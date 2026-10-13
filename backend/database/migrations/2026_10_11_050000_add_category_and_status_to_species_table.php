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
        Schema::table('species', function (Blueprint $table) {
            if (!Schema::hasColumn('species', 'category')) {
                $table->string('category')->default('General')->after('name');
            }
            if (!Schema::hasColumn('species', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('category');
            }
            if (!Schema::hasColumn('species', 'updated_at')) {
                $table->timestamp('updated_at')->nullable()->after('created_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('species', function (Blueprint $table) {
            if (Schema::hasColumn('species', 'category')) {
                $table->dropColumn('category');
            }
            if (Schema::hasColumn('species', 'is_active')) {
                $table->dropColumn('is_active');
            }
            if (Schema::hasColumn('species', 'updated_at')) {
                $table->dropColumn('updated_at');
            }
        });
    }
};
