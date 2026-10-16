<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo operativo Inventario ('inventory' / alias 'inventario').
 *
 *  - `inventory_items`     → catálogo de insumos de la granja (código
 *    autogenerado, categoría, stock actual/mínimo/máximo, lote,
 *    vencimientos, costos, proveedor y última fecha de compra).
 *  - `inventory_movements` → entradas, salidas y ajustes que mutan el
 *    stock, con destino de consumo (lote de animales), fecha/hora y
 *    responsable (usuario autenticado).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained('farms')->onDelete('cascade');
            $table->string('code');
            $table->string('name');
            $table->string('category');
            $table->decimal('current_stock', 12, 2)->default(0);
            $table->decimal('min_stock', 12, 2)->default(0);
            $table->decimal('max_stock', 12, 2)->nullable();
            $table->string('batch_number')->nullable();
            $table->date('manufacturing_date')->nullable();
            $table->date('expiration_date')->nullable();
            $table->string('location')->nullable();
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->decimal('total_cost', 14, 2)->default(0);
            $table->string('supplier')->nullable();
            $table->date('last_purchase_date')->nullable();
            $table->timestamp('low_stock_alerted_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();

            $table->unique(['farm_id', 'code']);
            $table->index(['farm_id', 'category']);
            $table->index(['farm_id', 'expiration_date']);
        });

        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained('farms')->onDelete('cascade');
            $table->foreignId('inventory_item_id')->constrained('inventory_items')->onDelete('cascade');
            $table->string('type'); // entrada | salida | ajuste
            $table->decimal('quantity', 12, 2);
            $table->decimal('resulting_stock', 12, 2)->default(0);
            $table->foreignId('destination_lot_id')->nullable()->constrained('lots')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamp('movement_date')->useCurrent();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();

            $table->index(['inventory_item_id', 'created_at']);
            $table->index(['farm_id', 'created_at']);
        });

        // Registro idempotente del módulo oficial 'inventory' (el alias
        // 'inventario' se resuelve en CheckModuleAccess). Asegura que el
        // código exista aunque no se haya ejecutado app:init-root.
        DB::table('modules')->insertOrIgnore([
            'code' => 'inventory',
            'name' => 'Inventario',
            'description' => 'Control de Insumos y Movimientos de Inventario',
            'created_at' => now(),
        ]);

        // Filas de farm_modules deshabilitadas para las granjas ya
        // existentes: el módulo queda disponible para que el Root lo
        // habilite desde la consola de administración.
        $module = DB::table('modules')->where('code', 'inventory')->first();

        if ($module) {
            foreach (DB::table('farms')->pluck('id') as $farmId) {
                DB::table('farm_modules')->updateOrInsert(
                    ['farm_id' => $farmId, 'module_id' => $module->id],
                    ['is_enabled' => false]
                );
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_movements');
        Schema::dropIfExists('inventory_items');
    }
};
