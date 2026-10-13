<?php

namespace Tests\Feature;

use App\Models\Farm;
use App\Models\Module;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RootManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $rootUser;
    private string $rootToken;
    private User $adminUser;
    private string $adminToken;

    protected function setUp(): void
    {
        parent::setUp();

        $this->artisan('app:init-root');

        $this->rootUser = User::where('email', 'rosangeles92@gmail.com')->first();
        $rootLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'Miranda*30',
        ]);
        $this->rootToken = $rootLogin->json('data.access_token');

        // Create a dummy farm & admin user
        $farm = Farm::create(['name' => 'Granja Prueba', 'sector' => 'porcino', 'is_active' => true]);
        $this->adminUser = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Test',
            'email' => 'admintest@farm.com',
            'password_hash' => Hash::make('secret123'),
            'role' => 'admin',
            'is_active' => true,
        ]);
        $adminLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'admintest@farm.com',
            'password' => 'secret123',
        ]);
        $this->adminToken = $adminLogin->json('data.access_token');
    }

    /**
     * 1. Test Root protection middleware blocks non-root users.
     */
    public function test_non_root_users_cannot_access_root_endpoints(): void
    {
        // Admin token attempting to list farms -> 403 Forbidden
        $this->withHeader('Authorization', 'Bearer ' . $this->adminToken)
            ->getJson('/api/v1/root/farms')
            ->assertStatus(403)
            ->assertJson([
                'status' => 'error',
                'message' => 'Acceso denegado. Este recurso es exclusivo para el usuario Root.',
            ]);
    }

    /**
     * 2. Test Root can list, create, and update farms.
     */
    public function test_root_can_manage_farms(): void
    {
        // Create Farm
        $createRes = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->postJson('/api/v1/root/farms', [
                'name' => 'Granja Porcina La Esperanza',
                'sector' => 'porcino',
                'is_active' => true,
            ]);

        $createRes->assertStatus(201)
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'name' => 'Granja Porcina La Esperanza',
                    'is_active' => true,
                ]
            ]);

        $farmId = $createRes->json('data.id');

        // List Farms
        $listRes = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->getJson('/api/v1/root/farms');

        $listRes->assertStatus(200)
            ->assertJsonStructure(['status', 'data']);

        // Update Farm (Deactivate)
        $updateRes = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->putJson('/api/v1/root/farms/' . $farmId, [
                'name' => 'Granja Porcina La Esperanza Editada',
                'is_active' => false,
            ]);

        $updateRes->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'name' => 'Granja Porcina La Esperanza Editada',
                    'is_active' => false,
                ]
            ]);

        $this->assertDatabaseHas('farms', [
            'id' => $farmId,
            'name' => 'Granja Porcina La Esperanza Editada',
            'is_active' => false,
        ]);
    }

    /**
     * 3. Test Root can register and manage Admin users.
     */
    public function test_root_can_manage_admin_users(): void
    {
        $farm = Farm::create(['name' => 'Granja Avícola El Porvenir', 'sector' => 'avicola', 'is_active' => true]);

        // Register Admin
        $createRes = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->postJson('/api/v1/root/admins', [
                'name' => 'Carlos Dueño',
                'email' => 'carlos@elporvenir.com',
                'password' => 'SecurePass123',
                'farm_id' => $farm->id,
            ]);

        $createRes->assertStatus(201)
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'name' => 'Carlos Dueño',
                    'email' => 'carlos@elporvenir.com',
                    'role' => 'admin',
                    'farm_id' => $farm->id,
                ]
            ]);

        $adminId = $createRes->json('data.id');

        // List Admins
        $listRes = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->getJson('/api/v1/root/admins');

        $listRes->assertStatus(200);

        // Update Admin
        $updateRes = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->putJson('/api/v1/root/admins/' . $adminId, [
                'name' => 'Carlos Dueño Actualizado',
                'is_active' => false,
            ]);

        $updateRes->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'name' => 'Carlos Dueño Actualizado',
                    'is_active' => false,
                ]
            ]);
    }

    /**
     * 3b. Test Root can toggle Admin user status.
     */
    public function test_root_can_toggle_admin_user_status(): void
    {
        $farm = Farm::create(['name' => 'Granja Status Test', 'sector' => 'bovino', 'is_active' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Para Alternar',
            'email' => 'toggle_admin@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        // 1. Toggle status to false (inverts current boolean)
        $toggleRes1 = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->patchJson('/api/v1/root/admins/' . $admin->id . '/toggle-status');

        $toggleRes1->assertStatus(200)
            ->assertJson([
                'message' => 'Estado del administrador actualizado exitosamente.',
                'is_active' => false,
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $admin->id,
            'is_active' => false,
        ]);

        // 2. Toggle status back to true
        $toggleRes2 = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->patchJson('/api/v1/root/admins/' . $admin->id . '/status');

        $toggleRes2->assertStatus(200)
            ->assertJson([
                'message' => 'Estado del administrador actualizado exitosamente.',
                'is_active' => true,
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $admin->id,
            'is_active' => true,
        ]);

        // 3. Non-root user cannot toggle admin status
        $adminLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'toggle_admin@test.com',
            'password' => 'password123',
        ]);
        $adminToken = $adminLogin->json('data.access_token');

        $this->withHeader('Authorization', 'Bearer ' . $adminToken)
            ->patchJson('/api/v1/root/admins/' . $admin->id . '/toggle-status')
            ->assertStatus(403);
    }

    /**
     * 3a. Test Root can update Admin and synchronize modules via Eloquent.
     */
    public function test_root_can_update_admin_and_sync_modules(): void
    {
        $farm = Farm::create(['name' => 'Granja Sincronizada', 'sector' => 'porcino', 'is_active' => true]);

        $speciesMod = Module::where('code', 'species')->first();
        $barnsMod = Module::where('code', 'barns')->first();
        $lotsMod = Module::where('code', 'lots')->first();

        // Register Admin
        $createRes = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->postJson('/api/v1/root/admins', [
                'name' => 'Admin Sincronizado',
                'email' => 'syncadmin@test.com',
                'password' => 'SecurePass123',
                'farm_id' => $farm->id,
                'modules' => ['species', 'barns'],
            ]);

        $createRes->assertStatus(201)
            ->assertJsonStructure([
                'status',
                'data' => [
                    'id',
                    'name',
                    'email',
                    'farm_id',
                    'modules',
                    'enabled_modules',
                ]
            ]);

        $adminId = $createRes->json('data.id');

        // Verify initial module state in database
        $this->assertDatabaseHas('farm_modules', [
            'farm_id' => $farm->id,
            'module_id' => $speciesMod->id,
            'is_enabled' => true,
        ]);
        $this->assertDatabaseHas('farm_modules', [
            'farm_id' => $farm->id,
            'module_id' => $lotsMod->id,
            'is_enabled' => false,
        ]);

        // 1. Update Admin using 'modules' array with Spanish alias and canonical code
        $updateRes = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->putJson('/api/v1/root/admins/' . $adminId, [
                'name' => 'Admin Sincronizado Editado',
                'modules' => ['especies', 'lotes'], // spanish alias 'especies' and 'lotes'
            ]);

        $updateRes->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'message' => 'Usuario Administrador actualizado correctamente.',
            ])
            ->assertJsonStructure([
                'status',
                'data' => [
                    'id',
                    'name',
                    'modules',
                    'enabled_modules',
                ]
            ]);

        // Assert newly synchronized modules in response
        $modulesInResponse = collect($updateRes->json('data.modules'));
        $this->assertTrue($modulesInResponse->count() >= 5);
        $speciesPivot = $modulesInResponse->firstWhere('id', $speciesMod->id)['pivot'];
        $this->assertTrue((bool) $speciesPivot['is_enabled']);
        $barnsPivot = $modulesInResponse->firstWhere('id', $barnsMod->id)['pivot'];
        $this->assertFalse((bool) $barnsPivot['is_enabled']);

        // Assert database state updated
        $this->assertDatabaseHas('farm_modules', [
            'farm_id' => $farm->id,
            'module_id' => $lotsMod->id,
            'is_enabled' => true,
        ]);
        $this->assertDatabaseHas('farm_modules', [
            'farm_id' => $farm->id,
            'module_id' => $barnsMod->id,
            'is_enabled' => false,
        ]);

        // 2. Update Admin using 'module_ids' numeric array
        $updateIdsRes = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->putJson('/api/v1/root/admins/' . $adminId, [
                'module_ids' => [$barnsMod->id],
            ]);

        $updateIdsRes->assertStatus(200);

        $this->assertDatabaseHas('farm_modules', [
            'farm_id' => $farm->id,
            'module_id' => $barnsMod->id,
            'is_enabled' => true,
        ]);
        $this->assertDatabaseHas('farm_modules', [
            'farm_id' => $farm->id,
            'module_id' => $speciesMod->id,
            'is_enabled' => false,
        ]);

        // 3. Test Eloquent relation sync directly on User model
        $adminUser = User::find($adminId);
        $adminUser->modules()->sync([
            $speciesMod->id => ['is_enabled' => true, 'updated_at' => now()],
        ]);

        $this->assertDatabaseHas('farm_modules', [
            'farm_id' => $farm->id,
            'module_id' => $speciesMod->id,
            'is_enabled' => true,
        ]);
    }

    /**
     * 3b. Test Admin registration validations.
     */
    public function test_admin_registration_requires_valid_farm_and_unique_email(): void
    {
        // Missing farm_id and duplicate email
        $res = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->postJson('/api/v1/root/admins', [
                'name' => 'Test Duplicate',
                'email' => 'admintest@farm.com', // Already exists
                'password' => 'secret123',
                'farm_id' => 99999, // Non-existent farm
            ]);

        $res->assertStatus(422)
            ->assertJsonStructure(['status', 'message', 'errors']);
    }

    /**
     * 4. Test Root can manage farm modules.
     */
    public function test_root_can_get_and_update_farm_modules(): void
    {
        $farm = Farm::create(['name' => 'Granja Multi Módulo', 'sector' => 'bovino', 'is_active' => true]);
        $speciesModule = Module::where('code', 'species')->first();
        $barnsModule = Module::where('code', 'barns')->first();

        // Get modules for farm
        $getRes = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->getJson('/api/v1/root/farms/' . $farm->id . '/modules');

        $getRes->assertStatus(200)
            ->assertJsonStructure(['status', 'data' => ['farm_id', 'modules']]);

        // Update module states
        $updateRes = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->putJson('/api/v1/root/farms/' . $farm->id . '/modules', [
                'modules' => [
                    ['module_id' => $speciesModule->id, 'is_enabled' => true],
                    ['module_id' => $barnsModule->id, 'is_enabled' => false],
                ]
            ]);

        $updateRes->assertStatus(200);

        $this->assertDatabaseHas('farm_modules', [
            'farm_id' => $farm->id,
            'module_id' => $speciesModule->id,
            'is_enabled' => true,
        ]);

        $this->assertDatabaseHas('farm_modules', [
            'farm_id' => $farm->id,
            'module_id' => $barnsModule->id,
            'is_enabled' => false,
        ]);
    }

    /**
     * 5. Test Farm creation requires a valid sector value.
     */
    public function test_farm_creation_requires_valid_sector(): void
    {
        $res = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->postJson('/api/v1/root/farms', [
                'name' => 'Granja Invalida',
                'sector' => 'invalid_sector_name',
                'is_active' => true,
            ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['sector']);
    }

    /**
     * 6. Test Root can update a single farm module state independently.
     */
    public function test_root_can_update_single_farm_module_independently(): void
    {
        $farm = Farm::create(['name' => 'Granja Single Module', 'sector' => 'porcino', 'is_active' => true]);
        $lotsModule = Module::where('code', 'lots')->first();

        // Toggle single module 'lots' to false
        $res = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->putJson("/api/v1/root/farms/{$farm->id}/modules/{$lotsModule->id}", [
                'is_enabled' => false,
            ]);

        $res->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'farm_id' => $farm->id,
                    'module_id' => $lotsModule->id,
                    'is_enabled' => false,
                ]
            ]);

        $this->assertDatabaseHas('farm_modules', [
            'farm_id' => $farm->id,
            'module_id' => $lotsModule->id,
            'is_enabled' => false,
        ]);
    }

    /**
     * Test Root stats endpoint returns correct counts of farms and admins.
     */
    public function test_root_can_get_dashboard_stats(): void
    {
        $res = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->getJson('/api/v1/root/stats')
            ->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'data' => [
                    'total_farms',
                    'active_farms',
                    'inactive_farms',
                    'total_admins',
                    'active_admins',
                    'inactive_admins',
                    'total_subordinates',
                    'total_modules',
                ],
            ]);

        $this->assertEquals(1, $res->json('data.total_farms'));
        $this->assertEquals(1, $res->json('data.total_admins'));
    }

    /**
     * Test farms/select returns all active farms without filtering out those with existing admins.
     */
    public function test_farms_select_returns_all_active_farms_including_those_with_admins(): void
    {
        // Farm with existing admin
        $farmWithAdmin = Farm::where('name', 'Granja Prueba')->first();

        // Create a second active farm without an admin
        $secondFarm = Farm::create([
            'name' => 'Granja Segunda Activa',
            'sector' => 'avicola',
            'is_active' => true,
        ]);

        // Create an inactive farm
        $inactiveFarm = Farm::create([
            'name' => 'Granja Inactiva Oculta',
            'sector' => 'bovino',
            'is_active' => false,
        ]);

        $res = $this->withHeader('Authorization', 'Bearer ' . $this->rootToken)
            ->getJson('/api/v1/farms/select')
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'status' => 'success',
            ]);

        $farmIds = collect($res->json('data'))->pluck('id')->toArray();

        // Both active farms MUST be present (including the one with an admin)
        $this->assertContains($farmWithAdmin->id, $farmIds);
        $this->assertContains($secondFarm->id, $farmIds);

        // Inactive farm must NOT be present by default
        $this->assertNotContains($inactiveFarm->id, $farmIds);
    }
}
