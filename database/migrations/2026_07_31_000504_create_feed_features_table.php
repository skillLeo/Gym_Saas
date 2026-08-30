<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Members surfaced in the social feed for a sustained streak (§4.5).
 *
 * Created by the scheduled job from real activity only — there is deliberately
 * no admin action to feature someone. A feature that can be handed out by hand
 * stops meaning anything, and members work out very quickly which it is.
 *
 * `expires_at` keeps the feed current without a cleanup job: the query filters
 * on it, so a stale feature simply stops being selected.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feed_features', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('feature_type', ['week_streak', 'month_streak']);

            $table->date('period_start');
            $table->date('period_end');
            $table->timestamp('expires_at');
            $table->timestamp('dismissed_at')->nullable();

            $table->timestamps();

            $table->index('expires_at');
            // Same idempotency rule as user_badges: one feature per member, per
            // type, per period, enforced by the database.
            $table->unique(['user_id', 'feature_type', 'period_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feed_features');
    }
};
