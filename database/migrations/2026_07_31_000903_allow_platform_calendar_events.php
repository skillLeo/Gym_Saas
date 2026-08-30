<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Lets a calendar event belong to the platform rather than to one member (§5.2).
 *
 * A Vibe Call must "automatically appear on the platform calendar", but
 * `calendar_events` was strictly per-member. The two options were writing one
 * row per member per session — which scales as members × sessions and leaves
 * orphans whenever anyone joins or leaves — or letting `user_id` be NULL to
 * mean "everyone".
 *
 * NULL was chosen: one row per session regardless of headcount, and a new
 * member sees the existing schedule immediately with no backfill.
 *
 * `CalendarController@index` was widened to `user_id = me OR user_id IS NULL`,
 * and the write paths still require ownership, so a member cannot edit or
 * delete a platform event.
 *
 * Every step is guarded. A `user_id_date` index already existed on this table,
 * which failed a first run *after* the column change had been applied — so this
 * has to be safe to re-run from a half-applied state.
 */
return new class extends Migration
{
    public function up(): void
    {
        if ($this->columnIsNotNullable('user_id')) {
            Schema::table('calendar_events', function (Blueprint $table) {
                $table->unsignedBigInteger('user_id')->nullable()->change();
            });
        }

        if (!Schema::hasColumn('calendar_events', 'live_session_id')) {
            Schema::table('calendar_events', function (Blueprint $table) {
                $table->foreignId('live_session_id')->nullable()->after('user_id')
                    ->constrained('live_sessions')->cascadeOnDelete();
            });
        }

        // 'live' is not in the existing enum; widen it rather than overloading
        // 'other', so a Vibe Call is identifiable on the calendar.
        if (!str_contains($this->typeColumnDefinition(), "'live'")) {
            DB::statement("ALTER TABLE `calendar_events` MODIFY `type` ENUM('workout','meal','appointment','personal','other','live') NOT NULL DEFAULT 'other'");
        }
    }

    public function down(): void
    {
        // Platform events have no owner and cannot survive a non-nullable
        // column; remove them before reverting.
        DB::table('calendar_events')->whereNull('user_id')->delete();

        if (str_contains($this->typeColumnDefinition(), "'live'")) {
            DB::statement("ALTER TABLE `calendar_events` MODIFY `type` ENUM('workout','meal','appointment','personal','other') NOT NULL DEFAULT 'other'");
        }

        if (Schema::hasColumn('calendar_events', 'live_session_id')) {
            Schema::table('calendar_events', function (Blueprint $table) {
                $table->dropConstrainedForeignId('live_session_id');
            });
        }

        if (!$this->columnIsNotNullable('user_id')) {
            Schema::table('calendar_events', function (Blueprint $table) {
                $table->unsignedBigInteger('user_id')->nullable(false)->change();
            });
        }
    }

    private function columnIsNotNullable(string $column): bool
    {
        $col = collect(DB::select('SHOW COLUMNS FROM `calendar_events`'))
            ->firstWhere('Field', $column);

        return $col && $col->Null === 'NO';
    }

    private function typeColumnDefinition(): string
    {
        $col = collect(DB::select('SHOW COLUMNS FROM `calendar_events`'))
            ->firstWhere('Field', 'type');

        return $col->Type ?? '';
    }
};
