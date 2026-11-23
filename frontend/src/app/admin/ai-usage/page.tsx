'use client';

/**
 * Admin > AI Usage.
 *
 * What has been spent this month, on what, by whom, and the controls to cap or
 * stop it.
 *
 * Every money figure on this page is an ESTIMATE calculated from the pricing
 * table in config/ai.php, and the page says so in plain words rather than in a
 * footnote. OpenAI's invoice is the authority. This project has had to strip
 * out confident-looking numbers that came from nowhere before now, and a
 * dashboard that reads "$3.41 spent" without qualification is the same mistake
 * wearing a different hat.
 *
 * English only, matching every other admin screen — the admin panel is the
 * client's own and is not translated. The member-facing AI screens are
 * localised in en/es/fr.
 */

import { useCallback, useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Controls';
import { NumericField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/States';
import { ProgressBar } from '@/components/ui/ProgressBar';
import toast from 'react-hot-toast';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, DollarSign,
  KeyRound, Loader2, Users,
} from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

interface AiSettings {
  ai_enabled: boolean;
  ai_beta_mode: boolean;
  ai_monthly_cap_usd: number;
  ai_daily_limit_per_user: number;
  ai_per_minute_per_user: number;
}

interface AiUsage {
  month: {
    starts_on: string;
    spent_usd: number;
    cap_usd: number;
    /** True when the cap is 0, which switches the cap off entirely. */
    uncapped: boolean;
    /** Null when uncapped — "not applicable", not "nothing left". */
    remaining_usd: number | null;
    percent_used: number | null;
    cap_reached: boolean;
  };
  by_feature: {
    feature: string;
    calls: number;
    ok_calls: number;
    cost_usd: number;
    avg_latency_ms: number | null;
    cost_per_call_usd: number;
  }[];
  by_status: { status: string; calls: number }[];
  top_users: { user_id: number; name: string; email: string | null; calls: number; cost_usd: number }[];
  recent_failures: {
    id: number; feature: string; model: string; status: string;
    latency_ms: number | null; user_id: number | null; created_at: string | null;
  }[];
  settings: AiSettings;
  models: { vision: string; text: string; transcribe: string };
  api_key_present: boolean;
  members_enabled: number;
}

/** `food_analyze_image` -> `Photo` — the stored keys are not reader-facing. */
const FEATURE_LABELS: Record<string, string> = {
  food_analyze_image: 'Photo (Snap)',
  food_analyze_audio: 'Voice (Say)',
  food_analyze_text: 'Text (Type)',
};

const STATUS_LABELS: Record<string, string> = {
  ok: 'Succeeded',
  unavailable: 'Provider unreachable',
  invalid_response: 'Unusable answer',
  blocked: 'Blocked by a guard',
  error: 'Error',
};

/**
 * Four decimal places, because a month of light use costs cents and rounding
 * to two would show "$0.00" next to hundreds of calls.
 *
 * Anything above zero but below the smallest figure four places can show is
 * rendered as "<$0.0001", never as "$0". One text analysis really does cost
 * about $0.00004, and printing that as "$0" told the admin the call was free —
 * which is the kind of confident, wrong number this project has had to remove
 * before. Exact zero still prints as "$0", because that is true.
 */
const money = (n: number) => {
  if (n > 0 && n < 0.0001) return '<$0.0001';

  return `$${n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') || '0'}`;
};

export default function AdminAiUsagePage() {
  const [data, setData] = useState<AiUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Limit fields are held as strings so a half-typed value ("3.") does not get
  // coerced to a number mid-keystroke and fight the user's cursor.
  const [form, setForm] = useState({
    ai_monthly_cap_usd: '',
    ai_daily_limit_per_user: '',
    ai_per_minute_per_user: '',
  });

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/ai-usage');
      const d: AiUsage | undefined = res.data?.data;
      if (!d) throw new Error('empty');
      setData(d);
      setForm({
        ai_monthly_cap_usd: String(d.settings.ai_monthly_cap_usd),
        ai_daily_limit_per_user: String(d.settings.ai_daily_limit_per_user),
        ai_per_minute_per_user: String(d.settings.ai_per_minute_per_user),
      });
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not load AI usage.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** Saves one or more settings, then reloads so the page shows stored truth. */
  const save = async (patch: Partial<AiSettings>, successMessage: string) => {
    setSaving(true);
    try {
      await api.post('/admin/ai-usage/settings', patch);
      toast.success(successMessage);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not save.'));
      // Reload on failure too: leaving a switch showing the value the admin
      // wanted, when the server kept the old one, is a lie about the state of
      // the kill switch.
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex justify-center py-24">
          <Loader2 size={28} className="animate-spin text-accent" />
        </div>
      </DashboardShell>
    );
  }

  if (!data) {
    return (
      <DashboardShell>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <PageHeader title="AI Usage" back="/admin" />
          <Alert tone="error" title="Could not load AI usage">
            The page could not reach the server. Nothing has been changed.
          </Alert>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => { setLoading(true); void load(); }}>
              Try again
            </Button>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const { month, settings } = data;

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <PageHeader
          title="AI Usage"
          subtitle="Estimated cost of photo, voice and text food logging"
          back="/admin"
        />

        {!data.api_key_present && (
          <Alert tone="warning" title="No API key is set" className="mb-4">
            Photo, voice and text logging is switched off for everyone until a key is
            configured in the server environment. Manual logging is unaffected.
          </Alert>
        )}

        {month.cap_reached && (
          <Alert tone="warning" title="The monthly budget has been reached" className="mb-4">
            AI logging is paused for the rest of the month and will resume on the 1st.
            Members can still log food manually. Raise the cap below to resume sooner.
          </Alert>
        )}

        {!settings.ai_enabled && (
          <Alert tone="info" title="AI logging is switched off" className="mb-4">
            Nobody can use photo, voice or text logging while this is off. Everything
            else in the app works normally.
          </Alert>
        )}

        {/* ---------------------------------------------- spend vs cap */}
        <Card className="mb-4">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-content-primary text-sm">This month</h3>
                <p className="text-xs text-content-tertiary">
                  Since {month.starts_on}
                </p>
              </div>
              <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-accent-subtle">
                <DollarSign size={16} className="text-accent" />
              </div>
            </div>

            {/*
              A cap of zero means NO cap — that is what the limit check does
              and what the setting is documented to mean. Printed as numbers it
              said the opposite: "$0.00 of $0.00, $0.00 left" is how a screen
              says "you have run out", above a feature that was spending with
              no ceiling at all. Say it in words instead.
            */}
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-display text-3xl font-bold text-content-primary tabular">
                {money(month.spent_usd)}
              </span>
              <span className={`text-sm tabular ${month.uncapped ? 'text-warning' : 'text-content-secondary'}`}>
                {month.uncapped ? 'with no spending cap set' : `of ${money(month.cap_usd)}`}
              </span>
            </div>

            {!month.uncapped && (
              <div className="mb-3">
                <ProgressBar
                  value={month.spent_usd}
                  max={month.cap_usd}
                  color={month.cap_reached ? 'var(--error)' : 'var(--accent)'}
                />
              </div>
            )}

            <p className="text-xs text-content-tertiary">
              {month.uncapped
                ? 'Nothing will stop this spending. Set a monthly cap below. '
                : `${money(month.remaining_usd ?? 0)} left. `}
              <strong className="text-content-secondary">
                These figures are estimates
              </strong>{' '}
              worked out from published per-token prices, not from OpenAI&apos;s bill.
              Use them to stay inside budget, not for accounting.
            </p>
          </div>
        </Card>

        {/* ---------------------------------------------------- controls */}
        <Card className="mb-4">
          <div className="p-5 space-y-1">
            <h3 className="font-semibold text-content-primary text-sm mb-3">Controls</h3>

            <Switch
              checked={settings.ai_enabled}
              disabled={saving}
              onChange={(v) => save(
                { ai_enabled: v },
                v ? 'AI logging switched on.' : 'AI logging switched off for everyone.',
              )}
              label="AI logging enabled"
              description="Master switch. Off stops every AI call immediately, for every member."
            />

            <div className="h-px bg-border-subtle my-2" />

            <Switch
              checked={settings.ai_beta_mode}
              disabled={saving}
              onChange={(v) => save(
                { ai_beta_mode: v },
                v ? 'Testing mode on — only chosen members have access.'
                  : 'Testing mode off — every member has access.',
              )}
              label="Testing mode"
              description="On: only members you switch on individually can use it. Off: every member can."
            />

            {!settings.ai_beta_mode && (
              <Alert tone="warning" className="mt-3">
                Testing mode is off, so every member can use AI logging. The monthly
                budget is then the only thing limiting total spend.
              </Alert>
            )}

            <div className="h-px bg-border-subtle my-3" />

            <div className="grid gap-3 sm:grid-cols-3">
              <NumericField
                label="Monthly budget"
                value={form.ai_monthly_cap_usd}
                onValueChange={(v) => setForm((p) => ({ ...p, ai_monthly_cap_usd: v }))}
                min={0}
                max={500}
                allowDecimal
                suffix="USD"
                hint="0 means no limit"
              />
              <NumericField
                label="Per member, per day"
                value={form.ai_daily_limit_per_user}
                onValueChange={(v) => setForm((p) => ({ ...p, ai_daily_limit_per_user: v }))}
                min={0}
                max={500}
                allowDecimal={false}
                hint="Successful logs"
              />
              <NumericField
                label="Per member, per minute"
                value={form.ai_per_minute_per_user}
                onValueChange={(v) => setForm((p) => ({ ...p, ai_per_minute_per_user: v }))}
                min={0}
                max={60}
                allowDecimal={false}
                hint="All attempts"
              />
            </div>

            <div className="pt-3">
              <Button
                loading={saving}
                onClick={() => save({
                  ai_monthly_cap_usd: Number(form.ai_monthly_cap_usd || 0),
                  ai_daily_limit_per_user: Number(form.ai_daily_limit_per_user || 0),
                  ai_per_minute_per_user: Number(form.ai_per_minute_per_user || 0),
                }, 'Limits saved.')}
              >
                Save limits
              </Button>
            </div>
          </div>
        </Card>

        {/* -------------------------------------------------- by feature */}
        <Card className="mb-4">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={15} className="text-content-secondary" />
              <h3 className="font-semibold text-content-primary text-sm">By feature</h3>
            </div>
            <p className="text-xs text-content-tertiary mb-4">This month</p>

            {data.by_feature.length === 0 ? (
              <p className="text-sm text-content-tertiary py-6 text-center">
                No AI calls yet this month.
              </p>
            ) : (
              <div className="space-y-3">
                {data.by_feature.map((f) => (
                  <div key={f.feature} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-content-primary truncate">
                        {FEATURE_LABELS[f.feature] ?? f.feature}
                      </div>
                      <div className="text-xs text-content-tertiary tabular">
                        {f.calls} {f.calls === 1 ? 'call' : 'calls'}
                        {f.calls !== f.ok_calls && `, ${f.calls - f.ok_calls} failed`}
                        {f.avg_latency_ms !== null && ` · ${(f.avg_latency_ms / 1000).toFixed(1)}s avg`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm text-content-primary tabular">{money(f.cost_usd)}</div>
                      <div className="text-xs text-content-tertiary tabular">
                        {money(f.cost_per_call_usd)} each
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* ------------------------------------------------ top members */}
        <Card className="mb-4">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Users size={15} className="text-content-secondary" />
              <h3 className="font-semibold text-content-primary text-sm">Heaviest users</h3>
            </div>
            <p className="text-xs text-content-tertiary mb-4">
              By estimated cost, this month. {data.members_enabled} member
              {data.members_enabled === 1 ? '' : 's'} currently switched on.
            </p>

            {data.top_users.length === 0 ? (
              <p className="text-sm text-content-tertiary py-6 text-center">
                Nobody has used it yet.
              </p>
            ) : (
              <div className="space-y-3">
                {data.top_users.map((u) => (
                  <div key={u.user_id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-content-primary truncate">{u.name}</div>
                      {u.email && (
                        <div className="text-xs text-content-tertiary truncate">{u.email}</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm text-content-primary tabular">{money(u.cost_usd)}</div>
                      <div className="text-xs text-content-tertiary tabular">{u.calls} calls</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* -------------------------------------------------- reliability */}
        <Card className="mb-4">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={15} className="text-content-secondary" />
              <h3 className="font-semibold text-content-primary text-sm">Outcomes</h3>
            </div>

            {data.by_status.length === 0 ? (
              <p className="text-sm text-content-tertiary py-2 text-center">Nothing to show.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {data.by_status.map((s) => (
                  <div key={s.status} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-content-secondary truncate">
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                    <span className="text-content-primary tabular shrink-0">{s.calls}</span>
                  </div>
                ))}
              </div>
            )}

            {data.recent_failures.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-2 pt-2 border-t border-border-subtle">
                  <AlertTriangle size={14} className="text-warning" />
                  <h4 className="text-xs font-semibold text-content-secondary">
                    Recent failures
                  </h4>
                </div>
                <div className="space-y-2">
                  {data.recent_failures.slice(0, 8).map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-content-secondary truncate">
                        {FEATURE_LABELS[f.feature] ?? f.feature} — {STATUS_LABELS[f.status] ?? f.status}
                      </span>
                      <span className="text-content-tertiary tabular shrink-0">
                        {f.created_at ? new Date(f.created_at).toLocaleString() : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>

        {/* ------------------------------------------------------ models */}
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound size={15} className="text-content-secondary" />
              <h3 className="font-semibold text-content-primary text-sm">Configuration</h3>
            </div>

            <div className="space-y-2 text-sm">
              {([
                ['Photo model', data.models.vision],
                ['Text model', data.models.text],
                ['Voice model', data.models.transcribe],
              ] as const).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-content-secondary shrink-0">{label}</span>
                  <code className="text-xs text-content-primary truncate">{value}</code>
                </div>
              ))}

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border-subtle">
                <span className="text-content-secondary">API key</span>
                <span className={data.api_key_present ? 'text-success' : 'text-warning'}>
                  {data.api_key_present ? 'Set' : 'Not set'}
                </span>
              </div>
            </div>

            <p className="text-xs text-content-tertiary mt-4">
              Models are set in the server environment, not here, so they can be changed
              without a deploy. The key itself is never shown on this page or sent to the
              browser.
            </p>
          </div>
        </Card>

        <div className="flex items-center gap-2 justify-center text-xs text-content-tertiary mt-6">
          <Clock size={12} />
          <span>Usage records hold no photos, recordings, or food names.</span>
        </div>
      </div>
    </DashboardShell>
  );
}
