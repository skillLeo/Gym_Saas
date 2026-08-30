<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Vibe Thread — one platform-wide open channel (§5.1).
 *
 * Distinct from private messaging (which is per-conversation) and from the
 * social feed (which is posts with reactions and comments). This is a single
 * continuous room everyone shares.
 *
 * Soft deletes so a removed message leaves a gap that moderation can review,
 * rather than vanishing from history entirely.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vibe_thread_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');

            // Denormalised at write time rather than joined on read: a member
            // who is later granted or loses admin must not retroactively change
            // how their past messages are rendered.
            $table->boolean('is_admin_post')->default(false);

            $table->foreignId('reply_to_id')->nullable()
                ->constrained('vibe_thread_messages')->nullOnDelete();

            $table->timestamp('edited_at')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index('created_at');
            $table->index('reply_to_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vibe_thread_messages');
    }
};
