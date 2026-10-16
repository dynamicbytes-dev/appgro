<?php

namespace Tests\Feature;

use App\Models\Farm;
use App\Models\FarmModule;
use App\Models\Galpon;
use App\Models\Module;
use App\Models\Species;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SpeciesModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_species_table_structure_has_all_required_columns(): void
    {
        $this->artisan('app:init-root');

        $this->assertTrue(Schema::hasTable('species'));
        $this->assertTrue(Schema::hasColumns('species', [
            'id',
            'farm_id',
            'name',
            'category',
            'is_active',
            'created_at',
            'updated_at',
        ]));
    }

    public function test_species_module_is_officially_registered(): void
    {
        $this->artisan('app:init-root');

        $speciesModule = Module::where('code', 'species')->first();
        $this->assertNotNull($speciesModule);
        $this->assertEquals('Especies', $speciesModule->name);
    }

    public function test_admin_cannot_access_species_if_module_is_disabled_for_farm(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Sin Especies',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Sin Modulo',
            'email' => 'admin_nomod@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $speciesMod = Module::where('code', 'species')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $speciesMod->id)
            ->update(['is_enabled' => false]);

        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_nomod@test.com',
            'password' => 'password123',
        ]);
        $token = $loginRes->json('data.access_token');

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/species')
            ->assertStatus(403);
    }

    public function test_species_crud_lifecycle_with_strict_farm_isolation(): void
    {
        $this->artisan('app:init-root');

        // Farm 1
        $farm1 = Farm::create([
            'name' => 'Granja Los Andes',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        // Farm 2
        $farm2 = Farm::create([
            'name' => 'Granja El Llano',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $admin1 = User::create([
            'farm_id' => $farm1->id,
            'name' => 'Admin Granja 1',
            'email' => 'admin1_species@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $admin2 = User::create([
            'farm_id' => $farm2->id,
            'name' => 'Admin Granja 2',
            'email' => 'admin2_species@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        // Enable species module on Farm 1 and Farm 2
        $speciesMod = Module::where('code', 'species')->first();
        FarmModule::whereIn('farm_id', [$farm1->id, $farm2->id])
            ->where('module_id', $speciesMod->id)
            ->update(['is_enabled' => true]);

        // Login Admin 1
        $loginRes1 = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin1_species@test.com',
            'password' => 'password123',
        ]);
        $token1 = $loginRes1->json('data.access_token');

        // 1. Validation error on Store: name and category are required
        $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->postJson('/api/v1/species', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'category']);

        // 2. Successful store of species for Farm 1
        $createRes = $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->postJson('/api/v1/species', [
                'name' => 'Vaca',
                'category' => 'bovina',
                'is_active' => true,
            ])
            ->assertStatus(201);

        $species1Id = $createRes->json('data.id');
        $this->assertEquals($farm1->id, $createRes->json('data.farm_id'));
        $this->assertEquals('bovina', $createRes->json('data.category'));
        $this->assertTrue($createRes->json('data.is_active'));

        // 3. Create a species directly for Farm 2
        $speciesFarm2 = Species::create([
            'farm_id' => $farm2->id,
            'name' => 'Porcino Landrace',
            'category' => 'porcina',
            'is_active' => true,
        ]);

        // 4. Index: Admin 1 only sees species of Farm 1
        $indexRes = $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->getJson('/api/v1/species')
            ->assertStatus(200);

        $speciesList = $indexRes->json('data');
        $this->assertCount(1, $speciesList);
        $this->assertEquals('Vaca', $speciesList[0]['name']);
        $this->assertEquals($farm1->id, $speciesList[0]['farm_id']);

        // 5. Show: Admin 1 can see own species, but cannot view Farm 2's species (403/404)
        $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->getJson("/api/v1/species/{$species1Id}")
            ->assertStatus(200);

        $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->getJson("/api/v1/species/{$speciesFarm2->id}")
            ->assertStatus(404);

        // 6. Update: Admin 1 updates own species
        $updateRes = $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->putJson("/api/v1/species/{$species1Id}", [
                'name' => 'oveja',
                'category' => 'ovina',
                'is_active' => true,
            ])
            ->assertStatus(200);

        $this->assertEquals('Oveja', $updateRes->json('data.name'));
        $this->assertEquals('ovina', $updateRes->json('data.category'));

        // 7. Toggle Status: deactivate species
        $toggleRes = $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->patchJson("/api/v1/species/{$species1Id}/status", [
                'is_active' => false,
            ])
            ->assertStatus(200);

        $this->assertFalse($toggleRes->json('data.is_active'));
        $this->assertDatabaseHas('species', [
            'id' => $species1Id,
            'is_active' => false,
        ]);

        // 8. Destroy: delete species
        $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->deleteJson("/api/v1/species/{$species1Id}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('species', [
            'id' => $species1Id,
        ]);
    }

    public function test_root_can_manage_species_globally_and_specify_farm_id(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Root Manage',
            'sector' => 'cunícola',
            'is_active' => true,
        ]);

        $rootLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'Miranda*30',
        ]);
        $rootToken = $rootLogin->json('data.access_token');

        // Root creates species specifying farm_id
        $createRes = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->postJson('/api/v1/species', [
                'name' => 'Conejo',
                'category' => 'cunícola',
                'farm_id' => $farm->id,
            ])
            ->assertStatus(201);

        $this->assertEquals($farm->id, $createRes->json('data.farm_id'));

        // Root can filter index by farm_id
        $resFilter = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->getJson("/api/v1/species?farm_id={$farm->id}")
            ->assertStatus(200);

        $this->assertCount(1, $resFilter->json('data'));
        $this->assertEquals('Conejo', $resFilter->json('data.0.name'));
    }

    public function test_species_stats_endpoint_returns_clean_contextual_metrics_filtered_by_farm_id(): void
    {
        $this->artisan('app:init-root');

        $farm1 = Farm::create([
            'name' => 'Granja Estadisticas 1',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        $farm2 = Farm::create([
            'name' => 'Granja Estadisticas 2',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $admin1 = User::create([
            'farm_id' => $farm1->id,
            'name' => 'Admin Granja Stats',
            'email' => 'admin_stats@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $speciesMod = Module::where('code', 'species')->first();
        FarmModule::where('farm_id', $farm1->id)
            ->where('module_id', $speciesMod->id)
            ->update(['is_enabled' => true]);

        // Farm 1: 3 species (2 active, 1 inactive; 2 unique categories: bovina, avícola)
        Species::create([
            'farm_id' => $farm1->id,
            'name' => 'Bovino Angus',
            'category' => 'bovina',
            'is_active' => true,
        ]);
        Species::create([
            'farm_id' => $farm1->id,
            'name' => 'Bovino Holstein',
            'category' => 'bovina',
            'is_active' => true,
        ]);
        Species::create([
            'farm_id' => $farm1->id,
            'name' => 'Gallina Ponedora',
            'category' => 'avícola',
            'is_active' => false,
        ]);

        // Farm 2: 2 species (should NEVER appear in Farm 1's stats)
        Species::create([
            'farm_id' => $farm2->id,
            'name' => 'Porcino Pietrain',
            'category' => 'porcina',
            'is_active' => true,
        ]);
        Species::create([
            'farm_id' => $farm2->id,
            'name' => 'Porcino Duroc',
            'category' => 'porcina',
            'is_active' => true,
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_stats@test.com',
            'password' => 'password123',
        ]);
        $token = $login->json('data.access_token');

        // Test GET /api/v1/species/stats
        $statsRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/species/stats')
            ->assertStatus(200);

        $statsRes->assertJson([
            'status' => 'success',
            'total_species' => 3,
            'active_species' => 2,
            'inactive_species' => 1,
            'categories_count' => 2,
            'data' => [
                'total_species' => 3,
                'active_species' => 2,
                'inactive_species' => 1,
                'categories_count' => 2,
                'farm_id' => $farm1->id,
            ],
        ]);

        // Test GET /api/v1/species/summary alias
        $summaryRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/species/summary')
            ->assertStatus(200);

        $summaryRes->assertJson([
            'total_species' => 3,
            'active_species' => 2,
            'categories_count' => 2,
        ]);

        // Test GET /api/v1/species also provides stats and never null
        $indexRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/species')
            ->assertStatus(200);

        $this->assertEquals(3, $indexRes->json('total_species'));
        $this->assertEquals(2, $indexRes->json('active_species'));
        $this->assertEquals(2, $indexRes->json('categories_count'));
        $this->assertNotNull($indexRes->json('stats'));
    }

    public function test_species_stats_returns_clean_zeros_when_no_species_exist(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Vacia',
            'sector' => 'avícola',
            'is_active' => true,
        ]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Granja Vacia',
            'email' => 'admin_empty@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $speciesMod = Module::where('code', 'species')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $speciesMod->id)
            ->update(['is_enabled' => true]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_empty@test.com',
            'password' => 'password123',
        ]);
        $token = $login->json('data.access_token');

        $res = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/species/stats')
            ->assertStatus(200);

        $res->assertJson([
            'status' => 'success',
            'total_species' => 0,
            'active_species' => 0,
            'inactive_species' => 0,
            'categories_count' => 0,
        ]);

        $this->assertIsInt($res->json('total_species'));
        $this->assertIsInt($res->json('active_species'));
        $this->assertIsInt($res->json('categories_count'));
    }

    public function test_species_category_validation_rejects_invalid_values_and_accepts_official_list(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Validacion Categorias',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Categorias',
            'email' => 'admin_cat@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $speciesMod = Module::where('code', 'species')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $speciesMod->id)
            ->update(['is_enabled' => true]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_cat@test.com',
            'password' => 'password123',
        ]);
        $token = $login->json('data.access_token');

        // 1. Invalid category on Store must fail with 422
        $invalidRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/species', [
                'name' => 'Caballo Cuarto de Milla',
                'category' => 'equina', // Not in official list
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['category']);

        $this->assertStringContainsString('bovina, porcina, avícola, ovina, caprina, cunícola', $invalidRes->json('errors.category.0'));

        // 2. All official categories must be accepted (with a species from its own sector)
        $validCategories = [
            'bovina' => 'Vaca',
            'porcina' => 'Cerdo',
            'avícola' => 'Pollo',
            'ovina' => 'Oveja',
            'caprina' => 'Cabra',
            'cunícola' => 'Conejo',
        ];
        foreach ($validCategories as $cat => $speciesName) {
            $res = $this->withHeader('Authorization', 'Bearer ' . $token)
                ->postJson('/api/v1/species', [
                    'name' => $speciesName,
                    'category' => $cat,
                ])
                ->assertStatus(201);

            $this->assertEquals($cat, $res->json('data.category'));
        }

        // 3. Normalization test: input 'Avicola' without accent and lowercase name is normalized and accepted
        $normalizedRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/species', [
                'name' => 'gallina',
                'category' => 'Avicola',
            ])
            ->assertStatus(201);

        $this->assertEquals('avícola', $normalizedRes->json('data.category'));
        $this->assertEquals('Gallina', $normalizedRes->json('data.name'));
        $createdId = $normalizedRes->json('data.id');

        // 4. Update with invalid category must fail with 422
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->putJson("/api/v1/species/{$createdId}", [
                'name' => 'Gallina',
                'category' => 'reptil',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['category']);

        // 5. Update with valid category and matching species succeeds
        $updateOk = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->putJson("/api/v1/species/{$createdId}", [
                'name' => 'Chivo',
                'category' => 'caprina',
            ])
            ->assertStatus(200);

        $this->assertEquals('caprina', $updateOk->json('data.category'));
    }

    public function test_species_must_match_official_sector_taxonomy(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create(['name' => 'Granja Taxonomia', 'sector' => 'bovino', 'is_active' => true]);

        User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Taxonomia',
            'email' => 'admin_tax@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $speciesMod = Module::where('code', 'species')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $speciesMod->id)
            ->update(['is_enabled' => true]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_tax@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        $auth = ['Authorization' => 'Bearer ' . $token];

        // Taxonomy endpoint exposes the official structure
        $tax = $this->withHeaders($auth)->getJson('/api/v1/species/taxonomy')->assertStatus(200);
        $this->assertCount(6, $tax->json('data'));

        // Species outside the official list is rejected
        $this->withHeaders($auth)
            ->postJson('/api/v1/species', ['name' => 'Caballo', 'category' => 'bovina'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        // Species from another sector is rejected (pollo is not bovino)
        $this->withHeaders($auth)
            ->postJson('/api/v1/species', ['name' => 'Pollo', 'category' => 'bovino'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        // Accent-insensitive name + sector alias: 'bufalo' / 'Bovino' => 'Búfalo' / 'bovina'
        $this->withHeaders($auth)
            ->postJson('/api/v1/species', ['name' => 'bufalo', 'category' => 'Bovino'])
            ->assertStatus(201)
            ->assertJsonPath('data.name', 'Búfalo')
            ->assertJsonPath('data.category', 'bovina');

        // 'Cunícula' alias maps to the stored 'cunícola' sector
        $this->withHeaders($auth)
            ->postJson('/api/v1/species', ['name' => 'conejo', 'category' => 'Cunícula'])
            ->assertStatus(201)
            ->assertJsonPath('data.category', 'cunícola');

        // Cordero and Borrego resolve to the same canonical species => second one is a duplicate
        $this->withHeaders($auth)
            ->postJson('/api/v1/species', ['name' => 'cordero', 'category' => 'Ovino'])
            ->assertStatus(201)
            ->assertJsonPath('data.name', 'Cordero/Borrego');

        $this->withHeaders($auth)
            ->postJson('/api/v1/species', ['name' => 'Borrego', 'category' => 'ovina'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_species_stats_role_based_dynamic_scope_and_consistent_json_structure(): void
    {
        $this->artisan('app:init-root');

        // Setup Farm A (3 species: 2 active, 1 inactive; 2 categories: bovina, avícola)
        $farmA = Farm::create([
            'name' => 'Granja A Dynamic Scope',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        // Setup Farm B (2 species: 2 active; 1 category: porcina)
        $farmB = Farm::create([
            'name' => 'Granja B Dynamic Scope',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $speciesMod = Module::where('code', 'species')->first();
        FarmModule::whereIn('farm_id', [$farmA->id, $farmB->id])
            ->where('module_id', $speciesMod->id)
            ->update(['is_enabled' => true]);

        // Species for Farm A
        Species::create(['farm_id' => $farmA->id, 'name' => 'Vaca Angus', 'category' => 'bovina', 'is_active' => true]);
        Species::create(['farm_id' => $farmA->id, 'name' => 'Toro Brahman', 'category' => 'bovina', 'is_active' => true]);
        Species::create(['farm_id' => $farmA->id, 'name' => 'Gallina Ponedora', 'category' => 'avícola', 'is_active' => false]);

        // Species for Farm B
        Species::create(['farm_id' => $farmB->id, 'name' => 'Cerdo Landrace', 'category' => 'porcina', 'is_active' => true]);
        Species::create(['farm_id' => $farmB->id, 'name' => 'Cerdo Yorkshire', 'category' => 'porcina', 'is_active' => true]);

        // 1. Root user: global stats (total 5, active 4, categories 3)
        $rootLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'Miranda*30',
        ]);
        $rootToken = $rootLogin->json('data.access_token');

        $rootGlobalRes = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->getJson('/api/v1/species/stats')
            ->assertStatus(200);

        $rootGlobalRes->assertJson([
            'status' => 'success',
            'total_species' => 5,
            'active_species' => 4,
            'categories_count' => 3,
        ]);

        // Root user filtering by farmA
        $rootFarmARes = $this->withHeader('Authorization', 'Bearer ' . $rootToken)
            ->getJson("/api/v1/species/stats?farm_id={$farmA->id}")
            ->assertStatus(200);

        $rootFarmARes->assertJson([
            'total_species' => 3,
            'active_species' => 2,
            'categories_count' => 2,
        ]);

        // 2. Admin user of Farm A: strictly filtered by Auth::user()->farm_id
        $adminA = User::create([
            'farm_id' => $farmA->id,
            'name' => 'Admin Granja A',
            'email' => 'admin_a_stats@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $adminLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_a_stats@test.com',
            'password' => 'password123',
        ]);
        $adminToken = $adminLogin->json('data.access_token');

        // Admin calling stats, even if trying to pass ?farm_id=farmB, is strictly locked to farmA
        $adminRes = $this->withHeader('Authorization', 'Bearer ' . $adminToken)
            ->getJson("/api/v1/species/stats?farm_id={$farmB->id}")
            ->assertStatus(200);

        $adminRes->assertJson([
            'status' => 'success',
            'total_species' => 3,
            'active_species' => 2,
            'categories_count' => 2,
        ]);

        // Verify exact standardized keys
        $this->assertEquals(3, $adminRes->json('total_species'));
        $this->assertEquals(2, $adminRes->json('active_species'));
        $this->assertEquals(2, $adminRes->json('categories_count'));

        // 3. Subordinate of Farm A: strictly filtered by Auth::user()->farm_id
        $subordinateA = User::create([
            'farm_id' => $farmA->id,
            'name' => 'Encargado Granja A',
            'email' => 'sub_a_stats@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        // Assign species module to subordinate
        \Illuminate\Support\Facades\DB::table('subordinate_modules')->insert([
            'user_id' => $subordinateA->id,
            'module_id' => $speciesMod->id,
            'is_enabled' => true,
        ]);

        $subLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'sub_a_stats@test.com',
            'password' => 'password123',
        ]);
        $subToken = $subLogin->json('data.access_token');

        $subRes = $this->withHeader('Authorization', 'Bearer ' . $subToken)
            ->getJson('/api/v1/species/stats')
            ->assertStatus(200);

        $subRes->assertJson([
            'status' => 'success',
            'total_species' => 3,
            'active_species' => 2,
            'categories_count' => 2,
        ]);
        $this->assertEquals(3, $subRes->json('total_species'));
        $this->assertEquals(2, $subRes->json('active_species'));
        $this->assertEquals(2, $subRes->json('categories_count'));
    }

    public function test_cannot_create_or_update_duplicate_species_within_same_farm(): void
    {
        $this->artisan('app:init-root');

        $farm1 = Farm::create(['name' => 'Granja Duplicados 1', 'sector' => 'avicola', 'is_active' => true]);
        $farm2 = Farm::create(['name' => 'Granja Duplicados 2', 'sector' => 'avicola', 'is_active' => true]);

        $speciesMod = Module::where('code', 'species')->first();
        FarmModule::whereIn('farm_id', [$farm1->id, $farm2->id])
            ->where('module_id', $speciesMod->id)
            ->update(['is_enabled' => true]);

        $admin1 = User::create([
            'farm_id' => $farm1->id,
            'name' => 'Admin Granja 1',
            'email' => 'admin_dup1@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $login1 = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_dup1@test.com',
            'password' => 'password123',
        ]);
        $token1 = $login1->json('data.access_token');

        // 1. Create first species 'Pollo' in Farm 1
        $res1 = $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->postJson('/api/v1/species', [
                'name' => 'Pollo',
                'category' => 'avícola',
            ])
            ->assertStatus(201);

        $speciesId = $res1->json('data.id');

        // 2. Attempt to create duplicate 'Pollo' in Farm 1 -> must fail with 422
        $resDup = $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->postJson('/api/v1/species', [
                'name' => 'Pollo',
                'category' => 'avícola',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        $resDup->assertJsonFragment([
            'name' => ['Ya existe una especie con este nombre en la granja seleccionada.']
        ]);

        // 2b. Case-insensitive duplicates: lowercase 'pollo' or '  POLLO  ' must also be rejected
        $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->postJson('/api/v1/species', [
                'name' => 'pollo',
                'category' => 'avícola',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->postJson('/api/v1/species', [
                'name' => '  POLLO  ',
                'category' => 'avícola',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        // 3. Different farm (Farm 2) CAN create 'Pollo'
        $admin2 = User::create([
            'farm_id' => $farm2->id,
            'name' => 'Admin Granja 2',
            'email' => 'admin_dup2@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $login2 = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_dup2@test.com',
            'password' => 'password123',
        ]);
        $token2 = $login2->json('data.access_token');

        $this->withHeader('Authorization', 'Bearer ' . $token2)
            ->postJson('/api/v1/species', [
                'name' => 'Pollo',
                'category' => 'avícola',
            ])
            ->assertStatus(201);

        // 4. Update the species keeping its own name is allowed (ignore ID works)
        $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->putJson("/api/v1/species/{$speciesId}", [
                'name' => 'Pollo',
                'category' => 'avícola',
            ])
            ->assertStatus(200);

        // 5. Create a second species in Farm 1
        $res2 = $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->postJson('/api/v1/species', [
                'name' => 'Gallina',
                'category' => 'avícola',
            ])
            ->assertStatus(201);

        $species2Id = $res2->json('data.id');

        // 6. Attempt to update species 2 to have species 1 name -> must fail with 422
        $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->putJson("/api/v1/species/{$species2Id}", [
                'name' => 'Pollo',
                'category' => 'avícola',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_cannot_delete_species_being_used_by_galpones(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Especie en Uso',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        // Enable species & galpones modules for the farm
        $speciesMod = Module::where('code', 'species')->first();
        $galponMod = Module::where('code', 'barns')->first();
        FarmModule::where('farm_id', $farm->id)
            ->whereIn('module_id', [$speciesMod->id, $galponMod->id])
            ->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Especie en Uso',
            'email' => 'admin_spec_in_use@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_spec_in_use@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        $species = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Vaca',
            'category' => 'bovina',
            'is_active' => true,
        ]);

        // Galpón linked to the species
        Galpon::create([
            'farm_id' => $farm->id,
            'species_id' => $species->id,
            'name' => 'Galpón 1 - Engorde',
            'category' => 'bovina',
            'sector' => 'bovina',
            'purpose' => 'carne',
            'max_capacity' => 120,
            'is_active' => true,
        ]);

        $res = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson("/api/v1/species/{$species->id}");

        $res->assertStatus(422)
            ->assertJsonFragment([
                'status' => 'error',
                'message' => 'No se puede eliminar la especie porque está siendo utilizada en galpones activos.',
            ]);

        // Species and its galpón remain intact
        $this->assertDatabaseHas('species', ['id' => $species->id]);
        $this->assertDatabaseHas('galpones', ['species_id' => $species->id]);
    }

    public function test_can_delete_species_without_galpones_associated(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Especie Libre',
            'sector' => 'porcina',
            'is_active' => true,
        ]);

        $speciesMod = Module::where('code', 'species')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $speciesMod->id)
            ->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Especie Libre',
            'email' => 'admin_spec_free@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_spec_free@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        $species = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Cerdo',
            'category' => 'porcina',
            'is_active' => true,
        ]);

        $res = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson("/api/v1/species/{$species->id}");

        $res->assertStatus(200)
            ->assertJsonFragment([
                'status' => 'success',
                'message' => 'Especie eliminada correctamente.',
            ]);

        $this->assertDatabaseMissing('species', ['id' => $species->id]);
    }
}



