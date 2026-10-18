<?php

use App\Models\Species;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('species', function (Blueprint $table) {
            $table->boolean('is_custom')->default(false);
        });

        // Backfill: las especies cuyo nombre no pertenece a la taxonomía
        // oficial de su sector fueron registradas con la opción "Otro".
        DB::table('species')
            ->select('id', 'name', 'category')
            ->orderBy('id')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $row) {
                    if (Species::isCustomName($row->category, $row->name)) {
                        DB::table('species')->where('id', $row->id)->update(['is_custom' => true]);
                    }
                }
            });
    }

    public function down(): void
    {
        Schema::table('species', function (Blueprint $table) {
            $table->dropColumn('is_custom');
        });
    }
};
