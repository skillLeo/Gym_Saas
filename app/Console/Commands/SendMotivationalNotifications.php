<?php

namespace App\Console\Commands;

use App\Services\MotivationalNotifier;
use Illuminate\Console\Command;

/**
 * Fires any motivational notification schedule that is due (§4.4).
 *
 * Registered to run every minute. Each schedule decides for itself whether it
 * is due, and stamps `last_run_at` once it fires, so running this often is
 * cheap and idempotent — the alternative, a fixed daily time in the scheduler,
 * could not honour per-schedule timezones or admin-configured send times.
 */
class SendMotivationalNotifications extends Command
{
    protected $signature   = 'notifications:motivational {--dry-run : Report what would be sent without sending}';
    protected $description = 'Send scheduled motivational notifications to active members';

    public function __construct(private MotivationalNotifier $notifier)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dry    = (bool) $this->option('dry-run');
        $result = $this->notifier->runDueSchedules($dry);

        $this->info(sprintf(
            '%sSchedules fired: %d. Notifications sent: %d. Skipped (not due): %d.',
            $dry ? '[dry run] ' : '',
            $result['schedules'], $result['sent'], $result['skipped']
        ));

        return self::SUCCESS;
    }
}
