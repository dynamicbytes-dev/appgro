<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\EggProduction;
use App\Models\Farm;
use App\Models\Galpon;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\Lot;
use App\Models\Module;
use App\Models\Species;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AnalyticsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Granja con los módulos indicados habilitados y un admin autenticado.
     *
     * @param  array<int, string>  $modules
     * @return array{0: Farm, 1: User, 2: string}
     */
    private function createFarmWithAdmin(string $name, string $email, array $modules = ['analytics', 'lots', 'barns', 'inventory', 'activities']): array
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => $name,
            'sector' => 'mixto',
            'is_active' => true,
        ]);

        foreach ($modules as $code) {
            $module = Module::where('code', $code)->first();
            $this->assertNotNull($module, "El módulo '{$code}' debe existir.");

            DB::table('farm_modules')->updateOrInsert(
                ['farm_id' => $farm->id, 'module_id' => $module->id],
                ['is_enabled' => true]
            );
        }

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Analítica',
            'email' => $email,
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        return [$farm, $admin, $this->loginToken($email)];
    }

    private function loginToken(string $email): string
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password123',
        ])->json('data.access_token');
    }

    private function createRoot(string $email = 'root_analytics@test.com'): string
    {
        $this->artisan('app:init-root');

        User::create([
            'farm_id' => null,
            'name' => 'Root Analítica',
            'email' => $email,
            'password_hash' => Hash::make('password123'),
            'role' => 'root',
            'is_active' => true,
        ]);

        return $this->loginToken($email);
    }

    private function createSpecies(Farm $farm, string $category = 'porcina'): Species
    {
        return Species::create([
            'farm_id' => $farm->id,
            'name' => 'Especie '.$category,
            'category' => $category,
            'is_active' => true,
        ]);
    }

    private function createGalpon(Farm $farm, Species $species, array $attrs = []): Galpon
    {
        return Galpon::create(array_merge([
            'farm_id' => $farm->id,
            'species_id' => $species->id,
            'name' => 'Galpón Test',
            'category' => $species->category,
            'sector' => $species->category,
            'purpose' => 'engorde',
            'max_capacity' => 100,
            'is_active' => true,
        ], $attrs));
    }

    private function createLot(Farm $farm, Galpon $galpon, Species $species, array $attrs = []): Lot
    {
        return Lot::create(array_merge([
            'farm_id' => $farm->id,
            'galpon_id' => $galpon->id,
            'code' => Lot::generateCode(),
            'species_id' => $species->id,
            'sector' => $species->category,
            'purpose' => 'engorde',
            'quantity' => 40,
            'status' => Lot::STATUS_ACTIVE,
            'entry_date' => now()->toDateString(),
        ], $attrs));
    }

    private function makeItem(Farm $farm, array $attrs = []): InventoryItem
    {
        return InventoryItem::create(array_merge([
            'farm_id' => $farm->id,
            'code' => InventoryItem::generateCode($farm->id),
            'name' => 'Maíz molido',
            'category' => InventoryItem::CATEGORY_ALIMENTOS,
            'unit' => 'kg',
            'current_stock' => 100,
            'min_stock' => 5,
            'unit_cost' => 5,
            'total_cost' => 0,
        ], $attrs));
    }

    /* ================================================================= */
    /* Esquema                                                            */
    /* ================================================================= */

    public function test_analytics_schema_exists(): void
    {
        $this->assertTrue(Schema::hasTable('egg_productions'));
        $this->assertTrue(Schema::hasColumn('lots', 'investment_cost'));

        foreach ([
            'id', 'farm_id', 'lot_id', 'production_date', 'good_eggs',
            'broken_eggs', 'egg_price', 'good_cost', 'broken_cost', 'created_by',
        ] as $column) {
            $this->assertTrue(
                Schema::hasColumn('egg_productions', $column),
                "Falta '{$column}' en egg_productions."
            );
        }
    }

    /* ================================================================= */
    /* Resumen ejecutivo                                                  */
    /* ================================================================= */

    public function test_summary_returns_consolidated_kpis(): void
    {
        [$farm, , $token] = $this->createFarmWithAdmin('Granja KPIs', 'admin_kpis@test.com');
        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species);
        $this->createLot($farm, $galpon, $species, [
            'quantity' => 60,
            'investment_cost' => 1000,
            'total_eggs' => 60,
            'broken_eggs' => 20,
            'egg_price' => 1,
            'total_egg_cost' => 60,
            'total_broken_cost' => 20,
            'total_price' => 150,
        ]);

        $item = $this->makeItem($farm, ['unit_cost' => 5]);
        InventoryMovement::create([
            'farm_id' => $farm->id,
            'inventory_item_id' => $item->id,
            'type' => InventoryMovement::TYPE_EXIT,
            'quantity' => 10,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/analytics/summary')
            ->assertStatus(200)
            ->assertJson(['status' => 'success']);

        // Costo = inversión (1000) + insumos (10×5=50) + huevos buenos (60) + rotos (20) = 1130
        $this->assertEquals(1130.0, $response->json('data.total_cost'));
        // Cosecha global = valor de cosecha del lote = 150
        $this->assertEquals(150.0, $response->json('data.total_revenue'));
        $this->assertEquals(-980.0, $response->json('data.profit'));
        $this->assertEquals(80, $response->json('data.eggs_total'));
        $this->assertEquals(60, $response->json('data.eggs_good'));
        $this->assertEquals(20, $response->json('data.eggs_broken'));
        $this->assertEquals(25.0, $response->json('data.broken_percent'));
        // Ocupación = 60 / 100
        $this->assertEquals(60.0, $response->json('data.occupancy_percent'));
        $this->assertEquals(1, $response->json('data.lots_total'));
    }

    public function test_summary_requires_module_access(): void
    {
        [, , $token] = $this->createFarmWithAdmin('Granja Sin Módulo', 'admin_sin_modulo@test.com', ['lots']);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/analytics/summary')
            ->assertStatus(403);
    }

    public function test_summary_requires_authentication(): void
    {
        $this->getJson('/api/v1/analytics/summary')->assertStatus(401);
    }

    /* ================================================================= */
    /* Analítica financiera                                               */
    /* ================================================================= */

    public function test_financial_breakdown_by_sector_and_lot(): void
    {
        [$farm, , $token] = $this->createFarmWithAdmin('Granja Financiera', 'admin_fin@test.com');
        $porcina = $this->createSpecies($farm, 'porcina');
        $avicola = $this->createSpecies($farm, 'avícola');

        $galponCerdo = $this->createGalpon($farm, $porcina, ['name' => 'Galpón Cerdos', 'purpose' => 'engorde']);
        $galponAve = $this->createGalpon($farm, $avicola, ['name' => 'Galpón Aves', 'purpose' => 'postura', 'sector' => 'avícola']);

        // Lote porcino: inversión 2000, sin huevos, cosecha 2500.
        $this->createLot($farm, $galponCerdo, $porcina, [
            'investment_cost' => 2000,
            'total_price' => 2500,
        ]);

        // Lote avícola de postura: inversión 500, huevos 60/20, precio 1.
        $layer = $this->createLot($farm, $galponAve, $avicola, [
            'purpose' => 'postura',
            'quantity' => 50,
            'investment_cost' => 500,
            'total_eggs' => 60,
            'broken_eggs' => 20,
            'egg_price' => 1,
            'total_egg_cost' => 60,
            'total_broken_cost' => 20,
        ]);

        // Serie histórica de huevos.
        EggProduction::create([
            'farm_id' => $farm->id,
            'lot_id' => $layer->id,
            'production_date' => now()->subDays(2)->toDateString(),
            'good_eggs' => 40,
            'broken_eggs' => 10,
            'egg_price' => 1,
            'good_cost' => 40,
            'broken_cost' => 10,
        ]);
        EggProduction::create([
            'farm_id' => $farm->id,
            'lot_id' => $layer->id,
            'production_date' => now()->subDay()->toDateString(),
            'good_eggs' => 20,
            'broken_eggs' => 10,
            'egg_price' => 1,
            'good_cost' => 20,
            'broken_cost' => 10,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/analytics/financial')
            ->assertStatus(200)
            ->assertJson(['status' => 'success']);

        // Costos: inversión 2500, huevos 60, rotos 20 → total 2580.
        $this->assertEquals(2500.0, $response->json('data.costs.investment'));
        $this->assertEquals(60.0, $response->json('data.costs.eggs'));
        $this->assertEquals(20.0, $response->json('data.costs.eggs_broken'));
        $this->assertEquals(2580.0, $response->json('data.costs.total'));
        // Cosecha global: 2500 (porcino) + 0 (avícola sin total_price) = 2500.
        $this->assertEquals(2500.0, $response->json('data.revenue.total'));

        $sectors = collect($response->json('data.by_sector'))->keyBy('sector');
        $this->assertArrayHasKey('porcino', $sectors->all());
        $this->assertArrayHasKey('avicola', $sectors->all());
        $this->assertEquals(2000.0, $sectors['porcino']['cost']);
        $this->assertEquals(2500.0, $sectors['porcino']['revenue']);
        $this->assertEquals(580.0, $sectors['avicola']['cost']);
        $this->assertEquals(0.0, $sectors['avicola']['revenue']);

        // Serie temporal de mermas ordenada ascendentemente.
        $series = $response->json('data.eggs_series');
        $this->assertCount(2, $series);
        $this->assertEquals(40, $series[0]['good_eggs']);
        $this->assertEquals(10, $series[0]['broken_eggs']);
        $this->assertEquals(20, $series[1]['good_eggs']);
    }

    public function test_financial_excludes_revenue_of_other_farms(): void
    {
        [$farmA, , $tokenA] = $this->createFarmWithAdmin('Granja A', 'admin_a@test.com');
        [$farmB] = $this->createFarmWithAdmin('Granja B', 'admin_b@test.com');

        $speciesA = $this->createSpecies($farmA);
        $speciesB = $this->createSpecies($farmB);

        $this->createLot($farmA, $this->createGalpon($farmA, $speciesA), $speciesA, [
            'investment_cost' => 100,
            'total_price' => 300,
        ]);
        $this->createLot($farmB, $this->createGalpon($farmB, $speciesB), $speciesB, [
            'investment_cost' => 9999,
            'total_price' => 9999,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$tokenA)
            ->getJson('/api/v1/analytics/financial')
            ->assertStatus(200);

        // Solo el lote de la granja A.
        $this->assertEquals(100.0, $response->json('data.costs.investment'));
        $this->assertEquals(300.0, $response->json('data.revenue.total'));
    }

    public function test_eggs_series_keeps_the_most_recent_dates(): void
    {
        [$farm, , $token] = $this->createFarmWithAdmin('Granja Serie', 'admin_serie@test.com');
        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species);
        $lot = $this->createLot($farm, $galpon, $species, ['purpose' => 'postura']);

        // 181 fechas distintas: la más antigua (hace 180 días) debe quedar
        // fuera de la ventana de 180 fechas más recientes.
        $rows = [];
        for ($i = 180; $i >= 0; $i--) {
            $rows[] = [
                'farm_id' => $farm->id,
                'lot_id' => $lot->id,
                'production_date' => now()->subDays($i)->toDateString(),
                'good_eggs' => 1,
                'broken_eggs' => 0,
                'egg_price' => 1,
                'good_cost' => 1,
                'broken_cost' => 0,
                'created_by' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }
        EggProduction::insert($rows);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/analytics/financial')
            ->assertStatus(200);

        $series = $response->json('data.eggs_series');
        $dates = array_column($series, 'date');

        // Solo 180 puntos, ordenados ascendentemente y con los datos recientes.
        $this->assertCount(180, $series);
        $this->assertEquals(now()->subDays(179)->toDateString(), $series[0]['date']);
        $this->assertEquals(now()->toDateString(), $series[179]['date']);
        // La fecha más antigua fue descartada (no se quedan las más viejas).
        $this->assertNotContains(now()->subDays(180)->toDateString(), $dates);
    }

    /* ================================================================= */
    /* Analítica operativa                                                */
    /* ================================================================= */

    public function test_operations_reports_occupancy_and_inventory(): void
    {
        [$farm, , $token] = $this->createFarmWithAdmin('Granja Operativa', 'admin_ops@test.com');
        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['max_capacity' => 100]);

        $this->createLot($farm, $galpon, $species, ['quantity' => 30, 'purpose' => 'engorde']);
        $this->createLot($farm, $galpon, $species, ['quantity' => 20, 'purpose' => 'postura']);
        $this->createLot($farm, $galpon, $species, ['quantity' => 10, 'purpose' => 'reproducción', 'status' => Lot::STATUS_INACTIVE]);

        // Insumo en stock crítico.
        $this->makeItem($farm, ['name' => 'Alimento balanceado', 'current_stock' => 2, 'min_stock' => 10]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/analytics/operations')
            ->assertStatus(200)
            ->assertJson(['status' => 'success']);

        // Ocupación: solo lotes activos (30+20=50) sobre 100.
        $this->assertEquals(100, $response->json('data.capacity.capacity'));
        $this->assertEquals(50, $response->json('data.capacity.occupied'));
        $this->assertEquals(50.0, $response->json('data.capacity.percent'));
        $this->assertCount(1, $response->json('data.capacity.sheds'));
        $this->assertEquals(50, $response->json('data.capacity.sheds.0.occupied'));

        // 3 lotes: 2 activos + 1 inactivo.
        $this->assertEquals(3, $response->json('data.lots.total'));

        // Propósitos normalizados.
        $purposes = collect($response->json('data.lots.by_purpose'))->keyBy('purpose');
        $this->assertEquals(1, $purposes['carne']['count']);
        $this->assertEquals(1, $purposes['postura']['count']);
        $this->assertEquals(1, $purposes['reproduccion']['count']);

        // Inventario crítico disponible.
        $this->assertTrue($response->json('data.inventory.available'));
        $this->assertCount(1, $response->json('data.inventory.low_stock'));
        $this->assertEquals('Alimento balanceado', $response->json('data.inventory.low_stock.0.name'));
    }

    public function test_operations_hides_inventory_when_module_disabled(): void
    {
        [$farm, , $token] = $this->createFarmWithAdmin('Granja Sin Inventario', 'admin_noinv@test.com', ['analytics', 'lots', 'barns']);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/analytics/operations')
            ->assertStatus(200);

        $this->assertFalse($response->json('data.inventory.available'));
        $this->assertSame([], $response->json('data.inventory.low_stock'));
    }

    public function test_operations_occupancy_matches_sheds_and_allows_overcapacity(): void
    {
        [$farm, , $token] = $this->createFarmWithAdmin('Granja Ocupación', 'admin_occ@test.com');
        $species = $this->createSpecies($farm);

        $galponA = $this->createGalpon($farm, $species, ['name' => 'Galpón A', 'max_capacity' => 10]);
        $galponB = $this->createGalpon($farm, $species, ['name' => 'Galpón B', 'max_capacity' => 100]);

        // Galpón A: dos lotes que en conjunto superan su capacidad (8+7=15 > 10).
        $this->createLot($farm, $galponA, $species, ['quantity' => 8]);
        $this->createLot($farm, $galponA, $species, ['quantity' => 7]);
        // Galpón B: un lote dentro de cupo.
        $this->createLot($farm, $galponB, $species, ['quantity' => 25]);
        // Lote activo SIN galpón: no debe inflar el consolidado.
        $this->createLot($farm, $galponB, $species, ['quantity' => 40, 'galpon_id' => null]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/analytics/operations')
            ->assertStatus(200);

        $this->assertEquals(110, $response->json('data.capacity.capacity'));
        // Consolidado = 15 (A) + 25 (B); el lote sin galpón queda fuera.
        $this->assertEquals(40, $response->json('data.capacity.occupied'));

        $sheds = collect($response->json('data.capacity.sheds'))->keyBy('name');
        // Sobrecarga real conservada (no se recorta a la capacidad).
        $this->assertEquals(15, $sheds['Galpón A']['occupied']);
        $this->assertEquals(100.0, $sheds['Galpón A']['percent']);
        // El consolidado siempre coincide con la suma del detalle.
        $this->assertEquals(
            collect($response->json('data.capacity.sheds'))->sum('occupied'),
            $response->json('data.capacity.occupied')
        );
    }

    public function test_items_at_risk_is_consistent_between_summary_and_operations(): void
    {
        [$farm, , $token] = $this->createFarmWithAdmin('Granja Riesgo', 'admin_riesgo@test.com');

        // Cumple AMBAS condiciones (bajo stock + por vencer): debe contar una vez.
        $this->makeItem($farm, [
            'name' => 'Vacuna',
            'current_stock' => 1,
            'min_stock' => 10,
            'expiration_date' => now()->addDays(3)->toDateString(),
        ]);
        // Solo por vencer.
        $this->makeItem($farm, [
            'name' => 'Antibiótico',
            'current_stock' => 100,
            'min_stock' => 5,
            'expiration_date' => now()->addDays(5)->toDateString(),
        ]);

        $summary = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/analytics/summary')->assertStatus(200);
        $operations = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/analytics/operations')->assertStatus(200);

        // 2 insumos distintos en riesgo (sin duplicar el que cumple ambas).
        $this->assertEquals(2, $summary->json('data.items_at_risk'));
        $this->assertEquals(2, $operations->json('data.items_at_risk'));

        // Sumar ambas listas daría 3 (1 bajo stock + 2 por vencer): el bug previo.
        $this->assertEquals(
            3,
            count($operations->json('data.inventory.low_stock')) + count($operations->json('data.inventory.expiring'))
        );
    }

    /* ================================================================= */
    /* Personal                                                           */
    /* ================================================================= */

    public function test_staff_admin_sees_whole_team(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Personal', 'admin_staff@test.com');

        $workerA = User::create([
            'farm_id' => $farm->id,
            'name' => 'Trabajador',
            'lastname' => 'Uno',
            'email' => 'worker_uno@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);
        $workerB = User::create([
            'farm_id' => $farm->id,
            'name' => 'Trabajador',
            'lastname' => 'Dos',
            'email' => 'worker_dos@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        Activity::create([
            'farm_id' => $farm->id,
            'title' => 'Limpieza de galpón',
            'status' => Activity::STATUS_COMPLETED,
            'assigned_to' => $workerA->id,
            'created_by' => $admin->id,
            'due_date' => now()->subDays(3)->toDateString(),
            'completed_at' => now()->subDays(4),
        ]);
        Activity::create([
            'farm_id' => $farm->id,
            'title' => 'Alimentar cerdos',
            'status' => Activity::STATUS_PENDING,
            'assigned_to' => $workerA->id,
            'created_by' => $admin->id,
            'due_date' => now()->subDay()->toDateString(),
        ]);
        Activity::create([
            'farm_id' => $farm->id,
            'title' => 'Revisar bebederos',
            'status' => Activity::STATUS_IN_PROGRESS,
            'assigned_to' => $workerB->id,
            'created_by' => $admin->id,
            'due_date' => now()->addDays(2)->toDateString(),
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/analytics/staff')
            ->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $this->assertSame('farm', $response->json('data.scope'));
        $this->assertEquals(3, $response->json('data.summary.total'));
        $this->assertEquals(1, $response->json('data.summary.completed'));
        $this->assertEquals(1, $response->json('data.summary.in_progress'));
        $this->assertEquals(1, $response->json('data.summary.pending'));
        // La actividad pendiente venció ayer.
        $this->assertEquals(1, $response->json('data.summary.overdue'));

        $team = collect($response->json('data.team'))->keyBy('user_id');
        $this->assertArrayHasKey($workerA->id, $team->all());
        $this->assertArrayHasKey($workerB->id, $team->all());
        $this->assertEquals('Trabajador Uno', $team[$workerA->id]['name']);
        $this->assertEquals(2, $team[$workerA->id]['total']);
        $this->assertEquals(50.0, $team[$workerA->id]['completion_percent']);
        // Completada 1 día antes del vencimiento → -1.0
        $this->assertEquals(-1.0, $team[$workerA->id]['avg_days_vs_due']);
    }

    public function test_subordinate_only_sees_own_performance(): void
    {
        [$farm, $admin] = $this->createFarmWithAdmin('Granja Encargado', 'admin_enc@test.com');

        $activitiesModule = Module::where('code', 'activities')->first();
        $analyticsModule = Module::where('code', 'analytics')->first();

        $encargado = User::create([
            'farm_id' => $farm->id,
            'name' => 'Encargado',
            'lastname' => 'Propio',
            'email' => 'encargado_propio@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        foreach ([$activitiesModule, $analyticsModule] as $module) {
            DB::table('subordinate_modules')->updateOrInsert(
                ['user_id' => $encargado->id, 'module_id' => $module->id],
                ['is_enabled' => true]
            );
        }

        $otro = User::create([
            'farm_id' => $farm->id,
            'name' => 'Otro',
            'lastname' => 'Trabajador',
            'email' => 'otro_trabajador@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        Activity::create([
            'farm_id' => $farm->id,
            'title' => 'Propia completada',
            'status' => Activity::STATUS_COMPLETED,
            'assigned_to' => $encargado->id,
            'created_by' => $admin->id,
            'due_date' => now()->toDateString(),
            'completed_at' => now(),
        ]);
        Activity::create([
            'farm_id' => $farm->id,
            'title' => 'Pendiente de otro',
            'status' => Activity::STATUS_PENDING,
            'assigned_to' => $otro->id,
            'created_by' => $admin->id,
            'due_date' => now()->addDay()->toDateString(),
        ]);

        $token = $this->loginToken('encargado_propio@test.com');

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/analytics/staff')
            ->assertStatus(200);

        $this->assertSame('self', $response->json('data.scope'));
        $this->assertEquals(1, $response->json('data.summary.total'));
        $this->assertCount(1, $response->json('data.team'));
        $this->assertEquals($encargado->id, $response->json('data.team.0.user_id'));
    }

    /* ================================================================= */
    /* Alcance root y filtro por granja                                   */
    /* ================================================================= */

    public function test_root_sees_all_farms_and_can_filter(): void
    {
        [$farmA] = $this->createFarmWithAdmin('Granja Root A', 'admin_root_a@test.com');
        [$farmB] = $this->createFarmWithAdmin('Granja Root B', 'admin_root_b@test.com');

        $speciesA = $this->createSpecies($farmA);
        $speciesB = $this->createSpecies($farmB);

        $this->createLot($farmA, $this->createGalpon($farmA, $speciesA), $speciesA, [
            'investment_cost' => 100,
        ]);
        $this->createLot($farmB, $this->createGalpon($farmB, $speciesB), $speciesB, [
            'investment_cost' => 200,
        ]);

        $root = $this->createRoot();

        $all = $this->withHeader('Authorization', 'Bearer '.$root)
            ->getJson('/api/v1/analytics/summary')
            ->assertStatus(200);
        $this->assertEquals(300.0, $all->json('data.total_cost'));

        $filtered = $this->withHeader('Authorization', 'Bearer '.$root)
            ->getJson('/api/v1/analytics/summary?farm_id='.$farmB->id)
            ->assertStatus(200);
        $this->assertEquals(200.0, $filtered->json('data.total_cost'));
    }

    /* ================================================================= */
    /* Campo de inversión en lotes                                        */
    /* ================================================================= */

    public function test_lot_investment_cost_can_be_created_and_updated(): void
    {
        [$farm, , $token] = $this->createFarmWithAdmin('Granja Inversión', 'admin_inv@test.com');
        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species);

        $created = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 10,
                'purpose' => 'engorde',
                'investment_cost' => 1234.56,
            ])
            ->assertStatus(201);

        $lotId = $created->json('data.id');

        $this->assertDatabaseHas('lots', [
            'id' => $lotId,
            'investment_cost' => 1234.56,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/v1/lots/'.$lotId, ['investment_cost' => 2000.10])
            ->assertStatus(200);

        $this->assertDatabaseHas('lots', [
            'id' => $lotId,
            'investment_cost' => 2000.10,
        ]);

        // Un valor negativo es rechazado.
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/v1/lots/'.$lotId, ['investment_cost' => -5])
            ->assertStatus(422);
    }
}
