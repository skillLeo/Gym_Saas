<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('food_log_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('food_item_id')->constrained()->cascadeOnDelete();
            $table->enum('meal_type', ['breakfast', 'lunch', 'dinner', 'snack']);
            $table->date('logged_date')->index();
            $table->decimal('servings', 5, 2)->default(1);
            $table->decimal('total_calories', 7, 2)->default(0);
            $table->decimal('total_protein_g', 6, 2)->default(0);
            $table->decimal('total_carbs_g', 6, 2)->default(0);
            $table->decimal('total_fat_g', 6, 2)->default(0);
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('food_log_entries'); }
};
