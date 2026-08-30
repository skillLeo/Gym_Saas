<?php

namespace App\Services;

use App\Models\CoachingAccessLog;
use App\Models\CoachingAuthorization;
use App\Models\Physician;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * The single place a physician's access to a patient's coaching data is
 * decided (§6.5.3). Every coaching-data controller method calls this
 * directly — it is not a substitute for route middleware, it is the
 * independent, second check that middleware alone would not be defense in
 * depth for.
 *
 * Deliberately does NOT accept a raw member id from anywhere. The only way in
 * is a `CoachingAuthorization` row, and the only way to get one of those is
 * through the physician's own `authorizations()` relation — never by trusting
 * an id out of a URL.
 */
class PhysicianCanAccessMember
{
    /**
     * @throws HttpException 403 if access is not currently valid.
     */
    public function authorize(Physician $physician, CoachingAuthorization $authorization, Request $request): CoachingAuthorization
    {
        // Re-fetch rather than trust whatever the caller passed in, so a stale
        // in-memory instance (approved 2 minutes ago, revoked 1 minute ago)
        // can never be used to slip through on cached state.
        $fresh = CoachingAuthorization::find($authorization->id);

        if (! $fresh || $fresh->physician_id !== $physician->id) {
            throw new HttpException(403, 'Not authorized for this patient.');
        }

        if (! $fresh->isActivelyAuthorized()) {
            throw new HttpException(403, 'This authorization is not currently active.');
        }

        CoachingAccessLog::create([
            'physician_id'               => $physician->id,
            'coaching_authorization_id'  => $fresh->id,
            'member_id'                  => $fresh->member_id,
            'endpoint'                   => $request->path(),
            'ip'                         => $request->ip(),
        ]);

        return $fresh;
    }
}
