<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Lotes de insumos del módulo Inventario.
 *
 * `inventory_lots` es el catálogo propio de Inventario para las partidas /
 * recepciones de mercancía (lotes de insumos). Es independiente del módulo
 * Lotes (lotes de animales): los movimientos de **entrada** se asocian a un
 * lote de insumo, mientras que las **salidas** siguen usando el lote de
 * animales como destino de consumo (`destination_lot_id`).
 *
 *  - `code`               → identificador legible y único por granja.
 *  - `inventory_item_id`  → insumo al que pertenece el lote (puede quedar
 *                           libre para lotes aún no asignados).
 *  - `supplier_id`        → proveedor que despachó el lote (opcional).
 *  - fechas de fabricación / vencimiento del lote.
 *
 * En `inventory_movements` se añade `inventory_lot_id` (columna simple, sin
 * FK, para portabilidad PostgreSQL/SQLite; la integridad se valida en el
 * controlador).
 *
 * Migración de datos: cada `batch_number` de texto que ya existía en los
 * insumos se convierte en un lote del catálogo para no perder continuidad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_lots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained('farms')->onDelete('cascade');
            $table->unsignedBigInteger('inventory_item_id')->nullable();
            $table->string('code');
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->date('manufacturing_date')->nullable();
            $table->date('expiration_date')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();

            $table->unique(['farm_id', 'code']);
            $table->index(['farm_id', 'inventory_item_id']);
            $table->index(['farm_id', 'expiration_date']);
        });

        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->unsignedBigInteger('inventory_lot_id')->nullable();
            $table->index('inventory_lot_id');
        });

        $this->migrateBatchNumbersToLots();
    }

    /**
     * Convierte el `batch_number` (texto libre) de cada insumo en un lote
     * del nuevo catálogo, conservando fechas si existen.
     */
    private function migrateBatchNumbersToLots(): void
    {
        $now = now();

        $rows = DB::table('inventory_items')
            ->whereNotNull('batch_number')
            ->where('batch_number', '!=', '')
            ->get(['farm_id', 'id', 'batch_number', 'manufacturing_date', 'expiration_date']);

        $seen = [];

        foreach ($rows as $row) {
            $code = trim((string) $row->batch_number);

            if ($code === '') {
                continue;
            }

            $key = $row->farm_id.'|'.mb_strtolower($code);

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;

            DB::table('inventory_lots')->insert([
                'farm_id' => $row->farm_id,
                'inventory_item_id' => $row->id,
                'code' => $code,
                'supplier_id' => null,
                'manufacturing_date' => $row->manufacturing_date,
                'expiration_date' => $row->expiration_date,
                'notes' => 'Lote migrado desde el insumo.',
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->dropIndex(['inventory_lot_id']);
        });

        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->dropColumn('inventory_lot_id');
        });

        Schema::dropIfExists('inventory_lots');
    }
};
