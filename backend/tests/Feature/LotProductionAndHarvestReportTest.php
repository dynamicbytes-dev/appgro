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

class LotProductionAndHarvestReportTest extends TestCase
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

        foreach (['lots', 'barns', 'species', 'analytics'] as $code) {
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
            'name' => 'Roberto',
            'lastname' => 'Gómez',
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

    public function test_lots_index_and_executive_kpis_include_purpose_production_and_harvest_summary(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdmin('Granja Agropecuaria La Pradera', 'admin@pradera.com');

        // 1. Especies y Galpones
        $spAvicola = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Gallina Ponedora',
            'category' => 'avícola',
            'is_active' => true,
        ]);

        $spPorcino = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Cerdo Reproductor',
            'category' => 'porcina',
            'is_active' => true,
        ]);

        $spEngorde = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Cerdo Engorde',
            'category' => 'porcina',
            'is_active' => true,
        ]);

        $galponAvicola = Galpon::create([
            'farm_id' => $farm->id,
            'species_id' => $spAvicola->id,
            'name' => 'Galpón Avícola 1',
            'category' => 'avícola',
            'sector' => 'avícola',
            'purpose' => 'postura',
            'max_capacity' => 1000,
            'is_active' => true,
        ]);

        $galponPorcino = Galpon::create([
            'farm_id' => $farm->id,
            'species_id' => $spPorcino->id,
            'name' => 'Galpón Cerdas 1',
            'category' => 'porcina',
            'sector' => 'porcina',
            'purpose' => 'reproducción',
            'max_capacity' => 50,
            'is_active' => true,
        ]);

        $galponEngorde = Galpon::create([
            'farm_id' => $farm->id,
            'species_id' => $spEngorde->id,
            'name' => 'Galpón Ceba 1',
            'category' => 'porcina',
            'sector' => 'porcina',
            'purpose' => 'engorde',
            'max_capacity' => 200,
            'is_active' => true,
        ]);

        // 2. Lote 1: Postura con huevos buenos y mermas
        $lotPostura = Lot::create([
            'farm_id' => $farm->id,
            'galpon_id' => $galponAvicola->id,
            'species_id' => $spAvicola->id,
            'code' => 'LOT-POST-001',
            'purpose' => 'postura',
            'quantity' => 500,
            'initial_quantity' => 500,
            'investment_cost' => 1200.00,
            'status' => Lot::STATUS_ACTIVE,
            'total_eggs' => 2000, // buenos
            'broken_eggs' => 100, // rotos / mermas
            'egg_price' => 0.15,
            'total_egg_cost' => 300.00, // 2000 * 0.15 estrictamente sobre buenos
            'total_broken_cost' => 15.00,
        ]);

        // 3. Lote 2: Reproducción con cerdas y servicios de parto
        $lotRepro = Lot::create([
            'farm_id' => $farm->id,
            'galpon_id' => $galponPorcino->id,
            'species_id' => $spPorcino->id,
            'code' => 'LOT-REPR-001',
            'purpose' => 'reproducción',
            'quantity' => 2,
            'initial_quantity' => 2,
            'investment_cost' => 2000.00,
            'status' => Lot::STATUS_ACTIVE,
        ]);

        $sow = LoteAnimal::create([
            'lote_id' => $lotRepro->id,
            'identifier' => '00101',
            'gender' => 'hembra',
            'breed' => 'Landrace',
            'parity_count' => 1,
            'status' => LoteAnimal::STATUS_ACTIVE,
        ]);

        AnimalService::create([
            'lote_animal_id' => $sow->id,
            'service_type' => 'parto',
            'service_date' => '2025-05-10',
            'birth_date' => '2025-05-10',
            'total_piglets' => 14,
            'live_piglets' => 12,
            'status' => 'destete',
        ]);

        // Cosechar/vender una de las cerdas de reproducción (cosecha parcial del lote)
        $sowSold = LoteAnimal::create([
            'lote_id' => $lotRepro->id,
            'identifier' => '00102',
            'gender' => 'hembra',
            'breed' => 'Duroc',
            'status' => 'cosechado',
            'sale_weight' => 220.00,
            'sale_price_per_kg' => 3.50,
            'sale_total_price' => 770.00,
        ]);

        // 4. Lote 3: Carne / Engorde cerrado/cosechado
        $lotCarne = Lot::create([
            'farm_id' => $farm->id,
            'galpon_id' => $galponEngorde->id,
            'species_id' => $spEngorde->id,
            'code' => 'LOT-CARN-001',
            'purpose' => 'engorde',
            'quantity' => 0,
            'initial_quantity' => 50,
            'harvested_quantity' => 50,
            'weight' => 25.00, // peso inicial
            'avg_weight' => 105.00, // peso final promedio
            'total_weight' => 5250.00,
            'price_per_kg' => 2.80,
            'total_price' => 14700.00,
            'harvest_date' => '2025-06-15',
            'investment_cost' => 3500.00,
            'status' => Lot::STATUS_INACTIVE,
        ]);

        // ==========================================
        // PRUEBA 1: Endpoint GET /api/v1/lots
        // ==========================================
        $lotsResponse = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/lots');

        $lotsResponse->assertStatus(200);
        $lotsData = collect($lotsResponse->json('data'))->keyBy('code');

        // A) Verificar Lote de Postura
        $posturaItem = $lotsData['LOT-POST-001'];
        $this->assertArrayHasKey('purpose_production', $posturaItem);
        $this->assertArrayHasKey('harvest_summary', $posturaItem);

        $prodPostura = $posturaItem['purpose_production'];
        $this->assertSame(2100, $prodPostura['total_eggs']);
        $this->assertSame(2000, $prodPostura['good_eggs']);
        $this->assertSame(100, $prodPostura['broken_eggs']);
        $this->assertEquals(300.00, $prodPostura['production_cost']);
        $this->assertEquals(4.76, round($prodPostura['merma_percentage'], 2));

        // Resumen de cosecha de postura
        $harvPostura = $posturaItem['harvest_summary'];
        $this->assertSame('En curso', $harvPostura['harvest_status']);
        $this->assertEquals(300.00, $harvPostura['harvest_cost']); // incluye valor de huevos
        $this->assertEquals(1500.00, $harvPostura['total_harvest_cost']); // 300 + 1200 inversión

        // B) Verificar Lote de Reproducción
        $reproItem = $lotsData['LOT-REPR-001'];
        $prodRepro = $reproItem['purpose_production'];
        $this->assertGreaterThanOrEqual(1, $prodRepro['farrowings_count']);
        $this->assertSame(12, $prodRepro['born_alive']);
        $this->assertSame(2, $prodRepro['born_dead']);
        $this->assertSame(12, $prodRepro['weaned_count']);

        // Resumen de cosecha de reproducción (cerda vendida por 770.00)
        $harvRepro = $reproItem['harvest_summary'];
        $this->assertSame(1, $harvRepro['harvested_quantity']);
        $this->assertEquals(220.00, $harvRepro['harvested_weight']);
        $this->assertEquals(770.00, $harvRepro['harvest_cost']);
        $this->assertSame('Parcial', $harvRepro['harvest_status']);

        // C) Verificar Lote de Carne / Engorde (Cerrado)
        $carneItem = $lotsData['LOT-CARN-001'];
        $prodCarne = $carneItem['purpose_production'];
        $this->assertEquals(25.00, $prodCarne['initial_weight']);
        $this->assertEquals(105.00, $prodCarne['current_avg_weight']);
        $this->assertEquals(80.00, $prodCarne['weight_gain']); // 105 - 25 = 80 kg de ganancia

        // Resumen de cosecha de engorde
        $harvCarne = $carneItem['harvest_summary'];
        $this->assertSame(50, $harvCarne['harvested_quantity']);
        $this->assertEquals(5250.00, $harvCarne['harvested_weight']);
        $this->assertEquals(105.00, $harvCarne['avg_harvest_weight']);
        $this->assertEquals(14700.00, $harvCarne['harvest_cost']);
        $this->assertEquals(18200.00, $harvCarne['total_harvest_cost']); // 14700 + 3500 inversión
        $this->assertSame('Cosechado / Cerrado', $harvCarne['harvest_status']);
        $this->assertSame('2025-06-15', $harvCarne['harvest_date']);

        // ==========================================
        // PRUEBA 2: Endpoint GET /api/reports/lotes/executive-kpis
        // ==========================================
        $kpiResponse = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/reports/lotes/executive-kpis');

        $kpiResponse->assertStatus(200);

        // Estructura oficial del reporte
        $kpiResponse->assertJsonStructure([
            'status',
            'module',
            'audit' => ['system', 'farm_name', 'generated_by', 'generated_at'],
            'kpis' => [
                '*' => ['label', 'value', 'subtitle', 'status'],
            ],
            'diagnosis',
            'lots' => [
                '*' => [
                    'id',
                    'code',
                    'species',
                    'galpon',
                    'purpose',
                    'status',
                    'quantity',
                    'current_occupancy',
                    'purpose_production',
                    'harvest_summary',
                ],
            ],
            'purpose_production' => [
                'postura' => ['total_eggs', 'good_eggs', 'broken_eggs', 'merma_percentage', 'production_cost'],
                'reproduccion' => ['farrowings_count', 'born_alive', 'born_dead', 'weaned_count'],
                'engorde' => ['total_weight_gain', 'total_current_weight'],
            ],
            'harvest_summary' => [
                'harvested_quantity',
                'harvested_weight',
                'avg_harvest_weight',
                'harvest_cost',
                'total_harvest_cost',
                'closed_lots_count',
                'active_lots_count',
            ],
        ]);

        // Verificación de datos consolidados en el reporte
        $reportLots = collect($kpiResponse->json('lots'))->keyBy('code');
        $this->assertCount(3, $reportLots);

        // Postura en el reporte
        $this->assertSame(2000, $kpiResponse->json('purpose_production.postura.good_eggs'));
        $this->assertSame(100, $kpiResponse->json('purpose_production.postura.broken_eggs'));
        $this->assertEquals(300.00, $kpiResponse->json('purpose_production.postura.production_cost'));

        // Reproducción en el reporte
        $this->assertSame(12, $kpiResponse->json('purpose_production.reproduccion.born_alive'));
        $this->assertSame(12, $kpiResponse->json('purpose_production.reproduccion.weaned_count'));

        // Cosecha global en el reporte
        $this->assertSame(51, $kpiResponse->json('harvest_summary.harvested_quantity')); // 50 cerdos engorde + 1 cerda
        $this->assertEquals(5470.00, $kpiResponse->json('harvest_summary.harvested_weight')); // 5250 + 220
        $this->assertSame(1, $kpiResponse->json('harvest_summary.closed_lots_count'));
        $this->assertSame(2, $kpiResponse->json('harvest_summary.active_lots_count'));
    }
}
