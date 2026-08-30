'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { getErrorMessage } from '@/lib/errors';
import api from '@/lib/api';

interface Schedule {
  id: number;
  title: string;
  description: string | null;
  days_of_week: number[];
  day_labels: string;
  time_of_day: string;
  duration_minutes: number;
  timezone: string;
  auto_create_days_ahead: number;
  is_active: boolean;
  last_generated_through: string | null;
  sessions_count: number | null;
}

interface Upcoming {
  id: number;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
}

const DAYS = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

const inputCls =
  'w-full bg-surface-sunken border border-border-strong rounded-md px-3 py-2.5 text-body-sm text-content-primary ' +
  'placeholder:text-content-tertiary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors';

type FormState = {
  title: string;
  description: string;
  days_of_week: number[];
  time_of_day: string;
  duration_minutes: number;
  timezone: string;
  auto_create_days_ahead: number;
  is_active: boolean;
};

const EMPTY: FormState = {
  title: '', description: '', days_of_week: [1, 3, 5], time_of_day: '19:00',
  duration_minutes: 30, timezone: 'UTC', auto_create_days_ahead: 7, is_active: true,
};

/**
 * Admin management of recurring Vibe Calls (§5.2).
 *
 * Saving generates real live sessions immediately, so the calendar reflects a
 * change without waiting for the hourly job — the upcoming list below is the
 * actual generated output, not a preview.
 */
export default function AdminVibeCallsPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([
        api.get('/admin/vibe-calls'),
        api.get('/admin/vibe-calls/upcoming').catch(() => ({ data: { data: [] } })),
      ]);
      setSchedules(s.data.data ?? []);
      setUpcoming(u.data.data ?? []);
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function stop(schedule: Schedule) {
    try {
      const { data } = await api.delete(`/admin/vibe-calls/${schedule.id}`);
      toast.success(data.message);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto">
        <PageHeader
          title="Vibe Calls"
          subtitle="Recurring calls, generated onto the platform calendar"
          actions={
            <Button size="sm" icon={<Plus size={15} strokeWidth={2} />} onClick={() => setCreating(true)}>
              New
            </Button>
          }
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-content-tertiary" aria-label="Loading schedules" />
          </div>
        ) : error ? (
          <ErrorState description={error} onRetry={() => { setLoading(true); void load(); }} />
        ) : (
          <div className="space-y-4">
            {creating && (
              <ScheduleForm
                initial={EMPTY}
                onCancel={() => setCreating(false)}
                onSaved={async () => { setCreating(false); await load(); }}
              />
            )}

            {schedules.length === 0 && !creating ? (
              <EmptyState title="No Vibe Calls scheduled"
                description="Create a recurring slot and sessions will appear on everyone's calendar." />
            ) : (
              schedules.map((s) => (
                editing?.id === s.id ? (
                  <ScheduleForm
                    key={s.id}
                    schedule={s}
                    initial={{
                      title: s.title, description: s.description ?? '',
                      days_of_week: s.days_of_week, time_of_day: s.time_of_day,
                      duration_minutes: s.duration_minutes, timezone: s.timezone,
                      auto_create_days_ahead: s.auto_create_days_ahead, is_active: s.is_active,
                    }}
                    onCancel={() => setEditing(null)}
                    onSaved={async () => { setEditing(null); await load(); }}
                  />
                ) : (
                  <div key={s.id} className="rounded-md border border-border bg-surface-raised p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-display text-h3 text-content-primary">{s.title}</h2>
                          <Badge variant={s.is_active ? 'success' : 'neutral'} icon={false}>
                            {s.is_active ? 'Active' : 'Stopped'}
                          </Badge>
                        </div>
                        <p className="text-body-sm text-content-secondary mt-1">
                          {s.day_labels} at {s.time_of_day} ({s.timezone}) · {s.duration_minutes} min
                        </p>
                        <p className="text-caption text-content-tertiary mt-1">
                          Generated {s.auto_create_days_ahead} days ahead
                          {s.last_generated_through ? ` · through ${s.last_generated_through}` : ' · not generated yet'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" icon={<Pencil size={14} strokeWidth={2} />}
                          onClick={() => setEditing(s)}>Edit</Button>
                        {s.is_active && (
                          <Button size="sm" variant="ghost" icon={<Trash2 size={14} strokeWidth={2} />}
                            onClick={() => stop(s)}>Stop</Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              ))
            )}

            <div className="pt-2">
              <h3 className="text-body-sm font-semibold text-content-primary mb-2">Upcoming calls</h3>
              {upcoming.length === 0 ? (
                <p className="text-body-sm text-content-tertiary">
                  Nothing scheduled yet. Calls appear here once a schedule generates them.
                </p>
              ) : (
                <div className="space-y-2">
                  {upcoming.slice(0, 10).map((u) => (
                    <div key={u.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-sunken px-3.5 py-2.5">
                      <span className="text-body-sm text-content-primary truncate">{u.title}</span>
                      <span className="text-caption text-content-tertiary shrink-0 tabular-nums">
                        {new Date(u.scheduled_at).toLocaleString(undefined, {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                  {upcoming.length > 10 && (
                    <p className="text-caption text-content-tertiary">
                      and {upcoming.length - 10} more
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function ScheduleForm({
  schedule,
  initial,
  onCancel,
  onSaved,
}: {
  schedule?: Schedule;
  initial: FormState;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleDay = (d: number) =>
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter((x) => x !== d)
        : [...f.days_of_week, d].sort((a, b) => a - b),
    }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.days_of_week.length === 0) { setErr('Choose at least one day.'); return; }

    setSaving(true);
    setErr(null);
    try {
      if (schedule) {
        const { data } = await api.put(`/admin/vibe-calls/${schedule.id}`, form);
        toast.success(data.message ?? 'Saved.');
      } else {
        await api.post('/admin/vibe-calls', form);
        toast.success('Schedule created. Upcoming calls generated.');
      }
      await onSaved();
    } catch (e: unknown) {
      const res = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response;
      const first = res?.data?.errors ? Object.values(res.data.errors)[0]?.[0] : undefined;
      setErr(res?.data?.message ?? first ?? getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-accent bg-surface-raised p-4 space-y-4">
      {err && (
        <p className="text-body-sm text-error bg-error-surface border border-error/25 rounded-sm px-3 py-2">{err}</p>
      )}

      <label className="block">
        <span className="block text-body-sm font-medium text-content-secondary mb-1.5">Title</span>
        <input className={inputCls} value={form.title} required maxLength={255}
          placeholder="Morning Vibe Call"
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      </label>

      <label className="block">
        <span className="block text-body-sm font-medium text-content-secondary mb-1.5">
          Description <span className="text-content-tertiary font-normal">(optional)</span>
        </span>
        <textarea className={`${inputCls} min-h-20`} value={form.description} maxLength={2000}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </label>

      <div>
        <span className="block text-body-sm font-medium text-content-secondary mb-1.5">Days</span>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => {
            const on = form.days_of_week.includes(d.value);
            return (
              <button key={d.value} type="button" onClick={() => toggleDay(d.value)} aria-pressed={on}
                className={[
                  'px-3 py-2 rounded-sm text-caption font-medium border transition-colors min-w-11',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  on ? 'bg-accent text-white border-accent'
                     : 'bg-surface-sunken text-content-secondary border-border-strong',
                ].join(' ')}>
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-body-sm font-medium text-content-secondary mb-1.5">Time</span>
          <input className={inputCls} type="time" value={form.time_of_day} required
            onChange={(e) => setForm((f) => ({ ...f, time_of_day: e.target.value }))} />
        </label>

        <label className="block">
          <span className="block text-body-sm font-medium text-content-secondary mb-1.5">Timezone</span>
          <input className={inputCls} value={form.timezone} required maxLength={64} placeholder="UTC"
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} />
          <span className="block text-caption text-content-tertiary mt-1">
            The time above is in this zone, e.g. UTC or America/New_York.
          </span>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label="Length (minutes)" value={form.duration_minutes} min={5} max={480}
          onChange={(v) => setForm((f) => ({ ...f, duration_minutes: v }))} />
        <NumberField label="Generate days ahead" value={form.auto_create_days_ahead} min={1} max={60}
          onChange={(v) => setForm((f) => ({ ...f, auto_create_days_ahead: v }))} />
      </div>

      <label className="flex items-center gap-2.5">
        <input type="checkbox" checked={form.is_active}
          onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          className="h-4 w-4 rounded-sm accent-[var(--accent)]" />
        <span className="text-body-sm text-content-secondary">Active</span>
      </label>

      {schedule && (
        <p className="text-caption text-content-tertiary">
          Saving reschedules upcoming calls only. Calls that already happened are left alone.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" loading={saving} icon={<Check size={14} strokeWidth={2} />}>Save</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} icon={<X size={14} strokeWidth={2} />}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function NumberField({
  label, value, min, max, onChange,
}: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
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
        // Blocks sign/exponent characters a number input would otherwise accept.
        onKeyDown={(e) => { if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault(); }}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '' || /^\d{0,4}$/.test(raw)) onChange(raw === '' ? min : Number(raw));
        }}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (Number.isNaN(n) || n < min) onChange(min);
          else if (n > max) onChange(max);
        }}
      />
    </label>
  );
}
