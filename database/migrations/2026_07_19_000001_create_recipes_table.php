<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('recipes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('image_url')->nullable();
            $table->string('category')->default('Lunch');
            $table->json('tags')->nullable();
            $table->unsignedSmallInteger('prep_time')->default(0);
            $table->unsignedSmallInteger('cook_time')->default(0);
            $table->unsignedTinyInteger('servings')->default(1);
            $table->unsignedSmallInteger('calories')->default(0);
            $table->decimal('protein', 6, 2)->default(0);
            $table->decimal('carbs', 6, 2)->default(0);
            $table->decimal('fat', 6, 2)->default(0);
            $table->decimal('fiber', 6, 2)->default(0);
            $table->json('ingredients')->nullable();
            $table->json('instructions')->nullable();
            $table->decimal('rating', 3, 2)->default(0);
            $table->unsignedInteger('reviews_count')->default(0);
            $table->boolean('is_public')->default(true);
            $table->timestamps();

            $table->index(['category', 'is_public']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipes');
    }
};
