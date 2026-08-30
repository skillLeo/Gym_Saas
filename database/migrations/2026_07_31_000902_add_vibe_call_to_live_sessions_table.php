<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marks a live session as a Vibe Call (§5.2).
 *
 * Deliberately extends the existing Phase 7 `live_sessions` rather than adding
 * a parallel table: viewing, commenting and replay already work here, and a
 * second system would need all of it rebuilt and kept in step.
 *
 * `schedule_id` is nullable because a Vibe Call can also be created by hand;
 * it only links back when the session was materialised from a recurring rule.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('live_sessions', function (Blueprint $table) {
            $table->boolean('is_vibe_call')->default(false)->after('status');
            $table->foreignId('schedule_id')->nullable()->after('is_vibe_call')
                ->constrained('vibe_call_schedules')->nullOnDelete();

            // Generation looks up "does a session already exist for this rule at
            // this time?" on every run.
            $table->index(['schedule_id', 'scheduled_at']);
            $table->index(['is_vibe_call', 'scheduled_at']);
        });
    }

    public function down(): void
    {
        Schema::table('live_sessions', function (Blueprint $table) {
            $table->dropIndex(['schedule_id', 'scheduled_at']);
            $table->dropIndex(['is_vibe_call', 'scheduled_at']);
            $table->dropConstrainedForeignId('schedule_id');
            $table->dropColumn('is_vibe_call');
        });
    }
};
