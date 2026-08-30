<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

/**
 * Proves a queue worker is actually consuming jobs.
 *
 * Dispatching a job only writes a row to the `jobs` table — it does not mean
 * anything will ever run it. Phase 8 depends entirely on queued and scheduled
 * work (trial transitions, coupon emails, motivational notifications, badge
 * awards, auto-featuring), so "did a worker pick it up?" needs a real answer,
 * not an assumption.
 *
 * This job does one thing: stamp the cache with the time it executed. The
 * `queue:health` command dispatches it and reads that stamp back.
 */
class QueueHealthCheckJob implements ShouldQueue
{
    use Queueable;

    public const CACHE_KEY = 'queue:health:last_ran_at';

    /** Token lets the caller confirm THIS dispatch ran, not an older one. */
    public function __construct(public string $token) {}

    public function handle(): void
    {
        Cache::put(self::CACHE_KEY, [
            'token'  => $this->token,
            'ran_at' => now()->toIso8601String(),
        ], now()->addDay());
    }
}
