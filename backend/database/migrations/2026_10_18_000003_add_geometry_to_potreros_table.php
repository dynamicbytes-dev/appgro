<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fase 3 del módulo Potreros: georreferenciación.
     * - geometry: límite del potrero en GeoJSON (Polygon/MultiPolygon).
     * - centroid_lat / centroid_lng: ubicación puntual (opcional, para croquis).
     * - geo_area_ha: superficie calculada a partir de la geometría.
     */
    public function up(): void
    {
        if (! Schema::hasTable('potreros')) {
            return;
        }

        Schema::table('potreros', function (Blueprint $table) {
            if (! Schema::hasColumn('potreros', 'geometry')) {
                $table->jsonb('geometry')->nullable();
            }
            if (! Schema::hasColumn('potreros', 'centroid_lat')) {
                $table->decimal('centroid_lat', 10, 7)->nullable();
            }
            if (! Schema::hasColumn('potreros', 'centroid_lng')) {
                $table->decimal('centroid_lng', 10, 7)->nullable();
            }
            if (! Schema::hasColumn('potreros', 'geo_area_ha')) {
                $table->decimal('geo_area_ha', 12, 4)->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('potreros')) {
            return;
        }

        Schema::table('potreros', function (Blueprint $table) {
            foreach (['geometry', 'centroid_lat', 'centroid_lng', 'geo_area_ha'] as $column) {
                if (Schema::hasColumn('potreros', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
