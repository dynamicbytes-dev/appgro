<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tabla `activities`: módulo operativo Actividades.
 *
 * Tareas creadas por el administrador de la granja y asignadas a un
 * subordinado (encargado) de la MISMA granja. El subordinado gestiona
 * el estado ('pendiente' → 'en_proceso' → 'terminada').
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained('farms')->onDelete('cascade');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_to')->constrained('users')->onDelete('cascade');
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('due_date');
            $table->string('status')->default('pendiente');
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();

            $table->index(['farm_id', 'status']);
            $table->index(['assigned_to', 'status']);
        });

        // Registro idempotente del módulo oficial 'activities' (alias
        // 'actividades' resuelto en CheckModuleAccess). Asegura que el
        // código exista aunque no se haya ejecutado app:init-root.
        DB::table('modules')->insertOrIgnore([
            'code' => 'activities',
            'name' => 'Actividades',
            'description' => 'Control y Registro de Actividades Operativas',
            'created_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('activities');
    }
};
