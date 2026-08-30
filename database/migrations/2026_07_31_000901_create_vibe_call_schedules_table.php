<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Recurring Vibe Call slots (§5.2).
 *
 * A schedule is a rule, not an event. A scheduled command materialises real
 * `live_sessions` from it a few days ahead, so members join through the
 * existing Phase 7 live infrastructure rather than a parallel system.
 *
 * `days_of_week` holds ISO day numbers (1 = Monday … 7 = Sunday), matching the
 * convention already used by `notification_schedules` in §4.4.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vibe_call_schedules', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('days_of_week');
            $table->time('time_of_day');
            $table->smallInteger('duration_minutes')->default(30);
            $table->string('timezone')->default('UTC');
            $table->unsignedTinyInteger('auto_create_days_ahead')->default(7);
            $table->boolean('is_active')->default(true);

            // How far generation has already run, so a re-run is a no-op rather
            // than a source of duplicate sessions.
            $table->date('last_generated_through')->nullable();

            $table->timestamps();

            $table->index(['is_active', 'last_generated_through']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vibe_call_schedules');
    }
};
