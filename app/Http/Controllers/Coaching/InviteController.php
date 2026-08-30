<?php

namespace App\Http\Controllers\Coaching;

use App\Http\Controllers\Controller;
use App\Models\CoachingAuthorization;
use App\Models\Physician;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Public, unauthenticated invite-acceptance flow (§6.5.2 step 4).
 *
 * The raw token is emailed once by CoachingAdminController::approve() and
 * never stored — only `hash('sha256', $token)` lives in
 * `coaching_authorizations.invite_token_hash`. Hashed the same way Sanctum
 * hashes its own personal access tokens: this is a "find the one row with
 * this exact high-entropy value" lookup, not a password check, so a fast
 * deterministic hash is correct here (unlike bcrypt, which is intentionally
 * not directly comparable this way).
 */
class InviteController extends Controller
{
    /** Preview an invite before the physician commits to filling out the form. */
    public function show(Request $request, string $token)
    {
        $authorization = $this->findByToken($token);

        if (! $authorization) {
            return response()->json(['message' => 'This invite link is invalid or has expired.'], 404);
        }

        return response()->json([
            'physician_name' => $authorization->physician_name,
            'practice_name'  => $authorization->practice_name,
        ]);
    }

    public function accept(Request $request, string $token)
    {
        $authorization = $this->findByToken($token);

        if (! $authorization) {
            return response()->json(['message' => 'This invite link is invalid or has expired.'], 404);
        }

        $data = $request->validate([
            'email'    => 'required|email|unique:physicians,email',
            'password' => 'required|string|min:8',
        ]);

        $physician = DB::transaction(function () use ($authorization, $data) {
            $physician = Physician::create([
                'name'          => $authorization->physician_name,
                'email'         => $data['email'],
                'password'      => Hash::make($data['password']),
                'practice_name' => $authorization->practice_name,
                'practice_phone'=> $authorization->practice_phone,
                'is_active'     => true,
            ]);

            // Single-use: the hash is nulled the moment it is redeemed, so the
            // same link can never mint a second account even if it leaks
            // after use (email forwarding, browser history, a shared inbox).
            $authorization->forceFill([
                'physician_id'      => $physician->id,
                'invite_token_hash' => null,
                'invite_expires_at' => null,
                'authorized_at'     => now(),
            ])->save();

            return $physician;
        });

        // Same 24-hour lifetime as a normal physician login (PhysicianAuthController) —
        // accepting an invite shouldn't grant a longer-lived session than logging in does.
        $token = $physician->createToken('coaching-portal', ['*'], now()->addHours(24))->plainTextToken;

        return response()->json([
            'message'   => 'Account created.',
            'token'     => $token,
            'physician' => ['id' => $physician->id, 'name' => $physician->name, 'email' => $physician->email],
        ], 201);
    }

    private function findByToken(string $token): ?CoachingAuthorization
    {
        return CoachingAuthorization::query()
            ->where('status', CoachingAuthorization::APPROVED)
            ->where('invite_token_hash', hash('sha256', $token))
            ->where('invite_expires_at', '>', now())
            ->first();
    }
}
