<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Clean up duplicate records if any exist in PostgreSQL/MySQL
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("
                DELETE FROM species a USING species b
                WHERE a.id > b.id 
                  AND a.farm_id = b.farm_id 
                  AND LOWER(TRIM(a.name)) = LOWER(TRIM(b.name))
            ");

            DB::statement("
                UPDATE species 
                SET name = INITCAP(TRIM(name))
            ");

            DB::statement("
                CREATE UNIQUE INDEX IF NOT EXISTS species_farm_id_lower_name_unique 
                ON species (farm_id, LOWER(TRIM(name)))
            ");
        } else {
            // Driver-agnostic deduplication
            $duplicates = DB::table('species')
                ->select('farm_id', DB::raw('LOWER(TRIM(name)) as lower_name'), DB::raw('MIN(id) as keep_id'))
                ->groupBy('farm_id', DB::raw('LOWER(TRIM(name))'))
                ->havingRaw('COUNT(*) > 1')
                ->get();

            foreach ($duplicates as $dup) {
                DB::table('species')
                    ->where('farm_id', $dup->farm_id)
                    ->whereRaw('LOWER(TRIM(name)) = ?', [$dup->lower_name])
                    ->where('id', '!=', $dup->keep_id)
                    ->delete();
            }
        }

        // 2. Add composite unique constraint via Schema Builder
        Schema::table('species', function (Blueprint $table) {
            $table->unique(['farm_id', 'name'], 'species_farm_id_name_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("DROP INDEX IF EXISTS species_farm_id_lower_name_unique");
        }

        Schema::table('species', function (Blueprint $table) {
            $table->dropUnique('species_farm_id_name_unique');
        });
    }
};
