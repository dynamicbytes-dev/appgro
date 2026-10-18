<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Farm;
use App\Models\FarmModule;
use App\Models\Module;
use App\Models\Potrero;
use App\Models\Species;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PotrerosModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_potreros_table_has_all_required_columns(): void
    {
        $this->assertTrue(Schema::hasTable('potreros'), 'Table potreros must exist.');

        $expectedColumns = [
            'id',
            'farm_id',
            'species_id',
            'name',
            'category',
            'sector',
            'purpose',
            'max_capacity',
            'is_active',
            'created_at',
            'updated_at',
        ];

        foreach ($expectedColumns as $column) {
            $this->assertTrue(
                Schema::hasColumn('potreros', $column),
                "Column '{$column}' is missing from 'potreros' table."
            );
        }
    }

    public function test_potreros_module_is_officially_registered_in_modules_table(): void
    {
        $this->artisan('app:init-root');

        $module = Module::where('code', 'potreros')->first();
        $this->assertNotNull($module, "Module with code 'potreros' must be registered in modules table.");
        $this->assertEquals('Potreros', $module->name);
    }

    public function test_admin_cannot_access_potreros_if_module_is_disabled_for_farm(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Sin Potreros',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Granja Sin Potreros',
            'email' => 'admin_nomod_potrero@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $potreroModule = Module::where('code', 'potreros')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $potreroModule->id)
            ->update(['is_enabled' => false]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_nomod_potrero@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/potreros')
            ->assertStatus(403)
            ->assertJson(['status' => 'error']);
    }

    public function test_admin_can_create_potrero_with_allowed_species_inheriting_sector(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Con Potreros',
            'sector' => 'bovino',
            'is_active' => true,
        ]);

        $potreroModule = Module::where('code', 'potreros')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $potreroModule->id)
            ->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Potreros',
            'email' => 'admin_potreros@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        // Bovino es un sector permitido en Potreros
        $species = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Bovino Angus',
            'category' => 'bovina',
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_potreros@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        $createRes = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/potreros', [
                'name' => 'Potrero 1 - Pastoreo Rotativo',
                'species_id' => $species->id,
                'purpose' => 'carne',
                'max_capacity' => 120,
                'is_active' => true,
            ])
            ->assertStatus(201);

        $createRes->assertJson([
            'status' => 'success',
            'data' => [
                'name' => 'Potrero 1 - Pastoreo Rotativo',
                'species_id' => $species->id,
                'farm_id' => $farm->id,
                'purpose' => 'carne',
                'category' => 'bovina',
                'sector' => 'bovina',
                'max_capacity' => 120,
                'is_active' => true,
            ],
        ]);

        $potreroId = $createRes->json('data.id');
        $this->assertDatabaseHas('potreros', [
            'id' => $potreroId,
            'name' => 'Potrero 1 - Pastoreo Rotativo',
            'farm_id' => $farm->id,
            'species_id' => $species->id,
            'sector' => 'bovina',
            'max_capacity' => 120,
        ]);

        $auditLog = ActivityLog::where('module', 'Potreros')
            ->where('action', 'CREAR')
            ->where('farm_id', $farm->id)
            ->first();
        $this->assertNotNull($auditLog);

        // Propósito inválido para bovino (huevos) debe ser rechazado
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/potreros', [
                'name' => 'Potrero con propósito inválido',
                'species_id' => $species->id,
                'purpose' => 'huevos',
                'max_capacity' => 50,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['purpose']);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->patchJson('/api/v1/potreros/'.$potreroId, [
                'purpose' => 'huevos',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['purpose']);
    }

    public function test_cannot_create_potrero_with_species_outside_allowed_sectors(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Sectores No Permitidos Potrero',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $potreroModule = Module::where('code', 'potreros')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $potreroModule->id)
            ->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Sectores Potrero',
            'email' => 'admin_sectores_potrero@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        // Porcino no está permitido en Potreros (se gestiona en Galpones)
        $species = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Porcino Landrace',
            'category' => 'porcina',
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_sectores_potrero@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/potreros', [
                'name' => 'Potrero Porcino No Permitido',
                'species_id' => $species->id,
                'purpose' => 'carne',
                'max_capacity' => 100,
            ])
            ->assertStatus(422)
            ->assertJsonPath(
                'errors.species_id.0',
                'El módulo de Potreros solo admite especies de los sectores Bovino, Ovino y Caprino. Las demás se gestionan en el módulo Galpones.'
            );
    }

    public function test_update_allows_keeping_legacy_non_allowed_species(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Legado Porcino Potrero',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $potreroModule = Module::where('code', 'potreros')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $potreroModule->id)
            ->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Legado Potrero',
            'email' => 'admin_legado_potrero@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $species = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Porcino Legado',
            'category' => 'porcina',
            'is_active' => true,
        ]);

        // Potrero heredado (creado antes de la restricción de sectores)
        $potrero = Potrero::create([
            'farm_id' => $farm->id,
            'species_id' => $species->id,
            'name' => 'Potrero Heredado',
            'category' => 'porcina',
            'sector' => 'porcina',
            'purpose' => 'Carne',
            'max_capacity' => 30,
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_legado_potrero@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        // Editar solo el nombre no debe bloquearse por el sector heredado
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/v1/potreros/'.$potrero->id, [
                'name' => 'Potrero Heredado Editado',
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.name', 'Potrero Heredado Editado');

        // Mantener la misma especie heredada tampoco debe bloquearse
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/v1/potreros/'.$potrero->id, [
                'species_id' => $species->id,
                'name' => 'Potrero Heredado Editado 2',
            ])
            ->assertStatus(200);
    }

    public function test_validates_species_id_must_belong_to_same_farm(): void
    {
        $this->artisan('app:init-root');

        $farm1 = Farm::create(['name' => 'Granja Local Potrero', 'sector' => 'bovino', 'is_active' => true]);
        $farm2 = Farm::create(['name' => 'Granja Ajena Potrero', 'sector' => 'bovino', 'is_active' => true]);

        $potreroModule = Module::where('code', 'potreros')->first();
        FarmModule::where('farm_id', $farm1->id)->where('module_id', $potreroModule->id)->update(['is_enabled' => true]);

        User::create([
            'farm_id' => $farm1->id,
            'name' => 'Admin Granja 1 Potrero',
            'email' => 'admin_cross_farm_potrero@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $speciesFarm2 = Species::create([
            'farm_id' => $farm2->id,
            'name' => 'Bovino Ajeno',
            'category' => 'bovina',
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_cross_farm_potrero@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/potreros', [
                'name' => 'Potrero Con Especie Ajena',
                'species_id' => $speciesFarm2->id,
                'purpose' => 'carne',
                'max_capacity' => 50,
            ])
            ->assertStatus(422)
            ->assertJsonFragment([
                'message' => 'La especie seleccionada no pertenece a esta granja.',
            ]);
    }

    public function test_validates_species_id_must_be_active(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create(['name' => 'Granja Inactiva Species Potrero', 'sector' => 'bovino', 'is_active' => true]);
        $potreroModule = Module::where('code', 'potreros')->first();
        FarmModule::where('farm_id', $farm->id)->where('module_id', $potreroModule->id)->update(['is_enabled' => true]);

        User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Inactiva Species Potrero',
            'email' => 'admin_inactiva_sp_potrero@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $inactiveSpecies = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Especie Inactiva Potrero',
            'category' => 'bovina',
            'is_active' => false,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_inactiva_sp_potrero@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/potreros', [
                'name' => 'Potrero Inactivo',
                'species_id' => $inactiveSpecies->id,
                'purpose' => 'carne',
                'max_capacity' => 80,
            ])
            ->assertStatus(422)
            ->assertJsonFragment([
                'message' => 'La especie seleccionada se encuentra inactiva.',
            ]);
    }

    public function test_potrero_multi_farm_isolation_on_index_and_boundary_checks(): void
    {
        $this->artisan('app:init-root');

        $farm1 = Farm::create(['name' => 'Granja Aislada Potrero 1', 'sector' => 'bovino', 'is_active' => true]);
        $farm2 = Farm::create(['name' => 'Granja Aislada Potrero 2', 'sector' => 'bovino', 'is_active' => true]);

        $potreroModule = Module::where('code', 'potreros')->first();
        FarmModule::whereIn('farm_id', [$farm1->id, $farm2->id])
            ->where('module_id', $potreroModule->id)
            ->update(['is_enabled' => true]);

        User::create([
            'farm_id' => $farm1->id,
            'name' => 'Admin Potrero 1',
            'email' => 'admin1_iso_potrero@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $sp1 = Species::create(['farm_id' => $farm1->id, 'name' => 'Bovino Iso 1', 'category' => 'bovina', 'is_active' => true]);
        $sp2 = Species::create(['farm_id' => $farm2->id, 'name' => 'Ovino Iso 2', 'category' => 'ovina', 'is_active' => true]);

        $p1 = Potrero::create([
            'farm_id' => $farm1->id,
            'species_id' => $sp1->id,
            'name' => 'Potrero Granja 1',
            'category' => 'bovina',
            'sector' => 'bovina',
            'purpose' => 'carne',
            'max_capacity' => 100,
            'is_active' => true,
        ]);

        $p2 = Potrero::create([
            'farm_id' => $farm2->id,
            'species_id' => $sp2->id,
            'name' => 'Potrero Granja 2',
            'category' => 'ovina',
            'sector' => 'ovina',
            'purpose' => 'carne',
            'max_capacity' => 200,
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin1_iso_potrero@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        // 1. Index only returns farm 1 potreros
        $indexRes = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/potreros')
            ->assertStatus(200);

        $data = $indexRes->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals($p1->id, $data[0]['id']);

        // 2. Cannot view farm 2 potrero -> 403
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson("/api/v1/potreros/{$p2->id}")
            ->assertStatus(403);

        // 3. Cannot update farm 2 potrero -> 403
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/v1/potreros/{$p2->id}", ['name' => 'Hack Name'])
            ->assertStatus(403);

        // 4. Cannot delete farm 2 potrero -> 403
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson("/api/v1/potreros/{$p2->id}")
            ->assertStatus(403);
    }

    public function test_root_can_manage_potreros_globally_and_filter_by_farm(): void
    {
        $this->artisan('app:init-root');

        $farm1 = Farm::create(['name' => 'Granja Root Potrero 1', 'sector' => 'bovino', 'is_active' => true]);
        $farm2 = Farm::create(['name' => 'Granja Root Potrero 2', 'sector' => 'bovino', 'is_active' => true]);

        $sp1 = Species::create(['farm_id' => $farm1->id, 'name' => 'Bovino Root 1', 'category' => 'bovina', 'is_active' => true]);
        $sp2 = Species::create(['farm_id' => $farm2->id, 'name' => 'Caprino Root 2', 'category' => 'caprina', 'is_active' => true]);

        Potrero::create(['farm_id' => $farm1->id, 'species_id' => $sp1->id, 'name' => 'P1', 'category' => 'bovina', 'sector' => 'bovina', 'purpose' => 'carne', 'max_capacity' => 50, 'is_active' => true]);
        Potrero::create(['farm_id' => $farm2->id, 'species_id' => $sp2->id, 'name' => 'P2', 'category' => 'caprina', 'sector' => 'caprina', 'purpose' => 'carne', 'max_capacity' => 150, 'is_active' => true]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'Miranda*30',
        ])->json('data.access_token');

        // Global list sees 2 potreros
        $resGlobal = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/potreros')
            ->assertStatus(200);

        $this->assertCount(2, $resGlobal->json('data'));

        // Filter by farm 1
        $resF1 = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson("/api/v1/potreros?farm_id={$farm1->id}")
            ->assertStatus(200);

        $this->assertCount(1, $resF1->json('data'));
        $this->assertEquals($farm1->id, $resF1->json('data.0.farm_id'));
    }

    public function test_potrero_stats_endpoint_returns_accurate_kpis(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create(['name' => 'Granja KPIs Potrero', 'sector' => 'bovino', 'is_active' => true]);
        $potreroModule = Module::where('code', 'potreros')->first();
        FarmModule::where('farm_id', $farm->id)->where('module_id', $potreroModule->id)->update(['is_enabled' => true]);

        User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin KPIs Potrero',
            'email' => 'admin_kpi_potrero@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $sp = Species::create(['farm_id' => $farm->id, 'name' => 'Bovino KPI', 'category' => 'bovina', 'is_active' => true]);

        Potrero::create(['farm_id' => $farm->id, 'species_id' => $sp->id, 'name' => 'P Activo 1', 'purpose' => 'carne', 'max_capacity' => 100, 'is_active' => true]);
        Potrero::create(['farm_id' => $farm->id, 'species_id' => $sp->id, 'name' => 'P Activo 2', 'purpose' => 'leche', 'max_capacity' => 80, 'is_active' => true]);
        Potrero::create(['farm_id' => $farm->id, 'species_id' => $sp->id, 'name' => 'P Inactivo', 'purpose' => 'carne', 'max_capacity' => 40, 'is_active' => false]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_kpi_potrero@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/potreros/stats')
            ->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'total_potreros' => 3,
                'active_potreros' => 2,
                'inactive_potreros' => 1,
                'total_capacity' => 220,
                'purposes_count' => 2,
                'species_count' => 1,
            ]);
    }

    public function test_toggle_status_enables_and_disables_potrero_with_audit_trail(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create(['name' => 'Granja Toggle Potrero', 'sector' => 'bovino', 'is_active' => true]);
        $potreroModule = Module::where('code', 'potreros')->first();
        FarmModule::where('farm_id', $farm->id)->where('module_id', $potreroModule->id)->update(['is_enabled' => true]);

        User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Toggle Potrero',
            'email' => 'admin_toggle_potrero@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $sp = Species::create(['farm_id' => $farm->id, 'name' => 'Bovino Toggle', 'category' => 'bovina', 'is_active' => true]);

        $potrero = Potrero::create([
            'farm_id' => $farm->id,
            'species_id' => $sp->id,
            'name' => 'P Toggleable',
            'purpose' => 'carne',
            'max_capacity' => 100,
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_toggle_potrero@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        $res = $this->withHeader('Authorization', 'Bearer '.$token)
            ->patchJson("/api/v1/potreros/{$potrero->id}/toggle-status")
            ->assertStatus(200);

        $this->assertFalse($res->json('data.is_active'));
        $this->assertDatabaseHas('potreros', ['id' => $potrero->id, 'is_active' => false]);

        $res2 = $this->withHeader('Authorization', 'Bearer '.$token)
            ->patchJson("/api/v1/potreros/{$potrero->id}/toggle-status")
            ->assertStatus(200);

        $this->assertTrue($res2->json('data.is_active'));
        $this->assertDatabaseHas('potreros', ['id' => $potrero->id, 'is_active' => true]);
    }

    public function test_can_delete_potrero_without_operational_dependencies(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create(['name' => 'Granja Potrero Libre', 'sector' => 'bovino', 'is_active' => true]);
        $potreroModule = Module::where('code', 'potreros')->first();
        FarmModule::where('farm_id', $farm->id)->where('module_id', $potreroModule->id)->update(['is_enabled' => true]);

        User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Potrero Libre',
            'email' => 'admin_potrero_free@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $sp = Species::create(['farm_id' => $farm->id, 'name' => 'Bovino Libre', 'category' => 'bovina', 'is_active' => true]);

        $potrero = Potrero::create([
            'farm_id' => $farm->id,
            'species_id' => $sp->id,
            'name' => 'Potrero Libre',
            'category' => 'bovina',
            'sector' => 'bovina',
            'purpose' => 'carne',
            'max_capacity' => 100,
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_potrero_free@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson("/api/v1/potreros/{$potrero->id}")
            ->assertStatus(200)
            ->assertJsonFragment([
                'status' => 'success',
                'message' => 'Potrero eliminado correctamente.',
            ]);

        $this->assertDatabaseMissing('potreros', ['id' => $potrero->id]);
    }

    public function test_lot_of_potrero_species_requires_potrero_and_is_lodged_correctly(): void
    {
        $this->artisan('app:init-root');

        $farm = Farm::create(['name' => 'Granja Lotes Potrero', 'sector' => 'bovino', 'is_active' => true]);

        foreach (['lots', 'potreros'] as $code) {
            $module = Module::where('code', $code)->first();
            FarmModule::where('farm_id', $farm->id)
                ->where('module_id', $module->id)
                ->update(['is_enabled' => true]);
        }

        User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Lotes Potrero',
            'email' => 'admin_lotes_potrero@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $species = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Bovino Angus Lotes',
            'category' => 'bovina',
            'is_active' => true,
        ]);

        $potrero = Potrero::create([
            'farm_id' => $farm->id,
            'species_id' => $species->id,
            'name' => 'Potrero Norte',
            'category' => 'bovina',
            'sector' => 'bovina',
            'purpose' => 'carne',
            'max_capacity' => 100,
            'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin_lotes_potrero@test.com',
            'password' => 'password123',
        ])->json('data.access_token');

        // 1. Sin destino: exige un potrero (no un galpón)
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'species_id' => $species->id,
                'quantity' => 30,
            ])
            ->assertStatus(422)
            ->assertJsonPath(
                'errors.potrero_id.0',
                'El potrero destino es obligatorio para las especies Bovino, Ovino y Caprino.'
            );

        // 2. Creación correcta: el lote se aloja en el potrero
        $lotId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'potrero_id' => $potrero->id,
                'species_id' => $species->id,
                'quantity' => 30,
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.potrero_id', $potrero->id)
            ->assertJsonPath('data.galpon_id', null)
            ->json('data.id');

        $this->assertDatabaseHas('lots', [
            'id' => $lotId,
            'potrero_id' => $potrero->id,
            'galpon_id' => null,
            'farm_id' => $farm->id,
            'sector' => 'bovina',
            'purpose' => 'carne',
        ]);

        // 3. La ocupación del potrero refleja el lote recién creado
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/potreros')
            ->assertStatus(200)
            ->assertJsonPath('data.0.occupied_capacity', 30)
            ->assertJsonPath('data.0.available_capacity', 70);

        // 4. La capacidad del potrero se valida
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/lots', [
                'potrero_id' => $potrero->id,
                'species_id' => $species->id,
                'quantity' => 80,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);

        // 5. No se puede eliminar un potrero con lotes asociados
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson("/api/v1/potreros/{$potrero->id}")
            ->assertStatus(422)
            ->assertJsonFragment([
                'message' => 'No se puede eliminar el potrero porque tiene registros operativos asociados.',
            ]);
    }
}
