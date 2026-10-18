<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fase 1 del módulo Potreros: identificación y características físicas.
     * Todos los campos son opcionales para no romper los registros existentes.
     */
    public function up(): void
    {
        if (! Schema::hasTable('potreros')) {
            return;
        }

        Schema::table('potreros', function (Blueprint $table) {
            if (! Schema::hasColumn('potreros', 'code')) {
                $table->string('code')->nullable()->after('name');
            }
            if (! Schema::hasColumn('potreros', 'superficie_ha')) {
                $table->decimal('superficie_ha', 10, 2)->nullable();
            }
            if (! Schema::hasColumn('potreros', 'capacidad_ua')) {
                $table->decimal('capacidad_ua', 10, 2)->nullable();
            }
            if (! Schema::hasColumn('potreros', 'operational_status')) {
                $table->string('operational_status')->default('disponible');
            }
            if (! Schema::hasColumn('potreros', 'tipo_pastura')) {
                $table->string('tipo_pastura')->nullable();
            }
            if (! Schema::hasColumn('potreros', 'topografia')) {
                $table->string('topografia')->nullable();
            }
            if (! Schema::hasColumn('potreros', 'tipo_cercado')) {
                $table->string('tipo_cercado')->nullable();
            }
            if (! Schema::hasColumn('potreros', 'fuente_agua')) {
                $table->jsonb('fuente_agua')->nullable();
            }
            if (! Schema::hasColumn('potreros', 'notes')) {
                $table->text('notes')->nullable();
            }
        });

        // Código interno único por granja (POT-0001), espejo de LOT-XXXXX.
        $hasUnique = collect(Schema::getIndexes('potreros'))
            ->contains(fn ($index) => ($index['name'] ?? '') === 'potreros_farm_code_unique');

        if (! $hasUnique) {
            Schema::table('potreros', function (Blueprint $table) {
                $table->unique(['farm_id', 'code'], 'potreros_farm_code_unique');
            });
        }

        // Backfill de códigos para registros preexistentes.
        $farmIds = DB::table('potreros')->whereNull('code')->distinct()->pluck('farm_id');

        foreach ($farmIds as $farmId) {
            $ids = DB::table('potreros')
                ->where('farm_id', $farmId)
                ->whereNull('code')
                ->orderBy('id')
                ->pluck('id');

            $sequence = 1;
            foreach ($ids as $id) {
                DB::table('potreros')->where('id', $id)->update([
                    'code' => 'POT-'.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT),
                ]);
                $sequence++;
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('potreros')) {
            return;
        }

        $hasUnique = collect(Schema::getIndexes('potreros'))
            ->contains(fn ($index) => ($index['name'] ?? '') === 'potreros_farm_code_unique');

        if ($hasUnique) {
            Schema::table('potreros', function (Blueprint $table) {
                $table->dropUnique('potreros_farm_code_unique');
            });
        }

        Schema::table('potreros', function (Blueprint $table) {
            foreach (['code', 'superficie_ha', 'capacidad_ua', 'operational_status', 'tipo_pastura', 'topografia', 'tipo_cercado', 'fuente_agua', 'notes'] as $column) {
                if (Schema::hasColumn('potreros', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
