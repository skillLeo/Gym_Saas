<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureEmailIsVerified
{
    // These must stay reachable while the user is stuck on the "verify your email" screen,
    // so they can see who they are, sign out, or ask for a fresh link.
    private const ALLOWED_PATHS = [
        'api/auth/logout',
        'api/auth/user',
        'api/auth/email/resend',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || $user->email_verified_at || in_array($request->path(), self::ALLOWED_PATHS, true)) {
            return $next($request);
        }

        return response()->json([
            'success' => false,
            'error'   => 'Please verify your email address before continuing.',
            'code'    => 'email_unverified',
        ], 403);
    }
}
