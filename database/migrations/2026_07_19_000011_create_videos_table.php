<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('videos', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('video_url')->nullable();
            $table->string('thumbnail_url')->nullable();
            $table->unsignedInteger('duration_seconds')->default(0);
            $table->string('category')->default('Strength');
            $table->json('tags')->nullable();
            $table->json('muscle_groups')->nullable();
            $table->json('equipment')->nullable();
            $table->enum('difficulty', ['Beginner','Intermediate','Advanced'])->default('Intermediate');
            $table->string('instructor')->nullable();
            $table->unsignedInteger('views')->default(0);
            $table->unsignedInteger('likes')->default(0);
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['category', 'is_active']);
        });

        Schema::create('video_saves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('video_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'video_id']);
        });
    }
    public function down(): void {
        Schema::dropIfExists('video_saves');
        Schema::dropIfExists('videos');
    }
};
