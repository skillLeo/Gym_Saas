// `/pure` matters here. The default entry point injects js.stripe.com's 250KB
// script as a SIDE EFFECT OF BEING IMPORTED, and this module is imported by
// SubscriptionGate — which AppShell mounts on every authenticated page. Members
// were therefore downloading and parsing Stripe's payment SDK on the dashboard,
// the food journal, the feed and everywhere else, none of which take payments.
// The `/pure` entry defers injection until loadStripe() is actually called,
// which only happens on the subscribe screen.
import { loadStripe } from '@stripe/stripe-js/pure';
// The type comes from the main entry point; `import type` is erased at compile
// time, so it does not pull the script-injecting module into the bundle.
import type { Stripe } from '@stripe/stripe-js';
import api from './api';

export interface PlanSavings {
  saved_cents: number;
  percent: number;
  months_free: number;
  compared_to_cents: number;
}

export interface Plan {
  key: 'basic' | 'premium' | 'annual_vip';
  name: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  interval: 'month' | 'year';
  monthly_equivalent_cents: number;
  features: string[];
  savings: PlanSavings | null;
}

export type AccountState = 'trial' | 'subscriber' | 'grace' | 'deactivated';

export interface SubscriptionState {
  has_access: boolean;
  /** Authoritative lifecycle state. Distinguishes grace from deactivated. */
  account_state: AccountState;
  /** Legacy mirror of account_state. Kept for older callers; prefer the above. */
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  on_trial: boolean;
  trial_ends_at: string | null;
  trial_days_remaining: number;
  subscription: {
    id: number;
    status: string;
    plan: { key: string; name: string; amount_cents: number; interval: string } | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
}

/** The plan highlighted as recommended on the pricing page. */
export const RECOMMENDED_PLAN: Plan['key'] = 'premium';

export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    // Whole-dollar prices read better without trailing zeros; anything with
    // cents keeps them.
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export async function fetchPlans(): Promise<{
  plans: Plan[];
  publishableKey: string;
  /** Cheapest active monthly plan, for the landing page's entry-price copy. */
  cheapestMonthlyCents: number | null;
  /** Admin-configured trial length, for the "N-day free trial" copy. */
  trialDays: number | null;
}> {
  const { data } = await api.get('/plans');
  return {
    plans: data.data ?? [],
    publishableKey: data.publishable_key ?? '',
    cheapestMonthlyCents: data.cheapest_monthly_cents ?? null,
    trialDays: data.trial_days ?? null,
  };
}

export async function fetchSubscription(): Promise<SubscriptionState> {
  const { data } = await api.get('/subscription');
  return data.data;
}

export async function createSubscription(planKey: Plan['key']): Promise<{
  subscription_id: string;
  client_secret: string;
  plan: { key: string; name: string; amount_cents: number };
}> {
  const { data } = await api.post('/subscription', { plan_key: planKey });
  return data.data;
}

/** Move an existing subscription to a different tier. Stripe prorates. */
export async function changePlan(planKey: Plan['key']): Promise<string> {
  const { data } = await api.post('/subscription/change-plan', { plan_key: planKey });
  return data.message;
}

export async function cancelSubscription(): Promise<string> {
  const { data } = await api.post('/subscription/cancel');
  return data.message;
}

export async function resumeSubscription(): Promise<string> {
  const { data } = await api.post('/subscription/resume');
  return data.message;
}

/**
 * Stripe.js is loaded once per page-load and cached.
 *
 * The publishable key comes from the API rather than a build-time env var so
 * the same bundle works against test and live accounts — and so a key rotation
 * does not require a rebuild.
 */
let stripePromise: Promise<Stripe | null> | null = null;
let cachedKey = '';

export function getStripe(publishableKey: string): Promise<Stripe | null> {
  if (!publishableKey) return Promise.resolve(null);
  if (!stripePromise || cachedKey !== publishableKey) {
    cachedKey = publishableKey;
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}
