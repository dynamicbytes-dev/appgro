<?php

namespace Tests\Feature;

use App\Models\Farm;
use App\Models\FarmModule;
use App\Models\Module;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Regresión: las especies registradas con un nombre personalizado ("Otro")
 * deben comportarse como especies de carne: crear su destino (galpón o
 * potrero) con el propósito universal "Carne", crear el lote y ejecutar las
 * acciones del ciclo (cosecha). Además, NO deben admitir otros propósitos.
 */
class CustomSpeciesModuleTest extends TestCase
{
    use RefreshDatabase;

    private function setupFarm(): array
    {
        $this->artisan('app:init-root');

        $farm = Farm::create(['name' => 'Granja Custom', 'sector' => 'avicola', 'is_active' => true]);

        foreach (['species', 'barns', 'potreros', 'lots'] as $code) {
            $module = Module::where('code', $code)->first();
            if ($module) {
                FarmModule::where('farm_id', $farm->id)
                    ->where('module_id', $module->id)
                    ->update(['is_enabled' => true]);
            }
        }

        User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Custom',
            'email' => 'admin_custom@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_custom@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        return [$farm, $token];
    }

    public function test_custom_species_supports_the_full_carne_cycle_in_every_sector(): void
    {
        [, $token] = $this->setupFarm();
        $auth = ['Authorization' => 'Bearer '.$token];

        // Sector esperado => endpoint de su destino (galpón o potrero)
        $matrix = [
            'Avícola' => 'galpones',
            'Porcina' => 'galpones',
            'Cunícola' => 'galpones',
            'Bovina' => 'potreros',
            'Ovina' => 'potreros',
            'Caprina' => 'potreros',
        ];

        $index = 0;
        foreach ($matrix as $category => $endpoint) {
            $index++;

            // 1. La especie personalizada se registra y se marca como tal.
            $speciesRes = $this->withHeaders($auth)->postJson('/api/v1/species', [
                'name' => "Variante {$category} {$index}",
                'category' => $category,
                'is_custom' => true,
            ]);
            $this->assertSame(201, $speciesRes->status(), "No se pudo crear la especie {$category}: ".$speciesRes->getContent());
            $this->assertTrue($speciesRes->json('data.is_custom'), "La especie {$category} debía marcarse como personalizada.");
            $speciesId = $speciesRes->json('data.id');

            // 2. Se crea el destino con el único propósito admitido: carne.
            $destinationRes = $this->withHeaders($auth)->postJson("/api/v1/{$endpoint}", [
                'name' => "Destino {$category} {$index}",
                'species_id' => $speciesId,
                'purpose' => 'Carne',
                'max_capacity' => 100,
            ]);
            $this->assertSame(201, $destinationRes->status(), "No se pudo crear el destino {$endpoint} ({$category}): ".$destinationRes->getContent());
            $destinationId = $destinationRes->json('data.id');

            // 3. Se crea el lote heredando el propósito carne del destino.
            $lotPayload = [
                'species_id' => $speciesId,
                'quantity' => 10,
                $endpoint === 'potreros' ? 'potrero_id' : 'galpon_id' => $destinationId,
            ];

            $lotRes = $this->withHeaders($auth)->postJson('/api/v1/lots', $lotPayload);
            $this->assertSame(201, $lotRes->status(), "No se pudo crear el lote {$category}: ".$lotRes->getContent());
            $this->assertSame('Carne', $lotRes->json('data.purpose'));
            $lotId = $lotRes->json('data.id');

            // 4. Acción del propósito carne: cosecha del lote.
            $harvestRes = $this->withHeaders($auth)->postJson("/api/v1/lots/{$lotId}/harvest", [
                'avg_weight' => 2.5,
                'price_per_kg' => 3.0,
            ]);
            $this->assertSame(200, $harvestRes->status(), "No se pudo cosechar el lote {$category}: ".$harvestRes->getContent());
            $this->assertSame('inactivo', $harvestRes->json('data.status'));
        }
    }

    public function test_custom_species_only_accepts_the_carne_purpose(): void
    {
        [, $token] = $this->setupFarm();
        $auth = ['Authorization' => 'Bearer '.$token];

        // Especie personalizada en un sector de galpón (Avícola).
        $customAvicola = $this->withHeaders($auth)->postJson('/api/v1/species', [
            'name' => 'Pato Pekinés',
            'category' => 'Avícola',
            'is_custom' => true,
        ])->assertStatus(201)->json('data.id');

        // Propósitos del sector vetados para la especie personalizada.
        foreach (['Huevos', 'Reproducción'] as $veted) {
            $this->withHeaders($auth)->postJson('/api/v1/galpones', [
                'name' => "Galpón {$veted}",
                'species_id' => $customAvicola,
                'purpose' => $veted,
                'max_capacity' => 50,
            ])->assertStatus(422)->assertJsonValidationErrors(['purpose']);
        }

        // Solo "Carne" es aceptado.
        $this->withHeaders($auth)->postJson('/api/v1/galpones', [
            'name' => 'Galpón Carne Pato',
            'species_id' => $customAvicola,
            'purpose' => 'Carne',
            'max_capacity' => 50,
        ])->assertStatus(201);

        // Especie personalizada en un sector de potrero (Bovina).
        $customBovina = $this->withHeaders($auth)->postJson('/api/v1/species', [
            'name' => 'Búfalo de Agua',
            'category' => 'Bovina',
            'is_custom' => true,
        ])->assertStatus(201)->json('data.id');

        foreach (['Leche', 'Reproducción'] as $veted) {
            $this->withHeaders($auth)->postJson('/api/v1/potreros', [
                'name' => "Potrero {$veted}",
                'species_id' => $customBovina,
                'purpose' => $veted,
                'max_capacity' => 50,
            ])->assertStatus(422)->assertJsonValidationErrors(['purpose']);
        }

        $this->withHeaders($auth)->postJson('/api/v1/potreros', [
            'name' => 'Potrero Carne Búfalo',
            'species_id' => $customBovina,
            'purpose' => 'Carne',
            'max_capacity' => 50,
        ])->assertStatus(201);

        // Control: una especie OFICIAL conserva todos los propósitos de su sector.
        $officialSpecies = $this->withHeaders($auth)->postJson('/api/v1/species', [
            'name' => 'Pollo',
            'category' => 'Avícola',
        ])->assertStatus(201);
        $this->assertFalse($officialSpecies->json('data.is_custom'));
        $officialAvicola = $officialSpecies->json('data.id');

        $this->withHeaders($auth)->postJson('/api/v1/galpones', [
            'name' => 'Galpón Huevos Oficial',
            'species_id' => $officialAvicola,
            'purpose' => 'Huevos',
            'max_capacity' => 50,
        ])->assertStatus(201);
    }

    public function test_custom_species_lots_reject_non_carne_purposes(): void
    {
        [, $token] = $this->setupFarm();
        $auth = ['Authorization' => 'Bearer '.$token];

        $speciesId = $this->withHeaders($auth)->postJson('/api/v1/species', [
            'name' => 'Cuy Criollo',
            'category' => 'Cunícola',
            'is_custom' => true,
        ])->assertStatus(201)->json('data.id');

        $galponId = $this->withHeaders($auth)->postJson('/api/v1/galpones', [
            'name' => 'Galpón Cuy',
            'species_id' => $speciesId,
            'purpose' => 'Carne',
            'max_capacity' => 100,
        ])->assertStatus(201)->json('data.id');

        // Crear el lote con un propósito distinto a carne es rechazado.
        $this->withHeaders($auth)->postJson('/api/v1/lots', [
            'species_id' => $speciesId,
            'quantity' => 10,
            'galpon_id' => $galponId,
            'purpose' => 'Reproducción',
        ])->assertStatus(422)->assertJsonValidationErrors(['purpose']);

        // Propósito carne: aceptado.
        $lotId = $this->withHeaders($auth)->postJson('/api/v1/lots', [
            'species_id' => $speciesId,
            'quantity' => 10,
            'galpon_id' => $galponId,
            'purpose' => 'Carne',
        ])->assertStatus(201)->json('data.id');

        // Editar el lote hacia otro propósito: rechazado.
        $this->withHeaders($auth)->putJson('/api/v1/lots/'.$lotId, [
            'quantity' => 10,
            'purpose' => 'Huevos',
            'status' => 'activo',
        ])->assertStatus(422)->assertJsonValidationErrors(['purpose']);
    }
}
