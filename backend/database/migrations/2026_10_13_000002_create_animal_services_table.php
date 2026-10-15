<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabla `animal_services`: historial de servicios reproductivos
 * (inseminación / monta) por animal individual.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('animal_services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lote_animal_id')->constrained('lote_animals')->onDelete('cascade');
            $table->string('service_type');
            $table->date('service_date');
            $table->string('status')->default('activo');
            $table->date('pregnancy_date')->nullable();
            $table->date('birth_date')->nullable();
            $table->unsignedInteger('total_piglets')->default(0);
            $table->unsignedInteger('live_piglets')->default(0);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('animal_services');
    }
};
