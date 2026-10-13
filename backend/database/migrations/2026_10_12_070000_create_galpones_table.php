<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('galpones')) {
            Schema::create('galpones', function (Blueprint $table) {
                $table->id();
                $table->foreignId('farm_id')->constrained('farms')->onDelete('cascade');
                $table->foreignId('species_id')->constrained('species')->onDelete('cascade');
                $table->string('name');
                $table->string('category')->nullable();
                $table->string('sector')->nullable();
                $table->string('purpose');
                $table->integer('max_capacity')->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        // Add matching columns to barns table for compatibility if barns table exists
        if (Schema::hasTable('barns')) {
            Schema::table('barns', function (Blueprint $table) {
                if (!Schema::hasColumn('barns', 'species_id')) {
                    $table->foreignId('species_id')->nullable()->constrained('species')->nullOnDelete();
                }
                if (!Schema::hasColumn('barns', 'category')) {
                    $table->string('category')->nullable()->after('name');
                }
                if (!Schema::hasColumn('barns', 'sector')) {
                    $table->string('sector')->nullable()->after('category');
                }
                if (!Schema::hasColumn('barns', 'purpose')) {
                    $table->string('purpose')->nullable()->after('sector');
                }
                if (!Schema::hasColumn('barns', 'max_capacity')) {
                    $table->integer('max_capacity')->default(0)->after('purpose');
                }
                if (!Schema::hasColumn('barns', 'is_active')) {
                    $table->boolean('is_active')->default(true)->after('max_capacity');
                }
                if (!Schema::hasColumn('barns', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable()->after('created_at');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('galpones');

        if (Schema::hasTable('barns')) {
            Schema::table('barns', function (Blueprint $table) {
                if (Schema::hasColumn('barns', 'species_id')) {
                    $table->dropForeign(['species_id']);
                    $table->dropColumn('species_id');
                }
                if (Schema::hasColumn('barns', 'category')) {
                    $table->dropColumn('category');
                }
                if (Schema::hasColumn('barns', 'sector')) {
                    $table->dropColumn('sector');
                }
                if (Schema::hasColumn('barns', 'purpose')) {
                    $table->dropColumn('purpose');
                }
                if (Schema::hasColumn('barns', 'max_capacity')) {
                    $table->dropColumn('max_capacity');
                }
                if (Schema::hasColumn('barns', 'is_active')) {
                    $table->dropColumn('is_active');
                }
                if (Schema::hasColumn('barns', 'updated_at')) {
                    $table->dropColumn('updated_at');
                }
            });
        }
    }
};
