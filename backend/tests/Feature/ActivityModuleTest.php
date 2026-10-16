<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Farm;
use App\Models\FarmModule;
use App\Models\Module;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ActivityModuleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Crea una granja con el módulo de actividades habilitado para la
     * granja, un administrador autenticado y un subordinado activo.
     * Devuelve [$farm, $admin, $token, $subordinate].
     */
    private function createFarmWithAdminAndSubordinate(string $name, string $email): array
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => $name,
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $activitiesModule = Module::where('code', 'activities')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $activitiesModule->id)
            ->update(['is_enabled' => true]);

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Actividades',
            'email' => $email,
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $subordinate = User::create([
            'farm_id' => $farm->id,
            'name' => 'Juan',
            'lastname' => 'Encargado',
            'email' => 'encargado_'.$email,
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        // Habilitar el módulo también para el subordinado
        DB::table('subordinate_modules')->updateOrInsert(
            ['user_id' => $subordinate->id, 'module_id' => $activitiesModule->id],
            ['is_enabled' => true]
        );

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password123',
        ])->json('data.access_token');

        return [$farm, $admin, $token, $subordinate];
    }

    private function loginToken(string $email): string
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password123',
        ])->json('data.access_token');
    }

    /**
     * Prepara root + dos granjas, cada una con un subordinado activo y una
     * actividad. Devuelve [$root, $farmA, $farmB, $subA, $subB, $token].
     */
    private function createRootWithTwoFarmActivities(): array
    {
        $this->artisan('app:init-root');

        $farmA = Farm::create(['name' => 'Granja Alfa', 'sector' => 'porcino', 'is_active' => true]);
        $farmB = Farm::create(['name' => 'Granja Beta', 'sector' => 'bovino', 'is_active' => true]);

        $root = User::create([
            'farm_id' => null,
            'name' => 'Root Global',
            'email' => 'root_global@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'root',
            'is_active' => true,
        ]);

        $subA = User::create([
            'farm_id' => $farmA->id,
            'name' => 'Sub Alfa',
            'email' => 'sub_alfa@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        $subB = User::create([
            'farm_id' => $farmB->id,
            'name' => 'Sub Beta',
            'email' => 'sub_beta@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        Activity::create([
            'farm_id' => $farmA->id,
            'created_by' => $root->id,
            'assigned_to' => $subA->id,
            'title' => 'Tarea Alfa',
            'due_date' => now()->addDay()->toDateString(),
            'status' => 'pendiente',
        ]);

        Activity::create([
            'farm_id' => $farmB->id,
            'created_by' => $root->id,
            'assigned_to' => $subB->id,
            'title' => 'Tarea Beta',
            'due_date' => now()->addDay()->toDateString(),
            'status' => 'pendiente',
        ]);

        $token = $this->loginToken('root_global@test.com');

        return [$root, $farmA, $farmB, $subA, $subB, $token];
    }

    public function test_activities_tables_have_all_required_columns(): void
    {
        $this->assertTrue(Schema::hasTable('activities'), 'Table activities must exist.');

        foreach (['id', 'farm_id', 'created_by', 'assigned_to', 'title', 'description', 'due_date', 'status', 'completed_at'] as $column) {
            $this->assertTrue(
                Schema::hasColumn('activities', $column),
                "Column '{$column}' is missing from 'activities' table."
            );
        }

        $this->assertTrue(Schema::hasTable('notifications'), 'Table notifications must exist.');
        foreach (['id', 'type', 'notifiable_type', 'notifiable_id', 'data', 'read_at'] as $column) {
            $this->assertTrue(
                Schema::hasColumn('notifications', $column),
                "Column '{$column}' is missing from 'notifications' table."
            );
        }
    }

    public function test_activities_module_is_officially_registered_in_modules_table(): void
    {
        $this->artisan('app:init-root');

        $module = Module::where('code', 'activities')->first();
        $this->assertNotNull($module, "Module with code 'activities' must be registered in modules table.");
        $this->assertEquals('Actividades', $module->name);
    }

    public function test_admin_cannot_access_activities_if_module_is_disabled_for_farm(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdminAndSubordinate('Granja Sin Actividades', 'admin_nomod_act@test.com');

        $module = Module::where('code', 'activities')->first();
        FarmModule::where('farm_id', $farm->id)
            ->where('module_id', $module->id)
            ->update(['is_enabled' => false]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/activities')
            ->assertStatus(403)
            ->assertJson(['status' => 'error']);
    }

    public function test_admin_can_create_activity_and_subordinate_is_notified(): void
    {
        [$farm, $admin, $token, $subordinate] = $this->createFarmWithAdminAndSubordinate('Granja Actividades OK', 'admin_act_ok@test.com');

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/activities', [
                'title' => 'Alimentar cerdos de la mañana',
                'description' => 'Revisar comederos del galpón 1.',
                'due_date' => now()->addDay()->toDateString(),
                'assigned_to' => $subordinate->id,
            ])
            ->assertStatus(201)
            ->assertJson(['status' => 'success']);

        $this->assertSame('pendiente', $response->json('data.status'), 'La actividad debe nacer en estado pendiente.');

        // El registro existe y quedó auditado
        $this->assertDatabaseHas('activities', [
            'farm_id' => $farm->id,
            'assigned_to' => $subordinate->id,
            'title' => 'Alimentar cerdos de la mañana',
            'status' => 'pendiente',
        ]);

        $this->assertTrue(
            \App\Models\ActivityLog::where('module', 'Actividades')->where('action', 'CREAR')->exists(),
            'La creación debe quedar registrada en el historial de auditoría.'
        );

        // La notificación quedó persistida en base de datos para el subordinado
        $this->assertDatabaseHas('notifications', [
            'notifiable_type' => User::class,
            'notifiable_id' => $subordinate->id,
        ]);

        $notification = DB::table('notifications')
            ->where('notifiable_id', $subordinate->id)
            ->first();

        $this->assertNotNull($notification);
        $this->assertStringContainsString('Nueva actividad asignada', $notification->data);
    }

    public function test_admin_cannot_assign_activity_to_user_from_another_farm(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdminAndSubordinate('Granja Propia', 'admin_propria@test.com');

        // Subordinado de OTRA granja
        $this->artisan('app:init-root');
        $otherFarm = Farm::create(['name' => 'Granja Ajena', 'sector' => 'bovino', 'is_active' => true]);
        $foreignSubordinate = User::create([
            'farm_id' => $otherFarm->id,
            'name' => 'Ajeno',
            'email' => 'sub_ajeno@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/activities', [
                'title' => 'Actividad inválida',
                'due_date' => now()->addDay()->toDateString(),
                'assigned_to' => $foreignSubordinate->id,
            ])
            ->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseMissing('activities', ['title' => 'Actividad inválida']);
    }

    public function test_admin_cannot_assign_activity_to_another_admin(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdminAndSubordinate('Granja Admins', 'admin_admins@test.com');

        $otherAdmin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Otro Admin',
            'email' => 'otro_admin@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/activities', [
                'title' => 'Actividad a admin',
                'due_date' => now()->addDay()->toDateString(),
                'assigned_to' => $otherAdmin->id,
            ])
            ->assertStatus(422)
            ->assertJsonPath('status', 'error');
    }

    public function test_only_assigned_subordinate_or_admin_can_change_status(): void
    {
        [$farm, $admin, $token, $subordinate] = $this->createFarmWithAdminAndSubordinate('Granja Permisos', 'admin_permisos@test.com');

        $activity = Activity::create([
            'farm_id' => $farm->id,
            'created_by' => $admin->id,
            'assigned_to' => $subordinate->id,
            'title' => 'Limpiar galpón',
            'due_date' => now()->addDays(2)->toDateString(),
            'status' => 'pendiente',
        ]);

        // Subordinado AJENO a la asignación no puede cambiar el estado
        $this->artisan('app:init-root');
        $otherSubordinate = User::create([
            'farm_id' => $farm->id,
            'name' => 'Intruso',
            'email' => 'intruso@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        $intruderToken = $this->loginToken('intruso@test.com');

        $this->withHeader('Authorization', 'Bearer '.$intruderToken)
            ->patchJson("/api/v1/activities/{$activity->id}/status", ['status' => 'terminada'])
            ->assertStatus(403)
            ->assertJson(['status' => 'error']);

        // El subordinado asignado SÍ puede cambiar el estado
        $subordinateToken = $this->loginToken($subordinate->email);

        $this->withHeader('Authorization', 'Bearer '.$subordinateToken)
            ->patchJson("/api/v1/activities/{$activity->id}/status", ['status' => 'en_proceso'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'en_proceso');
    }

    public function test_status_must_be_exactly_in_progress_or_completed(): void
    {
        [$farm, $admin, $token, $subordinate] = $this->createFarmWithAdminAndSubordinate('Granja Estados', 'admin_estados@test.com');

        $activity = Activity::create([
            'farm_id' => $farm->id,
            'created_by' => $admin->id,
            'assigned_to' => $subordinate->id,
            'title' => 'Revisar comederos',
            'due_date' => now()->addDays(2)->toDateString(),
            'status' => 'pendiente',
        ]);

        $subordinateToken = $this->loginToken($subordinate->email);

        // 'pendiente' NO es una opción válida para el subordinado
        $this->withHeader('Authorization', 'Bearer '.$subordinateToken)
            ->patchJson("/api/v1/activities/{$activity->id}/status", ['status' => 'pendiente'])
            ->assertStatus(422)
            ->assertJson(['status' => 'error']);

        // Cualquier otro valor inventado también falla
        $this->withHeader('Authorization', 'Bearer '.$subordinateToken)
            ->patchJson("/api/v1/activities/{$activity->id}/status", ['status' => 'cancelada'])
            ->assertStatus(422)
            ->assertJson(['status' => 'error']);
    }

    public function test_completing_activity_notifies_admin_and_sets_completed_at(): void
    {
        [$farm, $admin, $token, $subordinate] = $this->createFarmWithAdminAndSubordinate('Granja Terminar', 'admin_terminar@test.com');

        $activity = Activity::create([
            'farm_id' => $farm->id,
            'created_by' => $admin->id,
            'assigned_to' => $subordinate->id,
            'title' => 'Vacunar cerdos',
            'due_date' => now()->addDays(3)->toDateString(),
            'status' => 'pendiente',
        ]);

        $subordinateToken = $this->loginToken($subordinate->email);

        $this->withHeader('Authorization', 'Bearer '.$subordinateToken)
            ->patchJson("/api/v1/activities/{$activity->id}/status", ['status' => 'terminada'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'terminada');

        $this->assertNotNull($activity->fresh()->completed_at, 'Al terminar debe registrarse completed_at.');

        // El admin que creó la actividad recibe la notificación
        $this->assertDatabaseHas('notifications', [
            'notifiable_type' => User::class,
            'notifiable_id' => $admin->id,
        ]);
    }

    public function test_subordinate_only_sees_own_assigned_activities(): void
    {
        [$farm, $admin, $token, $subordinate] = $this->createFarmWithAdminAndSubordinate('Granja Bandeja', 'admin_bandeja@test.com');

        Activity::create([
            'farm_id' => $farm->id,
            'created_by' => $admin->id,
            'assigned_to' => $subordinate->id,
            'title' => 'Mi actividad',
            'due_date' => now()->addDay()->toDateString(),
            'status' => 'pendiente',
        ]);

        // Actividad asignada a otro subordinado (no debe verse en la bandeja)
        $other = User::create([
            'farm_id' => $farm->id,
            'name' => 'Otro',
            'email' => 'otro_enc@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        Activity::create([
            'farm_id' => $farm->id,
            'created_by' => $admin->id,
            'assigned_to' => $other->id,
            'title' => 'Actividad de otro',
            'due_date' => now()->addDay()->toDateString(),
            'status' => 'pendiente',
        ]);

        $subordinateToken = $this->loginToken($subordinate->email);

        $response = $this->withHeader('Authorization', 'Bearer '.$subordinateToken)
            ->getJson('/api/v1/activities/my')
            ->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $titles = collect($response->json('data'))->pluck('title')->all();
        $this->assertContains('Mi actividad', $titles);
        $this->assertNotContains('Actividad de otro', $titles);
    }

    public function test_completed_activity_cannot_be_edited_or_deleted(): void
    {
        [$farm, $admin, $token, $subordinate] = $this->createFarmWithAdminAndSubordinate('Granja Bloqueo', 'admin_bloqueo@test.com');

        $activity = Activity::create([
            'farm_id' => $farm->id,
            'created_by' => $admin->id,
            'assigned_to' => $subordinate->id,
            'title' => 'Actividad terminada',
            'due_date' => now()->subDay()->toDateString(),
            'status' => 'terminada',
            'completed_at' => now(),
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/v1/activities/{$activity->id}", [
                'title' => 'Intento de edición',
                'due_date' => now()->addDay()->toDateString(),
                'assigned_to' => $subordinate->id,
            ])
            ->assertStatus(422)
            ->assertJson(['status' => 'error']);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson("/api/v1/activities/{$activity->id}")
            ->assertStatus(422)
            ->assertJson(['status' => 'error']);

        $this->assertDatabaseHas('activities', ['id' => $activity->id, 'title' => 'Actividad terminada']);
    }

    public function test_stats_endpoint_returns_activity_metrics(): void
    {
        [$farm, $admin, $token, $subordinate] = $this->createFarmWithAdminAndSubordinate('Granja Stats', 'admin_stats_act@test.com');

        Activity::create([
            'farm_id' => $farm->id,
            'created_by' => $admin->id,
            'assigned_to' => $subordinate->id,
            'title' => 'Vencida',
            'due_date' => now()->subDay()->toDateString(),
            'status' => 'pendiente',
        ]);

        Activity::create([
            'farm_id' => $farm->id,
            'created_by' => $admin->id,
            'assigned_to' => $subordinate->id,
            'title' => 'En curso',
            'due_date' => now()->addDay()->toDateString(),
            'status' => 'en_proceso',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/activities/stats')
            ->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $this->assertSame(2, $response->json('data.total'));
        $this->assertSame(1, $response->json('data.pending'));
        $this->assertSame(1, $response->json('data.in_progress'));
        $this->assertSame(1, $response->json('data.overdue'));
    }

    public function test_subordinate_cannot_access_global_listing_or_stats(): void
    {
        [, , , $subordinate] = $this->createFarmWithAdminAndSubordinate('Granja Blindaje', 'admin_blindaje@test.com');

        $subordinateToken = $this->loginToken($subordinate->email);

        // Listado global: exclusivo del administrador/root
        $this->withHeader('Authorization', 'Bearer '.$subordinateToken)
            ->getJson('/api/v1/activities')
            ->assertStatus(403)
            ->assertJson(['status' => 'error']);

        // Estadísticas globales: también exclusivas del administrador/root
        $this->withHeader('Authorization', 'Bearer '.$subordinateToken)
            ->getJson('/api/v1/activities/stats')
            ->assertStatus(403)
            ->assertJson(['status' => 'error']);
    }

    public function test_admin_can_filter_by_own_farm_id_without_forbidden_error(): void
    {
        [$farm, $admin, $token, $subordinate] = $this->createFarmWithAdminAndSubordinate('Granja Filtro', 'admin_filtro@test.com');

        Activity::create([
            'farm_id' => $farm->id,
            'created_by' => $admin->id,
            'assigned_to' => $subordinate->id,
            'title' => 'Tarea de mi granja',
            'due_date' => now()->addDay()->toDateString(),
            'status' => 'pendiente',
        ]);

        // El frontend admin SIEMPRE envía farm_id (su propia granja):
        // debe responder 200, no 403.
        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/activities?farm_id='.$farm->id)
            ->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Tarea de mi granja', $response->json('data.0.title'));
    }

    public function test_admin_requesting_foreign_farm_id_gets_empty_list_not_data_leak(): void
    {
        [$farm, $admin, $token, $subordinate] = $this->createFarmWithAdminAndSubordinate('Granja Propia', 'admin_ajena@test.com');

        Activity::create([
            'farm_id' => $farm->id,
            'created_by' => $admin->id,
            'assigned_to' => $subordinate->id,
            'title' => 'Tarea propia',
            'due_date' => now()->addDay()->toDateString(),
            'status' => 'pendiente',
        ]);

        // Otra granja ajena
        $foreignFarm = Farm::create(['name' => 'Granja Ajena', 'sector' => 'bovino', 'is_active' => true]);        $foreignSubordinate = User::create([
            'farm_id' => $foreignFarm->id,
            'name' => 'Ajeno',
            'email' => 'sub_ajena@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);
        Activity::create([
            'farm_id' => $foreignFarm->id,
            'created_by' => $foreignSubordinate->id,
            'assigned_to' => $foreignSubordinate->id,
            'title' => 'Tarea ajena',
            'due_date' => now()->addDay()->toDateString(),
            'status' => 'pendiente',
        ]);

        // El admin pide la granja ajena: se ignora el filtro y ve la suya
        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/activities?farm_id='.$foreignFarm->id)
            ->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $titles = collect($response->json('data'))->pluck('title')->all();
        $this->assertContains('Tarea propia', $titles);
        $this->assertNotContains('Tarea ajena', $titles, 'Nunca debe filtrar actividades de otra granja.');
    }

    public function test_root_can_filter_by_any_farm_id(): void
    {
        $this->artisan('app:init-root');

        $farmA = Farm::create(['name' => 'Granja A', 'sector' => 'porcino', 'is_active' => true]);
        $farmB = Farm::create(['name' => 'Granja B', 'sector' => 'bovino', 'is_active' => true]);

        $root = User::create([
            'farm_id' => null,
            'name' => 'Root',
            'email' => 'root@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'root',
            'is_active' => true,
        ]);

        $subA = User::create([
            'farm_id' => $farmA->id,
            'name' => 'Sub A',
            'email' => 'sub_a@test.com',
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        Activity::create([
            'farm_id' => $farmA->id,
            'created_by' => $root->id,
            'assigned_to' => $subA->id,
            'title' => 'Tarea A',
            'due_date' => now()->addDay()->toDateString(),
            'status' => 'pendiente',
        ]);

        Activity::create([
            'farm_id' => $farmB->id,
            'created_by' => $root->id,
            'assigned_to' => $subA->id,
            'title' => 'Tarea B',
            'due_date' => now()->addDay()->toDateString(),
            'status' => 'pendiente',
        ]);

        $token = $this->loginToken('root@test.com');

        // Root filtra por Granja A
        $responseA = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/activities?farm_id='.$farmA->id)
            ->assertStatus(200);

        $titlesA = collect($responseA->json('data'))->pluck('title')->all();
        $this->assertContains('Tarea A', $titlesA);
        $this->assertNotContains('Tarea B', $titlesA);

        // Root filtra por Granja B
        $responseB = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/activities?farm_id='.$farmB->id)
            ->assertStatus(200);

        $titlesB = collect($responseB->json('data'))->pluck('title')->all();
        $this->assertContains('Tarea B', $titlesB);
        $this->assertNotContains('Tarea A', $titlesB);
    }

    public function test_root_without_farm_id_sees_activities_from_all_farms(): void
    {
        [, , , , , $token] = $this->createRootWithTwoFarmActivities();

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/activities')
            ->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $titles = collect($response->json('data'))->pluck('title')->all();
        $this->assertContains('Tarea Alfa', $titles);
        $this->assertContains('Tarea Beta', $titles, 'El root debe ver actividades de todas las granjas.');
        $this->assertSame(2, $response->json('stats.total'));
    }

    public function test_root_with_farm_id_all_sees_every_farm(): void
    {
        [, , , , , $token] = $this->createRootWithTwoFarmActivities();

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/activities?farm_id=all')
            ->assertStatus(200);

        $titles = collect($response->json('data'))->pluck('title')->all();
        $this->assertContains('Tarea Alfa', $titles);
        $this->assertContains('Tarea Beta', $titles);
    }

    public function test_activity_listing_exposes_farm_name_for_root(): void
    {
        [, $farmA, , , , $token] = $this->createRootWithTwoFarmActivities();

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/activities?farm_id='.$farmA->id)
            ->assertStatus(200);

        $this->assertSame('Granja Alfa', $response->json('data.0.farm_name'));
        $this->assertSame($farmA->id, $response->json('data.0.farm.id'));
    }

    public function test_root_can_create_activity_in_any_farm_specifying_farm_id(): void
    {
        [, $farmA, $farmB, $subA, $subB, $token] = $this->createRootWithTwoFarmActivities();

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/activities', [
                'farm_id' => $farmB->id,
                'title' => 'Tarea creada por root en Beta',
                'due_date' => now()->addDay()->toDateString(),
                'assigned_to' => $subB->id,
            ])
            ->assertStatus(201)
            ->assertJson(['status' => 'success']);

        $this->assertDatabaseHas('activities', [
            'id' => $response->json('data.id'),
            'farm_id' => $farmB->id,
            'assigned_to' => $subB->id,
        ]);

        // El encargado asignado debe pertenecer a la granja indicada
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/activities', [
                'farm_id' => $farmB->id,
                'title' => 'Cruce de granjas',
                'due_date' => now()->addDay()->toDateString(),
                'assigned_to' => $subA->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['assigned_to']);
    }

    public function test_root_can_change_status_of_activity_from_any_farm(): void
    {
        [, , , , , $token] = $this->createRootWithTwoFarmActivities();

        $activityB = Activity::where('title', 'Tarea Beta')->firstOrFail();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->patchJson('/api/v1/activities/'.$activityB->id.'/status', ['status' => 'en_proceso'])
            ->assertStatus(200);

        $this->assertDatabaseHas('activities', ['id' => $activityB->id, 'status' => 'en_proceso']);
    }

    public function test_notifications_endpoint_returns_bell_data_and_marks_read(): void
    {
        [$farm, $admin, $token, $subordinate] = $this->createFarmWithAdminAndSubordinate('Granja Campana', 'admin_campana@test.com');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/activities', [
                'title' => 'Tarea para campana',
                'due_date' => now()->addDay()->toDateString(),
                'assigned_to' => $subordinate->id,
            ])
            ->assertStatus(201);

        $subordinateToken = $this->loginToken($subordinate->email);

        $response = $this->withHeader('Authorization', 'Bearer '.$subordinateToken)
            ->getJson('/api/v1/notifications')
            ->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $this->assertSame(1, $response->json('unread_count'), 'El subordinado debe tener 1 notificación sin leer.');
        $notificationId = $response->json('data.0.id');
        $this->assertNotNull($notificationId);

        // Marcar como leída
        $this->withHeader('Authorization', 'Bearer '.$subordinateToken)
            ->postJson("/api/v1/notifications/{$notificationId}/read")
            ->assertStatus(200);

        $this->assertSame(0, $this->withHeader('Authorization', 'Bearer '.$subordinateToken)
            ->getJson('/api/v1/notifications')
            ->json('unread_count'));
    }
}
