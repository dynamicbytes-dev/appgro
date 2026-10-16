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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ResetFarmDataCommandTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Crea datos operativos de prueba (granja, usuario, especie,
     * galpón, lote, animal, servicio y actividad) y devuelve
     * [$farm, $admin].
     */
    private function seedOperationalData(): array
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => 'Granja Reset',
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $lotsModule = Module::where('code', 'lots')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $lotsModule->id)
            ->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Reset',
            'email' => 'admin_reset@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $species = Species::create([
            'farm_id' => $farm->id,
            'name' => 'Cerdo Duroc',
            'category' => 'porcina',
            'is_active' => true,
        ]);

        $galpon = Galpon::create([
            'farm_id' => $farm->id,
            'species_id' => $species->id,
            'name' => 'Galpón Reset',
            'category' => 'porcina',
            'sector' => 'porcina',
            'purpose' => 'reproducción',
            'max_capacity' => 100,
            'is_active' => true,
        ]);

        $lot = Lot::create([
            'farm_id' => $farm->id,
            'galpon_id' => $galpon->id,
            'code' => 'LOT-RESET',
            'species_id' => $species->id,
            'sector' => 'porcina',
            'purpose' => 'reproducción',
            'quantity' => 2,
            'status' => 'activo',
            'entry_date' => now()->toDateString(),
        ]);

        $animal = LoteAnimal::create([
            'lote_id' => $lot->id,
            'identifier' => 'RESET-001',
            'gender' => 'hembra',
            'status' => 'activo',
        ]);

        DB::table('animal_services')->insert([
            'lote_animal_id' => $animal->id,
            'service_type' => 'inseminación',
            'service_date' => now()->toDateString(),
            'status' => 'gestación',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        ActivityLog::create([
            'user_id' => $admin->id,
            'farm_id' => $farm->id,
            'module' => 'lots',
            'action' => 'create',
            'description' => 'Lote creado para prueba de reset.',
        ]);

        return [$farm, $admin];
    }

    public function test_reset_farm_data_clears_operational_tables_and_preserves_users_farms_modules(): void
    {
        [$farm, $admin] = $this->seedOperationalData();

        // Verifica que hay datos operativos antes del reset
        $this->assertGreaterThan(0, Lot::count(), 'Debe existir al menos un lote antes del reset.');
        $this->assertGreaterThan(0, LoteAnimal::count(), 'Debe existir al menos un animal antes del reset.');
        $this->assertGreaterThan(0, Species::count(), 'Debe existir al menos una especie antes del reset.');

        $usersBefore = User::count();
        $farmsBefore = Farm::count();
        $modulesBefore = Module::count();

        // Ejecuta el comando de limpieza
        $this->artisan('app:reset-farm-data --force')
            ->assertExitCode(0);

        // Tablas operativas vaciadas
        $this->assertSame(0, DB::table('lots')->count(), 'La tabla lots debe quedar vacía.');
        $this->assertSame(0, DB::table('lote_animals')->count(), 'La tabla lote_animals debe quedar vacía.');
        $this->assertSame(0, DB::table('animal_services')->count(), 'La tabla animal_services debe quedar vacía.');
        $this->assertSame(0, DB::table('galpones')->count(), 'La tabla galpones debe quedar vacía.');
        $this->assertSame(0, DB::table('barns')->count(), 'La tabla barns debe quedar vacía.');
        $this->assertSame(0, DB::table('species')->count(), 'La tabla species debe quedar vacía.');
        $this->assertSame(0, DB::table('activity_logs')->count(), 'La tabla activity_logs debe quedar vacía.');

        // Tablas conservadas intactas
        $this->assertSame($usersBefore, User::count(), 'users debe conservarse intacta.');
        $this->assertSame($farmsBefore, Farm::count(), 'farms debe conservarse intacta.');
        $this->assertSame($modulesBefore, Module::count(), 'modules debe conservarse intacta.');
        $this->assertNotNull(User::find($admin->id), 'El usuario admin debe seguir existiendo.');
        $this->assertNotNull(Farm::find($farm->id), 'La granja debe seguir existiendo.');
    }

    public function test_reset_farm_data_is_idempotent_and_leaves_schema_intact(): void
    {
        $this->seedOperationalData();

        // Ejecutar dos veces no debe fallar
        $this->artisan('app:reset-farm-data --force')->assertExitCode(0);
        $this->artisan('app:reset-farm-data --force')->assertExitCode(0);

        // El esquema sigue completo tras la limpieza
        $this->assertTrue(Schema::hasTable('lots'), 'La tabla lots debe seguir existiendo.');
        $this->assertTrue(Schema::hasTable('lote_animals'), 'La tabla lote_animals debe seguir existiendo.');
        $this->assertTrue(Schema::hasTable('users'), 'La tabla users debe seguir existiendo.');
        $this->assertTrue(Schema::hasTable('farms'), 'La tabla farms debe seguir existiendo.');
    }
}
