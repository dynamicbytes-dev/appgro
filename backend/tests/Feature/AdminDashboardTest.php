<?php

namespace Tests\Feature;

use App\Models\Farm;
use App\Models\FarmModule;
use App\Models\Module;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_farm_creation_automatically_initializes_farm_modules(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Auto Init',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $moduleCount = Module::count();
        $farmModuleCount = FarmModule::where('farm_id', $farm->id)->count();

        $this->assertGreaterThan(0, $moduleCount);
        $this->assertEquals($moduleCount, $farmModuleCount);
    }

    public function test_admin_dashboard_returns_modules_using_farm_id(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Admin Dashboard',
            'sector' => 'avicola',
            'is_active' => true,
        ]);

        $speciesMod = Module::where('code', 'species')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $speciesMod->id)
            ->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Test',
            'email' => 'admindash@farm.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email' => 'admindash@farm.com',
            'password' => 'password123',
        ]);
        $token = $loginRes->json('data.access_token');

        $res = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/admin/dashboard')
            ->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'data' => [
                    'farm' => ['id', 'code', 'name', 'sector'],
                    'farm_modules',
                    'modules',
                    'enabled_modules_count',
                ],
            ]);

        $modules = $res->json('data.modules');
        $this->assertNotEmpty($modules);

        $speciesInRes = collect($modules)->firstWhere('code', 'species');
        $this->assertNotNull($speciesInRes);
        $this->assertTrue($speciesInRes['is_enabled']);
    }

    public function test_get_farm_modules_returns_all_system_modules_with_default_false_when_pivot_is_empty(): void
    {
        $this->artisan('app:init-root');

        $rootLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'Miranda*30',
        ]);
        $rootToken = $rootLogin->json('data.access_token');

        $farm = Farm::create([
            'name' => 'Granja Sin Pivote Inicial',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        // Manually wipe pivot records for this farm to test fallback behavior
        FarmModule::where('farm_id', $farm->id)->delete();

        $res = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->getJson("/api/v1/farms/{$farm->id}/modules")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'status' => 'success',
            ]);

        $modules = $res->json('data.modules');
        $this->assertCount(Module::count(), $modules);

        foreach ($modules as $mod) {
            $this->assertIsBool($mod['is_enabled']);
            $this->assertFalse($mod['is_enabled'], "Module {$mod['code']} should be false by default.");
        }
    }

    public function test_admin_dashboard_subordinates_count_filters_strictly_by_authenticated_admin_farm(): void
    {
        $this->artisan('app:init-root');

        // Farm 1: Admin's farm
        $farm1 = Farm::create([
            'name' => 'Granja Principal Admin',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        // Farm 2: Another farm
        $farm2 = Farm::create([
            'name' => 'Granja Secundaria',
            'sector' => 'avicola',
            'is_active' => true,
        ]);

        // Admin belonging to Farm 1
        $admin = User::create([
            'farm_id' => $farm1->id,
            'name' => 'Admin Granja 1',
            'email' => 'admin_granja1@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        // 1 Subordinate in Farm 1
        User::create([
            'farm_id' => $farm1->id,
            'name' => 'Subordinado Granja 1',
            'email' => 'sub1@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        // 2 Subordinates in Farm 2 (should be ignored)
        User::create([
            'farm_id' => $farm2->id,
            'name' => 'Subordinado Granja 2 - A',
            'email' => 'sub2a@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        User::create([
            'farm_id' => $farm2->id,
            'name' => 'Subordinado Granja 2 - B',
            'email' => 'sub2b@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_granja1@test.com',
            'password' => 'password123',
        ]);
        $token = $loginRes->json('data.access_token');

        $res = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/admin/dashboard')
            ->assertStatus(200);

        // Strict validation: Must equal exactly 1 (only Farm 1 subordinate)
        $this->assertEquals(1, $res->json('subordinates_count'));
        $this->assertEquals(1, $res->json('data.subordinates_count'));
        $this->assertEquals(1, $res->json('total_subordinates'));
        $this->assertEquals(1, $res->json('data.total_subordinates'));
    }
}

