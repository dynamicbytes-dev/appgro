<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Catálogos del módulo Inventario: proveedores y bodegas.
 *
 *  - `inventory_suppliers`  → registro de proveedores de la granja.
 *  - `inventory_warehouses` → registro de bodegas / ubicaciones físicas.
 *
 * Los insumos (`inventory_items`) referencian ambos catálogos mediante
 * `supplier_id` y `warehouse_id`. Se conservan las columnas de texto
 * anteriores (`supplier`, `location`) por compatibilidad, pero la
 * aplicación pasa a usar las relaciones.
 *
 * Migración de datos: el texto libre existente en `supplier` y
 * `location` se convierte en filas de los nuevos catálogos y se enlaza.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_suppliers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained('farms')->onDelete('cascade');
            $table->string('name');
            $table->string('tax_id')->nullable();        // Identificación / RUC
            $table->string('contact_name')->nullable();  // Persona de contacto
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();

            $table->unique(['farm_id', 'name']);
            $table->index(['farm_id', 'is_active']);
        });

        Schema::create('inventory_warehouses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained('farms')->onDelete('cascade');
            $table->string('name');
            $table->string('code')->nullable();
            $table->string('address')->nullable();
            $table->string('manager_name')->nullable();  // Responsable
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();

            $table->unique(['farm_id', 'name']);
            $table->index(['farm_id', 'is_active']);
        });

        // Referencias desde los insumos. Se añaden como columnas simples
        // (sin FK) para ser portables entre PostgreSQL y SQLite; la
        // integridad se mantiene en el controlador (SET NULL al borrar).
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->unsignedBigInteger('warehouse_id')->nullable();
            $table->index('supplier_id');
            $table->index('warehouse_id');
        });

        $now = now();

        // Migra el texto libre de proveedor → catálogo de proveedores.
        $supplierRows = DB::table('inventory_items')
            ->whereNotNull('supplier')
            ->where('supplier', '!=', '')
            ->get(['id', 'farm_id', 'supplier']);

        $supplierCache = [];

        foreach ($supplierRows as $row) {
            $name = trim((string) $row->supplier);

            if ($name === '') {
                continue;
            }

            $key = $row->farm_id.'|'.mb_strtolower($name);

            if (! isset($supplierCache[$key])) {
                $supplierCache[$key] = DB::table('inventory_suppliers')->insertGetId([
                    'farm_id' => $row->farm_id,
                    'name' => $name,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('inventory_items')
                ->where('id', $row->id)
                ->update(['supplier_id' => $supplierCache[$key]]);
        }

        // Migra el texto libre de ubicación → catálogo de bodegas.
        $locationRows = DB::table('inventory_items')
            ->whereNotNull('location')
            ->where('location', '!=', '')
            ->get(['id', 'farm_id', 'location']);

        $warehouseCache = [];

        foreach ($locationRows as $row) {
            $name = trim((string) $row->location);

            if ($name === '') {
                continue;
            }

            $key = $row->farm_id.'|'.mb_strtolower($name);

            if (! isset($warehouseCache[$key])) {
                $warehouseCache[$key] = DB::table('inventory_warehouses')->insertGetId([
                    'farm_id' => $row->farm_id,
                    'name' => $name,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('inventory_items')
                ->where('id', $row->id)
                ->update(['warehouse_id' => $warehouseCache[$key]]);
        }
    }

    public function down(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropIndex(['supplier_id']);
            $table->dropIndex(['warehouse_id']);
        });

        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropColumn(['supplier_id', 'warehouse_id']);
        });

        Schema::dropIfExists('inventory_warehouses');
        Schema::dropIfExists('inventory_suppliers');
    }
};
