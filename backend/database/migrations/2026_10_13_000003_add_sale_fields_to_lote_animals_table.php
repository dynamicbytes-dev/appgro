<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Campos de cosecha/venta individual por animal (porcinos de reproducción):
 * peso, precio por kilo y total de venta al cosechar/vender un cerdo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lote_animals', function (Blueprint $table) {
            $table->decimal('sale_weight', 10, 2)->nullable()->after('avg_piglets_per_birth');
            $table->decimal('sale_price_per_kg', 12, 2)->nullable()->after('sale_weight');
            $table->decimal('sale_total_price', 14, 2)->nullable()->after('sale_price_per_kg');
        });
    }

    public function down(): void
    {
        Schema::table('lote_animals', function (Blueprint $table) {
            $table->dropColumn(['sale_weight', 'sale_price_per_kg', 'sale_total_price']);
        });
    }
};
