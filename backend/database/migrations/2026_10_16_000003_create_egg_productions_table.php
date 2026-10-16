<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Historial de producción de huevos (`egg_productions`).
 *
 * `lots` solo acumula los totales de producción (`total_eggs`,
 * `broken_eggs`), lo que impide construir la serie temporal de mermas que
 * exige el módulo de Analítica. Esta tabla guarda cada registro de
 * "Recoger Huevos" con su fecha, de modo que se puede graficar la
 * evolución de huevos buenos vs. rotos y su costo económico.
 *
 * Convención (idéntica a `lots`):
 *  - `good_eggs`   → huevos completos (buenos).
 *  - `broken_eggs` → huevos rotos (mermas), valor independiente.
 *  - `good_cost`   = good_eggs × egg_price.
 *  - `broken_cost` = broken_eggs × egg_price.
 *
 * Migración de datos: el acumulado actual de cada lote se convierte en un
 * único registro histórico fechado en su cosecha (o su creación) para no
 * perder continuidad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('egg_productions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained('farms')->onDelete('cascade');
            $table->foreignId('lot_id')->constrained('lots')->onDelete('cascade');
            $table->date('production_date');
            $table->unsignedInteger('good_eggs')->default(0);
            $table->unsignedInteger('broken_eggs')->default(0);
            $table->decimal('egg_price', 12, 2)->default(0);
            $table->decimal('good_cost', 14, 2)->default(0);
            $table->decimal('broken_cost', 14, 2)->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();

            $table->index(['farm_id', 'production_date']);
            $table->index(['lot_id', 'production_date']);
        });

        $this->migrateLotTotals();
    }

    /**
     * Convierte el acumulado de huevos de cada lote en un registro
     * histórico para que la Analítica tenga al menos un punto por lote.
     */
    private function migrateLotTotals(): void
    {
        $lots = DB::table('lots')
            ->where(function ($query) {
                $query->where('total_eggs', '>', 0)->orWhere('broken_eggs', '>', 0);
            })
            ->get(['id', 'farm_id', 'total_eggs', 'broken_eggs', 'egg_price', 'total_egg_cost', 'total_broken_cost', 'harvest_date', 'created_at']);

        $now = now();

        foreach ($lots as $lot) {
            $good = (int) $lot->total_eggs;
            $broken = (int) $lot->broken_eggs;
            $price = (float) ($lot->egg_price ?? 0);

            $date = $lot->harvest_date
                ? substr((string) $lot->harvest_date, 0, 10)
                : substr((string) $lot->created_at, 0, 10);

            DB::table('egg_productions')->insert([
                'farm_id' => $lot->farm_id,
                'lot_id' => $lot->id,
                'production_date' => $date,
                'good_eggs' => $good,
                'broken_eggs' => $broken,
                'egg_price' => round($price, 2),
                'good_cost' => (float) ($lot->total_egg_cost ?? round($good * $price, 2)),
                'broken_cost' => (float) ($lot->total_broken_cost ?? round($broken * $price, 2)),
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('egg_productions');
    }
};
