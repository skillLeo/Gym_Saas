'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Plus, Send, Trash2, Pencil, Check, X } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert, EmptyState, ErrorState } from '@/components/ui/States';
import { getErrorMessage } from '@/lib/errors';
import {
  createMessage,
  createSchedule,
  DAY_OPTIONS,
  deleteMessage,
  deleteSchedule,
  fetchMotivational,
  sendMessageNow,
  updateMessage,
  updateSchedule,
  type MotivationalMessage,
  type NotificationSchedule,
  type ScheduleInput,
} from '@/lib/motivational';

const inputCls =
  'w-full bg-surface-sunken border border-border-strong rounded-md px-3 py-2.5 text-body-sm text-content-primary ' +
  'placeholder:text-content-tertiary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors';

type Tab = 'messages' | 'schedules';

/**
 * Motivational notifications (§4.4).
 *
 * Wired to the real API. The version this replaced kept everything in local
 * state and picked messages with `Math.random()` — its own copy said "a random
 * active message is sent on each scheduled trigger". Nothing was sent, and the
 * selection approach was the one the brief rules out, because random repeats.
 *
 * Delivery is in-app only. Browser push is deliberately not wired.
 */
export default function AdminNotificationsPage() {
  const [messages, setMessages] = useState<MotivationalMessage[]>([]);
  const [schedules, setSchedules] = useState<NotificationSchedule[]>([]);
  const [recipientCount, setRecipientCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('messages');

  const load = useCallback(async () => {
    try {
      const d = await fetchMotivational();
      setMessages(d.messages);
      setSchedules(d.schedules);
      setRecipientCount(d.recipientCount);
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto">
        <PageHeader
          title="Motivational Notifications"
          subtitle="Sent automatically to active members"
        />

        <Alert tone="info" title="In-app only">
          These appear in members&apos; notification feeds inside the app. Browser push
          notifications are not enabled.
        </Alert>

        <div role="tablist" aria-label="Section"
          className="inline-flex mt-5 p-1 rounded-md bg-surface-sunken border border-border-subtle">
          {(['messages', 'schedules'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={[
                'px-4 py-2 text-body-sm font-medium rounded-sm transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                tab === t ? 'bg-surface-raised text-content-primary' : 'text-content-secondary hover:text-content-primary',
              ].join(' ')}>
              {t === 'messages' ? 'Messages' : 'Schedules'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-content-tertiary" aria-label="Loading" />
          </div>
        ) : error ? (
          <div className="mt-5">
            <ErrorState description={error} onRetry={() => { setLoading(true); void load(); }} />
          </div>
        ) : tab === 'messages' ? (
          <MessagesTab messages={messages} recipientCount={recipientCount} onChanged={load} />
        ) : (
          <SchedulesTab schedules={schedules} onChanged={load} />
        )}
      </div>
    </DashboardShell>
  );
}

function MessagesTab({
  messages,
  recipientCount,
  onChanged,
}: {
  messages: MotivationalMessage[];
  recipientCount: number;
  onChanged: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-content-secondary">
          {messages.length} in the pool · {recipientCount} {recipientCount === 1 ? 'member' : 'members'} will receive them
        </p>
        <Button size="sm" icon={<Plus size={15} strokeWidth={2} />} onClick={() => setAdding(true)}>
          Add message
        </Button>
      </div>

      <p className="text-caption text-content-tertiary text-pretty">
        Messages rotate least-recently-sent first, so the whole pool is used before any
        message repeats. A newly added message goes out next.
      </p>

      {adding && (
        <MessageEditor
          initial={{ title: '', body: '', is_active: true }}
          onCancel={() => setAdding(false)}
          onSave={async (v) => {
            await createMessage({ title: v.title || null, body: v.body, is_active: v.is_active });
            setAdding(false);
            await onChanged();
            toast.success('Message added.');
          }}
        />
      )}

      {messages.length === 0 && !adding ? (
        <EmptyState title="No messages yet"
          description="Add a message so scheduled notifications have something to send." />
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <MessageRow key={m.id} message={m} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}

function MessageRow({
  message,
  onChanged,
}: {
  message: MotivationalMessage;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'send' | 'delete' | 'toggle' | null>(null);

  async function run(kind: 'send' | 'delete' | 'toggle', fn: () => Promise<string | void>) {
    setBusy(kind);
    try {
      const msg = await fn();
      if (typeof msg === 'string') toast.success(msg);
      await onChanged();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (editing) {
    return (
      <MessageEditor
        initial={{ title: message.title ?? '', body: message.body, is_active: message.is_active }}
        onCancel={() => setEditing(false)}
        onSave={async (v) => {
          await updateMessage(message.id, { title: v.title || null, body: v.body, is_active: v.is_active });
          setEditing(false);
          await onChanged();
          toast.success('Message saved.');
        }}
      />
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {message.title && (
              <p className="font-semibold text-body-sm text-content-primary">{message.title}</p>
            )}
            {message.is_next && message.is_active && (
              <Badge variant="info" icon={false}>Next to send</Badge>
            )}
            {!message.is_active && <Badge variant="neutral" icon={false}>Inactive</Badge>}
          </div>
          <p className="text-body-sm text-content-secondary mt-1 text-pretty">{message.body}</p>
          <p className="text-caption text-content-tertiary mt-2">
            {message.send_count === 0
              ? 'Never sent'
              : `Sent ${message.send_count} ${message.send_count === 1 ? 'time' : 'times'}` +
                (message.last_sent_at ? ` · last ${new Date(message.last_sent_at).toLocaleDateString()}` : '')}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" icon={<Send size={14} strokeWidth={2} />}
            loading={busy === 'send'} disabled={!message.is_active}
            onClick={() => run('send', () => sendMessageNow(message.id))}>
            Send now
          </Button>
          <Button size="sm" variant="ghost" icon={<Pencil size={14} strokeWidth={2} />}
            onClick={() => setEditing(true)} aria-label="Edit message">
            Edit
          </Button>
          <Button size="sm" variant="ghost" icon={<Trash2 size={14} strokeWidth={2} />}
            loading={busy === 'delete'}
            onClick={() => run('delete', () => deleteMessage(message.id))} aria-label="Delete message">
            Delete
          </Button>
        </div>
      </div>

      <label className="flex items-center gap-2 mt-3 pt-3 border-t border-border-subtle">
        <input type="checkbox" checked={message.is_active}
          disabled={busy === 'toggle'}
          onChange={(e) =>
            run('toggle', () =>
              updateMessage(message.id, {
                title: message.title, body: message.body, is_active: e.target.checked,
              }).then(() => undefined))}
          className="h-4 w-4 rounded-sm accent-[var(--accent)]" />
        <span className="text-caption text-content-secondary">Include in the rotation</span>
      </label>
    </div>
  );
}

function MessageEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: { title: string; body: string; is_active: boolean };
  onCancel: () => void;
  onSave: (v: { title: string; body: string; is_active: boolean }) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const remaining = 500 - form.body.length;

  return (
    <form
      className="rounded-md border border-accent bg-surface-raised p-4 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await onSave(form);
        } catch (err) {
          toast.error(getErrorMessage(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className="block">
        <span className="block text-body-sm font-medium text-content-secondary mb-1.5">
          Title <span className="text-content-tertiary font-normal">(optional)</span>
        </span>
        <input className={inputCls} value={form.title} maxLength={255}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      </label>

      <label className="block">
        <span className="block text-body-sm font-medium text-content-secondary mb-1.5">Message</span>
        <textarea className={`${inputCls} min-h-24`} value={form.body} required maxLength={500}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
        <span className={`block text-caption mt-1 ${remaining < 0 ? 'text-error' : 'text-content-tertiary'}`}>
          {remaining} characters left
        </span>
      </label>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" loading={saving} icon={<Check size={14} strokeWidth={2} />}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}
          icon={<X size={14} strokeWidth={2} />}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function SchedulesTab({
  schedules,
  onChanged,
}: {
  schedules: NotificationSchedule[];
  onChanged: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-sm text-content-secondary">
          {schedules.length} {schedules.length === 1 ? 'schedule' : 'schedules'}
        </p>
        <Button size="sm" icon={<Plus size={15} strokeWidth={2} />} onClick={() => setAdding(true)}>
          Add schedule
        </Button>
      </div>

      {adding && (
        <ScheduleEditor
          initial={{ name: '', days_of_week: [1, 3, 5], send_time: '09:00', timezone: 'UTC', is_active: true }}
          onCancel={() => setAdding(false)}
          onSave={async (v) => { await createSchedule(v); setAdding(false); await onChanged(); toast.success('Schedule added.'); }}
        />
      )}

      {schedules.length === 0 && !adding ? (
        <EmptyState title="No schedules"
          description="Add a schedule to send motivational messages automatically." />
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => <ScheduleRow key={s.id} schedule={s} onChanged={onChanged} />)}
        </div>
      )}
    </div>
  );
}

function ScheduleRow({
  schedule,
  onChanged,
}: {
  schedule: NotificationSchedule;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (editing) {
    return (
      <ScheduleEditor
        initial={{
          name: schedule.name, days_of_week: schedule.days_of_week,
          send_time: schedule.send_time, timezone: schedule.timezone, is_active: schedule.is_active,
        }}
        onCancel={() => setEditing(false)}
        onSave={async (v) => { await updateSchedule(schedule.id, v); setEditing(false); await onChanged(); toast.success('Schedule saved.'); }}
      />
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-body-sm text-content-primary">{schedule.name}</p>
            <Badge variant={schedule.is_active ? 'success' : 'neutral'} icon={false}>
              {schedule.is_active ? 'Active' : 'Paused'}
            </Badge>
          </div>
          <p className="text-body-sm text-content-secondary mt-1">
            {schedule.day_labels} at {schedule.send_time} ({schedule.timezone})
          </p>
          <p className="text-caption text-content-tertiary mt-1">
            {schedule.last_run_at
              ? `Last ran ${new Date(schedule.last_run_at).toLocaleString()}`
              : 'Has not run yet'}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" icon={<Pencil size={14} strokeWidth={2} />}
            onClick={() => setEditing(true)}>Edit</Button>
          <Button size="sm" variant="ghost" icon={<Trash2 size={14} strokeWidth={2} />} loading={busy}
            onClick={async () => {
              setBusy(true);
              try { toast.success(await deleteSchedule(schedule.id)); await onChanged(); }
              catch (e) { toast.error(getErrorMessage(e)); }
              finally { setBusy(false); }
            }}>Delete</Button>
        </div>
      </div>
    </div>
  );
}

function ScheduleEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: ScheduleInput;
  onCancel: () => void;
  onSave: (v: ScheduleInput) => Promise<void>;
}) {
  const [form, setForm] = useState<ScheduleInput>(initial);
  const [saving, setSaving] = useState(false);

  const toggleDay = (d: number) =>
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter((x) => x !== d)
        : [...f.days_of_week, d].sort((a, b) => a - b),
    }));

  return (
    <form
      className="rounded-md border border-accent bg-surface-raised p-4 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (form.days_of_week.length === 0) { toast.error('Choose at least one day.'); return; }
        setSaving(true);
        try { await onSave(form); }
        catch (err) { toast.error(getErrorMessage(err)); }
        finally { setSaving(false); }
      }}
    >
      <label className="block">
        <span className="block text-body-sm font-medium text-content-secondary mb-1.5">Name</span>
        <input className={inputCls} value={form.name} required maxLength={255}
          placeholder="Weekday mornings"
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </label>

      <div>
        <span className="block text-body-sm font-medium text-content-secondary mb-1.5">Days</span>
        <div className="flex flex-wrap gap-1.5">
          {DAY_OPTIONS.map((d) => {
            const on = form.days_of_week.includes(d.value);
            return (
              <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                aria-pressed={on}
                className={[
                  'px-3 py-2 rounded-sm text-caption font-medium border transition-colors min-w-11',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  on ? 'bg-accent text-white border-accent' : 'bg-surface-sunken text-content-secondary border-border-strong',
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
          <input className={inputCls} type="time" value={form.send_time} required
            onChange={(e) => setForm((f) => ({ ...f, send_time: e.target.value }))} />
        </label>

        <label className="block">
          <span className="block text-body-sm font-medium text-content-secondary mb-1.5">Timezone</span>
          <input className={inputCls} value={form.timezone} required maxLength={64}
            placeholder="UTC"
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} />
          <span className="block text-caption text-content-tertiary mt-1">
            e.g. UTC, America/New_York. The time above is in this zone.
          </span>
        </label>
      </div>

      <label className="flex items-center gap-2.5">
        <input type="checkbox" checked={form.is_active}
          onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          className="h-4 w-4 rounded-sm accent-[var(--accent)]" />
        <span className="text-body-sm text-content-secondary">Active</span>
      </label>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" loading={saving} icon={<Check size={14} strokeWidth={2} />}>Save</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} icon={<X size={14} strokeWidth={2} />}>Cancel</Button>
      </div>
    </form>
  );
}
