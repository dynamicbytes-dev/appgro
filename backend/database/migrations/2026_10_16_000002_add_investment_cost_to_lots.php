<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Costo de inversión (adquisición) de los animales de un lote.
 *
 * `lots` no tenía ninguna columna para reflejar la inversión inicial en
 * animales, por lo que el módulo de Analítica no podía consolidar el
 * "Costo Total de Producción" completo (animales + insumos + huevos).
 *
 * El valor es opcional: `NULL` significa "sin dato" y se excluye de los
 * totales para no distorsionar el margen.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lots', function (Blueprint $table) {
            $table->decimal('investment_cost', 14, 2)->nullable()->after('total_broken_cost');
        });
    }

    public function down(): void
    {
        Schema::table('lots', function (Blueprint $table) {
            $table->dropColumn('investment_cost');
        });
    }
};
