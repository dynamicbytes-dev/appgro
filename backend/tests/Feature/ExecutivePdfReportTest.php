<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Farm;
use App\Models\Galpon;
use App\Models\InventoryItem;
use App\Models\InventoryLot;
use App\Models\Lot;
use App\Models\Module;
use App\Models\Species;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ExecutivePdfReportTest extends TestCase
{
    use RefreshDatabase;

    private function createFarmWithAdmin(string $name, string $email): array
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => $name,
            'sector' => 'mixto',
            'is_active' => true,
        ]);

        foreach (['analytics', 'lots', 'barns', 'inventory', 'activities', 'species'] as $code) {
            $module = Module::where('code', $code)->first();
            if ($module) {
                DB::table('farm_modules')->updateOrInsert(
                    ['farm_id' => $farm->id, 'module_id' => $module->id],
                    ['is_enabled' => true]
                );
            }
        }

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Carlos',
            'lastname' => 'Mendoza',
            'email' => $email,
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password123',
        ])->json('data.access_token');

        return [$farm, $admin, $token];
    }

    private function createRootUser(): array
    {
        $this->artisan('app:init-root');

        $root = User::create([
            'farm_id' => null,
            'name' => 'Super',
            'lastname' => 'Admin',
            'email' => 'root_pdf@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'root',
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'root_pdf@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        return [$root, $token];
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/reports/lotes/executive-kpis');
        $response->assertStatus(401);
    }

    public function test_invalid_module_returns_422(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja San José', 'admin_inv@test.com');

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/modulo_inexistente/executive-kpis');

        $response->assertStatus(422)
            ->assertJsonPath('status', 'error');
    }

    public function test_especies_module_report(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Avícola El Sol', 'admin_esp@test.com');

        Species::create([
            'farm_id' => $farm->id,
            'name' => 'Gallina',
            'category' => 'avícola',
            'is_active' => true,
        ]);

        Species::create([
            'farm_id' => $farm->id,
            'name' => 'Cerdo',
            'category' => 'porcina',
            'is_active' => true,
        ]);

        Species::create([
            'farm_id' => $farm->id,
            'name' => 'Codorniz',
            'category' => 'avícola',
            'is_active' => false,
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/especies/executive-kpis');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('audit.system', 'Zootika - Sistema de Gestión Agropecuaria Integral')
            ->assertJsonPath('audit.farm_name', 'Granja Avícola El Sol')
            ->assertJsonPath('audit.generated_by', 'Carlos Mendoza (Administrador)')
            ->assertJsonCount(4, 'kpis');

        $kpis = collect($response->json('kpis'))->keyBy('label');
        $this->assertEquals('3', $kpis['Total Especies']['value']);
        $this->assertStringContainsString('2', $kpis['Especies Activas']['value']);
        $this->assertStringContainsString('1 Porcino / 2 Avícola', $kpis['Distribución Porcino vs. Avícola']['value']);
        $this->assertNotEmpty($kpis['Propósito Predominante']['value']);
        $this->assertNotEmpty($response->json('diagnosis'));
    }

    public function test_galpones_module_report_and_saturation_alert(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Porcina La Cima', 'admin_gal@test.com');

        $species = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Cerdo',
            'category' => 'porcina',
            'is_active' => true,
        ]);

        $galpon = Galpon::create([
            'farm_id' => $farm->id,
            'species_id' => $species->id,
            'name' => 'Galpón 1',
            'sector' => 'porcina',
            'purpose' => 'carne',
            'max_capacity' => 100,
            'is_active' => true,
        ]);

        // Crear lote con 95 animales (95% de ocupación -> > 90% alerta danger)
        Lot::create([
            'farm_id' => $farm->id,
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'code' => 'LOT-00001',
            'initial_quantity' => 95,
            'quantity' => 95,
            'current_occupancy' => 95,
            'status' => Lot::STATUS_ACTIVE,
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/galpones/executive-kpis');

        $response->assertStatus(200)
            ->assertJsonCount(4, 'kpis');

        $kpis = collect($response->json('kpis'))->keyBy('label');
        $this->assertEquals('1 galpones', $kpis['Galpones Activos']['value']);
        $this->assertEquals('100 plazas', $kpis['Capacidad Instalada']['value']);
        $this->assertEquals('95 animales', $kpis['Ocupación Actual']['value']);
        $this->assertEquals('95%', $kpis['% Ocupación Global']['value']);
        $this->assertEquals('danger', $kpis['% Ocupación Global']['status']);
        $this->assertStringContainsString('Alerta', $response->json('diagnosis'));
    }

    public function test_lotes_module_report_with_egg_production_and_harvest_cost(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Avícola Santa Clara', 'admin_lot@test.com');

        $species = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Gallina',
            'category' => 'avícola',
            'is_active' => true,
        ]);

        // Lote 1: Activo de postura con 500 animales y huevos
        Lot::create([
            'farm_id' => $farm->id,
            'species_id' => $species->id,
            'code' => 'LOT-00001',
            'initial_quantity' => 500,
            'quantity' => 500,
            'current_occupancy' => 500,
            'status' => Lot::STATUS_ACTIVE,
            'total_eggs' => 1000,
            'broken_eggs' => 50, // 50 / 1050 = 4.76%
            'egg_price' => 2.50,
            'total_egg_cost' => 2500.00, // 1000 buenos * 2.50
        ]);

        // Lote 2: Cerrado/cosechado con venta de 1500.00
        Lot::create([
            'farm_id' => $farm->id,
            'species_id' => $species->id,
            'code' => 'LOT-00002',
            'initial_quantity' => 200,
            'quantity' => 0,
            'current_occupancy' => 0,
            'status' => Lot::STATUS_INACTIVE,
            'total_price' => 1500.00,
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/lotes/executive-kpis');

        $response->assertStatus(200)
            ->assertJsonCount(4, 'kpis');

        $kpis = collect($response->json('kpis'))->keyBy('label');
        $this->assertEquals('1 Activos / 1 Cerrados', $kpis['Lotes Activos vs. Cerrados']['value']);
        $this->assertEquals('500 animales', $kpis['Población Viva Total']['value']);
        $this->assertEquals('1,050 uds', $kpis['Producción Total de Huevos']['value']);
        // Costo Total de Cosecha: 2500 (huevos buenos) + 1500 (animales) = 4000.00
        $this->assertEquals('$ 4,000.00', $kpis['Costo Total de Cosecha']['value']);
        $this->assertStringContainsString('4,000.00', $response->json('diagnosis'));
    }

    public function test_inventario_module_report_with_stock_alert(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja El Trébol', 'admin_inv_test@test.com');

        $item1 = InventoryItem::create([
            'farm_id' => $farm->id,
            'code' => 'INS-001',
            'name' => 'Alimento Iniciador',
            'category' => 'alimento',
            'unit' => 'kg',
            'current_stock' => 10,
            'min_stock' => 50, // Crítico!
            'unit_cost' => 1.50,
            'total_cost' => 15.00,
        ]);

        $item2 = InventoryItem::create([
            'farm_id' => $farm->id,
            'code' => 'INS-002',
            'name' => 'Vacuna Triple',
            'category' => 'medicamento',
            'unit' => 'dosis',
            'current_stock' => 200,
            'min_stock' => 50,
            'unit_cost' => 5.00,
            'total_cost' => 1000.00,
        ]);

        InventoryLot::create([
            'farm_id' => $farm->id,
            'inventory_item_id' => $item1->id,
            'code' => 'LOT-INS-01',
            'initial_quantity' => 100,
            'current_quantity' => 10,
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/inventario/executive-kpis');

        $response->assertStatus(200)
            ->assertJsonCount(4, 'kpis');

        $kpis = collect($response->json('kpis'))->keyBy('label');
        $this->assertEquals('2 insumos', $kpis['Insumos Catalogados']['value']);
        $this->assertEquals('$ 1,015.00', $kpis['Valoración Total del Stock']['value']);
        $this->assertEquals('1 insumos', $kpis['Insumos en Stock Crítico']['value']);
        $this->assertEquals('danger', $kpis['Insumos en Stock Crítico']['status']);
        $this->assertEquals('1 lotes', $kpis['Lotes de Insumos Registrados']['value']);
        $this->assertStringContainsString('Alerta de inventario', $response->json('diagnosis'));
    }

    public function test_actividades_module_report_with_efficiency(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja La Pradera', 'admin_act@test.com');

        Activity::create([
            'farm_id' => $farm->id,
            'created_by' => $admin->id,
            'assigned_to' => $admin->id,
            'title' => 'Limpieza de comederos',
            'due_date' => now()->toDateString(),
            'status' => Activity::STATUS_COMPLETED,
        ]);

        Activity::create([
            'farm_id' => $farm->id,
            'created_by' => $admin->id,
            'assigned_to' => $admin->id,
            'title' => 'Vacunación lote 1',
            'due_date' => now()->toDateString(),
            'status' => Activity::STATUS_COMPLETED,
        ]);

        Activity::create([
            'farm_id' => $farm->id,
            'created_by' => $admin->id,
            'assigned_to' => $admin->id,
            'title' => 'Revisión de bebederos',
            'due_date' => now()->toDateString(),
            'status' => Activity::STATUS_IN_PROGRESS,
        ]);

        Activity::create([
            'farm_id' => $farm->id,
            'created_by' => $admin->id,
            'assigned_to' => $admin->id,
            'title' => 'Desinfección galpón 2',
            'due_date' => now()->toDateString(),
            'status' => Activity::STATUS_PENDING,
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/actividades/executive-kpis');

        $response->assertStatus(200)
            ->assertJsonCount(4, 'kpis');

        $kpis = collect($response->json('kpis'))->keyBy('label');
        $this->assertEquals('4 tareas', $kpis['Total Actividades']['value']);
        $this->assertEquals('1 en curso', $kpis['Actividades En Proceso']['value']);
        $this->assertEquals('2 concluidas', $kpis['Actividades Terminadas']['value']);
        $this->assertEquals('50%', $kpis['% Eficiencia de Cumplimiento']['value']);
        $this->assertNotEmpty($response->json('diagnosis'));
    }

    public function test_analitica_module_report(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Analítica Central', 'admin_ana@test.com');

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/analitica/executive-kpis');

        $response->assertStatus(200)
            ->assertJsonCount(4, 'kpis');

        $kpis = collect($response->json('kpis'))->keyBy('label');
        $this->assertArrayHasKey('Costo Total Cosecha Global', $kpis);
        $this->assertArrayHasKey('% Ocupación Infraestructura', $kpis);
        $this->assertArrayHasKey('% Eficiencia de Postura', $kpis);
        $this->assertArrayHasKey('% Productividad del Personal', $kpis);
        $this->assertNotEmpty($response->json('diagnosis'));
    }

    public function test_multi_farm_isolation_and_root_access(): void
    {
        [$farm1, $admin1, $token1] = $this->createFarmWithAdmin('Granja Alfa', 'admin_alfa@test.com');
        [$farm2, $admin2, $token2] = $this->createFarmWithAdmin('Granja Beta', 'admin_beta@test.com');
        [$root, $rootToken] = $this->createRootUser();

        Species::create([
            'farm_id' => $farm1->id,
            'name' => 'Cerdo',
            'category' => 'porcina',
            'is_active' => true,
        ]);

        Species::create([
            'farm_id' => $farm2->id,
            'name' => 'Gallina',
            'category' => 'avícola',
            'is_active' => true,
        ]);

        // Admin 1 ve solo su granja
        $res1 = $this->withHeader('Authorization', "Bearer {$token1}")
            ->getJson('/api/reports/especies/executive-kpis');
        $res1->assertStatus(200)
            ->assertJsonPath('audit.farm_name', 'Granja Alfa');
        $kpis1 = collect($res1->json('kpis'))->keyBy('label');
        $this->assertEquals('1', $kpis1['Total Especies']['value']);

        // Root ve consolidado global o puede filtrar por farm_id
        $resRootGlobal = $this->withHeader('Authorization', "Bearer {$rootToken}")
            ->getJson('/api/reports/especies/executive-kpis');
        $resRootGlobal->assertStatus(200)
            ->assertJsonPath('audit.farm_name', 'Consolidado Multigranja (Global)');
        $kpisRoot = collect($resRootGlobal->json('kpis'))->keyBy('label');
        $this->assertEquals('2', $kpisRoot['Total Especies']['value']);

        // Root filtrando por Granja Alfa
        $resRootFilter = $this->withHeader('Authorization', "Bearer {$rootToken}")
            ->getJson("/api/reports/especies/executive-kpis?farm_id={$farm1->id}");
        $resRootFilter->assertStatus(200)
            ->assertJsonPath('audit.farm_name', 'Granja Alfa');
        $kpisRootFilter = collect($resRootFilter->json('kpis'))->keyBy('label');
        $this->assertEquals('1', $kpisRootFilter['Total Especies']['value']);
    }

    public function test_english_and_v1_aliases_work_correctly(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Zootika Norte', 'admin_alias@test.com');

        foreach (['species', 'barns', 'lots', 'inventory', 'activities', 'analytics'] as $alias) {
            $response = $this->withHeader('Authorization', "Bearer {$token}")
                ->getJson("/api/v1/reports/{$alias}/executive-kpis");

            $response->assertStatus(200)
                ->assertJsonPath('status', 'success')
                ->assertJsonCount(4, 'kpis');
        }
    }
}
