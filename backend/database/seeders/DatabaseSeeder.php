<?php

namespace Database\Seeders;

use App\Models\Module;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Catálogo oficial de módulos del sistema, con sus IDs canónicos.
     *
     * Los IDs deben coincidir con `CODE_TO_MODULE_ID` del frontend y con el
     * middleware de acceso por módulo. Se fijan de forma explícita para que una
     * instalación limpia (`migrate:fresh --seed`) quede idéntica al entorno de
     * referencia y no dependa del orden de autoincremento de PostgreSQL.
     */
    private const OFFICIAL_MODULES = [
        ['id' => 2,  'code' => 'species',    'name' => 'Especies',              'description' => 'Módulo de Gestión de Especies Pecuarias'],
        ['id' => 3,  'code' => 'barns',      'name' => 'Galpones',              'description' => 'Módulo de Galpones e Instalaciones'],
        ['id' => 4,  'code' => 'lots',       'name' => 'Lotes',                 'description' => 'Módulo de Lotes de Animales'],
        ['id' => 5,  'code' => 'activities', 'name' => 'Actividades',           'description' => 'Control y Registro de Actividades Operativas'],
        ['id' => 6,  'code' => 'analytics',  'name' => 'Analítica y Reportes',  'description' => 'Analíticas, Estadísticas y Reportes Agropecuarios'],
        ['id' => 7,  'code' => 'history',    'name' => 'Historial y Auditoría', 'description' => 'Registro de acciones de usuarios'],
        ['id' => 10, 'code' => 'inventory',  'name' => 'Inventario',            'description' => 'Control de Insumos y Movimientos de Inventario'],
        ['id' => 11, 'code' => 'potreros',   'name' => 'Potreros',              'description' => 'Módulo de Gestión de Potreros y Pastoreo'],
    ];

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->seedModules();
        $this->seedRootUser();
    }

    /**
     * Sincroniza el catálogo de módulos oficiales con sus IDs canónicos.
     *
     * Nota histórica: algunas migraciones (`activity_logs`, `activities`,
     * `inventory_tables`, `potreros`) insertan sus módulos con IDs
     * autogenerados por la secuencia, lo que rompe `CODE_TO_MODULE_ID` del
     * frontend en instalaciones limpias. Como el frontend envía IDs numéricos
     * en `module_ids`, aquí reconstruimos el catálogo con los IDs canónicos
     * cuando es seguro (sin asignaciones a granjas/usuarios). Si ya existen
     * asignaciones, se respetan los IDs actuales y solo se sincroniza por código.
     */
    private function seedModules(): void
    {
        $hasAssignments = DB::table('farm_modules')->exists()
            || DB::table('subordinate_modules')->exists();

        // Instalación limpia: el catálogo aún no tiene asignaciones reales, así
        // que podemos recrearlo para fijar los IDs canónicos.
        if (! $hasAssignments) {
            DB::table('modules')->delete();
        }

        // Crea/actualiza cada módulo oficial respetando su ID canónico.
        foreach (self::OFFICIAL_MODULES as $moduleData) {
            $existing = Module::where('code', $moduleData['code'])->first();

            if ($existing) {
                $existing->update([
                    'name' => $moduleData['name'],
                    'description' => $moduleData['description'],
                ]);
                continue;
            }

            DB::table('modules')->insert([
                'id' => $moduleData['id'],
                'code' => $moduleData['code'],
                'name' => $moduleData['name'],
                'description' => $moduleData['description'],
                'created_at' => now(),
            ]);
        }

        // Elimina módulos obsoletos (y sus pivotes) que no sean oficiales.
        $validCodes = array_column(self::OFFICIAL_MODULES, 'code');
        $orphanModuleIds = Module::whereNotIn('code', $validCodes)->pluck('id')->toArray();
        if (!empty($orphanModuleIds)) {
            DB::table('farm_modules')->whereIn('module_id', $orphanModuleIds)->delete();
            DB::table('subordinate_modules')->whereIn('module_id', $orphanModuleIds)->delete();
            Module::whereIn('id', $orphanModuleIds)->delete();
        }

        // Adelanta la secuencia de IDs (PostgreSQL) para futuras inserciones.
        if (DB::connection()->getDriverName() === 'pgsql') {
            $maxId = (int) Module::max('id');
            if ($maxId > 0) {
                DB::statement("SELECT setval(pg_get_serial_sequence('modules', 'id'), {$maxId}, true)");
            }
        }
    }

    /**
     * Inserta (o actualiza) el único usuario Root del sistema.
     */
    private function seedRootUser(): void
    {
        User::updateOrCreate(
            ['email' => 'rosangeles92@gmail.com'],
            [
                'name' => 'Rosangeles Rojas',
                'password_hash' => Hash::make('Miranda*30'),
                'role' => 'root',
                'farm_id' => null,
                'is_active' => true,
            ]
        );
    }
}
