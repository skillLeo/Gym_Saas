<?php

namespace App\Http\Controllers\Coaching;

use App\Http\Controllers\Controller;
use App\Models\CoachingAuthorization;
use App\Models\PhysicianMessage;
use App\Services\PhysicianCanAccessMember;
use Illuminate\Http\Request;

/**
 * Physician-to-owner messaging (§6.5.3) — the one write path a physician has,
 * and it writes only a message row, never member data. Scoped to a single
 * authorization the same way every other coaching endpoint is.
 */
class MessageController extends Controller
{
    public function __construct(private PhysicianCanAccessMember $access) {}

    public function index(Request $request, CoachingAuthorization $authorization)
    {
        $auth = $this->access->authorize($request->user('physician'), $authorization, $request);

        $messages = PhysicianMessage::where('coaching_authorization_id', $auth->id)
            ->orderBy('created_at')
            ->get();

        return response()->json(['messages' => $messages]);
    }

    public function store(Request $request, CoachingAuthorization $authorization)
    {
        $auth = $this->access->authorize($request->user('physician'), $authorization, $request);
        $physician = $request->user('physician');

        $data = $request->validate(['body' => 'required|string|max:2000']);

        $message = PhysicianMessage::create([
            'coaching_authorization_id' => $auth->id,
            'sender_type'               => 'physician',
            'sender_id'                 => $physician->id,
            'body'                      => $data['body'],
        ]);

        return response()->json(['message' => $message], 201);
    }
}
