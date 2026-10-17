<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agrega atributos detallados individuales a los cerdos por lote:
 * - Peso inicial / actual (`weight`)
 * - Fecha de ingreso al lote (`entry_date`)
 * - Costo acumulado individual (`accumulated_cost`)
 * - Controles sanitarios y vacunación (`health_controls`)
 * - Observaciones e historial (`notes`)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lote_animals', function (Blueprint $table) {
            $table->decimal('weight', 8, 2)->nullable()->after('avg_piglets_per_birth');
            $table->date('entry_date')->nullable()->after('birth_date');
            $table->decimal('accumulated_cost', 12, 2)->nullable()->after('sale_total_price');
            $table->text('health_controls')->nullable()->after('accumulated_cost');
            $table->text('notes')->nullable()->after('health_controls');
        });
    }

    public function down(): void
    {
        Schema::table('lote_animals', function (Blueprint $table) {
            $table->dropColumn([
                'weight',
                'entry_date',
                'accumulated_cost',
                'health_controls',
                'notes',
            ]);
        });
    }
};
