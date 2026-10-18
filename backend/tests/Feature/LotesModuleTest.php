<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Farm;
use App\Models\FarmModule;
use App\Models\Galpon;
use App\Models\Lot;
use App\Models\LoteAnimal;
use App\Models\Module;
use App\Models\Species;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LotesModuleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Crea una granja con el módulo de lotes habilitado, una especie
     * activa y un administrador autenticado. Devuelve las referencias.
     */
    private function createFarmWithAdmin(string $name, string $email): array
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => $name,
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $lotsModule = Module::where('code', 'lots')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $lotsModule->id)
            ->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Lotes',
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

    private function createSpecies(Farm $farm, string $category = 'porcina'): Species
    {
        return Species::create([
            'farm_id' => $farm->id,
            'name' => 'Cerdo Landrace',
            'category' => $category,
            'is_active' => true,
        ]);
    }

    private function createGalpon(Farm $farm, Species $species, array $attrs = []): Galpon
    {
        return Galpon::create(array_merge([
            'farm_id' => $farm->id,
            'species_id' => $species->id,
            'name' => 'Galpón Reproducción',
            'category' => $species->category,
            'sector' => $species->category,
            'purpose' => 'reproducción',
            'max_capacity' => 100,
            'is_active' => true,
        ], $attrs));
    }

    public function test_lotes_tables_have_all_required_columns(): void
    {
        $this->assertTrue(Schema::hasTable('lots'), 'Table lots must exist.');

        $expectedColumns = [
            'id', 'farm_id', 'galpon_id', 'code', 'species_id',
            'sector', 'purpose', 'quantity', 'status', 'entry_date',
            'harvest_date', 'avg_weight', 'total_weight', 'price_per_kg', 'total_price',
            'total_eggs', 'broken_eggs', 'egg_price', 'total_egg_cost', 'total_broken_cost',
        ];

        foreach ($expectedColumns as $column) {
            $this->assertTrue(
                Schema::hasColumn('lots', $column),
                "Column '{$column}' is missing from 'lots' table."
            );
        }

        $this->assertTrue(Schema::hasTable('lote_animals'), 'Table lote_animals must exist.');
        foreach (['id', 'lote_id', 'identifier', 'name', 'color', 'breed', 'father_breed', 'mother_breed', 'gender', 'birth_date', 'parity_count', 'teats_count', 'avg_piglets_per_birth', 'status'] as $column) {
            $this->assertTrue(
                Schema::hasColumn('lote_animals', $column),
                "Column '{$column}' is missing from 'lote_animals' table."
            );
        }

        $this->assertTrue(Schema::hasTable('animal_services'), 'Table animal_services must exist.');
        foreach (['id', 'lote_animal_id', 'service_type', 'service_date', 'status', 'pregnancy_date', 'birth_date', 'total_piglets', 'live_piglets'] as $column) {
            $this->assertTrue(
                Schema::hasColumn('animal_services', $column),
                "Column '{$column}' is missing from 'animal_services' table."
            );
        }
    }

    public function test_lotes_module_is_officially_registered_in_modules_table(): void
    {
        $this->artisan('app:init-root');

        $module = Module::where('code', 'lots')->first();
        $this->assertNotNull($module, "Module with code 'lots' must be registered in modules table.");
        $this->assertEquals('Lotes', $module->name);
    }

    public function test_admin_cannot_access_lotes_if_module_is_disabled_for_farm(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Sin Lotes', 'admin_nomod_lotes@test.com');

        $lotsModule = Module::where('code', 'lots')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $lotsModule->id)
            ->update(['is_enabled' => false]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/lots')
            ->assertStatus(403)
            ->assertJson(['status' => 'error']);
    }

    public function test_admin_can_create_lote_with_automatic_code_and_inheritance(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Lotes OK', 'admin_lotes_ok@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 25,
            ])
            ->assertStatus(201);

        $response->assertJson([
            'status' => 'success',
            'data' => [
                'farm_id' => $farm->id,
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'code' => 'LOT-00001',
                'sector' => 'porcina',
                'purpose' => 'reproducción',
                'quantity' => 25,
                'status' => 'activo',
            ],
        ]);

        $this->assertDatabaseHas('lots', [
            'code' => 'LOT-00001',
            'farm_id' => $farm->id,
            'galpon_id' => $galpon->id,
            'sector' => 'porcina',
            'purpose' => 'reproducción',
            'status' => 'activo',
        ]);

        // Audit log was automatically created
        $this->assertNotNull(
            ActivityLog::where('module', 'Lotes')->where('action', 'CREAR')->first()
        );
    }

    public function test_lote_code_generation_is_sequential_and_unique(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Códigos', 'admin_lotes_codes@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['max_capacity' => 1000]);

        for ($i = 1; $i <= 3; $i++) {
            $this->withHeader('Authorization', 'Bearer '.$token)
                ->postJson('/api/v1/lots', [
                    'galpon_id' => $galpon->id,
                    'species_id' => $species->id,
                    'quantity' => 10,
                ])
                ->assertStatus(201);
        }

        $codes = Lot::pluck('code')->toArray();
        $this->assertEquals(['LOT-00001', 'LOT-00002', 'LOT-00003'], $codes);
        $this->assertCount(3, array_unique($codes));
    }

    public function test_validates_barn_capacity_and_rejects_exceeding_quantity_with_422(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Capacidad', 'admin_lotes_cap@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['purpose' => 'carne', 'max_capacity' => 100]);

        // 60 animals fit
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 60,
            ])
            ->assertStatus(201);

        // 50 more exceed the remaining 40 slots
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 50,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);

        // Exactly the remaining 40 fit
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 40,
            ])
            ->assertStatus(201);

        // Now the barn is full
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 1,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);
    }

    public function test_harvest_computes_totals_and_releases_capacity(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Cosecha', 'admin_lotes_harvest@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['purpose' => 'carne', 'max_capacity' => 100]);

        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 80,
            ])
            ->assertStatus(201)
            ->json('data.id');

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/harvest", [
                'avg_weight' => 120.5,
                'price_per_kg' => 3.25,
            ])
            ->assertStatus(200);

        $response->assertJson([
            'status' => 'success',
            'data' => [
                'status' => 'inactivo',
                'quantity' => 0,
                'avg_weight' => '120.50',
                'total_weight' => '9640.00',
                'price_per_kg' => '3.25',
                'total_price' => '31330.00',
            ],
        ]);

        $this->assertDatabaseHas('lots', [
            'id' => $lotId,
            'status' => 'inactivo',
            'quantity' => 0,
            'total_weight' => 9640.00,
            'total_price' => 31330.00,
        ]);

        // Capacity released: a new 100-animal lot fits in the same barn
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 100,
            ])
            ->assertStatus(201);
    }

    public function test_partial_harvest_keeps_lot_active_with_reduced_quantity(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Cosecha Parcial', 'admin_lotes_partial@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['purpose' => 'carne', 'max_capacity' => 100]);

        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 80,
            ])
            ->assertStatus(201)
            ->json('data.id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/harvest", [
                'quantity' => 30,
                'avg_weight' => 100,
                'price_per_kg' => 2,
            ])
            ->assertStatus(200)
            ->assertJson([
                'data' => [
                    'status' => 'activo',
                    'quantity' => 50,
                    'total_weight' => '3000.00',
                    'total_price' => '6000.00',
                ],
            ]);

        // 50 remain occupied, so only 50 more fit
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 51,
            ])
            ->assertStatus(422);
    }

    public function test_egg_registration_accumulates_without_releasing_capacity(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Huevos', 'admin_lotes_eggs@test.com');

        $species = $this->createSpecies($farm, 'avícola');
        $galpon = $this->createGalpon($farm, $species, [
            'category' => 'avícola',
            'sector' => 'avícola',
            'purpose' => 'huevos',
            'max_capacity' => 100,
        ]);

        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 50,
            ])
            ->assertStatus(201)
            ->json('data.id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/eggs", [
                'total_eggs' => 1000,
                'broken_eggs' => 40,
                'egg_price' => 0.25,
            ])
            ->assertStatus(200)
            ->assertJson([
                'data' => [
                    'status' => 'activo',
                    'quantity' => 50,
                    'total_eggs' => 1000,
                    'broken_eggs' => 40,
                    'egg_price' => '0.25',
                    'total_egg_cost' => '250.00',
                    'total_broken_cost' => '10.00',
                ],
            ]);

        // Capacity remains occupied: only 50 more animals fit
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 51,
            ])
            ->assertStatus(422);

        // Egg registration only applies to egg-production lots
        $meatSpecies = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Cerdo Hampshire',
            'category' => 'porcina',
            'is_active' => true,
        ]);
        $meatGalpon = $this->createGalpon($farm, $meatSpecies, ['purpose' => 'carne']);
        $meatLotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $meatGalpon->id,
                'species_id' => $meatSpecies->id,
                'quantity' => 10,
            ])
            ->assertStatus(201)
            ->json('data.id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$meatLotId}/eggs", [
                'total_eggs' => 10,
                'egg_price' => 0.25,
            ])
            ->assertStatus(422);
    }

    /**
     * Cosechar un lote de postura (huevos): libera el cupo del galpón
     * y marca el lote como INACTIVO (fin de ciclo de postura), sin
     * requerir peso ni precio de venta.
     */
    public function test_egg_lot_harvest_releases_capacity_and_inactivates(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Cosecha Huevos', 'admin_cosecha_huevos@test.com');

        $species = $this->createSpecies($farm, 'avícola');
        $galpon = $this->createGalpon($farm, $species, [
            'category' => 'avícola',
            'sector' => 'avícola',
            'purpose' => 'huevos',
            'max_capacity' => 100,
        ]);

        $auth = fn () => $this->withHeader('Authorization', 'Bearer '.$token);

        $lotId = $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 50,
        ])->assertStatus(201)->json('data.id');

        // Registrar producción de huevos (NO libera cupo)
        $auth()->postJson("/api/v1/lots/{$lotId}/eggs", [
            'total_eggs' => 1000,
            'broken_eggs' => 40,
            'egg_price' => 0.25,
        ])->assertStatus(200);

        // Cosecha COMPLETA del lote de postura (sin peso ni precio)
        $auth()->postJson("/api/v1/lots/{$lotId}/harvest", [
            'quantity' => 50,
        ])->assertStatus(200)
            ->assertJsonPath('data.status', 'inactivo')
            ->assertJsonPath('data.quantity', 0);

        $this->assertDatabaseHas('lots', [
            'id' => $lotId,
            'status' => 'inactivo',
            'quantity' => 0,
        ]);

        // Habilitar el módulo de galpones para leer la ocupación
        $galponesModule = Module::where('code', 'barns')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $galponesModule->id)
            ->update(['is_enabled' => true]);

        // El cupo del galpón quedó liberado (0 ocupados de 100)
        $data = $auth()->getJson('/api/v1/galpones')->assertStatus(200)->json('data');
        $barn = collect($data)->firstWhere('id', $galpon->id);

        $this->assertSame(0, (int) $barn['occupied_capacity'], 'La cosecha del lote de postura debe liberar el cupo.');
        $this->assertSame(100, (int) $barn['available_capacity']);

        // El "Costo Total de Cosecha" del lote avícola incluye el
        // acumulado del costo de producción de huevos (1000 × 0.25
        // = 250), aunque la cosecha no registre peso ni precio.
        $lots = $auth()->getJson('/api/v1/lots')->assertStatus(200)->json('data');
        $eggLot = collect($lots)->firstWhere('id', $lotId);
        $this->assertNotNull($eggLot, 'El lote de postura debe estar en la lista.');
        $this->assertEquals(
            250.0,
            round((float) ($eggLot['harvest_cost'] ?? 0), 2),
            'El costo total de cosecha debe sumar el acumulado de la producción de huevos.'
        );
    }

    /**
     * La validación de propósito para registrar huevos acepta tanto
     * "huevos" como "postura" (y variantes de mayúsculas/acentos),
     * alineada con la lógica del frontend. Antes un lote con propósito
     * "postura" recibía el falso error "solo aplica a lotes de producción
     * de huevos".
     */
    public function test_egg_registration_accepts_postura_purpose(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Postura', 'admin_postura@test.com');

        $species = $this->createSpecies($farm, 'avícola');

        foreach (['postura', 'Postura', 'HUEVOS', 'huevos'] as $purpose) {
            $galpon = $this->createGalpon($farm, $species, [
                'category' => 'avícola',
                'sector' => 'avícola',
                'purpose' => $purpose,
                'max_capacity' => 100,
            ]);

            $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
                ->postJson('/api/v1/lots', [
                    'galpon_id' => $galpon->id,
                    'species_id' => $species->id,
                    'quantity' => 50,
                ])->assertStatus(201)->json('data.id');

            // El propósito se hereda del galpón; el registro de huevos
            // debe aceptarse sin el falso error de propósito
            $this->withHeader('Authorization', 'Bearer '.$token)
                ->postJson("/api/v1/lots/{$lotId}/eggs", [
                    'total_eggs' => 500,
                    'broken_eggs' => 10,
                    'egg_price' => 0.25,
                ])
                ->assertStatus(200)
                ->assertJsonPath('data.total_eggs', 500)
                ->assertJsonPath('data.total_egg_cost', '125.00') // 500 completos × 0.25
                ->assertJsonPath('data.total_broken_cost', '2.50'); // 10 × 0.25
        }
    }

    public function test_lote_multi_farm_isolation_on_index_and_boundary_checks(): void
    {
        [$farmA, $adminA, $tokenA] = $this->createFarmWithAdmin('Granja A', 'admin_lotes_a@test.com');
        [$farmB, $adminB, $tokenB] = $this->createFarmWithAdmin('Granja B', 'admin_lotes_b@test.com');

        $speciesA = $this->createSpecies($farmA);
        $galponA = $this->createGalpon($farmA, $speciesA);

        $lotA = $this->withHeader('Authorization', 'Bearer '.$tokenA)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galponA->id,
                'species_id' => $speciesA->id,
                'quantity' => 10,
            ])
            ->assertStatus(201)
            ->json('data.id');

        // Farm B only sees its own lots (none)
        $this->withHeader('Authorization', 'Bearer '.$tokenB)
            ->getJson('/api/v1/lots')
            ->assertStatus(200)
            ->assertJson(['data' => []]);

        // Farm B cannot read farm A's lot
        $this->withHeader('Authorization', 'Bearer '.$tokenB)
            ->getJson("/api/v1/lots/{$lotA}")
            ->assertStatus(404);

        // Farm B cannot harvest farm A's lot
        $this->withHeader('Authorization', 'Bearer '.$tokenB)
            ->postJson("/api/v1/lots/{$lotA}/harvest", [
                'avg_weight' => 100,
                'price_per_kg' => 2,
            ])
            ->assertStatus(404);

        // Farm A sees its lot
        $this->withHeader('Authorization', 'Bearer '.$tokenA)
            ->getJson('/api/v1/lots')
            ->assertStatus(200)
            ->assertJsonFragment(['code' => 'LOT-00001']);
    }

    public function test_root_can_manage_lotes_globally_and_filter_by_farm(): void
    {
        $this->artisan('app:init-root');

        $root = User::where('email', 'rosangeles92@gmail.com')->first();
        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'Miranda*30',
        ])->json('data.access_token');

        $farm = Farm::create(['name' => 'Granja Root', 'sector' => 'porcino', 'is_active' => true]);
        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'farm_id' => $farm->id,
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 5,
            ])
            ->assertStatus(201)
            ->assertJson(['data' => ['farm_id' => $farm->id]]);

        // Root sees all farms' lots
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/lots')
            ->assertStatus(200)
            ->assertJsonFragment(['code' => 'LOT-00001']);

        // Root can filter by farm_id
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/lots?farm_id='.$farm->id)
            ->assertStatus(200)
            ->assertJsonFragment(['farm_id' => $farm->id]);

        // Root must specify farm_id when creating
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 5,
            ])
            ->assertStatus(422);
    }

    public function test_cunicola_rabbit_reproduction_animals_store_name_and_color(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Cunícola Reproducción', 'admin_lotes_cunicola@test.com');

        $species = $this->createSpecies($farm, 'cunícola');
        $galpon = $this->createGalpon($farm, $species, ['purpose' => 'reproducción']);

        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 5,
            ])
            ->assertStatus(201)
            ->json('data.id');

        // Cada conejo de reproducción guarda sus características individuales:
        // nombre, descripción de color, fecha de nacimiento y cantidad de partos.
        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/animals", [
                'name' => 'Copito',
                'color' => 'Blanco con manchas negras',
                'gender' => 'hembra',
                'birth_date' => '2025-03-10',
                'parity_count' => 4,
            ])
            ->assertStatus(201)
            ->assertJson([
                'data' => [
                    'name' => 'Copito',
                    'color' => 'Blanco con manchas negras',
                    'gender' => 'hembra',
                    'birth_date' => '2025-03-10',
                    'parity_count' => 4,
                ],
            ]);

        $animalId = $response->json('data.id');

        $this->assertDatabaseHas('lote_animals', [
            'id' => $animalId,
            'name' => 'Copito',
            'color' => 'Blanco con manchas negras',
        ]);

        // Las características individuales se pueden actualizar.
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/v1/lots/animals/{$animalId}", [
                'name' => 'Copito II',
                'color' => 'Gris',
                'parity_count' => 5,
            ])
            ->assertStatus(200)
            ->assertJson([
                'data' => [
                    'name' => 'Copito II',
                    'color' => 'Gris',
                    'parity_count' => 5,
                ],
            ]);

        $this->assertDatabaseHas('lote_animals', [
            'id' => $animalId,
            'name' => 'Copito II',
            'color' => 'Gris',
            'parity_count' => 5,
        ]);
    }

    public function test_cunicola_reproduction_process_uses_species_terms(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Cunícola Proceso', 'admin_lotes_cunicola_proc@test.com');

        $species = $this->createSpecies($farm, 'cunícola');
        $galpon = $this->createGalpon($farm, $species, ['purpose' => 'reproducción']);

        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 2,
            ])
            ->assertStatus(201)
            ->json('data.id');

        $animalId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201)
            ->json('data.id');

        // Un servicio de gestación pasa a la coneja a "gestación".
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalId}/services", [
                'service_type' => 'monta',
                'service_date' => '2026-09-01',
                'status' => 'gestación',
            ])
            ->assertStatus(201);

        // Estando en gestación no puede recibir otro servicio: el mensaje
        // referencia a la especie (coneja), no a la cerda por defecto.
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalId}/services", [
                'service_type' => 'monta',
                'service_date' => '2026-09-10',
                'status' => 'gestación',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'La coneja se encuentra actualmente en gestación; debe registrar su destete/parto.');

        // El destete exige total y vivos, con el término propio de la especie.
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalId}/services", [
                'service_type' => 'parto',
                'service_date' => '2026-10-02',
                'status' => 'destete',
            ])
            ->assertStatus(422)
            ->assertJsonPath('errors.total_piglets.0', 'El total de gazapos es obligatorio al registrar el destete/parto.');
    }

    public function test_reproduction_animals_and_services_flow(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Reproducción', 'admin_lotes_repro@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['purpose' => 'reproducción']);

        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 20,
            ])
            ->assertStatus(201)
            ->json('data.id');

        // Register individual breeding pigs with automatic 5-digit identifiers
        $first = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/animals", [
                'breed' => 'Landrace',
                'father_breed' => 'Duroc',
                'mother_breed' => 'Yorkshire',
                'gender' => 'hembra',
                'birth_date' => '2025-01-15',
                'parity_count' => 3,
                'teats_count' => 14,
                'avg_piglets_per_birth' => 11.5,
            ])
            ->assertStatus(201);

        $first->assertJson([
            'data' => [
                'identifier' => '00001',
                'lote_id' => $lotId,
                'gender' => 'hembra',
                'status' => 'activo',
            ],
        ]);

        $animalId = $first->json('data.id');

        $secondAnimalId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/animals", [
                'gender' => 'macho',
            ])
            ->assertStatus(201)
            ->assertJson(['data' => ['identifier' => '00002']])
            ->json('data.id');

        // Gender validation
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/animals", [
                'gender' => 'otro',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['gender']);

        // Register an insemination service that results in gestation
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalId}/services", [
                'service_type' => 'inseminación',
                'service_date' => '2026-09-01',
                'status' => 'gestación',
                'pregnancy_date' => '2026-09-05',
            ])
            ->assertStatus(201)
            ->assertJson([
                'data' => [
                    'service_type' => 'inseminación',
                    'status' => 'gestación',
                ],
            ]);

        // Animal status synced to gestation
        $this->assertDatabaseHas('lote_animals', [
            'id' => $animalId,
            'status' => 'gestación',
        ]);

        // Service history
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson("/api/v1/lots/animals/{$animalId}/services")
            ->assertStatus(200)
            ->assertJson(['total_services' => 1]);

        // Animal list within the lot
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson("/api/v1/lots/{$lotId}/animals")
            ->assertStatus(200)
            ->assertJson(['total_animals' => 2]);

        // Invalid service type
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalId}/services", [
                'service_type' => 'vacunación',
                'service_date' => '2026-09-10',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['service_type']);

        // REGLA 1: una cerda en gestación no puede recibir
        // otro servicio (inseminación / monta). Solo se
        // permite el registro de su destete / parto.
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalId}/services", [
                'service_type' => 'monta',
                'service_date' => '2026-09-10',
                'status' => 'gestación',
            ])
            ->assertStatus(422)
            ->assertJson([
                'status' => 'error',
                'message' => 'La cerda se encuentra actualmente en gestación; debe registrar su destete/parto.',
            ]);

        // También se bloquea un servicio sin estado explícito
        // (activo por defecto) sobre una cerda gestante.
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalId}/services", [
                'service_type' => 'inseminación',
                'service_date' => '2026-09-11',
            ])
            ->assertStatus(422)
            ->assertJson([
                'message' => 'La cerda se encuentra actualmente en gestación; debe registrar su destete/parto.',
            ]);

        // El destete / parto exige fecha del parto y lechones
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalId}/services", [
                'service_type' => 'parto',
                'service_date' => '2027-01-03',
                'status' => 'destete',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['birth_date', 'total_piglets', 'live_piglets']);

        // Los lechones vivos no pueden superar el total
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalId}/services", [
                'service_type' => 'parto',
                'service_date' => '2027-01-03',
                'status' => 'destete',
                'birth_date' => '2027-01-03',
                'total_piglets' => 10,
                'live_piglets' => 12,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['live_piglets']);

        // REGLA 2: registro de Destete / Parto. La cerda vuelve
        // a "activo" (ya destetó a los lechones) y su contador
        // de partos (parity_count = 3 al nacer el registro)
        // aumenta en uno.
        $weaningResponse = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalId}/services", [
                'service_type' => 'parto',
                'service_date' => '2027-01-03',
                'status' => 'destete',
                'birth_date' => '2027-01-03',
                'total_piglets' => 12,
                'live_piglets' => 11,
            ])
            ->assertStatus(201)
            ->assertJson([
                'data' => [
                    'service_type' => 'parto',
                    'status' => 'destete',
                    'total_piglets' => 12,
                    'live_piglets' => 11,
                ],
            ])
            ->json('data');

        $this->assertStringStartsWith(
            '2027-01-03',
            (string) $weaningResponse['birth_date'],
            'La fecha del parto debe registrarse en el servicio.'
        );

        $this->assertDatabaseHas('lote_animals', [
            'id' => $animalId,
            'status' => 'activo',
            'parity_count' => 4,
        ]);

        // Ciclo reiniciado: la cerda activa puede recibir
        // nuevamente un servicio (inseminación / monta).
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalId}/services", [
                'service_type' => 'inseminación',
                'service_date' => '2027-02-15',
                'status' => 'gestación',
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('lote_animals', [
            'id' => $animalId,
            'status' => 'gestación',
        ]);

        // Cualquier servicio reproductivo exitoso (incluso con el
        // estado por defecto 'activo' que envía el frontend) pone
        // al animal en gestación automáticamente.
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$secondAnimalId}/services", [
                'service_type' => 'inseminación',
                'service_date' => '2026-09-12',
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('lote_animals', [
            'id' => $secondAnimalId,
            'status' => 'gestación',
        ]);
    }

    /**
     * Regla estricta de capacidad: la gestación NO libera
     * cupo. El cupo ocupado del galpón (suma de la ocupación
     * actual de cada lote activo: animales activos + en
     * gestación + destetados) solo disminuye cuando un
     * animal pasa a un estado de salida definitiva
     * (cosechado / vendido / descartado / muerto).
     */
    public function test_gestation_does_not_free_barn_capacity(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Cupo Gestación', 'admin_lotes_cupo@test.com');

        // Habilitar el módulo de galpones para leer la
        // ocupación del galpón desde la API (el mismo
        // endpoint que usa el frontend: occupied_capacity
        // y available_capacity).
        $galponesModule = Module::where('code', 'barns')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $galponesModule->id)
            ->update(['is_enabled' => true]);

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['max_capacity' => 10]);

        $barnOccupancy = function () use ($token, $galpon) {
            $data = $this->withHeader('Authorization', 'Bearer '.$token)
                ->getJson('/api/v1/galpones')
                ->assertStatus(200)
                ->json('data');

            $barn = collect($data)->firstWhere('id', $galpon->id);
            $this->assertNotNull($barn, 'El galpón debe ser visible para el administrador de la granja.');

            return $barn;
        };

        // Lote de 5 cerdas: se registran las 5 animales
        // (como en el flujo real del formulario) y ocupan
        // 5 de los 10 cupos del galpón
        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 5,
            ])
            ->assertStatus(201)
            ->json('data.id');

        $animalId = null;
        for ($i = 0; $i < 5; $i++) {
            $id = $this->withHeader('Authorization', 'Bearer '.$token)
                ->postJson("/api/v1/lots/{$lotId}/animals", [
                    'gender' => 'hembra',
                ])
                ->assertStatus(201)
                ->json('data.id');

            $animalId ??= $id;
        }

        // Ocupación inicial: 5 de 10 cupos
        $barn = $barnOccupancy();
        $this->assertSame(5, (int) $barn['occupied_capacity']);
        $this->assertSame(5, (int) $barn['available_capacity']);

        // Registrar servicio (inseminación): la cerda pasa a gestación
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalId}/services", [
                'service_type' => 'inseminación',
                'service_date' => '2026-10-01',
                'status' => 'gestación',
            ])
            ->assertStatus(201);

        // REGLA 1: la gestación NO libera cupo. La cerda
        // sigue ocupando físicamente su lugar en el galpón.
        $this->assertDatabaseHas('lote_animals', [
            'id' => $animalId,
            'status' => 'gestación',
        ]);
        $this->assertDatabaseHas('lots', [
            'id' => $lotId,
            'quantity' => 5,
        ]);

        $barn = $barnOccupancy();
        $this->assertSame(5, (int) $barn['occupied_capacity'], 'La gestación no debe liberar cupo en el galpón.');
        $this->assertSame(5, (int) $barn['available_capacity'], 'La gestación no debe liberar cupo en el galpón.');

        // Registrar destete / parto: la cerda vuelve a
        // "activo" sin liberar cupo (nunca salió de la
        // producción).
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalId}/services", [
                'service_type' => 'parto',
                'service_date' => '2027-01-15',
                'status' => 'destete',
                'birth_date' => '2027-01-15',
                'total_piglets' => 12,
                'live_piglets' => 11,
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('lote_animals', [
            'id' => $animalId,
            'status' => 'activo',
        ]);
        $this->assertDatabaseHas('lots', [
            'id' => $lotId,
            'quantity' => 5,
        ]);

        $barn = $barnOccupancy();
        $this->assertSame(5, (int) $barn['occupied_capacity'], 'El destete / parto no debe liberar cupo.');
        $this->assertSame(5, (int) $barn['available_capacity'], 'El destete / parto no debe liberar cupo.');

        // Salida definitiva (cosechado): SÍ libera cupo
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/v1/lots/animals/{$animalId}", [
                'status' => 'cosechado',
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('lote_animals', [
            'id' => $animalId,
            'status' => 'cosechado',
        ]);
        $this->assertDatabaseHas('lots', [
            'id' => $lotId,
            'quantity' => 4,
        ]);

        $barn = $barnOccupancy();
        $this->assertSame(4, (int) $barn['occupied_capacity'], 'La cosecha debe liberar cupo.');
        $this->assertSame(6, (int) $barn['available_capacity'], 'La cosecha debe liberar cupo.');
    }

    /**
     * Regla estricta de capacidad: el registro de animales
     * individuales no puede exceder la cantidad declarada
     * del lote (garantiza que la ocupación del galpón
     * sume correctamente a todos los animales activos y
     * en gestación).
     */
    public function test_individual_animal_registration_respects_lot_quantity(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Cupo Lote', 'admin_lotes_cupo_lote@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['purpose' => 'reproducción', 'max_capacity' => 50]);

        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 2,
            ])
            ->assertStatus(201)
            ->json('data.id');

        // Caben los 2 animales que declara el lote
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/animals", [
                'gender' => 'hembra',
            ])
            ->assertStatus(201);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/animals", [
                'gender' => 'macho',
            ])
            ->assertStatus(201);

        // El tercer registro excede la cantidad declarada:
        // el cupo del lote está agotado
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/animals", [
                'gender' => 'hembra',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);
    }

    /**
     * La cantidad actual del lote (`current_occupancy`)
     * incluye a los animales activos Y en gestación:
     * un gestante sigue ocupando espacio y únicamente
     * las salidas definitivas (cosechado / vendido /
     * descartado / muerto) restan ocupación.
     *
     * Escenario: 6 animales → 1 cosechado → 1 en
     * gestación = 5 ocupando espacio (4 activos +
     * 1 gestante).
     */
    public function test_lot_current_occupancy_includes_gestating_animals(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Ocupación', 'admin_lotes_ocup@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['max_capacity' => 20]);

        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 6,
            ])
            ->assertStatus(201)
            ->json('data.id');

        $animalIds = [];
        for ($i = 0; $i < 6; $i++) {
            $animalIds[] = $this->withHeader('Authorization', 'Bearer '.$token)
                ->postJson("/api/v1/lots/{$lotId}/animals", [
                    'gender' => $i % 2 === 0 ? 'hembra' : 'macho',
                ])
                ->assertStatus(201)
                ->json('data.id');
        }

        // Vista general: 6 animales ocupando espacio
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson("/api/v1/lots/{$lotId}")
            ->assertStatus(200)
            ->assertJsonPath('data.quantity', 6)
            ->assertJsonPath('data.current_occupancy', 6);

        // Se cosecha 1: salida definitiva, libera cupo
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/v1/lots/animals/{$animalIds[0]}", [
                'status' => 'cosechado',
            ])
            ->assertStatus(200);

        // Otro animal pasa a gestación: SIGUE ocupando
        // físicamente su lugar en el galpón
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalIds[1]}/services", [
                'service_type' => 'inseminación',
                'service_date' => '2026-10-05',
                'status' => 'gestación',
            ])
            ->assertStatus(201);

        // La cantidad actual del lote refleja al gestante:
        // 6 - 1 cosechado = 5 (4 activos + 1 en gestación)
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson("/api/v1/lots/{$lotId}")
            ->assertStatus(200)
            ->assertJsonPath('data.quantity', 5)
            ->assertJsonPath('data.current_occupancy', 5);

        // La tabla principal (lista de lotes) y la vista
        // general también reportan la ocupación real
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/lots')
            ->assertStatus(200)
            ->assertJsonPath('data.0.current_occupancy', 5)
            ->assertJsonPath('stats.in_production_animals', 5);

        // La ocupación del galpón incluye a la cerda gestante
        $galponesModule = Module::where('code', 'barns')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $galponesModule->id)
            ->update(['is_enabled' => true]);

        $data = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/galpones')
            ->assertStatus(200)
            ->json('data');

        $barn = collect($data)->firstWhere('id', $galpon->id);
        $this->assertSame(5, (int) $barn['occupied_capacity'], 'La ocupación del galpón debe incluir a la cerda en gestación.');
        $this->assertSame(15, (int) $barn['available_capacity']);

        // Una mortalidad (salida definitiva) sí resta
        // ocupación del lote y del galpón
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/v1/lots/animals/{$animalIds[2]}", [
                'status' => 'muerto',
            ])
            ->assertStatus(200);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson("/api/v1/lots/{$lotId}")
            ->assertStatus(200)
            ->assertJsonPath('data.quantity', 4)
            ->assertJsonPath('data.current_occupancy', 4);
    }

    /**
     * La ocupación del galpón (ocupados / capacidad máxima)
     * cuenta a los animales ACTIVOS y en GESTACIÓN de los
     * lotes activos, e incluye también los lotes sin
     * seguimiento individual (ej. engorde), que aportan su
     * cantidad declarada.
     */
    public function test_barn_occupied_capacity_counts_active_and_gestating_animals(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Cupo Galpón', 'admin_cupo_galpon@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['max_capacity' => 10]);

        $auth = fn () => $this->withHeader('Authorization', 'Bearer '.$token);

        // Lote de carne (sin seguimiento individual): 4 declarados
        $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 4,
        ])->assertStatus(201);

        // Lote de reproducción con 2 cerdas registradas
        $lotId = $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 2,
        ])->assertStatus(201)->json('data.id');

        $sowId = $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201)->json('data.id');

        $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201);

        // Una cerda pasa a gestación: sigue ocupando espacio
        $auth()->postJson("/api/v1/lots/animals/{$sowId}/services", [
            'service_type' => 'inseminación',
            'service_date' => '2026-10-06',
            'status' => 'gestación',
        ])->assertStatus(201);

        // El módulo de galpones habilitado para consultar cupos
        $galponesModule = Module::where('code', 'barns')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $galponesModule->id)
            ->update(['is_enabled' => true]);

        // Galpón: 4 (carne) + 2 (1 activa + 1 gestante) = 6 / 10
        $data = $auth()->getJson('/api/v1/galpones')->assertStatus(200)->json('data');
        $barn = collect($data)->firstWhere('id', $galpon->id);

        $this->assertSame(6, (int) $barn['occupied_capacity'], 'Debe contar animales activos, en gestación y lotes sin seguimiento individual.');
        $this->assertSame(4, (int) $barn['available_capacity']);

        // El lote de carne reporta su cantidad como ocupación actual
        $lots = $auth()->getJson('/api/v1/lots')->assertStatus(200)->json('data');
        $meatLot = collect($lots)->firstWhere('quantity', 4);

        $this->assertNotNull($meatLot, 'El lote de carne debe estar en la lista.');
        $this->assertSame(4, (int) $meatLot['current_occupancy'], 'Un lote sin animales registrados debe mostrar su cantidad declarada.');
    }

    /**
     * La columna "Cupo del Galpón" debe reflejar
     * [Ocupación Actual] / [Capacidad Máxima], donde la
     * ocupación actual es la SUMA de la cantidad de animales
     * de TODOS los lotes ACTIVOS alojados en ese galpón.
     *
     * Un lote inactivo (cosechado/vendido) ya no ocupa cupo,
     * por lo que NO debe sumarse al numerador.
     */
    public function test_barn_capacity_column_sums_only_active_lots_and_releases_on_harvest(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Cupo Columna', 'admin_cupo_columna@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['max_capacity' => 100]);

        $auth = fn () => $this->withHeader('Authorization', 'Bearer '.$token);

        // Lote activo de 50 animales alojados
        $lotId = $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 50,
        ])->assertStatus(201)->json('data.id');

        $galponesModule = Module::where('code', 'barns')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $galponesModule->id)
            ->update(['is_enabled' => true]);

        // La ocupación debe ser 50 / 100 (NO 100 / 100)
        $data = $auth()->getJson('/api/v1/galpones')->assertStatus(200)->json('data');
        $barn = collect($data)->firstWhere('id', $galpon->id);
        $this->assertSame(50, (int) $barn['occupied_capacity'], 'La ocupación debe ser la suma de los lotes activos (50).');
        $this->assertSame(50, (int) $barn['available_capacity']);

        // El lote se inactiva (cosecha): el cupo se libera
        $auth()->putJson("/api/v1/lots/{$lotId}", ['status' => 'inactivo'])
            ->assertStatus(200);

        // Tras inactivar, la ocupación baja a 0 / 100
        $data = $auth()->getJson('/api/v1/galpones')->assertStatus(200)->json('data');
        $barn = collect($data)->firstWhere('id', $galpon->id);
        $this->assertSame(0, (int) $barn['occupied_capacity'], 'Un lote inactivo ya no debe ocupar cupo del galpón.');
        $this->assertSame(100, (int) $barn['available_capacity']);
    }

    /**
     * La tarjeta "Animales en Producción" cuenta a los
     * animales REALMENTE alojados: los lotes de carne sin
     * seguimiento individual aportan su cantidad declarada
     * y las cerdas registradas (activas o en gestación) se
     * cuentan por registro, aunque el `quantity` declarado
     * del lote haya quedado por debajo tras una edición.
     */
    public function test_production_animals_stat_counts_real_animals_over_declared_quantity(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Métrica Producción', 'admin_metrica_prod@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['max_capacity' => 120]);

        $auth = fn () => $this->withHeader('Authorization', 'Bearer '.$token);

        // Lote de carne: 100 animales declarados
        // (sin seguimiento individual)
        $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 100,
        ])->assertStatus(201);

        // Lote de reproducción con 2 cerdas registradas
        $lotId = $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 2,
        ])->assertStatus(201)->json('data.id');

        $sowId = $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201)->json('data.id');

        $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201);

        // Una cerda pasa a gestación: sigue alojada en el galpón
        $auth()->postJson("/api/v1/lots/animals/{$sowId}/services", [
            'service_type' => 'inseminación',
            'service_date' => '2026-10-07',
            'status' => 'gestación',
        ])->assertStatus(201);

        // El `quantity` declarado del lote de reproducción
        // queda por debajo de los animales reales (dato
        // desincronizado por una edición posterior)
        Lot::whereKey($lotId)->update(['quantity' => 1]);

        // La tarjeta "Animales en Producción" muestra los
        // animales reales: 100 (carne) + 2 cerdas (1 activa
        // + 1 gestante) = 102, y NO la suma de `quantity`
        // declarado (101)
        $stats = $auth()->getJson('/api/v1/lots')->assertStatus(200)->json('stats');

        $this->assertSame(101, (int) $stats['total_animals'], 'total_animals sigue siendo la suma del quantity declarado.');
        $this->assertSame(102, (int) $stats['in_production_animals'], 'Animales en Producción debe contar los animales reales: activos + gestación, incluyendo lotes sin seguimiento individual.');

        // Y coincide con la ocupación del galpón
        $galponesModule = Module::where('code', 'barns')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $galponesModule->id)
            ->update(['is_enabled' => true]);

        $data = $auth()->getJson('/api/v1/galpones')->assertStatus(200)->json('data');
        $barn = collect($data)->firstWhere('id', $galpon->id);

        $this->assertSame(102, (int) $barn['occupied_capacity'], 'La ocupación del galpón debe coincidir con los animales en producción.');
    }

    /**
     * Ciclo completo de destete porcino: la cerda en
     * gestación registra su parto/destete (fecha, total y
     * lechones vivos obligatorios), vuelve a "activo" con
     * parity_count incrementado y se ofrece crear el lote
     * de lechones con la cantidad EXACTA de vivos,
     * validando estrictamente el cupo del galpón destino.
     */
    public function test_weaned_piglet_lot_creation_respects_barn_capacity(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Ciclo Destete', 'admin_ciclo_destete@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['max_capacity' => 10]);

        $auth = fn () => $this->withHeader('Authorization', 'Bearer '.$token);

        // Lote de reproducción con 2 cerdas
        $lotId = $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 2,
        ])->assertStatus(201)->json('data.id');

        $sowA = $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra', 'parity_count' => 2])
            ->assertStatus(201)->json('data.id');
        $sowB = $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201)->json('data.id');

        foreach ([$sowA, $sowB] as $sow) {
            $auth()->postJson("/api/v1/lots/animals/{$sow}/services", [
                'service_type' => 'inseminación',
                'service_date' => '2026-06-01',
                'status' => 'gestación',
            ])->assertStatus(201);
        }

        // Un destete NO puede registrarse con un tipo de
        // servicio distinto de "parto"
        $auth()->postJson("/api/v1/lots/animals/{$sowA}/services", [
            'service_type' => 'monta',
            'service_date' => '2026-09-23',
            'status' => 'destete',
            'birth_date' => '2026-09-23',
            'total_piglets' => 10,
            'live_piglets' => 8,
        ])->assertStatus(422)
            ->assertJsonPath('errors.service_type.0', 'El registro de destete/parto debe usar el tipo de servicio "parto".');

        // Destete / parto de la cerda A: 10 nacidos, 8 vivos
        $auth()->postJson("/api/v1/lots/animals/{$sowA}/services", [
            'service_type' => 'parto',
            'service_date' => '2026-09-23',
            'status' => 'destete',
            'birth_date' => '2026-09-23',
            'total_piglets' => 10,
            'live_piglets' => 8,
        ])->assertStatus(201);

        // La cerda vuelve a "activo" y su contador de partos
        // aumenta en uno (2 → 3)
        $this->assertDatabaseHas('lote_animals', [
            'id' => $sowA,
            'status' => 'activo',
            'parity_count' => 3,
        ]);

        // Se crea el lote de lechones con la cantidad EXACTA
        // de vivos (8): el galpón tiene 10 - 2 = 8 cupos
        $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 8,
        ])->assertStatus(201);

        // Segundo destete (cerda B, 3 lechones vivos): el
        // galpón ya está lleno (2 cerdas + 8 lechones = 10
        // de 10) y la creación del lote se BLOQUEA
        $auth()->postJson("/api/v1/lots/animals/{$sowB}/services", [
            'service_type' => 'parto',
            'service_date' => '2026-09-24',
            'status' => 'destete',
            'birth_date' => '2026-09-24',
            'total_piglets' => 6,
            'live_piglets' => 3,
        ])->assertStatus(201);

        $this->assertDatabaseHas('lote_animals', [
            'id' => $sowB,
            'status' => 'activo',
        ]);

        $response = $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 3,
        ])->assertStatus(422);

        $this->assertStringContainsString(
            'excede la capacidad disponible',
            $response->json('message'),
            'Sin cupo, la creación del lote de lechones debe bloquearse con un mensaje claro.'
        );
    }

    /**
     * Los lechones destetados pendientes de formar un lote se
     * PERSISTEN en backend: la alerta del frontend sobrevive a
     * un refresco de página (GET /lots/{id}/weaned-pending) y
     * solo desaparece cuando se crea el lote de lechones
     * vinculado (`from_service_ids`) con la cantidad EXACTA de
     * vivos, validando además la disponibilidad del galpón.
     */
    public function test_weaned_piglets_pending_persist_until_lot_created(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Lechones Pendientes', 'admin_lechones_pend@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['max_capacity' => 30]);

        $auth = fn () => $this->withHeader('Authorization', 'Bearer '.$token);

        $lotId = $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 2,
        ])->assertStatus(201)->json('data.id');

        $sowId = $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201)->json('data.id');

        $auth()->postJson("/api/v1/lots/animals/{$sowId}/services", [
            'service_type' => 'inseminación',
            'service_date' => '2026-06-01',
            'status' => 'gestación',
        ])->assertStatus(201);

        // Destete con 14 nacidos y 12 vivos: los 12 quedan
        // PENDIENTES persistidos en BD
        $destete = $auth()->postJson("/api/v1/lots/animals/{$sowId}/services", [
            'service_type' => 'parto',
            'service_date' => '2026-09-23',
            'status' => 'destete',
            'birth_date' => '2026-09-23',
            'total_piglets' => 14,
            'live_piglets' => 12,
        ])->assertStatus(201)->json('data');

        $this->assertSame(12, (int) $destete['pending_piglets'], 'El destete debe persistir sus lechones vivos como pendientes.');

        // Endpoint que consulta el frontend al abrir el lote /
        // tras un refresco: devuelve los 12 pendientes
        $pending = $auth()->getJson("/api/v1/lots/{$lotId}/weaned-pending")
            ->assertStatus(200)
            ->json('data');

        $this->assertSame(12, (int) $pending['pending_piglets']);
        $serviceId = $pending['services'][0]['id'];

        // Cantidad DISTINTA a los pendientes: 422
        $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 10,
            'from_service_ids' => [$serviceId],
        ])->assertStatus(422)
            ->assertJsonPath(
                'errors.quantity.0',
                'La cantidad del lote debe coincidir exactamente con los 12 lechones vivos pendientes de destete.'
            );

        // Los pendientes siguen intactos tras el intento fallido
        $auth()->getJson("/api/v1/lots/{$lotId}/weaned-pending")
            ->assertStatus(200)
            ->assertJsonPath('data.pending_piglets', 12);

        // Lote de lechones con la cantidad EXACTA (12), vinculado
        $pigletLotId = $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 12,
            'from_service_ids' => [$serviceId],
        ])->assertStatus(201)->json('data.id');

        // La alerta desaparece: pendientes resueltos y lote enlazado
        $auth()->getJson("/api/v1/lots/{$lotId}/weaned-pending")
            ->assertStatus(200)
            ->assertJsonPath('data.pending_piglets', 0);

        $this->assertDatabaseHas('animal_services', [
            'id' => $serviceId,
            'pending_piglets' => 0,
            'piglet_lot_id' => $pigletLotId,
        ]);

        // Reutilizar el mismo destete: 422 (ya resuelto)
        $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 12,
            'from_service_ids' => [$serviceId],
        ])->assertStatus(422)
            ->assertJsonPath('errors.from_service_ids.0', 'Uno o más registros de destete ya fueron asignados a un lote de lechones.');
    }

    public function test_reproduction_animal_registration_rejected_for_non_reproduction_lot(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Engorde', 'admin_lotes_engorde@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['purpose' => 'carne']);

        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 10,
            ])
            ->assertStatus(201)
            ->json('data.id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/animals", [
                'gender' => 'hembra',
            ])
            ->assertStatus(422);
    }

    public function test_lote_stats_endpoint_returns_accurate_kpis(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Stats', 'admin_lotes_stats@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['purpose' => 'carne', 'max_capacity' => 500]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 100,
            ])
            ->assertStatus(201);

        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 50,
            ])
            ->assertStatus(201)
            ->json('data.id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/harvest", [
                'avg_weight' => 100,
                'price_per_kg' => 2,
            ])
            ->assertStatus(200);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/lots/stats')
            ->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'total_lotes' => 2,
                'active_lotes' => 1,
                'inactive_lotes' => 1,
                'total_animals' => 100,
            ]);
    }

    public function test_cannot_delete_active_lot_must_harvest_first(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Eliminar', 'admin_lotes_delete@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['purpose' => 'carne']);

        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 10,
            ])
            ->assertStatus(201)
            ->json('data.id');

        // Active lot with animals cannot be deleted
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson("/api/v1/lots/{$lotId}")
            ->assertStatus(422);

        // Harvest then delete
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/harvest", [
                'avg_weight' => 100,
                'price_per_kg' => 2,
            ])
            ->assertStatus(200);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson("/api/v1/lots/{$lotId}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('lots', ['id' => $lotId]);
    }

    public function test_validation_requires_species_and_destination(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Validación', 'admin_lotes_valid@test.com');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['species_id', 'quantity']);

        // Destination is required according to the species' sector
        $species = $this->createSpecies($farm);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'species_id' => $species->id,
                'quantity' => 5,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['galpon_id']);

        // Species must belong to the same farm
        $otherFarm = Farm::create(['name' => 'Otra Granja', 'sector' => 'porcino', 'is_active' => true]);
        $otherSpecies = $this->createSpecies($otherFarm);
        $galpon = $this->createGalpon($farm, $species);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $otherSpecies->id,
                'quantity' => 5,
            ])
            ->assertStatus(422);

        // Species must match the barn's species
        $otherLocalSpecies = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Cerdo Duroc',
            'category' => 'porcina',
            'is_active' => true,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $otherLocalSpecies->id,
                'quantity' => 5,
            ])
            ->assertStatus(422);
    }

    public function test_selling_individual_animal_updates_status_and_releases_lot_capacity(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Venta Cerdos', 'admin_venta_cerdos@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['purpose' => 'reproducción', 'max_capacity' => 100]);

        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 3,
            ])
            ->assertStatus(201)
            ->json('data.id');

        $animalId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201)
            ->json('data.id');

        $this->assertDatabaseHas('lote_animals', ['id' => $animalId, 'status' => 'activo']);

        // Cosecha / Venta individual: estado fuera de producción + total automático
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/v1/lots/animals/{$animalId}", [
                'sale_weight' => 110.5,
                'sale_price_per_kg' => 3.2,
                'status' => 'cosechado',
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'cosechado');

        // El animal YA NO aparece como activo y la cantidad del lote baja de 3 a 2
        $this->assertDatabaseHas('lote_animals', ['id' => $animalId, 'status' => 'cosechado']);
        $this->assertDatabaseHas('lots', ['id' => $lotId, 'quantity' => 2]);
        $this->assertEqualsWithDelta(
            353.6,
            (float) LoteAnimal::find($animalId)->sale_total_price,
            0.01,
            'sale_total_price debe calcularse automáticamente (110.5 kg × 3.20).'
        );

        // Cambiar entre estados fuera de producción (cosechado -> vendido)
        // NO debe descontar la cantidad una segunda vez
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/v1/lots/animals/{$animalId}", ['status' => 'vendido'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'vendido');

        $this->assertDatabaseHas('lots', ['id' => $lotId, 'quantity' => 2]);
        $this->assertDatabaseHas('lote_animals', ['id' => $animalId, 'status' => 'vendido']);

        // El cupo del galpón quedó libre: caben los 98 animales restantes (2 + 98 = 100)
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 98,
            ])
            ->assertStatus(201);

        // En la lista detallada del lote el animal figura como "vendido", no "activo"
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson("/api/v1/lots/{$lotId}/animals")
            ->assertStatus(200)
            ->assertJsonPath('data.0.status', 'vendido');
    }

    public function test_mortality_and_reactivation_sync_lot_quantity_and_capacity(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Reingreso Cerdos', 'admin_reingreso@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['purpose' => 'reproducción', 'max_capacity' => 4]);

        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 3,
            ])
            ->assertStatus(201)
            ->json('data.id');

        $animalId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'macho'])
            ->assertStatus(201)
            ->json('data.id');

        // Mortalidad: baja por enfermedad/accidente → fuera de producción, quantity - 1
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/v1/lots/animals/{$animalId}", ['status' => 'muerto'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'muerto');

        $this->assertDatabaseHas('lots', ['id' => $lotId, 'quantity' => 2]);

        // Reingreso a producción con cupo disponible → quantity + 1
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/v1/lots/animals/{$animalId}", ['status' => 'activo'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'activo');

        $this->assertDatabaseHas('lots', ['id' => $lotId, 'quantity' => 3]);

        // Sacar al animal de producción y llenar el resto del galpón (2 + 2 = 4)
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/v1/lots/animals/{$animalId}", ['status' => 'descartado'])
            ->assertStatus(200);

        $this->assertDatabaseHas('lots', ['id' => $lotId, 'quantity' => 2]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 2,
            ])
            ->assertStatus(201);

        // Reingreso con galpón lleno → 422 y la cantidad NO cambia
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/v1/lots/animals/{$animalId}", ['status' => 'activo'])
            ->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseHas('lots', ['id' => $lotId, 'quantity' => 2]);
        $this->assertDatabaseHas('lote_animals', ['id' => $animalId, 'status' => 'descartado']);
    }

    /**
     * Regla de negocio de cierre automático: al salir el último
     * animal vigente del lote (cantidad = 0), el lote pasa
     * automáticamente a INACTIVO. Si queda al menos un animal
     * vigente, permanece ACTIVO.
     */
    public function test_lot_auto_inactivates_when_last_animal_leaves(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Cierre Automático', 'admin_cierre_auto@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['max_capacity' => 10]);

        $auth = fn () => $this->withHeader('Authorization', 'Bearer '.$token);

        // Lote de reproducción con 2 cerdas registradas
        $lotId = $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 2,
        ])->assertStatus(201)->json('data.id');

        $sowA = $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201)->json('data.id');
        $sowB = $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201)->json('data.id');

        // Salida del primer animal: queda 1 vigente → SIGUE activo
        $auth()->putJson("/api/v1/lots/animals/{$sowA}", ['status' => 'cosechado'])
            ->assertStatus(200);

        $this->assertDatabaseHas('lots', [
            'id' => $lotId,
            'status' => 'activo',
            'quantity' => 1,
        ]);

        // Salida del ÚLTIMO animal: cierre automático a INACTIVO
        $response = $auth()->putJson("/api/v1/lots/animals/{$sowB}", ['status' => 'muerto'])
            ->assertStatus(200);

        // La respuesta del PUT ya refleja el lote inactivo
        $this->assertSame('inactivo', $response->json('data.lote.status'));

        $this->assertDatabaseHas('lots', [
            'id' => $lotId,
            'status' => 'inactivo',
            'quantity' => 0,
        ]);

        // La tabla principal (lista de lotes) trae el status inactivo:
        // la insignia del frontend lo pinta gris con texto "INACTIVO"
        $auth()->getJson('/api/v1/lots')
            ->assertStatus(200)
            ->assertJsonPath('data.0.status', 'inactivo');
    }

    /**
     * Costo total de cosecha por lote: suma del precio total de
     * venta de los animales con estado "cosechado". Lotes sin
     * animales cosechados → 0.
     */
    public function test_lot_harvest_cost_sums_harvested_animals(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Costo Cosecha', 'admin_costo_cosecha@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['max_capacity' => 10]);

        $auth = fn () => $this->withHeader('Authorization', 'Bearer '.$token);

        // Lote de carne (sin seguimiento individual): sin cosechas → 0
        $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 3,
        ])->assertStatus(201);

        $auth()->getJson('/api/v1/lots')
            ->assertStatus(200)
            ->assertJsonPath('data.0.harvest_cost', 0);

        // Lote de reproducción con 2 cerdas
        $lotId = $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 2,
        ])->assertStatus(201)->json('data.id');

        $sowA = $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201)->json('data.id');
        $sowB = $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201)->json('data.id');

        // Cosechar la cerda A: 100 kg × 5 = 500
        $auth()->putJson("/api/v1/lots/animals/{$sowA}", [
            'sale_weight' => 100,
            'sale_price_per_kg' => 5,
            'status' => 'cosechado',
        ])->assertStatus(200);

        $lots = $auth()->getJson('/api/v1/lots')->assertStatus(200)->json('data');
        $reproLot = collect($lots)->firstWhere('id', $lotId);

        $this->assertSame(500.0, (float) $reproLot['harvest_cost']);

        // Cosechar la cerda B: 120 kg × 4 = 480 → acumulado 980
        $auth()->putJson("/api/v1/lots/animals/{$sowB}", [
            'sale_weight' => 120,
            'sale_price_per_kg' => 4,
            'status' => 'cosechado',
        ])->assertStatus(200);

        $lots = $auth()->getJson('/api/v1/lots')->assertStatus(200)->json('data');
        $reproLot = collect($lots)->firstWhere('id', $lotId);

        $this->assertSame(980.0, (float) $reproLot['harvest_cost']);
    }

    /**
     * Costo total de cosecha en lotes cosechados a NIVEL DE LOTE
     * (endpoint harvest): el total se guarda en lots.total_price y no
     * actualiza animales individuales, pero la lista debe mostrarlo
     * igual que el "Resumen de Cosecha" del modal detallado.
     */
    public function test_lot_harvest_cost_includes_lot_level_harvest_total(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Cosecha Lote', 'admin_cosecha_lote@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['max_capacity' => 10]);

        $auth = fn () => $this->withHeader('Authorization', 'Bearer '.$token);

        // Lote de carne (sin seguimiento individual): 5 animales
        $lotId = $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 5,
        ])->assertStatus(201)->json('data.id');

        // Cosecha COMPLETA a nivel de lote: 5 × 80 kg × 5 = 2000
        $auth()->postJson("/api/v1/lots/{$lotId}/harvest", [
            'avg_weight' => 80,
            'price_per_kg' => 5,
        ])->assertStatus(200);

        $this->assertDatabaseHas('lots', [
            'id' => $lotId,
            'total_price' => 2000,
            'status' => 'inactivo',
        ]);

        // La tabla principal muestra el MISMO total que el modal
        // detallado ("Resumen de Cosecha" → total_price = 2000)
        $auth()->getJson('/api/v1/lots')
            ->assertStatus(200)
            ->assertJsonPath('data.0.harvest_cost', 2000);
    }

    /**
     * El costo total de cosecha suma el valor de CADA animal
     * individual que salió de producción (cosechado, vendido,
     * descartado o muerto) con costo registrado, tanto en lotes
     * activos como inactivos.
     */
    public function test_lot_harvest_cost_sums_all_harvested_animal_statuses(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Cosecha Estados', 'admin_cosecha_estados@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['max_capacity' => 10]);

        $auth = fn () => $this->withHeader('Authorization', 'Bearer '.$token);

        $lotId = $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 3,
        ])->assertStatus(201)->json('data.id');

        $sowA = $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201)->json('data.id');
        $sowB = $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201)->json('data.id');
        $sowC = $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201)->json('data.id');

        // Cerda A: vendida (estado 'vendido') con costo → debe sumar
        $auth()->putJson("/api/v1/lots/animals/{$sowA}", [
            'sale_weight' => 100,
            'sale_price_per_kg' => 5,
            'status' => 'vendido',
        ])->assertStatus(200);

        // Cerda B: cosechada con costo → debe sumar
        $auth()->putJson("/api/v1/lots/animals/{$sowB}", [
            'sale_weight' => 120,
            'sale_price_per_kg' => 4,
            'status' => 'cosechado',
        ])->assertStatus(200);

        // Cerda C: sigue activa (sin costo) → no suma

        // Lote activo con 2 animales vendidos/cosechados: 500 + 480 = 980
        $lots = $auth()->getJson('/api/v1/lots')->assertStatus(200)->json('data');
        $lot = collect($lots)->firstWhere('id', $lotId);

        $this->assertSame(980.0, (float) $lot['harvest_cost']);

        // Salida del último animal vigente → lote INACTIVO, pero el
        // acumulado de cosecha se mantiene (980)
        $auth()->putJson("/api/v1/lots/animals/{$sowC}", ['status' => 'muerto'])
            ->assertStatus(200);

        $this->assertDatabaseHas('lots', ['id' => $lotId, 'status' => 'inactivo']);

        $lots = $auth()->getJson('/api/v1/lots')->assertStatus(200)->json('data');
        $lot = collect($lots)->firstWhere('id', $lotId);

        $this->assertSame(980.0, (float) $lot['harvest_cost'], 'El lote inactivo debe conservar el acumulado de cosecha.');
    }

    /**
     * Evita el doble conteo: si un lote tiene animales cosechados
     * individualmente (sale_total_price) Y además `total_price` a nivel
     * de lote, la columna muestra la suma individual (el valor real),
     * NO la suma de ambos.
     */
    public function test_lot_harvest_cost_avoids_double_counting(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Doble Conteo', 'admin_doble_conteo@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['max_capacity' => 10]);

        $auth = fn () => $this->withHeader('Authorization', 'Bearer '.$token);

        $lotId = $auth()->postJson('/api/v1/lots', [
            'galpon_id' => $galpon->id,
            'species_id' => $species->id,
            'quantity' => 2,
        ])->assertStatus(201)->json('data.id');

        $sowA = $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201)->json('data.id');
        $sowB = $auth()->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
            ->assertStatus(201)->json('data.id');

        // Venta individual de ambas cerdas: 500 + 480 = 980 (valor real)
        $auth()->putJson("/api/v1/lots/animals/{$sowA}", [
            'sale_weight' => 100,
            'sale_price_per_kg' => 5,
            'status' => 'cosechado',
        ])->assertStatus(200);

        $auth()->putJson("/api/v1/lots/animals/{$sowB}", [
            'sale_weight' => 120,
            'sale_price_per_kg' => 4,
            'status' => 'cosechado',
        ])->assertStatus(200);

        // Estado inconsistente: total_price a nivel de lote también presente
        Lot::whereKey($lotId)->update(['total_price' => 980]);

        // La columna debe mostrar 980 (suma individual), NO 1960 (doble)
        $lots = $auth()->getJson('/api/v1/lots')->assertStatus(200)->json('data');
        $lot = collect($lots)->firstWhere('id', $lotId);

        $this->assertSame(980.0, (float) $lot['harvest_cost'], 'No debe duplicar el total a nivel de lote cuando ya hay cosechas individuales.');
    }

    public function test_harvesting_one_of_several_animals_updates_only_that_animal_status(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Lote 6 Cerdos', 'admin_lote6@test.com');

        $species = $this->createSpecies($farm);
        $galpon = $this->createGalpon($farm, $species, ['purpose' => 'reproducción', 'max_capacity' => 100]);

        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'galpon_id' => $galpon->id,
                'species_id' => $species->id,
                'quantity' => 6,
            ])
            ->assertStatus(201)
            ->json('data.id');

        // Registrar 6 animales individuales en el lote
        $animalIds = [];
        for ($i = 0; $i < 6; $i++) {
            $animalIds[] = $this->withHeader('Authorization', 'Bearer '.$token)
                ->postJson("/api/v1/lots/{$lotId}/animals", ['gender' => 'hembra'])
                ->assertStatus(201)
                ->json('data.id');
        }

        foreach ($animalIds as $id) {
            $this->assertDatabaseHas('lote_animals', ['id' => $id, 'status' => 'activo']);
        }
        $this->assertDatabaseHas('lots', ['id' => $lotId, 'quantity' => 6]);

        // Procesar cosecha/venta individual del primer animal
        $harvestedId = $animalIds[0];
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/v1/lots/animals/{$harvestedId}", [
                'sale_weight' => 120,
                'sale_price_per_kg' => 3.5,
                'status' => 'cosechado',
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'cosechado');

        // El animal procesado YA NO está activo en la BD
        $this->assertDatabaseHas('lote_animals', ['id' => $harvestedId, 'status' => 'cosechado']);
        // La cantidad del lote bajó de 6 a 5 (cupo liberado)
        $this->assertDatabaseHas('lots', ['id' => $lotId, 'quantity' => 5]);
        // El resto de animales siguen activos
        for ($i = 1; $i < 6; $i++) {
            $this->assertDatabaseHas('lote_animals', ['id' => $animalIds[$i], 'status' => 'activo']);
        }

        // La consulta de animales del lote refleja el estado real:
        // 1 cosechado y 5 activos
        $animals = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson("/api/v1/lots/{$lotId}/animals")
            ->assertStatus(200)
            ->json('data');

        $statuses = array_column($animals, 'status');
        $cosechados = array_filter($statuses, fn ($s) => $s === 'cosechado');
        $activos = array_filter($statuses, fn ($s) => $s === 'activo');
        $this->assertCount(1, $cosechados, 'Debe haber exactamente 1 animal cosechado.');
        $this->assertCount(5, $activos, 'Debe haber exactamente 5 animales activos.');
    }
}
