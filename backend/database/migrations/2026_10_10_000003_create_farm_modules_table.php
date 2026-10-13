<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('farm_modules', function (Blueprint $table) {
            $table->foreignId('farm_id')->constrained('farms')->onDelete('cascade');
            $table->foreignId('module_id')->constrained('modules')->onDelete('cascade');
            $table->boolean('is_enabled')->default(true);

            $table->primary(['farm_id', 'module_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farm_modules');
    }
};
