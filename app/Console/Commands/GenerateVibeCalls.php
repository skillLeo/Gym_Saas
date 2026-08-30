<?php

namespace App\Console\Commands;

use App\Services\VibeCallGenerator;
use Illuminate\Console\Command;

/**
 * Materialises upcoming Vibe Calls from their recurring schedules (§5.2).
 *
 * Safe to run repeatedly: generation is keyed on (schedule_id, scheduled_at),
 * so an occurrence that already exists is skipped.
 */
class GenerateVibeCalls extends Command
{
    protected $signature   = 'vibe-calls:generate {--dry-run : Report what would be created without writing}';
    protected $description = 'Create upcoming live sessions and calendar entries from Vibe Call schedules';

    public function __construct(private VibeCallGenerator $generator)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dry    = (bool) $this->option('dry-run');
        $result = $this->generator->run($dry);

        $this->info(sprintf(
            '%sSchedules with new occurrences: %d. Sessions created: %d. Calendar entries: %d.',
            $dry ? '[dry run] ' : '',
            $result['schedules'], $result['sessions'], $result['events']
        ));

        return self::SUCCESS;
    }
}
