<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fase 2 del módulo Potreros: manejo agronómico.
     * - pasture_treatments: historial de mantenimiento y fertilización.
     * - pasture_biomass_surveys: historial de aforo de forraje.
     */
    public function up(): void
    {
        if (! Schema::hasTable('pasture_treatments')) {
            Schema::create('pasture_treatments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('farm_id')->constrained('farms')->cascadeOnDelete();
                $table->foreignId('potrero_id')->constrained('potreros')->cascadeOnDelete();
                $table->string('type');
                $table->string('product')->nullable();
                $table->decimal('dose', 10, 2)->nullable();
                $table->string('dose_unit')->nullable();
                $table->date('applied_at');
                $table->decimal('cost', 12, 2)->nullable();
                $table->text('notes')->nullable();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['potrero_id', 'applied_at'], 'pasture_treatments_potrero_date_idx');
                $table->index(['farm_id', 'applied_at'], 'pasture_treatments_farm_date_idx');
            });
        }

        if (! Schema::hasTable('pasture_biomass_surveys')) {
            Schema::create('pasture_biomass_surveys', function (Blueprint $table) {
                $table->id();
                $table->foreignId('farm_id')->constrained('farms')->cascadeOnDelete();
                $table->foreignId('potrero_id')->constrained('potreros')->cascadeOnDelete();
                $table->date('surveyed_at');
                $table->decimal('entry_height_cm', 8, 2)->nullable();
                $table->decimal('exit_height_cm', 8, 2)->nullable();
                $table->decimal('biomass_kg_dm_ha', 12, 2)->nullable();
                $table->text('notes')->nullable();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['potrero_id', 'surveyed_at'], 'pasture_surveys_potrero_date_idx');
                $table->index(['farm_id', 'surveyed_at'], 'pasture_surveys_farm_date_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('pasture_biomass_surveys');
        Schema::dropIfExists('pasture_treatments');
    }
};
