<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Current and best streak per member, per activity (§4.5).
 *
 * A cache of something derivable from the activity tables, kept because the
 * profile and feed read it on every page load and recomputing months of
 * history each time would be wasteful. The recompute is authoritative — the
 * job rebuilds these rows from the source data rather than incrementing them,
 * so a missed run or a backfilled log corrects itself instead of drifting.
 *
 * `overall` counts a day on which the member did *anything*, and is what drives
 * feed auto-featuring.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_streaks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('streak_type', ['workout', 'meal_log', 'engagement', 'overall']);

            $table->unsignedInteger('current_count')->default(0);
            $table->unsignedInteger('longest_count')->default(0);
            $table->date('last_activity_date')->nullable();
            $table->date('started_on')->nullable();

            $table->timestamps();

            $table->unique(['user_id', 'streak_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_streaks');
    }
};
