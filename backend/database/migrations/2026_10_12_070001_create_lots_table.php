<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo operativo Lotes ('lots').
 *
 * Evoluciona la tabla placeholder `lots` al schema operativo completo:
 * multigranja, código autogenerado único, vínculo con galpón/especie,
 * herencia de sector/propósito, control de cupo y campos de cosecha/huevos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained('farms')->onDelete('cascade');
            $table->foreignId('galpon_id')->nullable()->constrained('galpones')->nullOnDelete();
            // Compatibilidad con el vínculo legacy barns
            $table->foreignId('barn_id')->nullable()->constrained('barns')->nullOnDelete();
            $table->string('code')->unique();
            $table->foreignId('species_id')->nullable()->constrained('species')->nullOnDelete();
            $table->string('sector')->nullable();
            $table->string('purpose')->nullable();
            $table->unsignedInteger('quantity')->default(0);
            $table->string('status')->default('activo');
            $table->date('entry_date')->nullable();
            // Campos de cosecha
            $table->date('harvest_date')->nullable();
            $table->decimal('avg_weight', 10, 2)->nullable();
            $table->decimal('total_weight', 12, 2)->nullable();
            $table->decimal('price_per_kg', 12, 2)->nullable();
            $table->decimal('total_price', 14, 2)->nullable();
            // Campos específicos de huevos
            $table->unsignedInteger('total_eggs')->default(0);
            $table->unsignedInteger('broken_eggs')->default(0);
            $table->decimal('egg_price', 12, 2)->nullable();
            $table->decimal('total_egg_cost', 14, 2)->nullable();
            $table->decimal('total_broken_cost', 14, 2)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lots');
    }
};
