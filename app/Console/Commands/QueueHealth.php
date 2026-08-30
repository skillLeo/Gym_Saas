<?php

namespace App\Console\Commands;

use App\Jobs\QueueHealthCheckJob;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Answers "is a worker actually consuming this app's queue?" with evidence.
 *
 * Run it on the server after deploying, and any time queued work seems to have
 * stopped. Exit code 1 means no worker picked the job up inside the wait
 * window — treat that as an outage, because it is one.
 */
class QueueHealth extends Command
{
    protected $signature = 'queue:health {--wait=15 : Seconds to wait for a worker to run the job}';

    protected $description = 'Dispatch a probe job and verify a queue worker executes it';

    public function handle(): int
    {
        $wait  = max(1, (int) $this->option('wait'));
        $token = (string) Str::uuid();

        Cache::forget(QueueHealthCheckJob::CACHE_KEY);

        $this->line("Dispatching probe job (token {$token})...");
        QueueHealthCheckJob::dispatch($token);

        $this->line("Waiting up to {$wait}s for a worker to pick it up...");

        $deadline = microtime(true) + $wait;
        while (microtime(true) < $deadline) {
            $result = Cache::get(QueueHealthCheckJob::CACHE_KEY);

            if (is_array($result) && ($result['token'] ?? null) === $token) {
                $this->info("A worker executed the job at {$result['ran_at']}.");
                $this->line('Queue is healthy.');

                return self::SUCCESS;
            }

            usleep(250_000);
        }

        $this->error("No worker executed the job within {$wait}s.");
        $this->newLine();
        $this->line('The job is sitting unprocessed in the `jobs` table. Anything that');
        $this->line('depends on the queue — trial expiry, coupon and receipt email,');
        $this->line('notifications, badge awards — is silently not happening.');
        $this->newLine();
        $this->line('Start a worker:  php artisan queue:work --tries=3');
        $this->line('See QUEUE_SETUP.md for the production configuration.');

        return self::FAILURE;
    }
}
