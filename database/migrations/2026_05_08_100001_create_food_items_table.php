<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('food_items', function (Blueprint $table) {
            $table->id();
            $table->string('nutritionix_id')->nullable()->index();
            $table->string('name');
            $table->string('brand')->nullable();
            $table->decimal('serving_qty', 6, 2)->default(1);
            $table->string('serving_unit')->default('serving');
            $table->decimal('serving_weight_grams', 6, 2)->nullable();
            $table->decimal('calories', 7, 2)->default(0);
            $table->decimal('protein_g', 6, 2)->default(0);
            $table->decimal('carbs_g', 6, 2)->default(0);
            $table->decimal('fat_g', 6, 2)->default(0);
            $table->decimal('fiber_g', 6, 2)->nullable();
            $table->decimal('sugar_g', 6, 2)->nullable();
            $table->decimal('sodium_mg', 7, 2)->nullable();
            $table->boolean('is_custom')->default(false);
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('food_items'); }
};
