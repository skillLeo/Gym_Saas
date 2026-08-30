<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Drops the legacy `emoji` column now that the Fitness Goals page reads
 * `icon_name` (added and backfilled in 2026_07_31_000001).
 *
 * Emoji are never used as UI (§1.5) — the icon is stored as a Lucide name and
 * resolved by <Icon name="..." /> on the client.
 *
 * down() restores the column and repopulates it from `icon_name` so a rollback
 * leaves the old UI working rather than showing blanks.
 */
return new class extends Migration
{
    private const ICON_TO_EMOJI = [
        'dumbbell'       => '💪',
        'footprints'     => '🏃',
        'bike'           => '🚴',
        'waves'          => '🏊',
        'brain'          => '🧘',
        'scale'          => '⚖️',
        'ruler'          => '📏',
        'flame'          => '🔥',
        'heart-pulse'    => '❤️',
        'droplet'        => '💧',
        'salad'          => '🥗',
        'apple'          => '🍎',
        'bed'            => '😴',
        'target'         => '🎯',
        'trophy'         => '🏆',
        'medal'          => '🥇',
        'star'           => '⭐',
        'trending-up'    => '📈',
        'trending-down'  => '📉',
        'timer'          => '⏱️',
        'mountain'       => '⛰️',
        'zap'            => '⚡',
    ];

    public function up(): void
    {
        // Safety: never drop the column unless icon_name exists and is populated,
        // otherwise the icon data would be lost outright.
        if (! Schema::hasColumn('fitness_goals', 'icon_name')) {
            throw new RuntimeException('icon_name column missing — run 2026_07_31_000001 first.');
        }

        DB::table('fitness_goals')
            ->whereNull('icon_name')
            ->orWhere('icon_name', '')
            ->update(['icon_name' => 'target']);

        Schema::table('fitness_goals', function (Blueprint $table) {
            $table->dropColumn('emoji');
        });
    }

    public function down(): void
    {
        Schema::table('fitness_goals', function (Blueprint $table) {
            $table->string('emoji')->default('🎯')->after('deadline');
        });

        // Binary collation is required here for the same reason as the forward
        // migration: MySQL's default collation treats many emoji as equal, so a
        // plain WHERE would match the wrong rows.
        foreach (self::ICON_TO_EMOJI as $icon => $emoji) {
            DB::table('fitness_goals')
                ->whereRaw('icon_name COLLATE utf8mb4_bin = ?', [$icon])
                ->update(['emoji' => $emoji]);
        }
    }
};
