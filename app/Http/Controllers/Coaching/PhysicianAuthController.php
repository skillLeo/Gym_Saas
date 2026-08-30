<?php

namespace App\Http\Controllers\Coaching;

use App\Http\Controllers\Controller;
use App\Models\Physician;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Physician login is deliberately NOT `Auth::attempt()` against the `web`
 * guard — physicians never touch that guard or its session. This checks
 * credentials against the `physicians` table directly and issues a Sanctum
 * token scoped to the `physician` provider (config/auth.php), which is the
 * only thing `auth:physician` routes will ever accept (§6.5.1).
 */
class PhysicianAuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $key = 'physician-login:' . strtolower($credentials['email']) . '|' . $request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            return response()->json([
                'message' => 'Too many attempts. Try again in ' . RateLimiter::availableIn($key) . ' seconds.',
            ], 429);
        }

        $physician = Physician::where('email', $credentials['email'])->first();

        if (! $physician || ! Hash::check($credentials['password'], $physician->password)) {
            RateLimiter::hit($key, 60);
            return response()->json(['message' => 'Invalid credentials.'], 401);
        }

        if (! $physician->is_active) {
            return response()->json(['message' => 'This account is not active.'], 403);
        }

        RateLimiter::clear($key);
        $physician->forceFill(['last_login_at' => now()])->save();

        // Shorter-lived than a member session: this token can read patient
        // health data, so it re-requires login every 24 hours rather than
        // relying on the 30-day ceiling everything else gets.
        $token = $physician->createToken('coaching-portal', ['*'], now()->addHours(24))->plainTextToken;

        return response()->json([
            'token'     => $token,
            'physician' => [
                'id'            => $physician->id,
                'name'          => $physician->name,
                'email'         => $physician->email,
                'practice_name' => $physician->practice_name,
            ],
        ]);
    }

    public function logout(Request $request)
    {
        $request->user('physician')->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request)
    {
        $physician = $request->user('physician');

        return response()->json([
            'physician' => [
                'id'            => $physician->id,
                'name'          => $physician->name,
                'email'         => $physician->email,
                'practice_name' => $physician->practice_name,
            ],
        ]);
    }
}
