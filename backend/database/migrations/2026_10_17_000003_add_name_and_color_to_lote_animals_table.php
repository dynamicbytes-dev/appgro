<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agrega características individuales de identificación a los animales de un lote:
 * - `name`: nombre propio del ejemplar (aplica a conejos de reproducción).
 * - `color`: descripción del color/tono del pelaje.
 *
 * Ambas columnas son opcionales y no afectan a los registros existentes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lote_animals', function (Blueprint $table) {
            $table->string('name')->nullable()->after('identifier');
            $table->string('color')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('lote_animals', function (Blueprint $table) {
            $table->dropColumn(['name', 'color']);
        });
    }
};
