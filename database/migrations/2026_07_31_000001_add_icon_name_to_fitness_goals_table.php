<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Emoji are never used as UI (§1.5 of PHASE_8-10_BUILD_BRIEF.md). Icons stored
 * in the database move to Lucide icon-name strings, resolved on the client by
 * <Icon name="..." />.
 *
 * The legacy `emoji` column is intentionally LEFT IN PLACE and still populated.
 * The Fitness Goals page still reads it, and dropping it here would break a
 * working Phase 1–7 feature during Stage 1. Stage 3 migrates that page to
 * `icon_name` and a follow-up migration drops `emoji` at that point.
 */
return new class extends Migration
{
    /** Emoji seen in seeders and in the goals UI, mapped to registered Lucide names. */
    private const EMOJI_TO_ICON = [
        '💪' => 'dumbbell',
        '🏋️' => 'dumbbell',
        '🏋' => 'dumbbell',
        '🏃' => 'footprints',
        '🏃‍♂️' => 'footprints',
        '👟' => 'footprints',
        '🚴' => 'bike',
        '🏊' => 'waves',
        '🧘' => 'brain',
        '⚖️' => 'scale',
        '⚖' => 'scale',
        '📏' => 'ruler',
        '🔥' => 'flame',
        '❤️' => 'heart-pulse',
        '❤' => 'heart-pulse',
        '💧' => 'droplet',
        '🥗' => 'salad',
        '🍎' => 'apple',
        '😴' => 'bed',
        '🎯' => 'target',
        '🏆' => 'trophy',
        '🥇' => 'medal',
        '⭐' => 'star',
        '📈' => 'trending-up',
        '📉' => 'trending-down',
        '⏱️' => 'timer',
        '⏱' => 'timer',
        '⛰️' => 'mountain',
        '⚡' => 'zap',
    ];

    public function up(): void
    {
        Schema::table('fitness_goals', function (Blueprint $table) {
            $table->string('icon_name', 60)->nullable()->after('emoji');
        });

        // Backfill from the existing emoji values. Anything unrecognised falls
        // back to 'target', which is a sensible neutral for a goal.
        //
        // The COLLATE utf8mb4_bin is REQUIRED, not stylistic. Under the table's
        // default (accent/case-insensitive) collation MySQL considers many
        // emoji equal to each other, so a plain `where('emoji', '💪')` matches
        // every emoji row — each iteration then overwrites the last and every
        // goal ends up with whichever mapping ran last. Verified: without the
        // binary collation, 💪/🏃/🧘/🦄 all resolved to 'trending-down'.
        foreach (self::EMOJI_TO_ICON as $emoji => $icon) {
            DB::table('fitness_goals')
                ->whereRaw('emoji COLLATE utf8mb4_bin = ?', [$emoji])
                ->update(['icon_name' => $icon]);
        }

        DB::table('fitness_goals')
            ->whereNull('icon_name')
            ->update(['icon_name' => 'target']);
    }

    public function down(): void
    {
        Schema::table('fitness_goals', function (Blueprint $table) {
            $table->dropColumn('icon_name');
        });
    }
};
