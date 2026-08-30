<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CoachingAuthorization;
use App\Services\UserAccountState;
use Illuminate\Http\Request;

/**
 * Member-facing side of the coaching authorization flow (§6.5.2). Everything
 * that decides *approval* lives in Admin\CoachingAdminController — this
 * controller can only create a `pending` request and revoke the member's own
 * existing one. No code path here can set `status = approved`.
 */
class CoachingAuthorizationController extends Controller
{
    public function index(Request $request)
    {
        $authorizations = CoachingAuthorization::where('member_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['authorizations' => $authorizations]);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        // §6.5.2 step 1 — server-side against real account state, never a UI
        // flag. A free-trial member cannot initiate this even if they somehow
        // reach the form (attack test §6.5.3 #7).
        $isPayingSubscriber = $user->account_state === UserAccountState::SUBSCRIBER
            && $user->activeSubscription() !== null;

        if (! $isPayingSubscriber) {
            return response()->json([
                'message' => 'Only an active paid subscription can request physician coaching access.',
            ], 403);
        }

        $data = $request->validate([
            'physician_name'        => 'required|string|max:255',
            'practice_name'         => 'required|string|max:255',
            'practice_address'      => 'required|string|max:500',
            'practice_phone'        => 'required|string|max:30',
            'representative_name'   => 'required|string|max:255',
            'representative_email'  => 'required|email|max:255',
        ]);

        $authorization = CoachingAuthorization::create([
            ...$data,
            'member_id' => $user->id,
            'status'    => CoachingAuthorization::PENDING,
        ]);

        return response()->json(['authorization' => $authorization], 201);
    }

    public function revoke(Request $request, CoachingAuthorization $authorization)
    {
        if ($authorization->member_id !== $request->user()->id) {
            abort(403);
        }

        if ($authorization->status !== CoachingAuthorization::APPROVED) {
            return response()->json(['message' => 'Only an approved authorization can be revoked.'], 422);
        }

        // Revocation is immediate — the very next physician request against
        // this authorization fails `isActivelyAuthorized()`, since that check
        // re-fetches from the database rather than trusting a cached instance.
        $authorization->update(['status' => CoachingAuthorization::REVOKED, 'revoked_at' => now()]);

        return response()->json(['authorization' => $authorization->fresh()]);
    }
}
