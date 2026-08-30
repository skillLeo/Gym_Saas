<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The other half of the role system.
 *
 * `EnsureAdmin` adds admin-only routes. Nothing ever *removed* member routes
 * from staff, so an administrator could log food, record workouts, plan meals
 * and hold a subscription on an account that belongs to no member's training.
 * Hiding those pages from the navigation was cosmetic: typing the address still
 * worked, and so did calling the API directly.
 *
 * Applies to personal-tracking endpoints only. Deliberately NOT applied to:
 *
 *   /subscription  — RequireSubscription calls it on every authenticated page,
 *                    including every admin screen. Blocking it would gate the
 *                    admin panel behind a failed request.
 *   /plans         — public pricing, used by the signed-out landing page.
 *   /admin/*       — a different prefix entirely, guarded by EnsureAdmin.
 *
 * A JSON 403 rather than a redirect: this is an API, and a 302 to an HTML page
 * would reach the client as an unparseable response. The Next.js middleware and
 * the client-side guard handle the redirect for actual page visits.
 */
class DenyAdminMemberFeature
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->is_admin) {
            return response()->json([
                'success' => false,
                'error'   => 'This is a member feature. Administrator accounts do not have personal food, fitness or billing records.',
                'code'    => 'member_only',
                'redirect' => '/dashboard',
            ], 403);
        }

        return $next($request);
    }
}
