<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Mail\PhysicianInviteMail;
use App\Models\CoachingAuthorization;
use App\Models\PhysicianMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Admin approval side of §6.5.2. `approve()` is the ONLY place in the entire
 * codebase that may set `status = approved` — grep for the constant if that
 * ever seems violated elsewhere, because it should not be possible.
 *
 * Route-gated by the `admin` middleware already covering this whole prefix
 * (routes/api.php), same as every other Admin\* controller.
 */
class CoachingAdminController extends Controller
{
    public function index(Request $request)
    {
        $query = CoachingAuthorization::with('member:id,name,email')->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return response()->json($query->paginate(20));
    }

    public function approve(Request $request, CoachingAuthorization $authorization)
    {
        if ($authorization->status !== CoachingAuthorization::PENDING) {
            return response()->json(['message' => 'Only a pending request can be approved.'], 422);
        }

        $rawToken = Str::random(64);

        $authorization->update([
            'status'             => CoachingAuthorization::APPROVED,
            'reviewed_by'        => $request->user()->id,
            'reviewed_at'        => now(),
            'invite_token_hash'  => hash('sha256', $rawToken),
            'invite_expires_at'  => now()->addHours(72),
        ]);

        Mail::to($authorization->representative_email)->send(new PhysicianInviteMail($authorization, $rawToken));

        return response()->json(['authorization' => $authorization->fresh()]);
    }

    public function reject(Request $request, CoachingAuthorization $authorization)
    {
        if ($authorization->status !== CoachingAuthorization::PENDING) {
            return response()->json(['message' => 'Only a pending request can be rejected.'], 422);
        }

        $data = $request->validate(['rejection_reason' => 'nullable|string|max:500']);

        $authorization->update([
            'status'            => CoachingAuthorization::REJECTED,
            'reviewed_by'       => $request->user()->id,
            'reviewed_at'       => now(),
            'rejection_reason'  => $data['rejection_reason'] ?? null,
        ]);

        return response()->json(['authorization' => $authorization->fresh()]);
    }

    /** Admin can also revoke — e.g. on request from the member by phone/support. */
    public function revoke(Request $request, CoachingAuthorization $authorization)
    {
        if ($authorization->status !== CoachingAuthorization::APPROVED) {
            return response()->json(['message' => 'Only an approved authorization can be revoked.'], 422);
        }

        $authorization->update(['status' => CoachingAuthorization::REVOKED, 'revoked_at' => now()]);

        return response()->json(['authorization' => $authorization->fresh()]);
    }

    public function messages(Request $request, CoachingAuthorization $authorization)
    {
        $messages = PhysicianMessage::where('coaching_authorization_id', $authorization->id)
            ->orderBy('created_at')
            ->get();

        return response()->json(['messages' => $messages]);
    }

    public function reply(Request $request, CoachingAuthorization $authorization)
    {
        $data = $request->validate(['body' => 'required|string|max:2000']);

        $message = PhysicianMessage::create([
            'coaching_authorization_id' => $authorization->id,
            'sender_type'               => 'admin',
            'sender_id'                 => $request->user()->id,
            'body'                      => $data['body'],
        ]);

        return response()->json(['message' => $message], 201);
    }
}
