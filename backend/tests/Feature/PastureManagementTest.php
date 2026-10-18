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
 * Fase 2 del módulo Potreros: manejo agronómico (tratamientos y aforo de
 * forraje) y métricas de rotación derivadas (ocupación, descanso y salida
 * estimada).
 */
class PastureManagementTest extends TestCase
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
            'email' => "pm_admin_{$key}@test.com",
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

    public function test_pasture_management_tables_have_required_columns(): void
    {
        $this->assertTrue(Schema::hasTable('pasture_treatments'));
        $this->assertTrue(Schema::hasTable('pasture_biomass_surveys'));

        foreach ([
            'id', 'farm_id', 'potrero_id', 'type', 'product', 'dose',
            'dose_unit', 'applied_at', 'cost', 'notes', 'user_id',
        ] as $column) {
            $this->assertTrue(
                Schema::hasColumn('pasture_treatments', $column),
                "Column '{$column}' is missing from 'pasture_treatments'."
            );
        }

        foreach ([
            'id', 'farm_id', 'potrero_id', 'surveyed_at', 'entry_height_cm',
            'exit_height_cm', 'biomass_kg_dm_ha', 'notes', 'user_id',
        ] as $column) {
            $this->assertTrue(
                Schema::hasColumn('pasture_biomass_surveys', $column),
                "Column '{$column}' is missing from 'pasture_biomass_surveys'."
            );
        }
    }

    public function test_admin_can_create_and_list_treatments(): void
    {
        [$farm, $token, $species] = $this->bootstrap('treat_create');
        $auth = ['Authorization' => 'Bearer '.$token];
        $potrero = $this->makePotrero($farm, $species);

        $created = $this->withHeaders($auth)->postJson("/api/v1/potreros/{$potrero->id}/treatments", [
            'type' => 'fertilizacion',
            'product' => 'Urea 46%',
            'dose' => 150,
            'dose_unit' => 'kg/ha',
            'applied_at' => '2026-05-10',
            'cost' => 480.50,
            'notes' => 'Aplicación con voleo.',
        ]);

        $created->assertStatus(201);
        $this->assertSame('fertilizacion', $created->json('data.type'));
        $this->assertSame('150.00', (string) $created->json('data.dose'));
        $this->assertSame('2026-05-10', $created->json('data.applied_at'));

        $list = $this->withHeaders($auth)->getJson("/api/v1/potreros/{$potrero->id}/treatments");
        $list->assertStatus(200);
        $this->assertCount(1, $list->json('data'));
        $this->assertSame('Urea 46%', $list->json('data.0.product'));
    }

    public function test_treatment_rejects_invalid_type_and_missing_date(): void
    {
        [$farm, $token, $species] = $this->bootstrap('treat_invalid');
        $auth = ['Authorization' => 'Bearer '.$token];
        $potrero = $this->makePotrero($farm, $species);

        $this->withHeaders($auth)->postJson("/api/v1/potreros/{$potrero->id}/treatments", [
            'type' => 'magia',
            'applied_at' => '2026-05-10',
        ])->assertStatus(422)->assertJsonValidationErrors(['type']);

        $this->withHeaders($auth)->postJson("/api/v1/potreros/{$potrero->id}/treatments", [
            'type' => 'fertilizacion',
        ])->assertStatus(422)->assertJsonValidationErrors(['applied_at']);

        $this->withHeaders($auth)->postJson("/api/v1/potreros/{$potrero->id}/treatments", [
            'type' => 'fertilizacion',
            'applied_at' => '2026-05-10',
            'dose' => -5,
        ])->assertStatus(422)->assertJsonValidationErrors(['dose']);
    }

    public function test_admin_can_update_and_delete_treatment(): void
    {
        [$farm, $token, $species] = $this->bootstrap('treat_crud');
        $auth = ['Authorization' => 'Bearer '.$token];
        $potrero = $this->makePotrero($farm, $species);

        $id = $this->withHeaders($auth)->postJson("/api/v1/potreros/{$potrero->id}/treatments", [
            'type' => 'control_malezas',
            'applied_at' => '2026-06-01',
        ])->assertStatus(201)->json('data.id');

        $updated = $this->withHeaders($auth)->putJson("/api/v1/potreros/{$potrero->id}/treatments/{$id}", [
            'type' => 'resiembra',
            'product' => 'Brachiaria',
            'applied_at' => '2026-06-15',
        ]);
        $updated->assertStatus(200);
        $this->assertSame('resiembra', $updated->json('data.type'));
        $this->assertSame('Brachiaria', $updated->json('data.product'));

        $this->withHeaders($auth)->deleteJson("/api/v1/potreros/{$potrero->id}/treatments/{$id}")
            ->assertStatus(200);
        $this->assertDatabaseMissing('pasture_treatments', ['id' => $id]);
    }

    public function test_admin_can_create_and_list_biomass_surveys(): void
    {
        [$farm, $token, $species] = $this->bootstrap('survey_create');
        $auth = ['Authorization' => 'Bearer '.$token];
        $potrero = $this->makePotrero($farm, $species);

        $created = $this->withHeaders($auth)->postJson("/api/v1/potreros/{$potrero->id}/biomass-surveys", [
            'surveyed_at' => '2026-05-20',
            'entry_height_cm' => 28.5,
            'exit_height_cm' => 12,
            'biomass_kg_dm_ha' => 3100,
            'notes' => 'Muestreo en cuadrante de 0.25 m2.',
        ]);

        $created->assertStatus(201);
        $this->assertSame('3100.00', (string) $created->json('data.biomass_kg_dm_ha'));

        $list = $this->withHeaders($auth)->getJson("/api/v1/potreros/{$potrero->id}/biomass-surveys");
        $list->assertStatus(200);
        $this->assertCount(1, $list->json('data'));
    }

    public function test_biomass_survey_rejects_invalid_payload(): void
    {
        [$farm, $token, $species] = $this->bootstrap('survey_invalid');
        $auth = ['Authorization' => 'Bearer '.$token];
        $potrero = $this->makePotrero($farm, $species);

        $this->withHeaders($auth)->postJson("/api/v1/potreros/{$potrero->id}/biomass-surveys", [
            'biomass_kg_dm_ha' => 1000,
        ])->assertStatus(422)->assertJsonValidationErrors(['surveyed_at']);

        $this->withHeaders($auth)->postJson("/api/v1/potreros/{$potrero->id}/biomass-surveys", [
            'surveyed_at' => '2026-05-20',
            'biomass_kg_dm_ha' => -10,
        ])->assertStatus(422)->assertJsonValidationErrors(['biomass_kg_dm_ha']);
    }

    public function test_management_records_are_isolated_per_farm(): void
    {
        [$farmA, $tokenA, $speciesA] = $this->bootstrap('iso_a');
        [$farmB, $tokenB] = $this->bootstrap('iso_b');

        $potreroB = $this->makePotrero($farmB, Species::create([
            'farm_id' => $farmB->id,
            'name' => 'Bovino iso_b2',
            'category' => 'bovina',
            'is_active' => true,
        ]));

        // El admin de la granja A no puede acceder a un potrero de la granja B.
        $this->withHeaders(['Authorization' => 'Bearer '.$tokenA])
            ->getJson("/api/v1/potreros/{$potreroB->id}/management")
            ->assertStatus(403);

        $this->withHeaders(['Authorization' => 'Bearer '.$tokenA])
            ->postJson("/api/v1/potreros/{$potreroB->id}/treatments", [
                'type' => 'fertilizacion',
                'applied_at' => '2026-05-10',
            ])->assertStatus(403);

        // El dueño sí puede.
        $this->withHeaders(['Authorization' => 'Bearer '.$tokenB])
            ->postJson("/api/v1/potreros/{$potreroB->id}/treatments", [
                'type' => 'fertilizacion',
                'applied_at' => '2026-05-10',
            ])->assertStatus(201);
    }

    public function test_management_returns_rotation_metrics_and_estimated_exit(): void
    {
        [$farm, $token, $species] = $this->bootstrap('metrics');
        $auth = ['Authorization' => 'Bearer '.$token];
        $potrero = $this->makePotrero($farm, $species, [
            'superficie_ha' => 10,
            'capacidad_ua' => 25,
        ]);

        $entry = Carbon::now()->startOfDay()->subDays(5);

        Lot::create([
            'farm_id' => $farm->id,
            'potrero_id' => $potrero->id,
            'code' => 'LOT-90001',
            'species_id' => $species->id,
            'sector' => 'bovina',
            'purpose' => 'Carne',
            'quantity' => 10,
            'status' => Lot::STATUS_ACTIVE,
            'entry_date' => $entry->toDateString(),
        ]);

        $this->withHeaders($auth)->postJson("/api/v1/potreros/{$potrero->id}/biomass-surveys", [
            'surveyed_at' => Carbon::now()->toDateString(),
            'biomass_kg_dm_ha' => 1000,
        ])->assertStatus(201);

        $res = $this->withHeaders($auth)->getJson("/api/v1/potreros/{$potrero->id}/management");
        $res->assertStatus(200);

        $data = $res->json('data');
        $this->assertSame('ocupado', $data['operational_state']);
        $this->assertSame(10, (int) $data['occupied_capacity']);
        $this->assertSame(5, (int) $data['days_occupied']);
        $this->assertNull($data['days_resting']);
        $this->assertSame(10000.0, (float) $data['forage_available_kg_dm']);
        $this->assertSame(100.0, (float) $data['daily_demand_kg_dm']);

        // 10.000 kg MS / 100 kg al día = 100 días de autonomía.
        $expectedExit = Carbon::now()->startOfDay()->addDays(100)->toDateString();
        $this->assertSame($expectedExit, $data['estimated_exit_date']);
        $this->assertSame(2.5, (float) $data['ua_per_ha']);
    }

    public function test_management_reports_days_resting_when_potrero_is_free(): void
    {
        [$farm, $token, $species] = $this->bootstrap('resting');
        $auth = ['Authorization' => 'Bearer '.$token];
        $potrero = $this->makePotrero($farm, $species);

        Lot::create([
            'farm_id' => $farm->id,
            'potrero_id' => $potrero->id,
            'code' => 'LOT-90002',
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

        $data = $res->json('data');
        $this->assertNull($data['days_occupied']);
        $this->assertSame(7, (int) $data['days_resting']);
        $this->assertSame('disponible', $data['operational_state']);
    }

    public function test_potrero_with_management_records_cannot_be_deleted(): void
    {
        [$farm, $token, $species] = $this->bootstrap('delete_guard');
        $auth = ['Authorization' => 'Bearer '.$token];
        $potrero = $this->makePotrero($farm, $species);

        $this->withHeaders($auth)->postJson("/api/v1/potreros/{$potrero->id}/treatments", [
            'type' => 'fertilizacion',
            'applied_at' => '2026-05-10',
        ])->assertStatus(201);

        $this->withHeaders($auth)->deleteJson("/api/v1/potreros/{$potrero->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['potrero']);
    }
}
