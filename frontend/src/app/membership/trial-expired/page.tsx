'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SubscriptionGate, type GateReason } from '@/components/subscription/SubscriptionGate';

const VALID: GateReason[] = ['trial_expired', 'deactivated', 'cancelled'];

/**
 * The blocking screen, reachable directly so the app can route here.
 *
 * `?reason=` selects the wording — trial expiry, cancellation, or a deactivated
 * account. It is validated against a known list rather than trusted, since a
 * query parameter is user-controlled and would otherwise be a way to put
 * arbitrary state into the page.
 */
export default function TrialExpiredPage() {
  return (
    <Suspense fallback={null}>
      <GateFromQuery />
    </Suspense>
  );
}

function GateFromQuery() {
  const raw = useSearchParams().get('reason');
  const reason = VALID.includes(raw as GateReason) ? (raw as GateReason) : 'trial_expired';

  return <SubscriptionGate reason={reason} />;
}
