<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        /*
         * Trust the reverse proxy that terminates TLS in production.
         *
         * On a real host the app is served behind nginx/Apache/Cloudflare, which
         * speaks HTTPS to the browser and plain HTTP to PHP. Without this,
         * `$request->isSecure()` is false and Laravel builds every absolute URL
         * with an `http://` scheme, which breaks two things badly:
         *
         *   1. `asset('storage/...')` — every uploaded avatar, post photo and
         *      recipe image comes back as http:// on an https:// page, so the
         *      browser blocks it as mixed content and the media library looks
         *      empty.
         *   2. `URL::temporarySignedRoute('verification.verify', ...)` — the
         *      link is SIGNED for the http:// URL but arrives over https://, so
         *      the signature never matches and every email verification link
         *      fails with "invalid". Nobody can finish signing up.
         *
         * `headers: null` uses Symfony's default set, which includes
         * X-Forwarded-Proto and Cloudflare's forwarding headers.
         */
        $middleware->trustProxies(at: '*');

        $middleware->alias([
            'auth'            => \App\Http\Middleware\Authenticate::class,
            'verified.email'  => \App\Http\Middleware\EnsureEmailIsVerified::class,
            'subscribed'      => \App\Http\Middleware\EnsureSubscriptionActive::class,
            'admin'           => \App\Http\Middleware\EnsureAdmin::class,
            // The mirror of 'admin': keeps staff out of member-only features.
            'member'          => \App\Http\Middleware\DenyAdminMemberFeature::class,
            'physician.active'=> \App\Http\Middleware\EnsurePhysicianActive::class,
        ]);
        $middleware->validateCsrfTokens(except: ['api/*']);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // API-only app with no session login route — always return a clean
        // 401 JSON response for unauthenticated requests instead of letting
        // Laravel's default guest-redirect fallback try to resolve `route('login')`.
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, \Illuminate\Http\Request $request) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        });

        // A raw database failure (bad column, out-of-range value, constraint violation, etc.) must
        // never reach the user as a SQL string — this applies in every environment, not just
        // production, since a query error is never something an end user should see verbatim.
        $exceptions->render(function (\Illuminate\Database\QueryException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                report($e);
                return response()->json(['message' => 'Something went wrong saving your data. Please check your entries and try again.'], 500);
            }
        });

        // Catch-all: no stack trace, file path, or exception class name may
        // reach a user — "in every environment, not just production" per the
        // brief. This was previously gated behind
        // `environment('production') && !config('app.debug')`, which meant it
        // did nothing locally (APP_DEBUG=true) and Laravel's framework default
        // verbose JSON (full trace, absolute file paths) rendered instead —
        // found while attack-testing the coaching portal's 403 responses,
        // which leaked exactly that. HTTP-exception messages throughout this
        // codebase are short, hand-authored, user-safe strings (e.g. "Not
        // authorized for this patient.") so they're fine to surface directly;
        // anything without a real HTTP status is an unexpected 500 and gets a
        // generic message instead, since its message may contain internals.
        // Laravel's own ValidationException carries its status via a public
        // `$status` property (422), not a `getStatusCode()` method — the
        // catch-all below only checked the latter, so every failed
        // `$request->validate()` call app-wide was falling through to the
        // generic 500 branch instead of returning field errors. Handling it
        // explicitly, ahead of the catch-all, restores the framework's normal
        // 422 + per-field `errors` shape every form on the frontend expects.
        $exceptions->render(function (\Illuminate\Validation\ValidationException $e, \Illuminate\Http\Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            return response()->json([
                'message' => $e->getMessage(),
                'errors'  => $e->errors(),
            ], $e->status);
        });

        $exceptions->render(function (\Throwable $e, \Illuminate\Http\Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            $status = method_exists($e, 'getStatusCode') ? $e->getStatusCode() : 500;
            if ($status >= 500) {
                report($e);
            }
            return response()->json([
                'message' => $status < 500 ? $e->getMessage() : 'Server error.',
            ], $status);
        });
    })->create();
