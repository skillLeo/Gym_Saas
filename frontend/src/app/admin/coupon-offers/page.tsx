'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Plus, Send, Power, Pencil } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, Alert } from '@/components/ui/States';
import { getErrorMessage } from '@/lib/errors';
import {
  createOffer,
  deleteOffer,
  EMAIL_PLACEHOLDERS,
  fetchOfferStats,
  fetchOffers,
  sendOfferPreview,
  updateOffer,
  type CouponOffer,
  type CouponOfferInput,
  type CouponOfferStats,
} from '@/lib/coupons';

const inputCls =
  'w-full bg-surface-sunken border border-border-strong rounded-md px-3 py-2.5 text-body-sm text-content-primary ' +
  'placeholder:text-content-tertiary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors';

const EMPTY: CouponOfferInput = {
  key: '',
  name: '',
  stage: 1,
  trigger_day_offset: 7,
  expires_after_days: 3,
  discount_type: 'percent',
  discount_value: 20,
  email_subject: '',
  email_body_html: '',
  is_active: true,
};

/**
 * Admin CRUD for trial conversion offers (§4.3).
 *
 * Every figure shown is returned by the API. Where nothing has been sent yet the
 * conversion rate renders as "no data" rather than 0%, because 0% on zero sends
 * is not a fact.
 */
export default function CouponOffersPage() {
  const [offers, setOffers] = useState<CouponOffer[]>([]);
  const [stats, setStats] = useState<CouponOfferStats[]>([]);
  const [maxFixed, setMaxFixed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<CouponOffer | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ offers: list, maxFixedDiscount }, s] = await Promise.all([
        fetchOffers(),
        fetchOfferStats().catch(() => [] as CouponOfferStats[]),
      ]);
      setOffers(list);
      setMaxFixed(maxFixedDiscount);
      setStats(s);
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statsByKey = useMemo(
    () => Object.fromEntries(stats.map((s) => [s.key, s])),
    [stats],
  );

  const open = creating || editing !== null;

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Conversion Offers"
          subtitle="Discounts sent automatically during a member's trial"
          actions={
            <Button size="sm" icon={<Plus size={15} strokeWidth={2} />} onClick={() => setCreating(true)}>
              New
            </Button>
          }
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-content-tertiary" aria-label="Loading offers" />
          </div>
        ) : error ? (
          <ErrorState description={error} onRetry={() => { setLoading(true); void load(); }} />
        ) : offers.length === 0 ? (
          <EmptyState
            title="No offers yet"
            description="Create an offer to start converting trials automatically."
            action={<Button onClick={() => setCreating(true)}>Create an offer</Button>}
          />
        ) : (
          <div className="space-y-4">
            {offers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                stats={statsByKey[offer.key]}
                onEdit={() => setEditing(offer)}
                onChanged={load}
              />
            ))}
          </div>
        )}

        <p className="text-caption text-content-tertiary mt-8 text-pretty">
          Offers are sent by the nightly job, counted from the day a member&apos;s trial starts.
          A member never receives the same offer twice, and never an earlier stage after a later one.
        </p>
      </div>

      <Sheet
        open={open}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? 'Edit offer' : 'New offer'}
      >
        {open && (
          <OfferForm
            initial={editing ? toInput(editing) : EMPTY}
            offerId={editing?.id ?? null}
            maxFixed={maxFixed}
            onDone={async () => {
              setCreating(false);
              setEditing(null);
              await load();
            }}
          />
        )}
      </Sheet>
    </DashboardShell>
  );
}

function toInput(o: CouponOffer): CouponOfferInput {
  return {
    key: o.key,
    name: o.name,
    stage: o.stage,
    trigger_day_offset: o.trigger_day_offset,
    expires_after_days: o.expires_after_days,
    discount_type: o.discount_type,
    discount_value: o.discount_value,
    email_subject: o.email_subject,
    email_body_html: o.email_body_html,
    is_active: o.is_active,
  };
}

function OfferCard({
  offer,
  stats,
  onEdit,
  onChanged,
}: {
  offer: CouponOffer;
  stats?: CouponOfferStats;
  onEdit: () => void;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<'preview' | 'toggle' | null>(null);

  async function preview() {
    setBusy('preview');
    try {
      toast.success(await sendOfferPreview(offer.id));
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function toggle() {
    setBusy('toggle');
    try {
      if (offer.is_active) {
        const { message } = await deleteOffer(offer.id);
        toast.success(message);
      } else {
        await updateOffer(offer.id, { ...toInput(offer), is_active: true });
        toast.success('Offer reactivated.');
      }
      await onChanged();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-md border border-border bg-surface-raised p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-h3 text-content-primary">{offer.name}</h2>
            <Badge variant="neutral" icon={false}>Stage {offer.stage}</Badge>
            <Badge variant={offer.is_active ? 'success' : 'neutral'} icon={false}>
              {offer.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-body-sm text-content-secondary mt-1">
            {offer.discount_label} · sent on day {offer.trigger_day_offset} · expires after{' '}
            {offer.expires_after_days} {offer.expires_after_days === 1 ? 'day' : 'days'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="ghost" icon={<Send size={14} strokeWidth={2} />}
            loading={busy === 'preview'} onClick={preview}>
            Preview
          </Button>
          <Button size="sm" variant="outline" icon={<Pencil size={14} strokeWidth={2} />} onClick={onEdit}>
            Edit
          </Button>
          <Button size="sm" variant={offer.is_active ? 'ghost' : 'outline'}
            icon={<Power size={14} strokeWidth={2} />} loading={busy === 'toggle'} onClick={toggle}>
            {offer.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border-subtle grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Sent" value={stats ? String(stats.sent) : '—'} />
        <Stat label="Redeemed" value={stats ? String(stats.redeemed) : '—'} />
        <Stat label="Expired unused" value={stats ? String(stats.expired_unused) : '—'} />
        <Stat
          label="Conversion"
          // Null means nothing has been sent. Showing 0% there would read as
          // failure when it means "no data yet".
          value={stats?.conversion_rate != null ? `${stats.conversion_rate}%` : 'No data'}
          muted={stats?.conversion_rate == null}
        />
      </div>

      {!offer.stripe_coupon_id && (
        <p className="text-caption text-content-tertiary mt-3">
          The Stripe discount is created the first time this offer is sent.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-caption text-content-tertiary">{label}</p>
      <p className={`font-display text-h3 tabular-nums ${muted ? 'text-content-tertiary' : 'text-content-primary'}`}>
        {value}
      </p>
    </div>
  );
}

function OfferForm({
  initial,
  offerId,
  maxFixed,
  onDone,
}: {
  initial: CouponOfferInput;
  offerId: number | null;
  maxFixed: number;
  onDone: () => Promise<void>;
}) {
  const [form, setForm] = useState<CouponOfferInput>(initial);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);

  const set = <K extends keyof CouponOfferInput>(k: K, v: CouponOfferInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Mirrors the server rule so the admin sees the limit while typing rather
  // than only after a rejected save. The server remains authoritative.
  const discountHint =
    form.discount_type === 'percent'
      ? 'Between 1 and 100.'
      : `Up to $${maxFixed.toFixed(2)} — the cheapest plan price.`;

  const discountTooHigh =
    form.discount_type === 'percent'
      ? Number(form.discount_value) > 100
      : Number(form.discount_value) > maxFixed;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFieldError(null);

    try {
      if (offerId) {
        const { message } = await updateOffer(offerId, form);
        toast.success(message);
      } else {
        await createOffer(form);
        toast.success('Offer created.');
      }
      await onDone();
    } catch (e: unknown) {
      const res = (e as { response?: { data?: { message?: string; field?: string; errors?: Record<string, string[]> } } }).response;
      const firstValidation = res?.data?.errors ? Object.values(res.data.errors)[0]?.[0] : undefined;
      setFieldError({
        field: res?.data?.field,
        message: res?.data?.message ?? firstValidation ?? getErrorMessage(e),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 pb-4">
      {fieldError && <Alert tone="error">{fieldError.message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-body-sm font-medium text-content-secondary mb-1.5">Name</span>
          <input className={inputCls} value={form.name} required maxLength={255}
            onChange={(e) => set('name', e.target.value)} placeholder="Trial conversion — stage 1" />
        </label>

        <label className="block">
          <span className="block text-body-sm font-medium text-content-secondary mb-1.5">Key</span>
          <input className={inputCls} value={form.key} required maxLength={60}
            onChange={(e) => set('key', e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
            placeholder="trial_offer_1" />
          <span className="block text-caption text-content-tertiary mt-1">
            Internal identifier. Letters, numbers, dash and underscore.
          </span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField label="Stage" value={form.stage} min={1} max={10}
          onChange={(v) => set('stage', v)} hint="Order in the funnel." />
        <NumberField label="Send on trial day" value={form.trigger_day_offset} min={0} max={365}
          onChange={(v) => set('trigger_day_offset', v)} hint="Days after the trial starts." />
        <NumberField label="Code valid for" value={form.expires_after_days} min={1} max={90}
          onChange={(v) => set('expires_after_days', v)} hint="Days." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-body-sm font-medium text-content-secondary mb-1.5">Discount type</span>
          <select className={inputCls} value={form.discount_type}
            onChange={(e) => set('discount_type', e.target.value as 'percent' | 'fixed')}>
            <option value="percent">Percentage off</option>
            <option value="fixed">Fixed amount off</option>
          </select>
        </label>

        <label className="block">
          <span className="block text-body-sm font-medium text-content-secondary mb-1.5">
            {form.discount_type === 'percent' ? 'Percentage' : 'Amount (USD)'}
          </span>
          <input
            className={inputCls}
            type="text"
            inputMode="decimal"
            value={form.discount_value}
            required
            // Guarded at the keystroke as well as on submit, per the three-layer
            // rule for numeric inputs.
            onKeyDown={(e) => {
              if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
            }}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '' || /^\d{0,6}(\.\d{0,2})?$/.test(raw)) {
                set('discount_value', raw === '' ? 0 : Number(raw));
              }
            }}
          />
          <span className={`block text-caption mt-1 ${discountTooHigh ? 'text-error' : 'text-content-tertiary'}`}>
            {discountTooHigh
              ? form.discount_type === 'percent'
                ? 'A percentage discount cannot be more than 100%.'
                : `A fixed discount cannot exceed $${maxFixed.toFixed(2)}.`
              : discountHint}
          </span>
        </label>
      </div>

      <label className="block">
        <span className="block text-body-sm font-medium text-content-secondary mb-1.5">Email subject</span>
        <input className={inputCls} value={form.email_subject} required maxLength={255}
          onChange={(e) => set('email_subject', e.target.value)} />
      </label>

      <label className="block">
        <span className="block text-body-sm font-medium text-content-secondary mb-1.5">Email body</span>
        <textarea className={`${inputCls} min-h-56 font-mono text-caption leading-relaxed`}
          value={form.email_body_html} required maxLength={65000}
          onChange={(e) => set('email_body_html', e.target.value)} />
      </label>

      <div className="rounded-md bg-surface-sunken border border-border-subtle p-3">
        <p className="text-caption font-semibold text-content-secondary mb-2">
          Placeholders you can use in the subject and body
        </p>
        <ul className="space-y-1">
          {EMAIL_PLACEHOLDERS.map((p) => (
            <li key={p.token} className="flex gap-2 text-caption text-content-tertiary">
              <code className="text-content-secondary font-mono shrink-0">{p.token}</code>
              <span>{p.description}</span>
            </li>
          ))}
        </ul>
      </div>

      <label className="flex items-center gap-2.5">
        <input type="checkbox" checked={form.is_active}
          onChange={(e) => set('is_active', e.target.checked)}
          className="h-4 w-4 rounded-sm accent-[var(--accent)]" />
        <span className="text-body-sm text-content-secondary">Active — send this offer automatically</span>
      </label>

      {offerId && (
        <p className="text-caption text-content-tertiary">
          Changing the discount does not affect codes already sent. Members keep the rate they were promised.
        </p>
      )}

      <Button type="submit" fullWidth size="lg" loading={saving} disabled={saving || discountTooHigh}>
        {offerId ? 'Save changes' : 'Create offer'}
      </Button>
    </form>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="block text-body-sm font-medium text-content-secondary mb-1.5">{label}</span>
      <input
        className={inputCls}
        type="text"
        inputMode="numeric"
        value={value}
        required
        // Blocks the characters a number input would otherwise accept silently
        // (exponent, sign) before they reach state.
        onKeyDown={(e) => {
          if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
        }}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '' || /^\d{0,3}$/.test(raw)) onChange(raw === '' ? min : Number(raw));
        }}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (Number.isNaN(n) || n < min) onChange(min);
          else if (n > max) onChange(max);
        }}
      />
      {hint && <span className="block text-caption text-content-tertiary mt-1">{hint}</span>}
    </label>
  );
}
