<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Farm;
use App\Models\FarmModule;
use App\Models\Galpon;
use App\Models\Lot;
use App\Models\Module;
use App\Models\Species;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class GalponesModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_galpones_table_has_all_required_columns(): void
    {
        $this->assertTrue(Schema::hasTable('galpones'), 'Table galpones must exist.');

        $expectedColumns = [
            'id',
            'farm_id',
            'species_id',
            'name',
            'category',
            'sector',
            'purpose',
            'max_capacity',
            'is_active',
            'created_at',
            'updated_at',
        ];

        foreach ($expectedColumns as $column) {
            $this->assertTrue(
                Schema::hasColumn('galpones', $column),
                "Column '{$column}' is missing from 'galpones' table."
            );
        }
    }

    public function test_galpones_module_is_officially_registered_in_modules_table(): void
    {
        $this->artisan('app:init-root');

        $module = Module::where('code', 'galpones')->first();
        $this->assertNotNull($module, "Module with code 'galpones' must be registered in modules table.");
        $this->assertEquals('Galpones', $module->name);
    }

    public function test_admin_cannot_access_galpones_if_module_is_disabled_for_farm(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Sin Galpones',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Granja Sin Modulo',
            'email' => 'admin_nomod_galpon@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        // Explicitly ensure both galpones and barns are disabled
        $galponModule = Module::where('code', 'galpones')->first();
        $barnModule = Module::where('code', 'barns')->first();
        FarmModule::where('farm_id', $farm->id)
            ->whereIn('module_id', array_filter([$galponModule?->id, $barnModule?->id]))
            ->update(['is_enabled' => false]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_nomod_galpon@test.com',
            'password' => 'password123',
        ]);
        $token = $login->json('data.access_token');

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/galpones');

        $response->assertStatus(403)
            ->assertJson([
                'status' => 'error',
            ]);
    }

    public function test_admin_can_create_galpon_with_active_species_inheriting_sector(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Con Galpones',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        $galponMod = Module::where('code', 'galpones')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $galponMod->id)
            ->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Galpones',
            'email' => 'admin_galpones@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        // Create an active species for this farm
        $species = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Bovino Angus',
            'category' => 'bovina',
            'is_active' => true,
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_galpones@test.com',
            'password' => 'password123',
        ]);
        $token = $login->json('data.access_token');

        $createRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/galpones', [
                'name' => 'Galpón 1 - Engorde Intensivo',
                'species_id' => $species->id,
                'purpose' => 'carne',
                'max_capacity' => 120,
                'is_active' => true,
            ])
            ->assertStatus(201);

        $createRes->assertJson([
            'status' => 'success',
            'data' => [
                'name' => 'Galpón 1 - Engorde Intensivo',
                'species_id' => $species->id,
                'farm_id' => $farm->id,
                'purpose' => 'carne',
                'category' => 'bovina',
                'sector' => 'bovina',
                'max_capacity' => 120,
                'is_active' => true,
            ],
        ]);

        $galponId = $createRes->json('data.id');
        $this->assertDatabaseHas('galpones', [
            'id' => $galponId,
            'name' => 'Galpón 1 - Engorde Intensivo',
            'farm_id' => $farm->id,
            'species_id' => $species->id,
            'sector' => 'bovina',
            'max_capacity' => 120,
        ]);

        // Audit log was automatically created
        $auditLog = ActivityLog::where('module', 'Galpones')
            ->where('action', 'CREAR')
            ->where('farm_id', $farm->id)
            ->first();
        $this->assertNotNull($auditLog);

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/galpones', [
                'name' => 'Galpón con propósito inválido',
                'species_id' => $species->id,
                'purpose' => 'huevos',
                'max_capacity' => 50,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['purpose']);

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->patchJson('/api/v1/galpones/' . $galponId, [
                'purpose' => 'huevos',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['purpose']);
    }

    public function test_validates_species_id_must_belong_to_same_farm(): void
    {
        $this->artisan('app:init-root');

        $farm1 = Farm::create(['name' => 'Granja Local', 'sector' => 'bovino', 'is_active' => true]);
        $farm2 = Farm::create(['name' => 'Granja Ajena', 'sector' => 'porcino', 'is_active' => true]);

        $galponMod = Module::where('code', 'galpones')->first();
        FarmModule::where('farm_id', $farm1->id)->where('module_id', $galponMod->id)->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm1->id,
            'name' => 'Admin Granja 1',
            'email' => 'admin_cross_farm@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        // Species belongs to Farm 2
        $speciesFarm2 = Species::create([
            'farm_id' => $farm2->id,
            'name' => 'Cerdos Pietrain',
            'category' => 'porcina',
            'is_active' => true,
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_cross_farm@test.com',
            'password' => 'password123',
        ]);
        $token = $login->json('data.access_token');

        $res = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/galpones', [
                'name' => 'Galpón Con Especie Ajena',
                'species_id' => $speciesFarm2->id,
                'purpose' => 'Engorde',
                'max_capacity' => 50,
            ])
            ->assertStatus(422);

        $res->assertJsonFragment([
            'message' => 'La especie seleccionada no pertenece a esta granja.',
        ]);
    }

    public function test_validates_species_id_must_be_active(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create(['name' => 'Granja Inactiva Species', 'sector' => 'bovino', 'is_active' => true]);
        $galponMod = Module::where('code', 'galpones')->first();
        FarmModule::where('farm_id', $farm->id)->where('module_id', $galponMod->id)->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Inactiva Species',
            'email' => 'admin_inactiva_sp@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        // Species is inactive
        $inactiveSpecies = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Especie Inactiva',
            'category' => 'bovina',
            'is_active' => false,
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_inactiva_sp@test.com',
            'password' => 'password123',
        ]);
        $token = $login->json('data.access_token');

        $res = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/galpones', [
                'name' => 'Galpón Inactivo',
                'species_id' => $inactiveSpecies->id,
                'purpose' => 'Reproducción',
                'max_capacity' => 80,
            ])
            ->assertStatus(422);

        $res->assertJsonFragment([
            'message' => 'La especie seleccionada se encuentra inactiva.',
        ]);
    }

    public function test_galpon_multi_farm_isolation_on_index_and_boundary_checks(): void
    {
        $this->artisan('app:init-root');

        $farm1 = Farm::create(['name' => 'Granja Aislada 1', 'sector' => 'bovino', 'is_active' => true]);
        $farm2 = Farm::create(['name' => 'Granja Aislada 2', 'sector' => 'porcino', 'is_active' => true]);

        $galponMod = Module::where('code', 'galpones')->first();
        FarmModule::whereIn('farm_id', [$farm1->id, $farm2->id])
            ->where('module_id', $galponMod->id)
            ->update(['is_enabled' => true]);

        $admin1 = User::create([
            'farm_id' => $farm1->id,
            'name' => 'Admin 1',
            'email' => 'admin1_iso_galpon@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $sp1 = Species::create(['farm_id' => $farm1->id, 'name' => 'Bovino 1', 'category' => 'bovina', 'is_active' => true]);
        $sp2 = Species::create(['farm_id' => $farm2->id, 'name' => 'Porcino 2', 'category' => 'porcina', 'is_active' => true]);

        $g1 = Galpon::create([
            'farm_id' => $farm1->id,
            'species_id' => $sp1->id,
            'name' => 'Galpón Granja 1',
            'category' => 'bovina',
            'sector' => 'bovina',
            'purpose' => 'Engorde',
            'max_capacity' => 100,
            'is_active' => true,
        ]);

        $g2 = Galpon::create([
            'farm_id' => $farm2->id,
            'species_id' => $sp2->id,
            'name' => 'Galpón Granja 2',
            'category' => 'porcina',
            'sector' => 'porcina',
            'purpose' => 'Cría',
            'max_capacity' => 200,
            'is_active' => true,
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin1_iso_galpon@test.com',
            'password' => 'password123',
        ]);
        $token = $login->json('data.access_token');

        // 1. Index only returns farm 1 galpones
        $indexRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/galpones')
            ->assertStatus(200);

        $data = $indexRes->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals($g1->id, $data[0]['id']);

        // 2. Cannot view farm 2 galpon -> 403 Forbidden
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson("/api/v1/galpones/{$g2->id}")
            ->assertStatus(403);

        // 3. Cannot update farm 2 galpon -> 403 Forbidden
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->putJson("/api/v1/galpones/{$g2->id}", ['name' => 'Hack Name'])
            ->assertStatus(403);

        // 4. Cannot delete farm 2 galpon -> 403 Forbidden
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson("/api/v1/galpones/{$g2->id}")
            ->assertStatus(403);
    }

    public function test_root_can_manage_galpones_globally_and_filter_by_farm(): void
    {
        $this->artisan('app:init-root');

        $farm1 = Farm::create(['name' => 'Granja Root 1', 'sector' => 'bovino', 'is_active' => true]);
        $farm2 = Farm::create(['name' => 'Granja Root 2', 'sector' => 'porcino', 'is_active' => true]);

        $sp1 = Species::create(['farm_id' => $farm1->id, 'name' => 'Bovino Root 1', 'category' => 'bovina', 'is_active' => true]);
        $sp2 = Species::create(['farm_id' => $farm2->id, 'name' => 'Porcino Root 2', 'category' => 'porcina', 'is_active' => true]);

        Galpon::create(['farm_id' => $farm1->id, 'species_id' => $sp1->id, 'name' => 'G1', 'purpose' => 'Engorde', 'max_capacity' => 50, 'is_active' => true]);
        Galpon::create(['farm_id' => $farm2->id, 'species_id' => $sp2->id, 'name' => 'G2', 'purpose' => 'Cría', 'max_capacity' => 150, 'is_active' => true]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'Miranda*30',
        ]);
        $token = $login->json('data.access_token');

        // Global list sees 2 galpones
        $resGlobal = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/galpones')
            ->assertStatus(200);

        $this->assertCount(2, $resGlobal->json('data'));

        // Filter by farm 1
        $resF1 = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson("/api/v1/galpones?farm_id={$farm1->id}")
            ->assertStatus(200);

        $this->assertCount(1, $resF1->json('data'));
        $this->assertEquals($farm1->id, $resF1->json('data.0.farm_id'));
    }

    public function test_galpon_stats_endpoint_returns_accurate_kpis(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create(['name' => 'Granja KPIs Galpon', 'sector' => 'bovino', 'is_active' => true]);
        $galponMod = Module::where('code', 'galpones')->first();
        FarmModule::where('farm_id', $farm->id)->where('module_id', $galponMod->id)->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin KPIs',
            'email' => 'admin_kpi_galpon@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $sp = Species::create(['farm_id' => $farm->id, 'name' => 'Bovino KPI', 'category' => 'bovina', 'is_active' => true]);

        Galpon::create(['farm_id' => $farm->id, 'species_id' => $sp->id, 'name' => 'G Activo 1', 'purpose' => 'Engorde', 'max_capacity' => 100, 'is_active' => true]);
        Galpon::create(['farm_id' => $farm->id, 'species_id' => $sp->id, 'name' => 'G Activo 2', 'purpose' => 'Reproducción', 'max_capacity' => 80, 'is_active' => true]);
        Galpon::create(['farm_id' => $farm->id, 'species_id' => $sp->id, 'name' => 'G Inactivo', 'purpose' => 'Engorde', 'max_capacity' => 40, 'is_active' => false]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_kpi_galpon@test.com',
            'password' => 'password123',
        ]);
        $token = $login->json('data.access_token');

        $res = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/galpones/stats')
            ->assertStatus(200);

        $res->assertJson([
            'status' => 'success',
            'total_galpones' => 3,
            'active_galpones' => 2,
            'inactive_galpones' => 1,
            'total_capacity' => 220,
            'purposes_count' => 2,
            'species_count' => 1,
        ]);
    }

    public function test_toggle_status_enables_and_disables_galpon_with_audit_trail(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create(['name' => 'Granja Toggle Galpon', 'sector' => 'bovino', 'is_active' => true]);
        $galponMod = Module::where('code', 'galpones')->first();
        FarmModule::where('farm_id', $farm->id)->where('module_id', $galponMod->id)->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Toggle',
            'email' => 'admin_toggle_galpon@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $sp = Species::create(['farm_id' => $farm->id, 'name' => 'Bovino Toggle', 'category' => 'bovina', 'is_active' => true]);

        $galpon = Galpon::create([
            'farm_id' => $farm->id,
            'species_id' => $sp->id,
            'name' => 'G Toggleable',
            'purpose' => 'Engorde',
            'max_capacity' => 100,
            'is_active' => true,
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_toggle_galpon@test.com',
            'password' => 'password123',
        ]);
        $token = $login->json('data.access_token');

        // Toggle to false
        $res = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->patchJson("/api/v1/galpones/{$galpon->id}/toggle-status")
            ->assertStatus(200);

        $this->assertFalse($res->json('data.is_active'));
        $this->assertDatabaseHas('galpones', ['id' => $galpon->id, 'is_active' => false]);

        // Toggle back to true
        $res2 = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->patchJson("/api/v1/galpones/{$galpon->id}/toggle-status")
            ->assertStatus(200);

        $this->assertTrue($res2->json('data.is_active'));
        $this->assertDatabaseHas('galpones', ['id' => $galpon->id, 'is_active' => true]);
    }

    public function test_filter_with_all_does_not_cause_sql_type_error_for_root_and_admin(): void
    {
        $this->artisan('app:init-root');

        $farmA = Farm::create(['name' => 'Granja Alfa', 'sector' => 'bovino', 'is_active' => true]);
        $farmB = Farm::create(['name' => 'Granja Beta', 'sector' => 'porcino', 'is_active' => true]);

        $spA = Species::create(['farm_id' => $farmA->id, 'name' => 'Vaca A', 'category' => 'bovina', 'is_active' => true]);
        $spB = Species::create(['farm_id' => $farmB->id, 'name' => 'Cerdo B', 'category' => 'porcina', 'is_active' => true]);

        $galponA = Galpon::create([
            'farm_id' => $farmA->id,
            'species_id' => $spA->id,
            'name' => 'Galpón Alfa',
            'purpose' => 'Engorde',
            'max_capacity' => 100,
            'is_active' => true,
        ]);

        $galponB = Galpon::create([
            'farm_id' => $farmB->id,
            'species_id' => $spB->id,
            'name' => 'Galpón Beta',
            'purpose' => 'Reproducción',
            'max_capacity' => 200,
            'is_active' => true,
        ]);

        // Enable module for farmA
        $galponMod = Module::where('code', 'galpones')->first();
        FarmModule::where('farm_id', $farmA->id)->where('module_id', $galponMod->id)->update(['is_enabled' => true]);

        $adminA = User::create([
            'farm_id' => $farmA->id,
            'name' => 'Admin Alfa',
            'email' => 'admin_alfa_all@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        // Root user login
        $rootLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'Miranda*30',
        ]);
        $rootToken = $rootLogin->json('data.access_token');

        // Root requests with farm_id=all
        $resRootAll = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->getJson('/api/v1/galpones?farm_id=all')
            ->assertStatus(200);

        $this->assertCount(2, $resRootAll->json('data'));

        // Root stats with farm_id=all
        $resRootStats = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->getJson('/api/v1/galpones/stats?farm_id=all')
            ->assertStatus(200);
        $this->assertEquals(2, $resRootStats->json('total_galpones'));

        // Admin login
        $adminLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_alfa_all@test.com',
            'password' => 'password123',
        ]);
        $adminToken = $adminLogin->json('data.access_token');

        // Admin requests with farm_id=all - must be safely scoped to farmA only
        $resAdminAll = $this->withHeader('Authorization', 'Bearer ' . $adminToken)
            ->getJson('/api/v1/galpones?farm_id=all')
            ->assertStatus(200);

        $this->assertCount(1, $resAdminAll->json('data'));
        $this->assertEquals('Galpón Alfa', $resAdminAll->json('data.0.name'));

        // Admin stats with farm_id=all
        $resAdminStats = $this->withHeader('Authorization', 'Bearer ' . $adminToken)
            ->getJson('/api/v1/galpones/stats?farm_id=all')
            ->assertStatus(200);
        $this->assertEquals(1, $resAdminStats->json('total_galpones'));
    }

    public function test_cannot_delete_galpon_with_associated_operational_lots(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Galpón con Lotes',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        $galponMod = Module::where('code', 'galpones')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $galponMod->id)
            ->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Galpón con Lotes',
            'email' => 'admin_barn_lots@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_barn_lots@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        $sp = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Bovino Lotes',
            'category' => 'bovina',
            'is_active' => true,
        ]);

        $galpon = Galpon::create([
            'farm_id' => $farm->id,
            'species_id' => $sp->id,
            'name' => 'Galpón con Lotes',
            'category' => 'bovina',
            'sector' => 'bovina',
            'purpose' => 'carne',
            'max_capacity' => 100,
            'is_active' => true,
        ]);

        // Legacy barn row sharing the same ID: lots.barn_id is FK-constrained
        // to the barns table and Galpon::lots() maps onto barn_id
        DB::table('barns')->insert([
            'id' => $galpon->id,
            'farm_id' => $farm->id,
            'name' => $galpon->name,
            'created_at' => now(),
        ]);

        // Operational lot lodged in the barn
        Lot::create([
            'farm_id' => $farm->id,
            'barn_id' => $galpon->id,
            'name' => 'Lote 1 - Engorde',
        ]);

        $res = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson("/api/v1/galpones/{$galpon->id}");

        $res->assertStatus(422)
            ->assertJsonFragment([
                'status' => 'error',
                'message' => 'No se puede eliminar el galpón porque tiene lotes o registros operativos asociados.',
            ]);

        // Galpón and its lot remain intact
        $this->assertDatabaseHas('galpones', ['id' => $galpon->id]);
        $this->assertDatabaseHas('lots', ['barn_id' => $galpon->id]);
    }

    public function test_can_delete_galpon_without_operational_dependencies(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Galpón Libre',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        $galponMod = Module::where('code', 'galpones')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $galponMod->id)
            ->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Galpón Libre',
            'email' => 'admin_barn_free@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_barn_free@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        $sp = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Bovino Libre',
            'category' => 'bovina',
            'is_active' => true,
        ]);

        $galpon = Galpon::create([
            'farm_id' => $farm->id,
            'species_id' => $sp->id,
            'name' => 'Galpón Libre',
            'category' => 'bovina',
            'sector' => 'bovina',
            'purpose' => 'carne',
            'max_capacity' => 100,
            'is_active' => true,
        ]);

        $res = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson("/api/v1/galpones/{$galpon->id}");

        $res->assertStatus(200)
            ->assertJsonFragment([
                'status' => 'success',
                'message' => 'Galpón eliminado correctamente.',
            ]);

        $this->assertDatabaseMissing('galpones', ['id' => $galpon->id]);
    }
}
