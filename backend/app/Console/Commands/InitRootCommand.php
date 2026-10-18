<?php

namespace App\Console\Commands;

use App\Models\Module;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class InitRootCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:init-root';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Inicializa los módulos del sistema y crea el usuario Root único del sistema agropecuario';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Inicializando sistema agropecuario...');

        // 1. Clean obsolete modules and ensure official system modules exist
        $officialModules = [
            ['code' => 'species', 'name' => 'Especies', 'description' => 'Módulo de Gestión de Especies Pecuarias'],
            ['code' => 'barns', 'name' => 'Galpones', 'description' => 'Módulo de Galpones e Instalaciones'],
            ['code' => 'lots', 'name' => 'Lotes', 'description' => 'Módulo de Lotes de Animales'],
            ['code' => 'activities', 'name' => 'Actividades', 'description' => 'Control y Registro de Actividades Operativas'],
            ['code' => 'inventory', 'name' => 'Inventario', 'description' => 'Control de Insumos y Movimientos de Inventario'],
            ['code' => 'analytics', 'name' => 'Analítica y Reportes', 'description' => 'Analíticas, Estadísticas y Reportes Agropecuarios'],
            ['code' => 'history', 'name' => 'Historial y Auditoría', 'description' => 'Historial y Registro de Auditoría de Actividades'],
            ['code' => 'potreros', 'name' => 'Potreros', 'description' => 'Módulo de Potreros y Pastoreo (Bovino, Ovino y Caprino)'],
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
        $this->info('✓ Módulos del sistema verificados y estandarizados.');

        // 2. Insert or update the unique Root User
        $rootEmail = 'rosangeles92@gmail.com';
        
        $rootUser = User::updateOrCreate(
            ['email' => $rootEmail],
            [
                'name' => 'Rosangeles Rojas',
                'password_hash' => Hash::make('Miranda*30'),
                'role' => 'root',
                'farm_id' => null,
                'is_active' => true,
            ]
        );

        $this->info("✓ Usuario Root creado exitosamente: {$rootUser->email} (ID: {$rootUser->id})");
        $this->info('Inicialización completada con éxito.');

        return Command::SUCCESS;
    }
}
