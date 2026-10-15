<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lechones destetados pendientes de formar un lote.
 *
 * `pending_piglets`: lechones vivos del destete que aún no se
 * han asignado a un lote (0 = resuelto). Persiste en BD la
 * alerta "lechones pendientes" del frontend, de modo que
 * sobreviva a un refresco de página.
 *
 * `piglet_lot_id`: lote de lechones creado a partir del
 * destete (referencia `lots.id`, sin FK por compatibilidad
 * con SQLite en los tests).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('animal_services', function (Blueprint $table) {
            $table->unsignedInteger('pending_piglets')->nullable()->after('live_piglets');
            $table->unsignedBigInteger('piglet_lot_id')->nullable()->after('pending_piglets');
            $table->index('piglet_lot_id');
        });
    }

    public function down(): void
    {
        Schema::table('animal_services', function (Blueprint $table) {
            $table->dropIndex(['piglet_lot_id']);
            $table->dropColumn(['pending_piglets', 'piglet_lot_id']);
        });
    }
};
