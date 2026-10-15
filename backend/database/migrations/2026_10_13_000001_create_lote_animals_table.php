<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabla `lote_animals`: registro individual de animales de un lote
 * (principalmente porcinos de reproducción).
 *
 * El aislamiento multigranja se resuelve a través de `lote_id` (el lote
 * pertenece a una granja), no con columna farm_id propia.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lote_animals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lote_id')->constrained('lots')->onDelete('cascade');
            $table->string('identifier', 10)->unique();
            $table->string('breed')->nullable();
            $table->string('father_breed')->nullable();
            $table->string('mother_breed')->nullable();
            $table->string('gender');
            $table->date('birth_date')->nullable();
            $table->unsignedInteger('parity_count')->default(0);
            $table->unsignedInteger('teats_count')->default(0);
            $table->decimal('avg_piglets_per_birth', 4, 2)->default(0);
            $table->string('status')->default('activo');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lote_animals');
    }
};
