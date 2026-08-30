<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks feature endpoints for accounts without an active trial or subscription.
 *
 * The client-side gate (RequireSubscription) is presentation only — anyone can
 * skip it by calling the API directly. This is the enforcement.
 */
class EnsureSubscriptionActive
{
    /**
     * Endpoints that must stay reachable to a lapsed user.
     *
     * Without these the account is a dead end: they could not view plans, pay,
     * see who they are signed in as, or sign out. Prefixes, not exact paths, so
     * sub-routes are covered.
     *
     * Mirrors the UNGATED list in frontend DashboardShell.tsx — if the two
     * disagree, a page renders and then every request it makes fails.
     */
    private const ALLOWED_PREFIXES = [
        'api/auth',           // login, logout, user, verification, password
        'api/plans',          // pricing
        'api/subscription',   // start, view, cancel, resume
        'api/stripe',         // webhooks
        'api/onboarding',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Unauthenticated requests are auth:sanctum's problem, not this one.
        if (!$user) {
            return $next($request);
        }

        if ($this->isAllowed($request->path()) || $user->hasAccess()) {
            return $next($request);
        }

        // 402 Payment Required: the request was understood and the caller is
        // authenticated — what is missing is a subscription. 403 would imply
        // this can never be permitted, which is wrong and unhelpful to clients.
        return response()->json([
            'success' => false,
            'error'   => 'Your access has ended. Choose a plan to continue.',
            'code'    => 'subscription_required',
            // account_state is the source of truth; it distinguishes `grace`
            // (recoverable) from `deactivated` (queued for deletion), which the
            // legacy mirror column flattens into one value.
            'state'   => $user->account_state,
        ], 402);
    }

    private function isAllowed(string $path): bool
    {
        foreach (self::ALLOWED_PREFIXES as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix . '/')) {
                return true;
            }
        }

        return false;
    }
}
