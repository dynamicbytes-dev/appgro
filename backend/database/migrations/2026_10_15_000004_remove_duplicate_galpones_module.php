<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Unifica el módulo "Galpones" en un único registro oficial con código `barns`.
 *
 * Históricamente el sistema registró dos filas equivalentes en `modules`:
 *  - `barns`     (canónico: `OFFICIAL_FARM_MODULES`, `CODE_TO_MODULE_ID` y el
 *                 middleware de acceso se basan en él).
 *  - `galpones`  (alias legacy duplicado, visible como "Galpones (galpones)").
 *
 * Esta migración conserva el estado de habilitación del alias legacy
 * (`farm_modules` / `subordinate_modules`) sobre el módulo canónico y elimina
 * la fila duplicada para evitar registros repetidos en la interfaz.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('modules')) {
            return;
        }

        $galpones = DB::table('modules')->where('code', 'galpones')->first();

        // Nada que consolidar si el alias legacy no existe.
        if (! $galpones) {
            return;
        }

        $barns = DB::table('modules')->where('code', 'barns')->first();

        // Si no existe el canónico, promovemos el legacy en lugar de eliminarlo.
        if (! $barns) {
            DB::table('modules')
                ->where('id', $galpones->id)
                ->update([
                    'code' => 'barns',
                    'name' => 'Galpones',
                    'description' => 'Módulo de Galpones e Instalaciones',
                ]);

            return;
        }

        // 1. Trasladar el estado habilitado del alias a la fila canónica.
        $this->mergeEnabledPivots('farm_modules', 'farm_id', $galpones->id, $barns->id);
        $this->mergeEnabledPivots('subordinate_modules', 'user_id', $galpones->id, $barns->id);

        // 2. Limpiar pivotes del alias y eliminar la fila duplicada.
        if (Schema::hasTable('farm_modules')) {
            DB::table('farm_modules')->where('module_id', $galpones->id)->delete();
        }

        if (Schema::hasTable('subordinate_modules')) {
            DB::table('subordinate_modules')->where('module_id', $galpones->id)->delete();
        }

        DB::table('modules')->where('id', $galpones->id)->delete();
    }

    public function down(): void
    {
        if (! Schema::hasTable('modules')) {
            return;
        }

        // Restaura el alias legacy (deshabilitado por defecto), sin recrear pivotes.
        if (! DB::table('modules')->where('code', 'galpones')->exists()) {
            DB::table('modules')->insert([
                'code' => 'galpones',
                'name' => 'Galpones',
                'description' => 'Módulo de Galpones e Instalaciones',
                'created_at' => now(),
            ]);
        }
    }

    /**
     * Copia `is_enabled = true` desde el módulo duplicado hacia el canónico para
     * cada propietario (granja o usuario) que tuviera el alias habilitado.
     */
    private function mergeEnabledPivots(string $table, string $ownerColumn, int $fromModuleId, int $toModuleId): void
    {
        if (! Schema::hasTable($table)) {
            return;
        }

        $ownerIds = DB::table($table)
            ->where('module_id', $fromModuleId)
            ->where('is_enabled', true)
            ->pluck($ownerColumn);

        foreach ($ownerIds as $ownerId) {
            $updated = DB::table($table)
                ->where($ownerColumn, $ownerId)
                ->where('module_id', $toModuleId)
                ->update(['is_enabled' => true]);

            if ($updated === 0) {
                DB::table($table)->updateOrInsert(
                    [$ownerColumn => $ownerId, 'module_id' => $toModuleId],
                    ['is_enabled' => true]
                );
            }
        }
    }
};
