<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Sanctum's guard only checks that a token is valid and belongs to a
 * Physician (config/auth.php `physician` guard) — it does not check whether
 * that physician account has since been deactivated. An admin flipping
 * `is_active` to false must take effect on the physician's very next request,
 * not just block new logins, so this runs on every `auth:physician` route.
 */
class EnsurePhysicianActive
{
    public function handle(Request $request, Closure $next)
    {
        $physician = $request->user('physician');

        if (! $physician || ! $physician->is_active) {
            abort(403, 'This physician account is not active.');
        }

        return $next($request);
    }
}
