<?php

namespace Tests\Feature;

use App\Models\Farm;
use App\Models\Module;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SubordinateManagementTest extends TestCase
{
    use RefreshDatabase;

    private Farm $farm;
    private User $adminUser;
    private string $adminToken;
    private Module $speciesModule;
    private Module $analyticsModule;

    protected function setUp(): void
    {
        parent::setUp();

        $this->artisan('app:init-root');

        // Create Farm
        $this->farm = Farm::create([
            'name' => 'Granja Porcina Test',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        // Get modules
        $this->speciesModule = Module::where('code', 'species')->first();
        $this->analyticsModule = Module::where('code', 'analytics')->first();

        // Enable ONLY species module for this farm, disable analytics module
        DB::table('farm_modules')->updateOrInsert(
            ['farm_id' => $this->farm->id, 'module_id' => $this->speciesModule->id],
            ['is_enabled' => true]
        );
        DB::table('farm_modules')->updateOrInsert(
            ['farm_id' => $this->farm->id, 'module_id' => $this->analyticsModule->id],
            ['is_enabled' => false]
        );

        // Create Admin for Farm
        $this->adminUser = User::create([
            'farm_id' => $this->farm->id,
            'name' => 'Admin Granja',
            'email' => 'adminporcino@granja.com',
            'password_hash' => Hash::make('AdminPass123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email' => 'adminporcino@granja.com',
            'password' => 'AdminPass123',
        ]);
        $this->adminToken = $loginRes->json('data.access_token');
    }

    /**
     * 1. Test registering a subordinate without phone succeeds (phone is optional) and hashes password.
     */
    public function test_register_subordinate_with_optional_phone_and_hashed_password(): void
    {
        $res = $this->withHeader('Authorization', 'Bearer ' . $this->adminToken)
            ->postJson('/api/v1/subordinates', [
                'name' => 'Juan Encargado',
                'lastname' => 'Pérez',
                'email' => 'juan@porcino.com',
                'password' => 'Encargado123',
                // phone omitted -> optional
                'module_ids' => [$this->speciesModule->id],
            ]);

        $res->assertStatus(201)
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'name' => 'Juan Encargado',
                    'lastname' => 'Pérez',
                    'email' => 'juan@porcino.com',
                    'phone' => null,
                    'role' => 'subordinate',
                    'farm_id' => $this->farm->id,
                ]
            ]);

        // Verify subordinate can login with Encargado123
        $subLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'juan@porcino.com',
            'password' => 'Encargado123',
        ]);
        $subLogin->assertStatus(200);
    }

    /**
     * 2. Test strict hierarchy validation rejects modules not enabled for farm (422 Unprocessable Entity).
     */
    public function test_assigning_unauthorized_farm_module_to_subordinate_is_rejected(): void
    {
        // Attempting to assign analyticsModule (which is disabled for farm) -> 422
        $res = $this->withHeader('Authorization', 'Bearer ' . $this->adminToken)
            ->postJson('/api/v1/subordinates', [
                'name' => 'Pedro Encargado',
                'email' => 'pedro@porcino.com',
                'password' => 'Encargado123',
                'module_ids' => [$this->speciesModule->id, $this->analyticsModule->id],
            ]);

        $res->assertStatus(422)
            ->assertJsonStructure(['status', 'message', 'errors' => ['module_ids']]);

        $this->assertDatabaseMissing('users', [
            'email' => 'pedro@porcino.com',
        ]);
    }

    /**
     * 2b. Test updating subordinate with unauthorized farm module is rejected with 422.
     */
    public function test_updating_subordinate_with_unauthorized_module_is_rejected(): void
    {
        $sub = User::create([
            'farm_id' => $this->farm->id,
            'role' => 'subordinate',
            'name' => 'Subordinate Existing',
            'email' => 'subexisting@porcino.com',
            'password_hash' => Hash::make('Encargado123'),
            'is_active' => true,
        ]);

        // Attempting to update with analytics module (which is disabled for this farm in farm_modules)
        $res = $this->withHeader('Authorization', 'Bearer ' . $this->adminToken)
            ->putJson('/api/v1/subordinates/' . $sub->id, [
                'modules' => ['analytics'],
            ]);

        $res->assertStatus(422)
            ->assertJsonStructure(['status', 'message', 'errors'])
            ->assertJson([
                'status' => 'error',
            ]);

        // Attempting to update with authorized species module succeeds
        $resOk = $this->withHeader('Authorization', 'Bearer ' . $this->adminToken)
            ->putJson('/api/v1/subordinates/' . $sub->id, [
                'modules' => ['species'],
            ]);

        $resOk->assertStatus(200)
            ->assertJson([
                'status' => 'success',
            ]);

        $this->assertDatabaseHas('subordinate_modules', [
            'user_id' => $sub->id,
            'module_id' => $this->speciesModule->id,
            'is_enabled' => true,
        ]);
        $this->assertDatabaseHas('subordinate_modules', [
            'user_id' => $sub->id,
            'module_id' => $this->analyticsModule->id,
            'is_enabled' => false,
        ]);
    }

    /**
     * 3. Test GET /api/v1/admin/available-modules returns only farm modules with is_enabled = true.
     */
    public function test_admin_available_modules_returns_only_enabled_farm_modules(): void
    {
        $res = $this->withHeader('Authorization', 'Bearer ' . $this->adminToken)
            ->getJson('/api/v1/admin/available-modules');

        $res->assertStatus(200);

        $modules = $res->json('data');
        $codes = array_column($modules, 'code');

        $this->assertContains('species', $codes);
        $this->assertNotContains('analytics', $codes);
    }

    /**
     * 4. Test GET /api/v1/admin/subordinates filters strictly by authenticated admin's farm_id and with('modules').
     */
    public function test_admin_only_sees_subordinates_from_own_farm(): void
    {
        // 1. Create Subordinate for Farm A
        $subA = User::create([
            'farm_id' => $this->farm->id,
            'role' => 'subordinate',
            'name' => 'Encargado Granja A',
            'email' => 'subA@granja.com',
            'password_hash' => Hash::make('password123'),
            'is_active' => true,
        ]);

        // 2. Create another Farm (Farm B), Admin B, and Subordinate B
        $farmB = Farm::create([
            'name' => 'Granja B Bovina',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        $adminB = User::create([
            'farm_id' => $farmB->id,
            'name' => 'Admin Granja B',
            'email' => 'adminB@granja.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $subB = User::create([
            'farm_id' => $farmB->id,
            'role' => 'subordinate',
            'name' => 'Encargado Granja B',
            'email' => 'subB@granja.com',
            'password_hash' => Hash::make('password123'),
            'is_active' => true,
        ]);

        // Test Endpoint 1: GET /api/v1/admin/subordinates as Admin A
        $resA = $this->withHeader('Authorization', 'Bearer ' . $this->adminToken)
            ->getJson('/api/v1/admin/subordinates');

        $resA->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'data' => [
                    '*' => [
                        'id',
                        'name',
                        'email',
                        'farm_id',
                        'modules',
                    ]
                ]
            ]);

        $emailsA = array_column($resA->json('data'), 'email');
        $this->assertContains('subA@granja.com', $emailsA);
        $this->assertNotContains('subB@granja.com', $emailsA);

        // Test Endpoint 2: GET /api/v1/subordinates as Admin A
        $resA2 = $this->withHeader('Authorization', 'Bearer ' . $this->adminToken)
            ->getJson('/api/v1/subordinates');
        $resA2->assertStatus(200);
        $emailsA2 = array_column($resA2->json('data'), 'email');
        $this->assertContains('subA@granja.com', $emailsA2);
        $this->assertNotContains('subB@granja.com', $emailsA2);

        // Login as Admin B
        $loginB = $this->postJson('/api/v1/auth/login', [
            'email' => 'adminB@granja.com',
            'password' => 'password123',
        ]);
        $tokenB = $loginB->json('data.access_token');

        // Test Endpoint as Admin B
        $resB = $this->withHeader('Authorization', 'Bearer ' . $tokenB)
            ->getJson('/api/v1/admin/subordinates');

        $resB->assertStatus(200);
        $emailsB = array_column($resB->json('data'), 'email');
        $this->assertContains('subB@granja.com', $emailsB);
        $this->assertNotContains('subA@granja.com', $emailsB);
    }
}
