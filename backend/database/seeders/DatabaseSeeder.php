<?php

namespace Database\Seeders;

use App\Models\Module;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Clean obsolete modules and ensure official system modules exist
        $officialModules = [
            ['code' => 'species', 'name' => 'Especies', 'description' => 'Módulo de Gestión de Especies Pecuarias'],
            ['code' => 'galpones', 'name' => 'Galpones', 'description' => 'Módulo de Galpones e Instalaciones'],
            ['code' => 'barns', 'name' => 'Galpones', 'description' => 'Módulo de Galpones e Instalaciones'],
            ['code' => 'lots', 'name' => 'Lotes', 'description' => 'Módulo de Lotes de Animales'],
            ['code' => 'activities', 'name' => 'Actividades', 'description' => 'Control y Registro de Actividades Operativas'],
            ['code' => 'analytics', 'name' => 'Analítica y Reportes', 'description' => 'Analíticas, Estadísticas y Reportes Agropecuarios'],
            ['code' => 'history', 'name' => 'Historial y Auditoría', 'description' => 'Registro de acciones de usuarios'],
        ];

        $validCodes = array_column($officialModules, 'code');

        // Delete pivot records for non-official modules
        $orphanModuleIds = Module::whereNotIn('code', $validCodes)->pluck('id')->toArray();
        if (!empty($orphanModuleIds)) {
            \Illuminate\Support\Facades\DB::table('farm_modules')->whereIn('module_id', $orphanModuleIds)->delete();
            \Illuminate\Support\Facades\DB::table('subordinate_modules')->whereIn('module_id', $orphanModuleIds)->delete();
            Module::whereIn('id', $orphanModuleIds)->delete();
        }

        foreach ($officialModules as $moduleData) {
            Module::updateOrCreate(
                ['code' => $moduleData['code']],
                [
                    'name' => $moduleData['name'],
                    'description' => $moduleData['description'],
                ]
            );
        }

        // 2. Insert single Root user
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
