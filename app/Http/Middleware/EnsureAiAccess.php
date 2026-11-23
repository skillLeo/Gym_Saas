<?php

namespace App\Http\Middleware;

use App\Services\Ai\AiGate;
use App\Services\Ai\Exceptions\AiLimitReached;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gate for every AI route: feature switched on, enabled for this member,
 * consent recorded, and inside the limits.
 *
 * Declared on the route rather than called inside each controller method, for
 * the reason EnsureAdmin gives: a per-method check works until the day someone
 * adds a method and forgets, and the failure mode there is an endpoint that
 * spends the client's money with no flag, no consent and no cap.
 *
 * AiGate is also consulted inside AiClient, so this middleware is the fast,
 * well-worded "no" rather than the only one.
 */
class EnsureAiAccess
{
    public function __construct(private readonly AiGate $gate)
    {
    }

    /**
     * @param  string|null  $limits  Pass "no-limits" for a route that spends
     *                               nothing. See below — this is not a way to
     *                               opt out of the cap, it is a way to stop
     *                               the cap destroying work already paid for.
     */
    public function handle(Request $request, Closure $next, ?string $limits = null): Response
    {
        if (($problem = $this->gate->accessProblem($request->user())) !== null) {
            return response()->json([
                'success' => false,
                'error'   => $problem['message'],
                'code'    => $problem['code'],
            ], $problem['status']);
        }

        /*
         * THE LIMITS GUARD SPENDING, SO THEY BELONG ON ROUTES THAT SPEND.
         *
         * /confirm does not. By the time it is called the analysis is paid for
         * and the member has spent a minute correcting the result; all it does
         * is write journal rows, exactly as manual logging does. Refusing it
         * on a limit threw that whole draft away — and the limit could easily
         * be reached between analysing and saving, by the member's own second
         * device or by another member pushing the shared monthly cap over
         * while this one was reviewing.
         *
         * The refusal also cost nothing to make and saved nothing: the money
         * was already gone. All it bought was a member staring at a 429 with
         * their corrected meal deleted and no way back to it.
         */
        if ($limits === 'no-limits') {
            return $next($request);
        }

        try {
            $this->gate->assertWithinLimits($request->user());
        } catch (AiLimitReached $e) {
            /*
             * 429 with `fallback: manual`. The frontend uses that to show a
             * "Log manually instead" button instead of a dead end: a limit on
             * an optional convenience must never read as the food journal
             * being closed.
             */
            return response()->json([
                'success'  => false,
                'error'    => $e->clientMessage(),
                'code'     => $e->code(),
                'reason'   => $e->reason(),
                'fallback' => 'manual',
            ], $e->status());
        }

        return $next($request);
    }
}
