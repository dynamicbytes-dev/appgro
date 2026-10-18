<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Integración del módulo Lotes con Potreros.
 *
 * Los lotes de especies de los sectores Bovino, Ovino y Caprino se
 * alojan en un potrero (campo abierto) en lugar de un galpón. El
 * campo es opcional para conservar los lotes legados que ya estaban
 * vinculados a un galpón.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lots', function (Blueprint $table) {
            $table->foreignId('potrero_id')
                ->nullable()
                ->after('galpon_id')
                ->constrained('potreros')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('lots', function (Blueprint $table) {
            $table->dropConstrainedForeignId('potrero_id');
        });
    }
};
