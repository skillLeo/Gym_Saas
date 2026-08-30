<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Badges a member has actually earned (§4.5).
 *
 * The composite UNIQUE on (user_id, badge_id, period_start) is what makes the
 * awarding job idempotent: re-running it re-attempts the same insert and the
 * database rejects it. A `whereDoesntHave` check in PHP would leave a race
 * window, and the job is expected to run on a schedule that can overlap.
 *
 * `period_start` is part of the key rather than a detail, because a weekly
 * badge is earned once *per week* — the same badge in a later period is a new
 * award, not a duplicate.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_badges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('badge_id')->constrained()->cascadeOnDelete();

            $table->timestamp('awarded_at');
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();

            // What the streak actually was when awarded, so the achievement can
            // be described later without recomputing history.
            $table->json('meta')->nullable();

            $table->timestamps();

            $table->unique(['user_id', 'badge_id', 'period_start']);
            $table->index(['user_id', 'awarded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_badges');
    }
};
