<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Módulo "Potreros": espejo de `galpones` pero para los sectores
     * pecuarios Bovino, Ovino y Caprino.
     */
    public function up(): void
    {
        if (!Schema::hasTable('potreros')) {
            Schema::create('potreros', function (Blueprint $table) {
                $table->id();
                $table->foreignId('farm_id')->constrained('farms')->onDelete('cascade');
                $table->foreignId('species_id')->constrained('species')->onDelete('cascade');
                $table->string('name');
                $table->string('category')->nullable();
                $table->string('sector')->nullable();
                $table->string('purpose');
                $table->integer('max_capacity')->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        // Registrar el módulo oficial "Potreros" de forma idempotente, para que
        // exista tras `php artisan migrate` sin depender de `app:init-root`.
        if (Schema::hasTable('modules') && ! DB::table('modules')->where('code', 'potreros')->exists()) {
            DB::table('modules')->insert([
                'code' => 'potreros',
                'name' => 'Potreros',
                'description' => 'Módulo de Potreros y Pastoreo (Bovino, Ovino y Caprino)',
                'created_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('modules')) {
            $moduleId = DB::table('modules')->where('code', 'potreros')->value('id');

            if ($moduleId) {
                if (Schema::hasTable('farm_modules')) {
                    DB::table('farm_modules')->where('module_id', $moduleId)->delete();
                }
                if (Schema::hasTable('subordinate_modules')) {
                    DB::table('subordinate_modules')->where('module_id', $moduleId)->delete();
                }
                DB::table('modules')->where('id', $moduleId)->delete();
            }
        }

        Schema::dropIfExists('potreros');
    }
};
