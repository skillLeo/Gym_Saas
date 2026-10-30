<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Ai\AiGate;
use App\Services\Ai\AiSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Availability and consent for the AI features.
 *
 * Deliberately NOT behind the `ai.access` middleware. These two endpoints are
 * how a member finds out whether they have access and how they grant consent,
 * so gating them on having access and consent already would make both
 * impossible — the status call would 403 for exactly the people who need an
 * answer from it, and the frontend would have no way to tell "switched off"
 * apart from "signed out".
 */
class AiController extends Controller
{
    public function __construct(
        private readonly AiGate $gate,
        private readonly AiSettings $settings,
    ) {
    }

    /**
     * Can this member use the AI features, and if not, why not.
     *
     * The frontend hides the entry point entirely when `available` is false,
     * so this has to be callable by members who will never have access.
     */
    public function status(Request $request): JsonResponse
    {
        $user    = $request->user();
        $problem = $this->gate->accessProblem($user);

        /*
         * `consent_required` is reported separately from `available`. A member
         * who simply has not read the notice yet is one tap away from using the
         * feature, which is a different thing to the feature being off for
         * them — and the UI needs to show a consent sheet in the first case and
         * nothing at all in the second.
         */
        $consentRequired = $problem !== null
            && $problem['code'] === 'ai_consent_required';

        return response()->json([
            'success' => true,
            'data'    => [
                'available'        => $problem === null,
                'reason'           => $problem['code'] ?? null,
                'message'          => $problem['message'] ?? null,
                'consent_required' => $consentRequired,
                'consent_version'  => (string) config('ai.consent_version'),

                /*
                 * What is left today, so the review screen can warn a member
                 * before they take a photo rather than after. Null when the
                 * limit does not apply to them, which is not the same as 0.
                 */
                'daily_limit'     => $this->settings->dailyLimitPerUser(),
                'daily_remaining' => $user && ! $user->is_admin
                    ? max(0, $this->settings->dailyLimitPerUser() - $this->gate->successfulCallsToday($user))
                    : null,
            ],
        ]);
    }

    /**
     * Record that this member has read the current notice.
     *
     * The client sends back the version it displayed. If that is not the
     * version now in force, the consent is rejected: it would otherwise be
     * possible to record agreement to wording the member never saw, simply by
     * leaving a stale tab open across a reword.
     *
     * No AI call can happen without a row here — enforced by AiGate, which both
     * the route middleware and AiClient consult.
     */
    public function consent(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'version'  => 'required|string|max:16',
            'accepted' => 'required|accepted',
        ]);

        $current = (string) config('ai.consent_version');

        if ($validated['version'] !== $current) {
            return response()->json([
                'success' => false,
                'error'   => 'The notice has been updated. Please reload and read it again.',
                'code'    => 'ai_consent_version_mismatch',
                'consent_version' => $current,
            ], 409);
        }

        $user = $request->user();

        // forceFill, not fill: these are not fillable by design, so that
        // consent can never be set as a side effect of a profile update.
        $user->forceFill([
            'ai_consent_at'      => now(),
            'ai_consent_version' => $current,
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'Thanks — saved.',
            'data'    => [
                'consent_version' => $current,
                'consented_at'    => $user->ai_consent_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Withdraw consent.
     *
     * Required for the notice to be meaningful: consent that cannot be taken
     * back is not consent. Clearing it immediately blocks every AI call for
     * this member through the same gate, with no other effect on their account.
     */
    public function revokeConsent(Request $request): JsonResponse
    {
        $request->user()->forceFill([
            'ai_consent_at'      => null,
            'ai_consent_version' => null,
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'Photo, voice and text logging is switched off for your account. Manual logging is unchanged.',
        ]);
    }
}
