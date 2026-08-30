<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('meal_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recipe_id')->nullable()->constrained()->nullOnDelete();
            $table->string('recipe_name')->nullable();
            $table->date('week_start');
            $table->unsignedTinyInteger('day_of_week'); // 0=Sun … 6=Sat
            $table->enum('meal_slot', ['breakfast', 'lunch', 'dinner', 'snack'])->default('lunch');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'week_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meal_plans');
    }
};
