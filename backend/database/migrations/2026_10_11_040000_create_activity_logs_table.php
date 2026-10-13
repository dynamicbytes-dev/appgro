<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('farm_id')->nullable()->constrained('farms')->onDelete('cascade');
            $table->string('module');
            $table->string('action');
            $table->text('description');
            $table->timestamps();

            $table->index(['farm_id', 'created_at']);
            $table->index(['module', 'action']);
        });

        // Register official 'history' module if not already registered
        DB::table('modules')->insertOrIgnore([
            'code' => 'history',
            'name' => 'Historial y Auditoría',
            'description' => 'Módulo de Registro y Auditoría de Actividades del Sistema',
            'created_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
        DB::table('modules')->where('code', 'history')->delete();
    }
};
