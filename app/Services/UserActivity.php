<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * There is no `last_active_at` column on `users` — "activity" is derived from
 * the most recent row across the tables that actually represent a member
 * doing something (a food log, a workout, a post). Shared by the email
 * campaign "inactive for N days" audience (§E1) and the new-user monitoring
 * screen (§E2) so the two features can never disagree about what "active"
 * means.
 */
class UserActivity
{
    /** @return array<int, string> map of user_id => last activity ISO timestamp */
    public function lastActiveMap(): array
    {
        $rows = DB::table('food_log_entries')
            ->select('user_id', 'created_at')
            ->unionAll(DB::table('fitness_logs')->select('user_id', 'created_at'))
            ->unionAll(DB::table('social_posts')->select('user_id', 'created_at'))
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $existing = $map[$row->user_id] ?? null;
            if (! $existing || $row->created_at > $existing) {
                $map[$row->user_id] = $row->created_at;
            }
        }

        return $map;
    }

    public function lastActiveAt(int $userId): ?Carbon
    {
        $map = $this->lastActiveMap();

        return isset($map[$userId]) ? Carbon::parse($map[$userId]) : null;
    }

    /**
     * User ids inactive for at least $days — including users who have never
     * logged anything at all (maximally inactive, not excluded by omission).
     */
    public function inactiveUserIds(int $days): array
    {
        $map = $this->lastActiveMap();
        $cutoff = now()->subDays($days);

        $activeRecently = collect($map)
            ->filter(fn ($ts) => Carbon::parse($ts)->gte($cutoff))
            ->keys()
            ->all();

        return DB::table('users')
            ->whereNull('deleted_at')
            ->whereNotIn('id', $activeRecently)
            ->pluck('id')
            ->all();
    }
}
