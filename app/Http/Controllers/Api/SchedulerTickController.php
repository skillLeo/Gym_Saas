<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Console\Scheduling\CallbackEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Runs Laravel's scheduler over HTTP, for an external cron service to call.
 *
 * Why this exists: the host cannot run the scheduler from cron. The shell's
 * process/thread allowance on this shared plan is exhausted by the Node
 * frontend, so a cron entry fires and then dies with
 * "fork: Resource temporarily unavailable" before it can start PHP. The web
 * request path has its own pool and works fine, so the scheduler is driven
 * through it instead.
 *
 * Why it does not simply call `schedule:run`: `proc_open` is in this host's
 * disable_functions, and Laravel's scheduler executes each `command()` event as
 * a SUBPROCESS (Symfony Process, which needs proc_open). `schedule:run` would
 * therefore fail on every task. Instead this resolves the due events itself and
 * invokes each one in-process via Artisan::call, which needs no subprocess.
 *
 * Security: unauthenticated by necessity — an external cron service cannot log
 * in — so the token is the only thing protecting it. A wrong or missing token
 * returns 404 rather than 401/403, so probing cannot even confirm the route
 * exists. The comparison is timing-safe. The route is additionally throttled,
 * and a cache lock stops overlapping runs from piling up if someone replays it.
 */
class SchedulerTickController extends Controller
{
    /** Refuse to run more often than this, whatever the caller does. */
    private const MIN_SECONDS_BETWEEN_RUNS = 25;

    private const LOCK_KEY = 'scheduler-http-tick';

    public function __invoke(Request $request, string $token): JsonResponse
    {
        $expected = (string) config('app.scheduler_token');

        // No token configured means the endpoint is not in service. Fail closed
        // and stay invisible.
        if ($expected === '' || strlen($expected) < 32) {
            return $this->notFound();
        }

        if (! hash_equals($expected, $token)) {
            Log::channel('scheduler')->warning('rejected tick with a bad token', [
                'ip' => $request->ip(),
            ]);

            return $this->notFound();
        }

        // Stop a found URL from being used to hammer the scheduler: even with a
        // valid token, runs are spaced out. `add` is atomic, so concurrent
        // callers cannot both win.
        if (! Cache::add(self::LOCK_KEY, true, self::MIN_SECONDS_BETWEEN_RUNS)) {
            Log::channel('scheduler')->info('tick skipped — ran less than '.self::MIN_SECONDS_BETWEEN_RUNS.'s ago');

            return response()->json([
                'ok'      => true,
                'skipped' => true,
                'reason'  => 'a run happened less than '.self::MIN_SECONDS_BETWEEN_RUNS.' seconds ago',
            ]);
        }

        $started = microtime(true);
        $ran     = [];
        $failed  = [];

        // The schedule is declared in routes/console.php, which only gets loaded
        // when the CONSOLE kernel boots. During an HTTP request it never runs,
        // so without this the Schedule is empty and the tick reports success
        // having done nothing at all — the worst possible failure here, because
        // it looks exactly like a healthy run.
        app(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

        /** @var Schedule $schedule */
        $schedule = app(Schedule::class);

        foreach ($schedule->dueEvents(app()) as $event) {
            if (! $event->filtersPass(app())) {
                continue;
            }

            // A closure-based task has no subprocess to spawn, so it can run as
            // Laravel intends.
            if ($event instanceof CallbackEvent) {
                try {
                    $event->run(app());
                    $ran[] = ['task' => $event->getSummaryForDisplay(), 'exit' => 0];
                } catch (\Throwable $e) {
                    $failed[] = ['task' => $event->getSummaryForDisplay(), 'error' => $e->getMessage()];
                }

                continue;
            }

            $artisan = $this->artisanCommandFor($event->command ?? '');

            if ($artisan === null) {
                $failed[] = ['task' => $event->getSummaryForDisplay(), 'error' => 'could not resolve an artisan command'];
                continue;
            }

            try {
                $exit     = Artisan::call($artisan);
                $output   = trim(Artisan::output());
                $ran[]    = ['task' => $artisan, 'exit' => $exit, 'output' => mb_substr($output, 0, 300)];
            } catch (\Throwable $e) {
                $failed[] = ['task' => $artisan, 'error' => mb_substr($e->getMessage(), 0, 300)];
            }
        }

        $payload = [
            'ok'       => $failed === [],
            'ran'      => $ran,
            'failed'   => $failed,
            'duration' => round(microtime(true) - $started, 2).'s',
            'at'       => now()->toDateTimeString(),
        ];

        Log::channel('scheduler')->info('tick', $payload);

        return response()->json($payload, $failed === [] ? 200 : 500);
    }

    /**
     * Pull the artisan command out of a scheduled event's command line.
     *
     * Laravel builds these as `'/path/to/php' 'artisan' trials:process`, so the
     * part after the quoted `artisan` is what we want. Reading it back from the
     * event keeps the cadence defined in one place — routes/console.php — rather
     * than duplicating the schedule here, where the two could silently drift.
     */
    private function artisanCommandFor(string $commandLine): ?string
    {
        if ($commandLine === '') {
            return null;
        }

        if (preg_match('/artisan[\'"]?\s+(.+)$/', $commandLine, $m)) {
            $cmd = trim($m[1]);
            // Drop the output redirection Laravel appends.
            $cmd = preg_split('/\s+>{1,2}\s/', $cmd)[0];

            return trim($cmd) !== '' ? trim($cmd) : null;
        }

        return null;
    }

    private function notFound(): JsonResponse
    {
        return response()->json(['message' => 'Not found.'], 404);
    }
}
