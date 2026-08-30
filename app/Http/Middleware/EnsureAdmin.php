<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restricts a route to admins.
 *
 * `AdminController` guards itself with a per-method `assertAdmin()` call, which
 * works but relies on every future method remembering it — one omission is an
 * open admin endpoint with nothing to signal it. Declaring the requirement on
 * the route means a new method cannot accidentally ship unguarded.
 */
class EnsureAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->user()?->is_admin) {
            return response()->json([
                'success' => false,
                'error'   => 'Administrator access required.',
                'code'    => 'admin_required',
            ], 403);
        }

        return $next($request);
    }
}
