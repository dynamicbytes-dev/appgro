<?php

namespace Tests\Feature;

use App\Models\Farm;
use App\Models\FarmModule;
use App\Models\Lot;
use App\Models\Module;
use App\Models\Potrero;
use App\Models\Species;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Fase 3 del módulo Potreros: georreferenciación (GeoJSON + superficie) y
 * historial de rotaciones derivado de los lotes.
 */
class PotreroGeospatialTest extends TestCase
{
    use RefreshDatabase;

    private function bootstrap(string $key): array
    {
        $this->artisan('app:init-root');

        $farm = Farm::create(['name' => "Granja {$key}", 'sector' => 'bovino', 'is_active' => true]);

        $module = Module::where('code', 'potreros')->first();
        if ($module) {
            FarmModule::where('farm_id', $farm->id)
                ->where('module_id', $module->id)
                ->update(['is_enabled' => true]);
        }

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => "Admin {$key}",
            'email' => "geo_admin_{$key}@test.com",
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $species = Species::create([
            'farm_id' => $farm->id,
            'name' => "Bovino {$key}",
            'category' => 'bovina',
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => $admin->email,
            'password' => 'password123',
        ])->json('data.access_token');

        return [$farm, $token, $species];
    }

    private function makePotrero(Farm $farm, Species $species, array $overrides = []): Potrero
    {
        return Potrero::create(array_merge([
            'farm_id' => $farm->id,
            'species_id' => $species->id,
            'name' => 'Potrero '.uniqid(),
            'code' => 'POT-'.str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT),
            'category' => 'bovina',
            'sector' => 'bovina',
            'purpose' => 'Carne',
            'max_capacity' => 100,
            'operational_status' => 'disponible',
            'is_active' => true,
        ], $overrides));
    }

    private function square(): array
    {
        return [
            'type' => 'Polygon',
            'coordinates' => [[
                [0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001],
            ]],
        ];
    }

    public function test_potreros_table_has_geospatial_columns(): void
    {
        foreach (['geometry', 'centroid_lat', 'centroid_lng', 'geo_area_ha'] as $column) {
            $this->assertTrue(
                Schema::hasColumn('potreros', $column),
                "Column '{$column}' is missing from 'potreros'."
            );
        }
    }

    public function test_admin_can_create_potrero_with_geometry_and_area_is_computed(): void
    {
        [$farm, $token, $species] = $this->bootstrap('create');

        $res = $this->withHeaders(['Authorization' => 'Bearer '.$token])->postJson('/api/v1/potreros', [
            'name' => 'Potrero Georreferenciado',
            'species_id' => $species->id,
            'purpose' => 'Carne',
            'max_capacity' => 80,
            'geometry' => $this->square(),
            'centroid_lat' => 0.0005,
            'centroid_lng' => 0.0005,
        ]);

        $res->assertStatus(201);
        $this->assertSame('Polygon', $res->json('data.geometry.type'));

        // El anillo se cierra automáticamente (primer punto == último).
        $ring = $res->json('data.geometry.coordinates.0');
        $this->assertCount(5, $ring);
        $this->assertSame($ring[0], $ring[4]);

        // 0.001° x 0.001° ≈ 1.23 ha cerca del ecuador.
        $area = (float) $res->json('data.geo_area_ha');
        $this->assertGreaterThan(1.0, $area);
        $this->assertLessThan(1.4, $area);

        $this->assertSame('0.0005000', (string) $res->json('data.centroid_lat'));
    }

    public function test_geometry_rejects_invalid_type_ring_and_centroid(): void
    {
        [$farm, $token, $species] = $this->bootstrap('invalid');
        $auth = ['Authorization' => 'Bearer '.$token];

        $base = [
            'name' => 'Potrero Inválido',
            'species_id' => $species->id,
            'purpose' => 'Carne',
            'max_capacity' => 40,
        ];

        $this->withHeaders($auth)->postJson('/api/v1/potreros', $base + [
            'geometry' => ['type' => 'Point', 'coordinates' => [0, 0]],
        ])->assertStatus(422)->assertJsonValidationErrors(['geometry']);

        $this->withHeaders($auth)->postJson('/api/v1/potreros', $base + [
            'geometry' => [
                'type' => 'Polygon',
                'coordinates' => [[[0, 0], [1, 1]]],
            ],
        ])->assertStatus(422)->assertJsonValidationErrors(['geometry']);

        $this->withHeaders($auth)->postJson('/api/v1/potreros', $base + [
            'centroid_lat' => 120,
        ])->assertStatus(422)->assertJsonValidationErrors(['centroid_lat']);
    }

    public function test_admin_can_clear_geometry_on_update(): void
    {
        [$farm, $token, $species] = $this->bootstrap('clear');
        $auth = ['Authorization' => 'Bearer '.$token];

        $id = $this->withHeaders($auth)->postJson('/api/v1/potreros', [
            'name' => 'Potrero Limpiable',
            'species_id' => $species->id,
            'purpose' => 'Carne',
            'max_capacity' => 40,
            'geometry' => $this->square(),
        ])->assertStatus(201)->json('data.id');

        $updated = $this->withHeaders($auth)->putJson('/api/v1/potreros/'.$id, [
            'geometry' => null,
        ]);

        $updated->assertStatus(200);
        $this->assertNull($updated->json('data.geometry'));
        $this->assertNull($updated->json('data.geo_area_ha'));
    }

    public function test_geojson_endpoint_returns_feature_collection_with_properties(): void
    {
        [$farm, $token, $species] = $this->bootstrap('geojson');
        $auth = ['Authorization' => 'Bearer '.$token];

        $withGeometry = $this->withHeaders($auth)->postJson('/api/v1/potreros', [
            'name' => 'Con Geometría',
            'species_id' => $species->id,
            'purpose' => 'Carne',
            'max_capacity' => 60,
            'geometry' => $this->square(),
        ])->assertStatus(201)->json('data.id');

        // Un potrero sin geometría también aparece (feature con geometry null).
        $withoutGeometry = $this->makePotrero($farm, $species, ['name' => 'Sin Geometría']);
        Lot::create([
            'farm_id' => $farm->id,
            'potrero_id' => $withGeometry,
            'code' => 'LOT-GEO-1',
            'species_id' => $species->id,
            'sector' => 'bovina',
            'purpose' => 'Carne',
            'quantity' => 25,
            'status' => Lot::STATUS_ACTIVE,
            'entry_date' => Carbon::now()->subDays(3)->toDateString(),
        ]);

        $res = $this->withHeaders($auth)->getJson('/api/v1/potreros/geojson?farm_id='.$farm->id);
        $res->assertStatus(200);
        $this->assertSame('FeatureCollection', $res->json('data.type'));

        $features = collect($res->json('data.features'));

        $geoFeature = $features->firstWhere('properties.id', $withGeometry);
        $this->assertNotNull($geoFeature);
        $this->assertSame('Polygon', $geoFeature['geometry']['type']);
        $this->assertSame('ocupado', $geoFeature['properties']['operational_state']);
        $this->assertSame(25, (int) $geoFeature['properties']['occupied_capacity']);
        $this->assertSame(35, (int) $geoFeature['properties']['available_capacity']);

        $plainFeature = $features->firstWhere('properties.id', $withoutGeometry->id);
        $this->assertNotNull($plainFeature);
        $this->assertNull($plainFeature['geometry']);
        $this->assertSame('disponible', $plainFeature['properties']['operational_state']);
    }

    public function test_management_returns_rotation_history(): void
    {
        [$farm, $token, $species] = $this->bootstrap('rotation');
        $auth = ['Authorization' => 'Bearer '.$token];
        $potrero = $this->makePotrero($farm, $species);

        // Lote activo (ingresó hace 5 días).
        Lot::create([
            'farm_id' => $farm->id,
            'potrero_id' => $potrero->id,
            'code' => 'LOT-ROT-ACT',
            'species_id' => $species->id,
            'sector' => 'bovina',
            'purpose' => 'Carne',
            'quantity' => 20,
            'status' => Lot::STATUS_ACTIVE,
            'entry_date' => Carbon::now()->startOfDay()->subDays(5)->toDateString(),
        ]);

        // Lote finalizado (ingresó hace 40 días, salió hace 7).
        Lot::create([
            'farm_id' => $farm->id,
            'potrero_id' => $potrero->id,
            'code' => 'LOT-ROT-OLD',
            'species_id' => $species->id,
            'sector' => 'bovina',
            'purpose' => 'Carne',
            'quantity' => 30,
            'status' => Lot::STATUS_INACTIVE,
            'entry_date' => Carbon::now()->startOfDay()->subDays(40)->toDateString(),
            'harvest_date' => Carbon::now()->startOfDay()->subDays(7)->toDateString(),
        ]);

        $res = $this->withHeaders($auth)->getJson("/api/v1/potreros/{$potrero->id}/management");
        $res->assertStatus(200);

        $this->assertSame(2, (int) $res->json('data.rotation_count'));

        $history = $res->json('data.rotation_history');
        $this->assertCount(2, $history);

        // Ordenado por fecha de ingreso descendente: primero el lote activo.
        $this->assertSame('LOT-ROT-ACT', $history[0]['code']);
        $this->assertSame('activo', $history[0]['status']);
        $this->assertSame(5, (int) $history[0]['days_occupied']);
        $this->assertNull($history[0]['exit_date']);

        $this->assertSame('LOT-ROT-OLD', $history[1]['code']);
        $this->assertSame('inactivo', $history[1]['status']);
        $this->assertSame(33, (int) $history[1]['days_occupied']);
        $this->assertNotNull($history[1]['exit_date']);
    }
}
