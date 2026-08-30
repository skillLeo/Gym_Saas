<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\StreakService;
use Illuminate\Console\Command;

/**
 * Recomputes streaks, awards badges and refreshes feed features (§4.5).
 *
 * Safe to run as often as you like: streaks are rebuilt from activity data
 * rather than incremented, and awards are guarded by unique constraints.
 */
class ProcessStreaks extends Command
{
    protected $signature   = 'streaks:process {--user= : Limit to one user id} {--dry-run : Recompute streaks but award nothing}';
    protected $description = 'Recompute activity streaks, award badges and refresh feed features';

    public function __construct(private StreakService $streaks)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dry      = (bool) $this->option('dry-run');
        $onlyUser = $this->option('user');

        $processed = 0; $badges = 0; $features = 0;

        User::query()
            ->when($onlyUser, fn ($q) => $q->where('id', $onlyUser))
            ->whereNull('deleted_at')
            ->chunkById(200, function ($users) use (&$processed, &$badges, &$features, $dry) {
                foreach ($users as $user) {
                    if ($dry) {
                        $this->streaks->recomputeStreaks($user);
                        $processed++;
                        continue;
                    }

                    $r = $this->streaks->processUser($user);
                    $badges   += $r['badges'];
                    $features += $r['features'];
                    $processed++;
                }
            });

        $this->info(sprintf(
            '%sMembers processed: %d. Badges awarded: %d. Feed features created: %d.',
            $dry ? '[dry run] ' : '', $processed, $badges, $features
        ));

        return self::SUCCESS;
    }
}
