'use client';

import { useEffect, useState } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { clearSession } from '@/lib/auth';
import { Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fetchPlans, fetchSubscription, formatMoney, type Plan } from '@/lib/subscription';

export type GateReason = 'trial_expired' | 'deactivated' | 'cancelled';

// Dictionary keys, not sentences: this map is module scope and runs before any
// component mounts, so the wording is resolved with t() where it is rendered.
const COPY: Record<GateReason, { titleKey: string; bodyKey: string }> = {
  trial_expired: { titleKey: 'gate.trialEnded', bodyKey: 'gate.trialEndedBody' },
  cancelled:     { titleKey: 'gate.subEnded',   bodyKey: 'gate.cancelledBody' },
  deactivated:   { titleKey: 'gate.inactive',   bodyKey: 'gate.deactivatedBody' },
};

/**
 * Full-screen block shown when an account is not entitled to use the app.
 *
 * Deliberately has no navigation and no dismiss: it is a gate, not a screen.
 * The previous version offered a "Continue with limited access" link straight
 * to the dashboard, which meant the gate stopped nobody.
 *
 * This is the user-facing half only. The server-side half is the
 * EnsureSubscriptionActive middleware — a client that skips this component
 * still gets 402 from the API.
 */
export function SubscriptionGate({ reason = 'trial_expired' }: { reason?: GateReason }) {
  const { t } = useI18nStore();
  const router = useRouter();
  const { user } = useAuthStore();
  const [cheapest, setCheapest] = useState<Plan | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchPlans()
      .then(({ plans }) => {
        if (cancelled) return;
        // Lead with the lowest monthly price so the entry point looks like what
        // it is, rather than quoting the plan we would prefer to sell.
        const monthly = plans.filter((p) => p.interval === 'month');
        const lowest = monthly.reduce<Plan | null>(
          (min, p) => (min === null || p.amount_cents < min.amount_cents ? p : min),
          null,
        );
        setCheapest(lowest);
      })
      .catch(() => {
        // Pricing is a nicety here; the gate must still render without it.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const { titleKey, bodyKey } = COPY[reason];
  const title = t(titleKey);
  const body = t(bodyKey);

  return (
    <div className="min-h-dvh bg-surface-base flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex mb-6">
          <div className="w-16 h-16 rounded-full bg-accent-surface text-accent flex items-center justify-center">
            <Lock size={30} strokeWidth={1.75} aria-hidden />
          </div>
        </div>

        <h1 className="font-display text-h1 text-content-primary mb-2 text-balance">{title}</h1>
        <p className="text-body text-content-secondary mb-8 text-pretty">{body}</p>

        <div className="space-y-3">
          <Button fullWidth size="lg" onClick={() => router.push('/membership')}>
            {cheapest
              ? t('gate.seePlansFrom', { price: formatMoney(cheapest.amount_cents) })
              : t('gate.seePlans')}
          </Button>
        </div>

        <p className="text-caption text-content-tertiary mt-6">
          {t('gate.reassure')}
        </p>

        {/* Who is actually blocked, and a way out.

            The gate deliberately has no navigation, but with no identity and no
            sign-out it became a dead end: a member could not tell which account
            was locked, and could not switch to another one. The client hit
            exactly this — two windows showing an identical gate, with no way to
            see that both were the same account. */}
        {user?.email && (
          <div className="mt-8 pt-6 border-t border-border-subtle">
            <p className="text-caption text-content-tertiary">
              {t('gate.signedInAs', { email: user.email })}
            </p>
            <button
              type="button"
              onClick={() => { clearSession(); router.push('/auth/login'); }}
              className="mt-2 text-caption font-semibold text-accent hover:underline"
            >
              {t('gate.signOut')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Wraps app content and swaps in the gate when the account is not entitled.
 *
 * Renders nothing until the check resolves — flashing the app to a locked-out
 * user before replacing it with a gate looks like a bug and briefly exposes
 * content they should not see.
 */
export function RequireSubscription({ children }: { children: React.ReactNode }) {
  const { t } = useI18nStore();
  const [state, setState] = useState<'checking' | 'allowed' | GateReason>('checking');

  useEffect(() => {
    let cancelled = false;

    fetchSubscription()
      .then((sub) => {
        if (cancelled) return;
        if (sub.has_access) {
          setState('allowed');
          return;
        }

        // account_state distinguishes a recoverable lapse from an account
        // already queued for deletion, which need different wording.
        if (sub.account_state === 'deactivated') {
          setState('deactivated');
        } else if (sub.subscription) {
          // They held a subscription and it ended — not an unconverted trial.
          setState('cancelled');
        } else {
          setState('trial_expired');
        }
      })
      .catch(() => {
        // A failed check must not lock out a paying member on a flaky network.
        // The API is the real gate; this is presentation.
        if (!cancelled) setState('allowed');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'checking') {
    return (
      <div className="min-h-dvh bg-surface-base flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-content-tertiary" aria-label={t('gate.checking')} />
      </div>
    );
  }

  if (state === 'allowed') return <>{children}</>;

  return <SubscriptionGate reason={state} />;
}
