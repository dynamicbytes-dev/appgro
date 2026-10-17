<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agrega columnas para trazabilidad de cantidades iniciales, cosechadas y peso inicial:
 * - `initial_quantity`: Cantidad inicial con la que se abrió el lote.
 * - `harvested_quantity`: Cantidad acumulada de animales o unidades cosechadas.
 * - `initial_weight`: Peso inicial promedio por animal al ingresar al lote.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lots', function (Blueprint $table) {
            $table->unsignedInteger('initial_quantity')->nullable()->after('quantity');
            $table->unsignedInteger('harvested_quantity')->default(0)->after('initial_quantity');
            $table->decimal('initial_weight', 10, 2)->nullable()->after('entry_date');
        });
    }

    public function down(): void
    {
        Schema::table('lots', function (Blueprint $table) {
            $table->dropColumn(['initial_quantity', 'harvested_quantity', 'initial_weight']);
        });
    }
};
