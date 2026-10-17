<?php

namespace Tests\Feature;

use App\Models\AnimalService;
use App\Models\Farm;
use App\Models\Galpon;
use App\Models\Lot;
use App\Models\LoteAnimal;
use App\Models\Module;
use App\Models\Species;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PigDetailedAttributesTest extends TestCase
{
    use RefreshDatabase;

    private function createFarmWithAdmin(string $name, string $email): array
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => $name,
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        foreach (['lots', 'barns', 'species'] as $code) {
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
            'name' => 'Alfonso',
            'lastname' => 'Guerrero',
            'email' => $email,
            'password_hash' => Hash::make('secret123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'secret123',
        ])->json('data.access_token');

        return [$farm, $admin, $token];
    }

    private function createBreedingLot(Farm $farm, User $admin): Lot
    {
        $species = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Porcino Reproductivo',
            'category' => 'porcinos',
            'is_active' => true,
        ]);

        $galpon = Galpon::create([
            'farm_id' => $farm->id,
            'species_id' => $species->id,
            'name' => 'Galpón Madres 1',
            'category' => 'porcinos',
            'sector' => 'porcinos',
            'purpose' => 'reproducción',
            'max_capacity' => 100,
            'is_active' => true,
        ]);

        static $counter = 1;

        return Lot::create([
            'farm_id' => $farm->id,
            'species_id' => $species->id,
            'galpon_id' => $galpon->id,
            'code' => 'LOT-REP-'.str_pad($counter++, 4, '0', STR_PAD_LEFT),
            'purpose' => 'reproducción',
            'quantity' => 10,
            'initial_quantity' => 10,
            'investment_cost' => 5000.00,
            'status' => Lot::STATUS_ACTIVE,
        ]);
    }

    public function test_lot_animals_endpoint_returns_complete_detailed_pig_attributes(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Porcina El Porvenir', 'admin@porvenir.com');
        $lot = $this->createBreedingLot($farm, $admin);

        // 1. Crear un cerdo reproductor hembra con todos los atributos detallados
        $createResponse = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lot->id}/animals", [
                'breed' => 'Duroc',
                'father_breed' => 'Duroc Puro',
                'mother_breed' => 'Yorkshire',
                'sex' => 'hembra',
                'birth_date' => '2024-05-10',
                'entry_date' => '2025-01-15',
                'weight' => 210.50,
                'teats_count' => 16,
                'parity_count' => 2,
                'avg_piglets_per_birth' => 12.0,
                'accumulated_cost' => 650.00,
                'health_controls' => [
                    ['treatment' => 'Parvovirus + Leptospirosis', 'date' => '2025-02-01', 'dose' => '2ml'],
                    ['treatment' => 'Desparasitación Ivermectina', 'date' => '2025-03-10', 'dose' => '3ml'],
                ],
                'observations' => 'Excelente conformación corporal y aplomos. 16 pezones funcionales.',
            ]);

        $createResponse->assertStatus(201);
        $animalId = $createResponse->json('data.id');
        $identifier = $createResponse->json('data.identifier');

        // 2. Registrar un servicio reproductivo de parto con lechones vivos y muertos
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalId}/services", [
                'service_type' => 'parto',
                'service_date' => '2025-06-01',
                'birth_date' => '2025-06-01',
                'total_piglets' => 14,
                'live_piglets' => 12,
            ])
            ->assertStatus(201);

        // 3. Registrar un servicio de destete
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/animals/{$animalId}/services", [
                'service_type' => 'parto',
                'service_date' => '2025-06-25',
                'birth_date' => '2025-06-01',
                'status' => 'destete',
                'total_piglets' => 12,
                'live_piglets' => 11,
            ])
            ->assertStatus(201);

        // 4. Consultar animales del lote vía GET /api/v1/lots/{lot}/animals
        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson("/api/v1/lots/{$lot->id}/animals");

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'status',
            'message',
            'data' => [
                '*' => [
                    'id',
                    'identifier',
                    'code',
                    'ear_tag',
                    'breed',
                    'sex',
                    'gender',
                    'status',
                    'birth_date',
                    'entry_date',
                    'weight',
                    'teats_count',
                    'farrowings_count',
                    'born_alive',
                    'born_dead',
                    'weaned_count',
                    'accumulated_cost',
                    'health_controls',
                    'observations',
                    'reproductive_summary' => [
                        'is_reproductive',
                        'farrowings_count',
                        'born_alive',
                        'born_dead',
                        'weaned_count',
                        'avg_piglets_per_birth',
                    ],
                    'financial_summary' => [
                        'accumulated_cost',
                    ],
                    'health_summary' => [
                        'status',
                        'controls_count',
                        'recent_controls',
                    ],
                ],
            ],
            'total_animals',
        ]);

        $pig = $response->json('data.0');

        // Verificación de Identificación y Características Físicas
        $this->assertSame($identifier, $pig['code']);
        $this->assertSame($identifier, $pig['ear_tag']);
        $this->assertSame('Duroc', $pig['breed']);
        $this->assertSame('hembra', $pig['sex']);
        $this->assertSame('2024-05-10', substr($pig['birth_date'], 0, 10));
        $this->assertSame('2025-01-15', $pig['entry_date']);
        $this->assertEquals(210.50, $pig['weight']);
        $this->assertSame(16, $pig['teats_count']);

        // Verificación de Datos Reproductivos
        // En los servicios se registraron partos: 12 vivos + 11 en destete = 23 vivos, 2 muertos, 11 destetados
        $this->assertGreaterThanOrEqual(2, $pig['farrowings_count']);
        $this->assertGreaterThanOrEqual(23, $pig['born_alive']);
        $this->assertGreaterThanOrEqual(2, $pig['born_dead']);
        $this->assertGreaterThanOrEqual(11, $pig['weaned_count']);
        $this->assertTrue($pig['reproductive_summary']['is_reproductive']);

        // Verificación de Resumen Financiero y Sanitario
        $this->assertEquals(650.00, $pig['accumulated_cost']);
        $this->assertCount(2, $pig['health_controls']);
        $this->assertSame('Parvovirus + Leptospirosis', $pig['health_controls'][0]['treatment']);
        $this->assertStringContainsString('16 pezones funcionales', $pig['observations']);
    }

    public function test_pigs_resource_endpoints_return_detailed_data_and_enforce_farm_isolation(): void
    {
        [$farmA, $adminA, $tokenA] = $this->createFarmWithAdmin('Granja A', 'adminA@granja.com');
        [$farmB, $adminB, $tokenB] = $this->createFarmWithAdmin('Granja B', 'adminB@granja.com');

        $lotA = $this->createBreedingLot($farmA, $adminA);
        $lotB = $this->createBreedingLot($farmB, $adminB);

        // Crear cerdo en Granja A
        $pigAResponse = $this->withHeader('Authorization', 'Bearer '.$tokenA)
            ->postJson('/api/v1/pigs', [
                'lot_id' => $lotA->id,
                'breed' => 'Landrace',
                'gender' => 'hembra',
                'birth_date' => '2024-08-01',
                'weight' => 195.00,
                'teats_count' => 14,
                'accumulated_cost' => 500.00,
                'observations' => 'Cerda madre reproductora de Granja A',
            ])
            ->assertStatus(201);

        $pigAId = $pigAResponse->json('data.id');

        // Crear cerdo en Granja B
        $this->withHeader('Authorization', 'Bearer '.$tokenB)
            ->postJson('/api/v1/pigs', [
                'lot_id' => $lotB->id,
                'breed' => 'Pietrain',
                'gender' => 'macho',
                'birth_date' => '2024-06-15',
                'weight' => 250.00,
                'teats_count' => 12,
                'accumulated_cost' => 800.00,
                'observations' => 'Verraco reproductor de Granja B',
            ])
            ->assertStatus(201);

        // 1. GET /api/v1/pigs para Granja A solo ve su propio cerdo
        $responseA = $this->withHeader('Authorization', 'Bearer '.$tokenA)
            ->getJson('/api/v1/pigs')
            ->assertStatus(200);

        $this->assertSame(1, $responseA->json('total'));
        $this->assertSame('Landrace', $responseA->json('data.0.breed'));
        $this->assertSame('hembra', $responseA->json('data.0.sex'));

        // 2. Granja B intentando ver el cerdo de Granja A por ID debe recibir 404 o 403
        $this->withHeader('Authorization', 'Bearer '.$tokenB)
            ->getJson("/api/v1/pigs/{$pigAId}")
            ->assertStatus(404);

        // 3. Granja A accediendo a su propio cerdo por ID
        $showResponse = $this->withHeader('Authorization', 'Bearer '.$tokenA)
            ->getJson("/api/v1/pigs/{$pigAId}")
            ->assertStatus(200);

        $this->assertSame('Landrace', $showResponse->json('data.breed'));
        $this->assertSame('00001', $showResponse->json('data.code'));
        $this->assertSame('00001', $showResponse->json('data.ear_tag'));
        $this->assertEquals(195.00, $showResponse->json('data.weight'));
        $this->assertSame(14, $showResponse->json('data.teats_count'));

        // 4. Actualizar cerdo vía PUT /api/v1/pigs/{id}
        $updateResponse = $this->withHeader('Authorization', 'Bearer '.$tokenA)
            ->putJson("/api/v1/pigs/{$pigAId}", [
                'weight' => 205.50,
                'accumulated_cost' => 580.00,
                'health_controls' => [
                    ['treatment' => 'Vacuna Erisipela', 'date' => '2025-04-01'],
                ],
                'notes' => 'Aumento de peso adecuado posparto.',
            ])
            ->assertStatus(200);

        $this->assertEquals(205.50, $updateResponse->json('data.weight'));
        $this->assertEquals(580.00, $updateResponse->json('data.accumulated_cost'));
        $this->assertSame('Aumento de peso adecuado posparto.', $updateResponse->json('data.observations'));
        $this->assertCount(1, $updateResponse->json('data.health_controls'));

        // 5. Estadísticas de cerdos vía GET /api/v1/pigs/stats
        $statsResponse = $this->withHeader('Authorization', 'Bearer '.$tokenA)
            ->getJson('/api/v1/pigs/stats')
            ->assertStatus(200);

        $this->assertSame(1, $statsResponse->json('data.total_pigs'));
        $this->assertSame(1, $statsResponse->json('data.females'));
        $this->assertSame(0, $statsResponse->json('data.males'));
    }

    public function test_fallback_accumulated_cost_from_lot_investment(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Costos', 'costos@granja.com');
        $lot = $this->createBreedingLot($farm, $admin); // investment_cost = 5000, initial_quantity = 10 -> 500 c/u

        $createResponse = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/lots/{$lot->id}/animals", [
                'gender' => 'hembra',
                'breed' => 'Yorkshire',
                'accumulated_cost' => null, // sin costo explícito
            ])
            ->assertStatus(201);

        $animalId = $createResponse->json('data.id');

        $showResponse = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson("/api/v1/lots/animals/{$animalId}")
            ->assertStatus(200);

        // Debe calcular 5000 / 10 = 500.00 como costo acumulado prorrateado del lote
        $this->assertEquals(500.00, $showResponse->json('data.accumulated_cost'));
        $this->assertEquals(500.00, $showResponse->json('data.financial_summary.accumulated_cost'));
    }
}
