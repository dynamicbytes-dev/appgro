<?php

namespace Tests\Feature;

use App\Models\Farm;
use App\Models\Module;
use App\Models\Species;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthAndPermissionsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test root initialization command creates root user and modules.
     */
    public function test_app_init_root_command_creates_modules_and_root_user(): void
    {
        $this->artisan('app:init-root')
            ->assertExitCode(0);

        $this->assertDatabaseHas('users', [
            'email' => 'rosangeles92@gmail.com',
            'name' => 'Rosangeles Rojas',
            'role' => 'root',
            'farm_id' => null,
            'is_active' => true,
        ]);

        $this->assertDatabaseMissing('modules', ['code' => 'users']);
        $this->assertDatabaseHas('modules', ['code' => 'species']);
        $this->assertDatabaseHas('modules', ['code' => 'barns']);
        $this->assertDatabaseHas('modules', ['code' => 'lots']);
        $this->assertDatabaseHas('modules', ['code' => 'activities']);
        $this->assertDatabaseHas('modules', ['code' => 'analytics']);
    }

    /**
     * Test login with root credentials.
     */
    public function test_root_user_can_login(): void
    {
        $this->artisan('app:init-root');

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'Miranda*30',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'message',
                'data' => [
                    'access_token',
                    'token_type',
                    'expires_in',
                    'user' => [
                        'id',
                        'name',
                        'email',
                        'role',
                        'is_active',
                    ],
                    'modules',
                ]
            ]);
    }

    /**
     * Test JWT payload contains id, email, role, and farm_id.
     */
    public function test_jwt_payload_contains_required_claims(): void
    {
        $this->artisan('app:init-root');

        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'Miranda*30',
        ]);

        $token = $loginResponse->json('data.access_token');
        $payload = JWTAuth::setToken($token)->getPayload()->toArray();

        $this->assertEquals('rosangeles92@gmail.com', $payload['email']);
        $this->assertEquals('root', $payload['role']);
        $this->assertArrayHasKey('id', $payload);
        $this->assertArrayHasKey('farm_id', $payload);
        $this->assertNull($payload['farm_id']);
    }

    /**
     * Test login failure with invalid password.
     */
    public function test_login_fails_with_invalid_credentials(): void
    {
        $this->artisan('app:init-root');

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'WrongPassword123',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'status' => 'error',
                'message' => 'Credenciales inválidas. Verifique su correo y clave.',
            ]);
    }

    /**
     * Test root user profile endpoint.
     */
    public function test_authenticated_user_can_access_me(): void
    {
        $this->artisan('app:init-root');

        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'Miranda*30',
        ]);

        $token = $loginResponse->json('data.access_token');

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/auth/me');

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'user' => [
                        'email' => 'rosangeles92@gmail.com',
                        'role' => 'root',
                    ]
                ]
            ]);
    }

    /**
     * Test admin module permission control.
     */
    public function test_admin_module_access_control(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create(['name' => 'Granja El Sol', 'is_active' => true]);
        $speciesModule = Module::where('code', 'species')->first();
        $barnsModule = Module::where('code', 'barns')->first();

        // Enable only 'species' for Granja El Sol
        DB::table('farm_modules')->updateOrInsert(
            ['farm_id' => $farm->id, 'module_id' => $speciesModule->id],
            ['is_enabled' => true]
        );

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Juan Admin',
            'email' => 'admin@elsol.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@elsol.com',
            'password' => 'password123',
        ]);
        $token = $loginRes->json('data.access_token');

        // Access enabled module 'species' -> HTTP 200
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/species')
            ->assertStatus(200);

        // Access disabled module 'barns' -> HTTP 403
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/barns')
            ->assertStatus(403)
            ->assertJsonFragment([
                'status' => 'error',
            ]);
    }

    /**
     * Test data isolation across farms.
     */
    public function test_data_isolation_between_farms(): void
    {
        $farmA = Farm::create(['name' => 'Granja A', 'is_active' => true]);
        $farmB = Farm::create(['name' => 'Granja B', 'is_active' => true]);

        $speciesModule = Module::firstOrCreate(['code' => 'species'], ['name' => 'Especies']);

        DB::table('farm_modules')->updateOrInsert(
            ['farm_id' => $farmA->id, 'module_id' => $speciesModule->id],
            ['is_enabled' => true]
        );
        DB::table('farm_modules')->updateOrInsert(
            ['farm_id' => $farmB->id, 'module_id' => $speciesModule->id],
            ['is_enabled' => true]
        );

        // Create species for Farm A and Farm B
        Species::create(['farm_id' => $farmA->id, 'name' => 'Cerdo Landrace']);
        Species::create(['farm_id' => $farmB->id, 'name' => 'Pollo Broiler']);

        $adminA = User::create([
            'farm_id' => $farmA->id,
            'name' => 'Admin A',
            'email' => 'adminA@farm.com',
            'password_hash' => Hash::make('secret123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email' => 'adminA@farm.com',
            'password' => 'secret123',
        ]);
        $tokenA = $loginRes->json('data.access_token');

        // Admin A should only see Farm A's species
        $res = $this->withHeader('Authorization', 'Bearer ' . $tokenA)
            ->getJson('/api/v1/species')
            ->assertStatus(200);

        $speciesList = $res->json('data');
        $this->assertCount(1, $speciesList);
        $this->assertEquals('Cerdo Landrace', $speciesList[0]['name']);
    }

    /**
     * Test GET /api/v1/auth/modules returns only enabled modules for authenticated user.
     */
    public function test_user_modules_endpoint_returns_only_enabled_farm_modules(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create(['name' => 'Granja Modulos Test', 'sector' => 'porcino', 'is_active' => true]);
        $speciesModule = Module::where('code', 'species')->first();
        $barnsModule = Module::where('code', 'barns')->first();

        // Enable species, disable barns
        DB::table('farm_modules')->updateOrInsert(
            ['farm_id' => $farm->id, 'module_id' => $speciesModule->id],
            ['is_enabled' => true]
        );
        DB::table('farm_modules')->updateOrInsert(
            ['farm_id' => $farm->id, 'module_id' => $barnsModule->id],
            ['is_enabled' => false]
        );

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Modulos',
            'email' => 'adminmodulos@farm.com',
            'password_hash' => Hash::make('secret123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $token = JWTAuth::fromUser($admin);

        $res = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/auth/modules')
            ->assertStatus(200);

        $modules = $res->json('data');
        $moduleMap = [];
        foreach ($modules as $m) {
            $moduleMap[$m['code']] = $m['is_enabled'];
        }

        $this->assertTrue($moduleMap['species']);
        $this->assertFalse($moduleMap['barns']);
    }
}
