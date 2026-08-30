<?php
namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    protected function redirectTo(Request $request): ?string
    {
        // This is an API-only application with no session-based login route,
        // so never attempt a redirect — let the exception render as JSON.
        return null;
    }
}
