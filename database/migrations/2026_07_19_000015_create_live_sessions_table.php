<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('live_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('instructor_name')->default('Coach Kelvin');
            $table->string('thumbnail_url')->nullable();
            $table->string('stream_url')->nullable();
            $table->enum('status', ['scheduled','live','ended'])->default('scheduled');
            $table->timestamp('scheduled_at')->nullable();
            $table->unsignedInteger('viewers_count')->default(0);
            $table->unsignedInteger('likes_count')->default(0);
            $table->unsignedInteger('duration_minutes')->nullable();
            $table->string('category')->default('HIIT');
            $table->string('difficulty')->default('Intermediate');
            $table->timestamps();
        });

        Schema::create('live_session_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('live_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('content');
            $table->timestamps();
            $table->index(['live_session_id', 'created_at']);
        });
    }
    public function down(): void {
        Schema::dropIfExists('live_session_comments');
        Schema::dropIfExists('live_sessions');
    }
};
