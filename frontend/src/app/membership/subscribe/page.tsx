'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import type { Appearance, Stripe } from '@stripe/stripe-js';
import { Check, Loader2, Lock } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Alert, ErrorState } from '@/components/ui/States';
import {
  createSubscription,
  fetchPlans,
  fetchSubscription,
  formatMoney,
  getStripe,
  type Plan,
} from '@/lib/subscription';

/**
 * Checkout.
 *
 * Card details are entered inside a Stripe Elements iframe and submitted
 * straight to Stripe — they never reach this application's servers, and this
 * code never sees a card number. The server's only role is issuing the client
 * secret that authorises the browser to confirm the payment.
 *
 * The version of this page that shipped before collected raw card numbers and
 * CVVs into React state, sent them nowhere, and told the user they had
 * subscribed.
 */
export default function SubscribePage() {
  const { t } = useI18nStore();
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <SubscribeInner />
    </Suspense>
  );
}

function CheckoutSkeleton() {
  const { t } = useI18nStore();
  return (
    <DashboardShell>
      <div className="max-w-md mx-auto">
        <PageHeader title={t('subscribe.title')} back="/membership" />
        <div className="flex justify-center py-16">
          <Loader2 size={22} className="animate-spin text-content-tertiary" aria-label={t('subscribe.loading')} />
        </div>
      </div>
    </DashboardShell>
  );
}

function SubscribeInner() {
  const { t } = useI18nStore();
  const params = useSearchParams();
  const planKey = params.get('plan') as Plan['key'] | null;

  const [stripe, setStripeInstance] = useState<Promise<Stripe | null> | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!planKey) {
        setError(t('subscribe.noPlan'));
        setLoading(false);
        return;
      }

      try {
        const { plans, publishableKey } = await fetchPlans();
        const chosen = plans.find((p) => p.key === planKey);

        if (cancelled) return;

        if (!chosen) {
          setError('That plan is not available.');
          setLoading(false);
          return;
        }
        if (!publishableKey) {
          setError(t('subscribe.notConfigured'));
          setLoading(false);
          return;
        }

        setPlan(chosen);
        setStripeInstance(getStripe(publishableKey));

        const created = await createSubscription(planKey);
        if (cancelled) return;
        setClientSecret(created.client_secret);
      } catch (err: unknown) {
        if (cancelled) return;
        const res = (err as { response?: { status?: number; data?: { message?: string } } }).response;
        setError(
          res?.data?.message ??
            t('subscribe.error.sub'),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [planKey]);

  // Elements is themed to match the app rather than shipping Stripe's defaults,
  // which would read as a third-party form dropped into the page.
  const appearance = useMemo<Appearance>(() => {
    const dark =
      typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    return {
      theme: dark ? 'night' : 'stripe',
      variables: {
        colorPrimary: '#F87404',
        colorBackground: dark ? '#1b1917' : '#ffffff',
        colorText: dark ? '#f5f4f2' : '#1c1917',
        colorDanger: '#B91C1C',
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: '8px',
        spacingUnit: '4px',
      },
    };
  }, []);

  if (loading) return <CheckoutSkeleton />;

  if (error || !plan) {
    return (
      <DashboardShell>
        <div className="max-w-md mx-auto">
          <PageHeader title={t('subscribe.title')} back="/membership" />
          <ErrorState
            title={t('subscribe.error.start')}
            description={error ?? t('subscribe.planGone')}
            onRetry={() => window.location.assign('/membership')}
            retryLabel={t('subscribe.back')}
          />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="max-w-md mx-auto">
        <PageHeader title={t('subscribe.title')} back="/membership" />

        <OrderSummary plan={plan} />

        {stripe && clientSecret ? (
          <Elements stripe={stripe} options={{ clientSecret, appearance }}>
            <PaymentForm plan={plan} />
          </Elements>
        ) : (
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin text-content-tertiary" />
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function OrderSummary({ plan }: { plan: Plan }) {
  const { t } = useI18nStore();
  const annual = plan.interval === 'year';

  return (
    <div className="rounded-md border border-border bg-surface-raised p-5 mb-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-h3 text-content-primary">{plan.name}</p>
          <p className="text-body-sm text-content-secondary mt-0.5">
            {annual ? t('subscribe.billedYearly') : t('subscribe.billedMonthly')}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display text-h2 text-content-primary tabular-nums">
            {formatMoney(plan.amount_cents)}
          </p>
          <p className="text-caption text-content-tertiary">{annual ? 'per year' : 'per month'}</p>
        </div>
      </div>

      {plan.savings && (
        <p className="mt-3 pt-3 border-t border-border-subtle text-body-sm text-success">
          You save {formatMoney(plan.savings.saved_cents)} versus paying monthly —{' '}
          {plan.savings.months_free} months free.
        </p>
      )}
    </div>
  );
}

function PaymentForm({ plan }: { plan: Plan }) {
  const { t } = useI18nStore();
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);

  /**
   * Entitlement is granted by the webhook, not by the browser. After Stripe
   * confirms the payment we poll our own API until it reports access, so the
   * success screen reflects our database rather than an optimistic guess.
   */
  const waitForActivation = useCallback(async () => {
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const state = await fetchSubscription();
        if (state.has_access && state.subscription) return true;
      } catch {
        // Keep polling — a transient failure here should not fail the payment.
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/membership/subscribe?plan=${plan.key}`,
      },
      // Stay on the page unless the card needs a redirect for 3-D Secure.
      redirect: 'if_required',
    });

    if (error) {
      // Stripe writes card_error and validation_error messages for cardholders;
      // anything else is an internal condition and must not be shown raw.
      setMessage(
        error.type === 'card_error' || error.type === 'validation_error'
          ? (error.message ?? t('subscribe.declined'))
          : t('subscribe.error.charge'),
      );
      setSubmitting(false);
      return;
    }

    const active = await waitForActivation();

    if (!active) {
      setMessage(
        'Your payment went through, but your account is still updating. Refresh in a moment — you will not be charged twice.',
      );
      setSubmitting(false);
      return;
    }

    setActivated(true);
    setTimeout(() => router.push('/dashboard'), 1600);
  }

  if (activated) {
    return (
      <div className="text-center py-10">
        <div className="h-14 w-14 rounded-full bg-success-surface text-success flex items-center justify-center mx-auto mb-4">
          <Check size={28} strokeWidth={2.5} />
        </div>
        <h2 className="font-display text-h2 text-content-primary mb-1">You are on {plan.name}</h2>
        <p className="text-body-sm text-content-secondary">{t('subscribe.redirecting')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-md border border-border bg-surface-raised p-5">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {message && <Alert tone="error">{message}</Alert>}

      <Button type="submit" fullWidth size="lg" loading={submitting} disabled={!stripe || submitting}>
        {submitting ? t('subscribe.processing') : `Pay ${formatMoney(plan.amount_cents)}`}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-caption text-content-tertiary">
        <Lock size={12} strokeWidth={2} className="shrink-0" aria-hidden />
        Card details go directly to Stripe. We never see or store them.
      </p>
    </form>
  );
}
