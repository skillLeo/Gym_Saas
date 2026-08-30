<?php

/*
 * On gyms.skillleo.com the site and the API share one origin, so the browser
 * treats API calls as same-origin and never sends a CORS preflight — these
 * settings are then simply unused. They matter in two cases that do happen:
 * local development (the Next dev server on :3000 calling the API on :8001),
 * and any future split where the frontend moves to its own host.
 *
 * FRONTEND_URL is the canonical origin. CORS_ALLOWED_ORIGINS is an optional
 * comma-separated list for extras — typically the www variant, or a staging
 * frontend — because FRONTEND_URL cannot itself hold a list: it is also used to
 * build password-reset and email-verification links, which need exactly one URL.
 */

$origins = array_values(array_filter(array_map(
    static fn (string $origin): string => rtrim(trim($origin), '/'),
    array_merge(
        [env('FRONTEND_URL', 'http://localhost:3000')],
        explode(',', (string) env('CORS_ALLOWED_ORIGINS', '')),
    ),
)));

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_unique($origins)),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,

    // Authentication is a bearer token from localStorage, not a cookie
    // (frontend/src/lib/api.ts sets withCredentials: false), so credentialed
    // cross-origin requests are neither used nor wanted. Leaving this false
    // also keeps the wildcard-origin footgun unreachable.
    'supports_credentials' => false,
];
