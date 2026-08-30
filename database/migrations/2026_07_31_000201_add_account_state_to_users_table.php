<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the account lifecycle state (§4.2).
 *
 * Four states: `trial`, `subscriber`, `grace` (ended but still recoverable),
 * `deactivated` (grace exhausted, queued for deletion).
 *
 * `account_state` becomes the single source of truth for account lifecycle.
 * The existing `subscription_status` column is kept as a derived mirror for the
 * admin dashboard queries that already read it — written only by
 * UserAccountState, never consulted for authorisation. One writer, one
 * computation, so the two cannot disagree.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('account_state', ['trial', 'subscriber', 'grace', 'deactivated'])
                ->default('trial')
                ->after('subscription_status');
            $table->timestamp('deactivated_at')->nullable()->after('account_state');
            $table->timestamp('scheduled_deletion_at')->nullable()->after('deactivated_at');

            $table->index('account_state');
            // Drives the deletion sweep, which scans for due rows on a schedule.
            $table->index('scheduled_deletion_at');
        });

        // Backfill from the column that has been authoritative until now.
        // Order matters: later statements must not overwrite earlier ones, so
        // each targets a disjoint set.
        DB::table('users')->where('subscription_status', 'active')
            ->update(['account_state' => 'subscriber']);

        DB::table('users')->where('subscription_status', 'trial')
            ->where(function ($q) {
                $q->whereNull('trial_ends_at')->orWhere('trial_ends_at', '>', now());
            })
            ->update(['account_state' => 'trial']);

        // A trial that has already lapsed is not a trial any more.
        DB::table('users')->where('subscription_status', 'trial')
            ->whereNotNull('trial_ends_at')->where('trial_ends_at', '<=', now())
            ->update(['account_state' => 'grace', 'deactivated_at' => now()]);

        DB::table('users')->whereIn('subscription_status', ['expired', 'cancelled'])
            ->update(['account_state' => 'grace', 'deactivated_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['account_state']);
            $table->dropIndex(['scheduled_deletion_at']);
            $table->dropColumn(['account_state', 'deactivated_at', 'scheduled_deletion_at']);
        });
    }
};
