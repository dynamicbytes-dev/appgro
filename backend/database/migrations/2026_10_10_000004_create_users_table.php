<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->nullable()->constrained('farms')->onDelete('set null');
            $table->string('role');
            $table->string('name');
            $table->string('lastname')->nullable();
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->string('password_hash');
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();
        });

        // Enforce CHECK constraint on PostgreSQL for role IN ('root', 'admin', 'subordinate')
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE users ADD CONSTRAINT check_user_role CHECK (role IN ('root', 'admin', 'subordinate'))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
