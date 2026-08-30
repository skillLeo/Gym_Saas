'use client';

import { useState, useEffect } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { ChartTooltip } from '@/components/ui/ChartTooltip';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Scale, TrendingDown, Plus, Camera, Activity, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { getErrorMessage } from '@/lib/errors';

interface StatPoint {
  date: string; weight: number; bodyFat: number; waist: number;
  hips: number; chest: number; arms: number; thighs: number;
}

type ActiveMetric = 'weight' | 'bodyFat' | 'waist' | 'hips' | 'chest' | 'arms' | 'thighs';

export default function BodyStatsPage() {
  const { t } = useI18nStore();
  const [stats, setStats] = useState<StatPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<ActiveMetric>('weight');
  const [showLogModal, setShowLogModal] = useState(false);
  const [logValues, setLogValues] = useState({ weight: '', bodyFat: '', waist: '', hips: '', chest: '', arms: '', thighs: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const loadStats = async () => {
    try {
      const res = await api.get('/body-stats', { params: { limit: 12 } });
      const raw: any[] = res.data.data ?? [];
      setStats(raw.map(s => {
        const dateStr = s.logged_date ? s.logged_date.toString().slice(0, 10) : '';
        return {
          date:    dateStr ? format(new Date(`${dateStr}T00:00:00`), 'MMM d') : '',
          weight:  parseFloat(s.weight_lbs)     || 0,
          bodyFat: parseFloat(s.body_fat_pct)   || 0,
          waist:   parseFloat(s.waist_inches)   || 0,
          hips:    parseFloat(s.hips_inches)    || 0,
          chest:   parseFloat(s.chest_inches)   || 0,
          arms:    parseFloat(s.arms_inches)    || 0,
          thighs:  parseFloat(s.thighs_inches)  || 0,
        };
      }));
    } catch {
      toast.error(t('bodyStats.error.load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  const saveStats = async () => {
    const { weight, bodyFat, waist, hips, chest, arms, thighs } = logValues;
    if (!weight && !bodyFat && !waist && !hips && !chest && !arms && !thighs) {
      toast.error(t('bodyStats.needOne'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/body-stats', {
        logged_date:    format(new Date(), 'yyyy-MM-dd'),
        weight_lbs:     weight  ? parseFloat(weight)  : null,
        body_fat_pct:   bodyFat ? parseFloat(bodyFat) : null,
        waist_inches:   waist   ? parseFloat(waist)   : null,
        hips_inches:    hips    ? parseFloat(hips)    : null,
        chest_inches:   chest   ? parseFloat(chest)   : null,
        arms_inches:    arms    ? parseFloat(arms)    : null,
        thighs_inches:  thighs  ? parseFloat(thighs)  : null,
        notes:          logValues.notes || null,
      });
      toast.success(t('bodyStats.saved'));
      setShowLogModal(false);
      setLogValues({ weight: '', bodyFat: '', waist: '', hips: '', chest: '', arms: '', thighs: '', notes: '' });
      await loadStats();
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('bodyStats.error.save')));
    } finally {
      setSaving(false);
    }
  };

  const latest = stats[stats.length - 1];
  const first  = stats[0];

  const metricConfig: Record<ActiveMetric, { label: string; unit: string; color: string }> = {
    weight:  { label: t('bodyStats.weight'),   unit: 'lbs', color: '#F87404' },
    bodyFat: { label: t('bodyStats.bodyFat'), unit: '%',   color: '#7C3AED' },
    waist:   { label: t('bodyStats.waist'),    unit: '"',   color: '#004AAD' },
    chest:   { label: t('bodyStats.chest'),    unit: '"',   color: '#10B981' },
    hips:    { label: t('bodyStats.hips'),     unit: '"',   color: '#DB2777' },
    arms:    { label: t('bodyStats.arms'),     unit: '"',   color: '#FFC000' },
    thighs:  { label: t('bodyStats.thighs'),   unit: '"',   color: '#0000FF' },
  };

  const fmtChange = (curr: number, prev: number, lowerBetter = false) => {
    if (!curr || !prev) return '—';
    const diff = curr - prev;
    const sign = diff > 0 ? '+' : '';
    const positive = lowerBetter ? diff < 0 : diff < 0;
    return { text: `${sign}${diff.toFixed(1)}`, positive };
  };

  const weightChng = latest && first && latest !== first ? fmtChange(latest.weight, first.weight) : null;
  const fatChng    = latest && first && latest !== first ? fmtChange(latest.bodyFat, first.bodyFat, true) : null;
  const waistChng  = latest && first && latest !== first ? fmtChange(latest.waist, first.waist, true) : null;

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        <PageHeader
        title={t('bodyStats.title')}
        subtitle={t('bodyStats.subtitle')}
        back="/fitness"
        actions={<Button size="sm" icon={<Plus size={15} />} onClick={() => setShowLogModal(true)}>{t('bodyStats.logStats')}</Button>}
      />

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-accent" />
          </div>
        ) : (
          <>
            {/* Key Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                {
                  label: t('bodyStats.weight'), val: latest?.weight ? `${latest.weight} lbs` : '—',
                  change: weightChng, icon: Scale, color: '#F87404',
                },
                {
                  label: t('bodyStats.bodyFat'), val: latest?.bodyFat ? `${latest.bodyFat}%` : '—',
                  change: fatChng, icon: Activity, color: '#7C3AED',
                },
                {
                  label: t('bodyStats.waist'), val: latest?.waist ? `${latest.waist}"` : '—',
                  change: waistChng, icon: TrendingDown, color: '#004AAD',
                },
              ].map(({ label, val, change, icon: Icon, color }) => (
                <Card key={label} padding="sm">
                  <div className="p-3.5 text-center">
                    <Icon size={16} className="mx-auto mb-1.5" style={{ color }} />
                    <div className="font-bold text-content-primary text-lg">{val}</div>
                    <div className="text-xs text-content-tertiary">{label}</div>
                    {change && typeof change === 'object' && (
                      <div className={`text-xs font-medium mt-1 ${change.positive ? 'text-green-500' : 'text-red-500'}`}>{change.text}</div>
                    )}
                    {change === null && <div className="text-xs text-content-tertiary mt-1">—</div>}
                  </div>
                </Card>
              ))}
            </div>

            {/* Chart */}
            {stats.length > 0 ? (
              <Card className="mb-5">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4 gap-3">
                    <h3 className="font-semibold text-content-primary text-sm shrink-0">{t('bodyStats.chart')}</h3>
                    <div className="flex gap-1 overflow-x-auto">
                      {(Object.entries(metricConfig) as [ActiveMetric, typeof metricConfig[ActiveMetric]][]).map(([key, cfg]) => (
                        <button key={key} onClick={() => setActiveMetric(key)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${activeMetric === key ? 'text-white' : 'text-content-secondary bg-gray-100 dark:bg-white/[0.07]'}`}
                          style={{ backgroundColor: activeMetric === key ? cfg.color : undefined }}>
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} domain={['auto', 'auto']} />
                        {/* Element (not a new component type) — props vary, type is stable. */}
                        <Tooltip
                          content={
                            <ChartTooltip
                              seriesLabel={metricConfig[activeMetric].label}
                              unit={metricConfig[activeMetric].unit}
                              color={metricConfig[activeMetric].color}
                            />
                          }
                        />
                        <Line
                          type="monotone" dataKey={activeMetric}
                          stroke={metricConfig[activeMetric].color} strokeWidth={2.5}
                          dot={{ r: 4, fill: metricConfig[activeMetric].color, strokeWidth: 0 }}
                          activeDot={{ r: 6 }} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="mb-5">
                <div className="flex flex-col items-center justify-center py-12">
                  <Scale size={32} className="text-content-tertiary dark:text-content-secondary mb-3" />
                  <p className="text-sm text-content-tertiary">{t('bodyStats.empty')}</p>
                  <button onClick={() => setShowLogModal(true)}
                    className="mt-3 text-xs font-semibold text-accent hover:underline">{t('bodyStats.logStats')}</button>
                </div>
              </Card>
            )}

            {/* Progress Photos Prompt */}
            <div className="flex items-center gap-4 bg-[#EFF6FF] dark:bg-[#004AAD]/10 border border-[#004AAD]/20 rounded-md p-4 mb-5">
              <div className="w-12 h-12 rounded-md bg-[#004AAD] flex items-center justify-center shrink-0">
                <Camera size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-content-primary text-sm">{t('bodyStats.photos')}</div>
                <div className="text-xs text-content-secondary">{t('bodyStats.photosHint')}</div>
              </div>
              <Button size="sm" variant="outline">{t('common.upload')}</Button>
            </div>

            {/* Measurements (real data) */}
            <Card>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-content-primary text-sm">{t('bodyStats.measurements')}</h3>
                  <span className="text-xs text-content-tertiary">{t('bodyStats.inches')}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: 'chest',  label: t('bodyStats.chest') },
                    { key: 'waist',  label: t('bodyStats.waist') },
                    { key: 'hips',   label: t('bodyStats.hips') },
                    { key: 'thighs', label: t('bodyStats.thighs') },
                    { key: 'arms',   label: t('bodyStats.arms') },
                  ] as const).map(({ key, label }) => {
                    const curr = latest?.[key] ?? 0;
                    const prev = first?.[key] ?? 0;
                    const chng = latest && first && latest !== first ? fmtChange(curr, prev, true) : null;
                    return (
                      <div key={label} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/[0.04] rounded-md">
                        <div>
                          <div className="text-xs text-content-secondary">{label}</div>
                          <div className="font-semibold text-content-primary text-sm">{curr ? `${curr}"` : '—'}</div>
                        </div>
                        {chng && typeof chng === 'object' ? (
                          <span className={`text-xs font-bold ${chng.positive ? 'text-green-500' : 'text-accent'}`}>{chng.text}</span>
                        ) : (
                          <span className="text-xs font-bold text-content-tertiary">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </>
        )}

        {/* Log Stats Modal */}
        {showLogModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogModal(false)} />
            <div className="relative w-full sm:max-w-md bg-surface-raised rounded-t-3xl sm:rounded-md p-6 z-10 border border-border-subtle">
              <h3 className="font-display text-xl font-bold text-content-primary mb-5">{t('bodyStats.logToday')}</h3>
              <div className="space-y-4 mb-5">
                {[
                  { key: 'weight',  label: t('common.weightLbs'),    placeholder: '185' },
                  { key: 'bodyFat', label: t('bodyStats.bodyFatPct'),    placeholder: '18.5' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-content-secondary mb-1.5 block">{label}</label>
                    <input type="number" step="0.1" min={0} placeholder={placeholder}
                      value={(logValues as any)[key]}
                      onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setLogValues(prev => ({ ...prev, [key]: v })); }}
                      onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                      className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                  </div>
                ))}
                <div>
                  <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('bodyStats.measureInches')}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'chest',  placeholder: t('bodyStats.chest') },
                      { key: 'waist',  placeholder: t('bodyStats.waist') },
                      { key: 'hips',   placeholder: t('bodyStats.hips') },
                      { key: 'thighs', placeholder: t('bodyStats.thighs') },
                      { key: 'arms',   placeholder: t('bodyStats.arms') },
                    ].map(({ key, placeholder }) => (
                      <input key={key} type="number" step="0.1" min={0} placeholder={placeholder}
                        value={(logValues as any)[key]}
                        onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setLogValues(prev => ({ ...prev, [key]: v })); }}
                        onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('common.notes')}</label>
                  <textarea rows={2} placeholder={t('bodyStats.feeling')} maxLength={500}
                    value={logValues.notes}
                    onChange={e => setLogValues(v => ({ ...v, notes: e.target.value }))}
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 resize-none" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" fullWidth onClick={() => setShowLogModal(false)}>{t('common.cancel')}</Button>
                <Button fullWidth onClick={saveStats} loading={saving}>{t('bodyStats.saveStats')}</Button>
              </div>
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
