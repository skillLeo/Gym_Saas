'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ErrorState, Alert } from '@/components/ui/States';
import { useI18nStore } from '@/store/i18nStore';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/format';
import toast from 'react-hot-toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  cancelSubscription,
  changePlan,
  fetchPlans,
  fetchSubscription,
  formatMoney,
  resumeSubscription,
  RECOMMENDED_PLAN,
  type Plan,
  type SubscriptionState,
} from '@/lib/subscription';

type Billing = 'month' | 'year';

/**
 * Pricing.
 *
 * Every price, feature and savings figure comes from the API, which reads the
 * same rows that hold the Stripe price IDs. Nothing is hardcoded here, so the
 * page cannot drift from what a customer is actually charged — the previous
 * version of this file advertised three tiers and three prices that did not
 * exist in Stripe.
 */
export default function MembershipPage() {
  const router = useRouter();
  // Dates go through the shared locale-aware formatter rather than a raw
  // toLocaleDateString, which is the app-wide convention.
  const { locale, t } = useI18nStore();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<SubscriptionState | null>(null);
  const [billing, setBilling] = useState<Billing>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingKey, setStartingKey] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const { confirm } = useConfirm();
  // Trial badges elsewhere in the app read the cached user, so it has to be
  // re-read after anything that changes what the member is paying for —
  // otherwise the dashboard keeps saying "19d left" to someone who just paid.
  const { user, refreshUser } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Plans are public; the subscription call needs auth and is allowed to
        // fail so signed-out visitors still see pricing.
        const [{ plans: fetched }, sub] = await Promise.all([
          fetchPlans(),
          fetchSubscription().catch(() => null),
        ]);
        if (cancelled) return;
        setPlans(fetched);
        setCurrent(sub);
      } catch {
        if (!cancelled) setError(t('membership.error.load'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const annualPlan = useMemo(() => plans.find((p) => p.interval === 'year'), [plans]);

  // Monthly tiers stay visible on the annual tab so the comparison the savings
  // callout refers to is actually on screen.
  const visible = useMemo(
    () => (billing === 'year' ? plans : plans.filter((p) => p.interval === 'month')),
    [plans, billing],
  );

  const activeKey = current?.subscription?.plan?.key ?? null;

  /**
   * Cancel and resume.
   *
   * Both endpoints, and the `cancelSubscription`/`resumeSubscription` helpers,
   * already existed and were called from nowhere — while this very page promised
   * "Change or cancel whenever you like" and "Cancel any time". A subscription
   * product that takes money and offers no way to stop is not a missing nicety.
   */
  async function stopSubscription() {
    const endsOn = current?.subscription?.current_period_end;
    if (!(await confirm({
      title: t('membership.cancelConfirm'),
      message: endsOn
        ? `You keep full access until ${formatDate(endsOn, locale)}, and you will not be charged again. You can undo this any time before then.`
        : 'You keep access until the end of the period you have paid for, and you will not be charged again.',
      confirmLabel: t('membership.cancel'),
      cancelLabel: t('membership.cancelNo'),
      destructive: true,
    }))) return;

    setChanging(true);
    try {
      const message = await cancelSubscription();
      setCurrent(await fetchSubscription());
      await refreshUser();
      toast.success(message);
    } catch {
      toast.error(t('membership.error.cancel'));
    } finally {
      setChanging(false);
    }
  }

  async function restartSubscription() {
    setChanging(true);
    try {
      const message = await resumeSubscription();
      setCurrent(await fetchSubscription());
      await refreshUser();
      toast.success(message);
    } catch {
      toast.error(t('membership.error.restart'));
    } finally {
      setChanging(false);
    }
  }

  const hasLiveSubscription = Boolean(
    current?.subscription && ['active', 'trialing', 'past_due'].includes(current.subscription.status),
  );

  async function choose(plan: Plan) {
    // An admin pressing a plan card would start a real checkout for a product
    // they already have unlimited access to.
    if (user?.is_admin) {
      toast(t('membership.adminAccess'));
      return;
    }

    // Someone already subscribed used to be routed to checkout, which then
    // refused with "change your plan from billing settings" — a screen that does
    // not exist. Move them between tiers instead, which is what they asked for.
    if (hasLiveSubscription) {
      const now = current?.subscription?.plan;
      const dearer = now ? plan.amount_cents > now.amount_cents : false;
      if (!(await confirm({
        title: `Switch to ${plan.name}?`,
        // Say what actually happens. This used to promise a charge for an
        // upgrade while the server only recorded a proration for the next
        // invoice — so nothing was taken and no card was asked for.
        message: dearer
          ? `Your card on file will be charged now for the rest of this period, then ${formatMoney(plan.amount_cents)} on each renewal.`
          : `You will be credited for the rest of this period, then charged ${formatMoney(plan.amount_cents)} on each renewal.`,
        confirmLabel: `Switch to ${plan.name}`,
      }))) return;

      setStartingKey(plan.key);
      try {
        toast.success(await changePlan(plan.key));
        setCurrent(await fetchSubscription());
      await refreshUser();
      } catch {
        toast.error(t('membership.error.change'));
      } finally {
        setStartingKey(null);
      }
      return;
    }

    setStartingKey(plan.key);
    router.push(`/membership/subscribe?plan=${plan.key}`);
  }

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto">
        <PageHeader title={t('membership.title')} subtitle={t('membership.subtitle')} />

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-content-tertiary" aria-label={t('membership.loading')} />
          </div>
        ) : error ? (
          <ErrorState description={error} onRetry={() => window.location.reload()} />
        ) : (
          <>
            {/* `on_trial` is computed purely from the trial dates, so it stays
                true after someone subscribes — the page was telling a paying
                member they had "22 days left on your trial". A live subscription
                wins, and the countdown now carries the actual date, which is the
                thing people look for. */}
            {/* The owner is not a customer. Kelvin's dashboard counted down a
                trial he was never on and this page invited him to buy the
                software he sells. Staff get a plain statement instead. */}
            {user?.is_admin ? (
              <p className="text-body-sm text-content-secondary text-center mb-5">
                {t('membership.adminPlansNote')}
              </p>
            ) : current?.subscription && ['active', 'trialing', 'past_due'].includes(current.subscription.status) ? (
              <p className="text-body-sm text-content-secondary text-center mb-5">
                {t('membership.youAreOnPlan')} <strong className="text-content-primary">{current.subscription.plan?.name ?? t('membership.aPaidPlan')}</strong>
                {current.subscription.current_period_end && (
                  <> — {current.subscription.cancel_at_period_end ? t('membership.accessEnds') : t('membership.renews')}{' '}
                    {formatDate(current.subscription.current_period_end, locale)}</>
                )}.
              </p>
            ) : current?.on_trial ? (
              <p className="text-body-sm text-content-secondary text-center mb-5">
                {current.trial_days_remaining > 0
                  ? (current.trial_days_remaining === 1
                      ? t('membership.trialLeftOne')
                      : t('membership.trialLeft', { count: current.trial_days_remaining }))
                  : t('membership.trialEndsToday')}
                {current.trial_ends_at && <> — {t('membership.trialEnds')} {formatDate(current.trial_ends_at, locale)}</>}.
              </p>
            ) : null}

            {/* A freshly seeded database has plan rows but no Stripe price ids,
                and /plans deliberately only returns rows that have one — a plan
                nobody can actually be charged for should not be offered. That
                left the page showing a billing toggle with an empty grid under
                it and no reason given, which is how this was first reported.
                Say what is wrong instead. */}
            {plans.length === 0 ? (
              <Alert tone="warning" title={t('membership.noPlansTitle')} className="mt-6">
                {t('membership.noPlansBody')}
              </Alert>
            ) : (
            <>
            <BillingToggle value={billing} onChange={setBilling} savings={annualPlan?.savings ?? null} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
              {visible.map((plan) => (
                <PlanCard
                  key={plan.key}
                  plan={plan}
                  isCurrent={activeKey === plan.key}
                  isRecommended={plan.key === RECOMMENDED_PLAN}
                  busy={startingKey === plan.key}
                  isSwitch={hasLiveSubscription}
                  onChoose={() => choose(plan)}
                />
              ))}
            </div>
            </>
            )}

            {!user?.is_admin && current?.subscription && ['active', 'trialing', 'past_due'].includes(current.subscription.status) && (
              <div className="flex justify-center mt-8">
                {current.subscription.cancel_at_period_end ? (
                  <Button variant="outline" onClick={restartSubscription} loading={changing}>
                    {t('membership.restart')}
                  </Button>
                ) : (
                  <button
                    type="button"
                    onClick={stopSubscription}
                    disabled={changing}
                    className="text-body-sm text-content-tertiary underline underline-offset-4 hover:text-error transition-colors disabled:opacity-50"
                  >
                    {t('membership.cancelYes')}
                  </button>
                )}
              </div>
            )}

            <p className="text-caption text-content-tertiary text-center mt-8">
              {t('membership.pricesNote')}
            </p>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function BillingToggle({
  value,
  onChange,
  savings,
}: {
  value: Billing;
  onChange: (v: Billing) => void;
  savings: Plan['savings'];
}) {
  const { t } = useI18nStore();

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="tablist"
        aria-label={t('membership.billingPeriod')}
        className="inline-flex p-1 rounded-md bg-surface-sunken border border-border-subtle"
      >
        {(['month', 'year'] as const).map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(option)}
              className={[
                'px-4 py-2 text-body-sm font-medium rounded-sm transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                selected
                  ? 'bg-surface-raised text-content-primary'
                  : 'text-content-secondary hover:text-content-primary',
              ].join(' ')}
            >
              {option === 'month' ? t('membership.monthly') : t('membership.annual')}
            </button>
          );
        })}
      </div>

      {/* Height is reserved in both states so switching tabs does not shift the
          cards below. */}
      <p className="text-body-sm text-success min-h-[1.25rem]" aria-live="polite">
        {value === 'year' && savings
          ? `Save ${formatMoney(savings.saved_cents)} a year — ${savings.months_free} months free`
          : ' '}
      </p>
    </div>
  );
}

function PlanCard({
  plan,
  isCurrent,
  isRecommended,
  busy,
  isSwitch,
  onChoose,
}: {
  plan: Plan;
  isCurrent: boolean;
  isRecommended: boolean;
  busy: boolean;
  isSwitch: boolean;
  onChoose: () => void;
}) {
  const { t } = useI18nStore();
  const annual = plan.interval === 'year';

  return (
    <div
      className={[
        'relative flex flex-col rounded-md bg-surface-raised p-5',
        isRecommended ? 'border-2 border-accent' : 'border border-border',
      ].join(' ')}
    >
      {isRecommended && (
        <span className="absolute -top-2.5 left-5 px-2 py-0.5 rounded-sm bg-accent text-white text-caption font-semibold">
          {t('membership.recommended')}
        </span>
      )}

      <h2 className="font-display text-h3 text-content-primary">{plan.name}</h2>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-h1 text-content-primary tabular-nums">
          {formatMoney(annual ? plan.monthly_equivalent_cents : plan.amount_cents)}
        </span>
        <span className="text-body-sm text-content-secondary">{t('membership.perMonth')}</span>
      </div>

      <p className="mt-1 text-body-sm text-content-secondary">
        {annual ? t('membership.billedYearly', { amount: formatMoney(plan.amount_cents) }) : t('membership.billedMonthly')}
      </p>

      {plan.savings && (
        <p className="mt-2 inline-flex self-start px-2 py-0.5 rounded-sm bg-success-surface text-success text-caption font-semibold">
          {plan.savings.months_free} months free vs monthly
        </p>
      )}

      {plan.description && (
        <p className="mt-3 text-body-sm text-content-secondary text-pretty">{plan.description}</p>
      )}

      <ul className="mt-4 space-y-2 flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2 text-body-sm text-content-secondary">
            <Check size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-success" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        className="mt-5"
        fullWidth
        variant={isRecommended ? 'primary' : 'outline'}
        loading={busy}
        disabled={isCurrent || busy}
        onClick={onChoose}
      >
        {/* "Choose" is right for a first purchase and wrong for someone
            already paying — they are switching, not choosing. */}
        {isCurrent ? t('membership.currentPlan') : isSwitch ? t('membership.switchTo', { plan: plan.name }) : t('membership.choosePlan', { plan: plan.name })}
      </Button>
    </div>
  );
}
