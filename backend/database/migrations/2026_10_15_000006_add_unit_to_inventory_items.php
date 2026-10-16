<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Unidad de medida de los insumos de Inventario.
 *
 * Los stocks (`current_stock`/`min_stock`/`max_stock`) se expresan en
 * una unidad fija por insumo: kg, g, cc, L, ml, unidad, dosis, etc.
 * Se agrega la columna `unit` (no nula, default 'kg') y se completa
 * con 'kg' los insumos ya existentes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->string('unit', 20)->default('kg');
        });

        // Backfill defensivo de filas previas (el default ya las cubre
        // en la mayoría de motores, pero lo aseguramos explícitamente).
        DB::table('inventory_items')
            ->whereNull('unit')
            ->orWhere('unit', '')
            ->update(['unit' => 'kg']);
    }

    public function down(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropColumn('unit');
        });
    }
};
