<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Barn;
use App\Models\Farm;
use App\Models\FarmModule;
use App\Models\Module;
use App\Models\Species;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class HistoryModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_activity_logs_table_exists_with_required_columns(): void
    {
        $this->artisan('app:init-root');

        $this->assertTrue(Schema::hasTable('activity_logs'));
        $this->assertTrue(Schema::hasColumns('activity_logs', [
            'id',
            'user_id',
            'farm_id',
            'module',
            'action',
            'description',
            'created_at',
            'updated_at',
        ]));
    }

    public function test_history_module_is_officially_registered_in_modules_table(): void
    {
        $this->artisan('app:init-root');

        $historyModule = Module::where('code', 'history')->first();

        $this->assertNotNull($historyModule);
        $this->assertEquals('Historial y Auditoría', $historyModule->name);
    }

    public function test_creating_updating_and_deleting_records_triggers_automatic_audit_log(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Auditoría Test',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Carlos Administrador',
            'email' => 'carlos_auditor@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        // Login as admin to simulate authenticated session
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email' => 'carlos_auditor@test.com',
            'password' => 'password123',
        ]);
        $token = $loginRes->json('data.access_token');

        // Enable species module for farm
        $speciesMod = Module::where('code', 'species')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $speciesMod->id)
            ->update(['is_enabled' => true]);

        // 1. Create a species via API
        $createRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/species', [
                'name' => 'cerdo',
                'category' => 'Porcino',
            ])
            ->assertStatus(201);

        $speciesId = $createRes->json('data.id');

        $createLog = ActivityLog::where('module', 'Especies')
            ->where('action', 'CREAR')
            ->where('farm_id', $farm->id)
            ->first();

        $this->assertNotNull($createLog);
        $this->assertEquals($admin->id, $createLog->user_id);
        $this->assertStringContainsString('Cerdo', $createLog->description);

        // 2. Delete the species via API
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson("/api/v1/species/{$speciesId}")
            ->assertStatus(200);

        $deleteLog = ActivityLog::where('module', 'Especies')
            ->where('action', 'ELIMINAR')
            ->where('farm_id', $farm->id)
            ->first();

        $this->assertNotNull($deleteLog);
        $this->assertEquals($admin->id, $deleteLog->user_id);
        $this->assertStringContainsString('Cerdo', $deleteLog->description);
    }

    public function test_admin_cannot_access_history_if_module_is_disabled_for_farm(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Sin Historial',
            'sector' => 'avicola',
            'is_active' => true,
        ]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Sin Historial',
            'email' => 'admin_nohistory@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        // Ensure history module is disabled for this farm
        $historyMod = Module::where('code', 'history')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $historyMod->id)
            ->update(['is_enabled' => false]);

        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_nohistory@test.com',
            'password' => 'password123',
        ]);
        $token = $loginRes->json('data.access_token');

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/history')
            ->assertStatus(403)
            ->assertJson([
                'status' => 'error',
            ]);
    }

    public function test_admin_can_access_history_when_enabled_and_only_sees_own_farm(): void
    {
        $this->artisan('app:init-root');

        // Farm 1
        $farm1 = Farm::create([
            'name' => 'Granja Uno',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        // Farm 2
        $farm2 = Farm::create([
            'name' => 'Granja Dos',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $admin1 = User::create([
            'farm_id' => $farm1->id,
            'name' => 'Admin Granja 1',
            'email' => 'admin1@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $admin2 = User::create([
            'farm_id' => $farm2->id,
            'name' => 'Admin Granja 2',
            'email' => 'admin2@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        // Enable history for farm 1
        $historyMod = Module::where('code', 'history')->first();
        FarmModule::where('farm_id', $farm1->id)
            ->where('module_id', $historyMod->id)
            ->update(['is_enabled' => true]);

        // Create log entries for Farm 1 and Farm 2
        ActivityLog::create([
            'user_id' => $admin1->id,
            'farm_id' => $farm1->id,
            'module' => 'Galpones',
            'action' => 'CREAR',
            'description' => 'Galpón 1 creado en Granja Uno',
        ]);

        $logFarm2 = ActivityLog::create([
            'user_id' => $admin2->id,
            'farm_id' => $farm2->id,
            'module' => 'Galpones',
            'action' => 'CREAR',
            'description' => 'Galpón 2 creado en Granja Dos',
        ]);

        // Login as Admin 1
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin1@test.com',
            'password' => 'password123',
        ]);
        $token1 = $loginRes->json('data.access_token');

        // Request history
        $res = $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->getJson('/api/v1/history')
            ->assertStatus(200);

        $data = $res->json('data');
        $this->assertNotEmpty($data);

        // Every log returned must belong strictly to Farm 1
        foreach ($data as $item) {
            $this->assertEquals($farm1->id, $item['farm_id']);
            $this->assertNotEquals($farm2->id, $item['farm_id']);
        }

        // Attempting to see specific log belonging to Farm 2 returns 403 Forbidden
        $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->getJson("/api/v1/history/{$logFarm2->id}")
            ->assertStatus(403);
    }

    public function test_root_can_view_global_history_and_filter_by_farm(): void
    {
        $this->artisan('app:init-root');

        $farmA = Farm::create([
            'name' => 'Granja Alpha',
            'sector' => 'avicola',
            'is_active' => true,
        ]);

        $farmB = Farm::create([
            'name' => 'Granja Beta',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        ActivityLog::create([
            'user_id' => null,
            'farm_id' => $farmA->id,
            'module' => 'Especies',
            'action' => 'CREAR',
            'description' => 'Especie Gallinas creada en Alpha',
        ]);

        ActivityLog::create([
            'user_id' => null,
            'farm_id' => $farmB->id,
            'module' => 'Lotes',
            'action' => 'CREAR',
            'description' => 'Lote Porcino creado en Beta',
        ]);

        $rootLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'Miranda*30',
        ]);
        $rootToken = $rootLogin->json('data.access_token');

        // Root accesses global history endpoint
        $resGlobal = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->getJson('/api/v1/root/history')
            ->assertStatus(200);

        $this->assertGreaterThanOrEqual(2, count($resGlobal->json('data')));

        // Root filters specifically by Farm Alpha
        $resFiltered = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->getJson("/api/v1/root/history?farm_id={$farmA->id}")
            ->assertStatus(200);

        $filteredData = $resFiltered->json('data');
        $this->assertNotEmpty($filteredData);
        foreach ($filteredData as $item) {
            $this->assertEquals($farmA->id, $item['farm_id']);
        }
    }

    public function test_root_can_toggle_history_module_for_farm_and_persists_in_farm_modules(): void
    {
        $this->artisan('app:init-root');

        $rootLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'Miranda*30',
        ]);
        $rootToken = $rootLogin->json('data.access_token');

        $farm = Farm::create([
            'name' => 'Granja Prueba Modulo Historial',
            'sector' => 'ovino_caprino',
            'is_active' => true,
        ]);

        $historyMod = Module::where('code', 'history')->first();
        $this->assertNotNull($historyMod);

        // 1. Toggle via single module endpoint with code in URL
        $resUrl = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->putJson("/api/v1/root/farms/{$farm->id}/modules/history", [
                'is_enabled' => true,
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('farm_modules', [
            'farm_id' => $farm->id,
            'module_id' => $historyMod->id,
            'is_enabled' => true,
        ]);

        // 2. Toggle via single module payload using code in body
        $resBodyCode = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->putJson("/api/v1/root/farms/{$farm->id}/modules", [
                'code' => 'history',
                'is_enabled' => false,
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('farm_modules', [
            'farm_id' => $farm->id,
            'module_id' => $historyMod->id,
            'is_enabled' => false,
        ]);

        // 3. Toggle via batch payload using id / module_id
        $resBatch = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->putJson("/api/v1/root/farms/{$farm->id}/modules", [
                'modules' => [
                    ['id' => $historyMod->id, 'is_enabled' => true],
                ],
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('farm_modules', [
            'farm_id' => $farm->id,
            'module_id' => $historyMod->id,
            'is_enabled' => true,
        ]);
    }

    public function test_history_stats_returns_accurate_aggregated_counts_filtered_by_farm_id(): void
    {
        $this->artisan('app:init-root');

        $farm1 = Farm::create([
            'name' => 'Granja Historial Stats 1',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        $farm2 = Farm::create([
            'name' => 'Granja Historial Stats 2',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $admin1 = User::create([
            'farm_id' => $farm1->id,
            'name' => 'Admin Granja Historial 1',
            'email' => 'admin_hist_stats1@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $historyMod = Module::where('code', 'history')->first();
        FarmModule::where('farm_id', $farm1->id)
            ->where('module_id', $historyMod->id)
            ->update(['is_enabled' => true]);

        // Clear automatic creation logs from Farm and User creation to start with a known baseline
        ActivityLog::query()->delete();

        // Farm 1: 2 creations, 4 modifications, 1 deletion -> 7 total
        ActivityLog::create([
            'user_id' => $admin1->id,
            'farm_id' => $farm1->id,
            'module' => 'Especies',
            'action' => 'CREAR',
            'description' => 'Creada especie bovina',
        ]);
        ActivityLog::create([
            'user_id' => $admin1->id,
            'farm_id' => $farm1->id,
            'module' => 'Galpones',
            'action' => 'CREAR',
            'description' => 'Creado galpón 1',
        ]);
        ActivityLog::create([
            'user_id' => $admin1->id,
            'farm_id' => $farm1->id,
            'module' => 'Especies',
            'action' => 'ACTUALIZAR',
            'description' => 'Actualizada especie bovina',
        ]);
        ActivityLog::create([
            'user_id' => $admin1->id,
            'farm_id' => $farm1->id,
            'module' => 'Especies',
            'action' => 'INHABILITAR',
            'description' => 'Inhabilitada especie',
        ]);
        ActivityLog::create([
            'user_id' => $admin1->id,
            'farm_id' => $farm1->id,
            'module' => 'Especies',
            'action' => 'HABILITAR',
            'description' => 'Habilitada especie',
        ]);
        ActivityLog::create([
            'user_id' => $admin1->id,
            'farm_id' => $farm1->id,
            'module' => 'Galpones',
            'action' => 'UPDATE',
            'description' => 'Update galpon',
        ]);
        ActivityLog::create([
            'user_id' => $admin1->id,
            'farm_id' => $farm1->id,
            'module' => 'Lotes',
            'action' => 'ELIMINAR',
            'description' => 'Eliminado lote 1',
        ]);

        // Farm 2: 3 logs (must NOT be counted for Farm 1)
        ActivityLog::create([
            'user_id' => null,
            'farm_id' => $farm2->id,
            'module' => 'Especies',
            'action' => 'CREAR',
            'description' => 'Especie granja 2',
        ]);
        ActivityLog::create([
            'user_id' => null,
            'farm_id' => $farm2->id,
            'module' => 'Especies',
            'action' => 'ACTUALIZAR',
            'description' => 'Actualizar granja 2',
        ]);
        ActivityLog::create([
            'user_id' => null,
            'farm_id' => $farm2->id,
            'module' => 'Especies',
            'action' => 'ELIMINAR',
            'description' => 'Eliminar granja 2',
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_hist_stats1@test.com',
            'password' => 'password123',
        ]);
        $token = $login->json('data.access_token');

        // 1. GET /api/v1/history/stats
        $statsRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/history/stats')
            ->assertStatus(200);

        $statsRes->assertJson([
            'status' => 'success',
            'total_records' => 7,
            'creations' => 3,
            'modifications' => 2,
            'deletions' => 2,
            'data' => [
                'total_records' => 7,
                'creations' => 3,
                'modifications' => 2,
                'deletions' => 2,
                'farm_id' => $farm1->id,
            ],
        ]);

        // 2. GET /api/v1/history/summary alias
        $summaryRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/history/summary')
            ->assertStatus(200);

        $summaryRes->assertJson([
            'total_records' => 7,
            'creations' => 3,
            'modifications' => 2,
            'deletions' => 2,
        ]);

        // 3. GET /api/v1/admin/history/stats
        $adminStatsRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/admin/history/stats')
            ->assertStatus(200);

        $adminStatsRes->assertJson([
            'total_records' => 7,
            'creations' => 3,
            'modifications' => 2,
            'deletions' => 2,
        ]);

        // 4. Index also includes stats keys and never null
        $indexRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/history')
            ->assertStatus(200);

        $this->assertEquals(7, $indexRes->json('total_records'));
        $this->assertEquals(3, $indexRes->json('creations'));
        $this->assertEquals(2, $indexRes->json('modifications'));
        $this->assertEquals(2, $indexRes->json('deletions'));
        $this->assertNotNull($indexRes->json('stats'));
    }

    public function test_history_stats_returns_clean_zeros_when_no_records_exist(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Historial Vacia',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Vacio',
            'email' => 'admin_empty_hist@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $historyMod = Module::where('code', 'history')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $historyMod->id)
            ->update(['is_enabled' => true]);

        // Clear automatic creation logs from Farm and User creation
        ActivityLog::query()->delete();

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_empty_hist@test.com',
            'password' => 'password123',
        ]);
        $token = $login->json('data.access_token');

        $res = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/history/stats')
            ->assertStatus(200);

        $res->assertJson([
            'status' => 'success',
            'total_records' => 0,
            'creations' => 0,
            'modifications' => 0,
            'deletions' => 0,
        ]);

        $this->assertIsInt($res->json('total_records'));
        $this->assertIsInt($res->json('creations'));
        $this->assertIsInt($res->json('modifications'));
        $this->assertIsInt($res->json('deletions'));
    }

    public function test_history_isolation_and_kpis_strictly_filtered_by_role_and_farm(): void
    {
        $this->artisan('app:init-root');

        // Farm 1
        $farm1 = Farm::create([
            'name' => 'Granja Aislamiento 1',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        // Farm 2
        $farm2 = Farm::create([
            'name' => 'Granja Aislamiento 2',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $historyMod = Module::where('code', 'history')->first();
        FarmModule::whereIn('farm_id', [$farm1->id, $farm2->id])
            ->where('module_id', $historyMod->id)
            ->update(['is_enabled' => true]);

        // Admin of Farm 1
        $admin1 = User::create([
            'farm_id' => $farm1->id,
            'name' => 'Admin Granja 1',
            'email' => 'admin_aislado1@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        // Subordinate of Farm 1
        $subordinate1 = User::create([
            'farm_id' => $farm1->id,
            'name' => 'Encargado Granja 1',
            'email' => 'sub_aislado1@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        \Illuminate\Support\Facades\DB::table('subordinate_modules')->insert([
            'user_id' => $subordinate1->id,
            'module_id' => $historyMod->id,
            'is_enabled' => true,
        ]);

        // Clear automatic creation logs from setup
        ActivityLog::query()->delete();

        // Create 5 logs for Farm 1 (2 CREAR, 2 ACTUALIZAR, 1 ELIMINAR)
        ActivityLog::create(['user_id' => $admin1->id, 'farm_id' => $farm1->id, 'module' => 'Especies', 'action' => 'CREAR', 'description' => 'Log 1 F1']);
        ActivityLog::create(['user_id' => $admin1->id, 'farm_id' => $farm1->id, 'module' => 'Galpones', 'action' => 'CREAR', 'description' => 'Log 2 F1']);
        ActivityLog::create(['user_id' => $admin1->id, 'farm_id' => $farm1->id, 'module' => 'Especies', 'action' => 'ACTUALIZAR', 'description' => 'Log 3 F1']);
        ActivityLog::create(['user_id' => $admin1->id, 'farm_id' => $farm1->id, 'module' => 'Galpones', 'action' => 'ACTUALIZAR', 'description' => 'Log 4 F1']);
        ActivityLog::create(['user_id' => $admin1->id, 'farm_id' => $farm1->id, 'module' => 'Lotes', 'action' => 'ELIMINAR', 'description' => 'Log 5 F1']);

        // Create 3 logs for Farm 2 (1 CREAR, 1 ACTUALIZAR, 1 ELIMINAR)
        ActivityLog::create(['user_id' => null, 'farm_id' => $farm2->id, 'module' => 'Especies', 'action' => 'CREAR', 'description' => 'Log 1 F2']);
        ActivityLog::create(['user_id' => null, 'farm_id' => $farm2->id, 'module' => 'Especies', 'action' => 'ACTUALIZAR', 'description' => 'Log 2 F2']);
        ActivityLog::create(['user_id' => null, 'farm_id' => $farm2->id, 'module' => 'Especies', 'action' => 'ELIMINAR', 'description' => 'Log 3 F2']);

        // 1. ROOT USER: can see global logs (8) or filter by farm_id
        $rootLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'Miranda*30',
        ]);
        $rootToken = $rootLogin->json('data.access_token');

        // Root global index & stats
        $rootIndex = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->getJson('/api/v1/history')
            ->assertStatus(200);

        $this->assertEquals(8, $rootIndex->json('meta.total'));
        $this->assertEquals(8, $rootIndex->json('total_records'));

        $rootStats = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->getJson('/api/v1/history/stats')
            ->assertStatus(200);

        $this->assertEquals(8, $rootStats->json('total_records'));
        $this->assertEquals(3, $rootStats->json('creations'));
        $this->assertEquals(3, $rootStats->json('modifications'));
        $this->assertEquals(2, $rootStats->json('deletions'));

        // Root filtered by farm 1
        $rootF1Index = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->getJson("/api/v1/history?farm_id={$farm1->id}")
            ->assertStatus(200);

        $this->assertEquals(5, $rootF1Index->json('meta.total'));

        $rootF1Stats = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->getJson("/api/v1/history/stats?farm_id={$farm1->id}")
            ->assertStatus(200);

        $this->assertEquals(5, $rootF1Stats->json('total_records'));
        $this->assertEquals(2, $rootF1Stats->json('creations'));
        $this->assertEquals(2, $rootF1Stats->json('modifications'));
        $this->assertEquals(1, $rootF1Stats->json('deletions'));

        // 2. ADMIN USER (Farm 1): strictly limited to farm 1
        $adminLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_aislado1@test.com',
            'password' => 'password123',
        ]);
        $adminToken = $adminLogin->json('data.access_token');

        // Admin index
        $adminIndex = $this->withHeader('Authorization', 'Bearer ' . $adminToken)
            ->getJson("/api/v1/history?farm_id={$farm2->id}") // attempting to bypass via param
            ->assertStatus(200);

        $this->assertEquals(5, $adminIndex->json('meta.total'));
        $this->assertEquals(5, $adminIndex->json('total_records'));
        $this->assertEquals(2, $adminIndex->json('creations'));
        $this->assertEquals(2, $adminIndex->json('modifications'));
        $this->assertEquals(1, $adminIndex->json('deletions'));

        // Admin stats: match exactly table count
        $adminStats = $this->withHeader('Authorization', 'Bearer ' . $adminToken)
            ->getJson("/api/v1/history/stats?farm_id={$farm2->id}")
            ->assertStatus(200);

        $this->assertEquals(5, $adminStats->json('total_records'));
        $this->assertEquals(2, $adminStats->json('creations'));
        $this->assertEquals(2, $adminStats->json('modifications'));
        $this->assertEquals(1, $adminStats->json('deletions'));

        // 3. SUBORDINATE USER (Farm 1): strictly limited to farm 1
        $subLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'sub_aislado1@test.com',
            'password' => 'password123',
        ]);
        $subToken = $subLogin->json('data.access_token');

        // Subordinate index
        $subIndex = $this->withHeader('Authorization', 'Bearer ' . $subToken)
            ->getJson('/api/v1/history')
            ->assertStatus(200);

        $this->assertEquals(5, $subIndex->json('meta.total'));
        $this->assertEquals(5, $subIndex->json('total_records'));

        // Subordinate stats
        $subStats = $this->withHeader('Authorization', 'Bearer ' . $subToken)
            ->getJson('/api/v1/history/stats')
            ->assertStatus(200);

        $this->assertEquals(5, $subStats->json('total_records'));
        $this->assertEquals(2, $subStats->json('creations'));
        $this->assertEquals(2, $subStats->json('modifications'));
        $this->assertEquals(1, $subStats->json('deletions'));

        // Check activity-logs alias routes
        $aliasStats = $this->withHeader('Authorization', 'Bearer ' . $subToken)
            ->getJson('/api/v1/activity-logs/stats')
            ->assertStatus(200);

        $this->assertEquals(5, $aliasStats->json('total_records'));
    }

    public function test_admin_and_subordinate_never_see_root_movements_in_history(): void
    {
        $this->artisan('app:init-root');

        $root = User::where('role', 'root')->first();

        $farm = Farm::create([
            'name' => 'Granja Sin Root Logs',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        $historyMod = Module::where('code', 'history')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $historyMod->id)
            ->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Test Root Exclusion',
            'email' => 'admin_noroot@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        ActivityLog::query()->delete();

        // Movements generated by root (global, farm_id = null)
        ActivityLog::create([
            'user_id' => $root->id,
            'farm_id' => null,
            'module' => 'Farms',
            'action' => 'CREAR',
            'description' => 'Root creó granja global',
        ]);
        ActivityLog::create([
            'user_id' => $root->id,
            'farm_id' => null,
            'module' => 'Users',
            'action' => 'ACTUALIZAR',
            'description' => 'Root actualizó administrador',
        ]);

        // Movements belonging to the farm
        ActivityLog::create([
            'user_id' => $admin->id,
            'farm_id' => $farm->id,
            'module' => 'Galpones',
            'action' => 'CREAR',
            'description' => 'Galpón de la granja',
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_noroot@test.com',
            'password' => 'password123',
        ]);
        $token = $login->json('data.access_token');

        // Admin index on /api/v1/activity-logs
        $indexRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/activity-logs')
            ->assertStatus(200);

        $this->assertEquals(1, $indexRes->json('meta.total'));
        $this->assertEquals(1, $indexRes->json('total_records'));
        $items = $indexRes->json('data');
        $this->assertCount(1, $items);
        $this->assertEquals($farm->id, $items[0]['farm_id']);

        // Admin stats on /api/v1/activity-logs/stats
        $statsRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/activity-logs/stats')
            ->assertStatus(200);

        $this->assertEquals(1, $statsRes->json('total_records'));
        $this->assertEquals(1, $statsRes->json('creations'));
        $this->assertEquals(0, $statsRes->json('modifications'));
        $this->assertEquals(0, $statsRes->json('deletions'));
    }
}



