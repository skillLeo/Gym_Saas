<?php

namespace App\Http\Controllers\Coaching;

use App\Http\Controllers\Controller;
use App\Models\CoachingAuthorization;
use Illuminate\Http\Request;

class PatientController extends Controller
{
    /**
     * The physician's own authorized-patient list. Scoped through the
     * `physician` relation on the authenticated physician — never a query
     * against `users` directly, so there is no path here that could return a
     * patient this physician was not explicitly approved for.
     */
    public function index(Request $request)
    {
        $physician = $request->user('physician');

        $patients = $physician->authorizations()
            ->where('status', CoachingAuthorization::APPROVED)
            ->whereNull('revoked_at')
            ->with('member:id,name,avatar')
            ->get()
            ->map(fn (CoachingAuthorization $a) => [
                'authorization_id' => $a->id,
                'member'           => [
                    'id'     => $a->member->id,
                    'name'   => $a->member->name,
                    'avatar' => $a->member->avatar_url,
                ],
                'authorized_at' => $a->authorized_at,
            ]);

        return response()->json(['patients' => $patients]);
    }
}
