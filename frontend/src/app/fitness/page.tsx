'use client';

import { useState, useEffect } from 'react';
import { formatDate, formatNumber, weekdayNames } from '@/lib/format';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Plus, Dumbbell, Flame, Clock, Check, TrendingUp,
  Activity, Target, Trophy, BarChart2, ChevronRight,
  Zap, Bike, PersonStanding, Footprints, Loader2
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import Link from 'next/link';
import api from '@/lib/api';



// Module scope cannot call t() — it runs before any component mounts. The label
// is held as a dictionary key and resolved at render time instead.
const quickNav = [
  { icon: Target,    labelKey: 'fitness.goals',     bg: '#F87404', href: '/fitness/goals' },
  { icon: BarChart2, labelKey: 'fitness.history',   bg: '#004AAD', href: '/fitness/history' },
  { icon: TrendingUp,labelKey: 'fitness.bodyStats', bg: '#10B981', href: '/fitness/body-stats' },
  { icon: Trophy,    labelKey: 'fitness.streak',    bg: '#FACC15', href: '/fitness/streak' },
];

interface WeekSummary { workouts: number; minutes: number; calories: number; week_activity: boolean[] }
interface WorkoutLog {
  id: number; exercise_name: string; category: string;
  duration_minutes: number | null; calories_burned: number | null; logged_date: string;
}
interface BodyStatPoint { date: string; weight: number }

const DEFAULT_SUMMARY: WeekSummary = { workouts: 0, minutes: 0, calories: 0, week_activity: [false,false,false,false,false,false,false] };

export default function FitnessPage() {
  // Dates and numbers follow the chosen language, not just the labels.
  const { locale, t } = useI18nStore();
  // Monday-first, in the member's language.
  const DAYS = weekdayNames(locale, 'short').slice(1).concat(weekdayNames(locale, 'short')[0]);
  const [tab, setTab] = useState<'log' | 'quick'>('log');
  const [steps, setSteps] = useState(0);
  const [stepsGoal, setStepsGoal] = useState(10000);
  const [stepsInput, setStepsInput] = useState('');
  const [showStepsInput, setShowStepsInput] = useState(false);
  const [stepsSaving, setStepsSaving] = useState(false);

  const [summary, setSummary] = useState<WeekSummary>(DEFAULT_SUMMARY);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutLog[]>([]);
  // The member's full history, used to work out what they actually repeat.
  const [allWorkouts, setAllWorkouts] = useState<WorkoutLog[]>([]);
  const [bodyStats, setBodyStats] = useState<BodyStatPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [sumRes, logsRes, statsRes, stepsRes] = await Promise.all([
          api.get('/fitness-logs/summary'),
          api.get('/fitness-logs', { params: { per_page: 100 } }),
          api.get('/body-stats', { params: { limit: 12 } }),
          api.get('/daily-steps'),
        ]);
        setSummary(sumRes.data.data ?? DEFAULT_SUMMARY);
        const allLogs: WorkoutLog[] = logsRes.data.data?.data ?? [];
        setRecentWorkouts(allLogs.slice(0, 5));
        setAllWorkouts(allLogs);
        setSteps(stepsRes.data.data?.steps ?? 0);
        setStepsGoal(stepsRes.data.data?.goal ?? 10000);
        const rawStats: any[] = statsRes.data.data ?? [];
        setBodyStats(rawStats.map(s => ({
          date:   s.logged_date?.slice(5) ?? s.logged_date,
          weight: parseFloat(s.weight_lbs) || 0
        })).filter(s => s.weight > 0));
      } catch (_) {
        // silently leave defaults
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const TYPE_STYLE: Record<string, { color: string; variant: 'red' | 'blue' | 'orange' | 'purple' | 'pink' | 'green'; icon: typeof Dumbbell }> = {
    Strength:    { color: '#FF0404', variant: 'red',    icon: Dumbbell },
    Cardio:      { color: '#004AAD', variant: 'blue',   icon: Activity },
    HIIT:        { color: '#FF5C04', variant: 'orange', icon: Zap },
    Yoga:        { color: '#7C3AED', variant: 'purple', icon: PersonStanding },
    Pilates:     { color: '#EC4899', variant: 'pink',   icon: PersonStanding },
    Flexibility: { color: '#10B981', variant: 'green',  icon: PersonStanding }
  };
  const getTypeColor = (type: string) => TYPE_STYLE[type]?.color ?? '#6B7280';
  const getTypeVariant = (type: string) => TYPE_STYLE[type]?.variant ?? 'blue';
  const getTypeIcon = (type: string) => TYPE_STYLE[type]?.icon ?? Dumbbell;

  const formatDayLabel = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return t('fitness.today');
    if (dateStr === yesterday) return t('fitness.yesterday');
    return formatDate(new Date(dateStr), locale, { month: 'short', day: 'numeric' });
  };

  /**
   * What this member actually repeats, from their own logs.
   *
   * This tab used to list four invented workouts — "Upper Body Blast, 45 min,
   * Intermediate" and friends — that existed nowhere in the database and led to
   * an empty form. Now it is the exercises they have logged most, with their own
   * typical duration and calories, so tapping one is genuinely "do that again".
   * Averages are rounded from real logged values; nothing here is made up.
   */
  const repeatWorkouts = (() => {
    const byName = new Map<string, { name: string; category: string; count: number; mins: number[]; kcal: number[] }>();

    for (const w of allWorkouts) {
      const key = w.exercise_name?.trim();
      if (!key) continue;
      const entry = byName.get(key) ?? { name: key, category: w.category, count: 0, mins: [], kcal: [] };
      entry.count += 1;
      if (w.duration_minutes) entry.mins.push(w.duration_minutes);
      if (w.calories_burned) entry.kcal.push(w.calories_burned);
      byName.set(key, entry);
    }

    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

    return [...byName.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map((e) => ({ ...e, avgMins: avg(e.mins), avgKcal: avg(e.kcal) }));
  })();

  const stepsPercent = Math.min((steps / stepsGoal) * 100, 100);

  const handleStepsUpdate = async () => {
    const val = parseInt(stepsInput);
    if (isNaN(val) || val < 0) { setShowStepsInput(false); setStepsInput(''); return; }
    setStepsSaving(true);
    try {
      const res = await api.put('/daily-steps', { steps: val });
      setSteps(res.data.data?.steps ?? val);
    } finally {
      setStepsSaving(false);
      setShowStepsInput(false);
      setStepsInput('');
    }
  };

  return (
    <DashboardShell>
      <PageHeader
        title={t('fitness.title')}
        subtitle={t('fitness.weekGlance')}
        actions={
          <Link href="/fitness/log-workout" aria-label={t('fitness.logWorkout')}>
            <span className="h-11 w-11 rounded-sm flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition-colors">
              <Plus size={20} strokeWidth={2} />
            </span>
          </Link>
        }
      />
      <div className="space-y-6 max-w-3xl mx-auto pt-1">

        {/* This Week */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={22} className="animate-spin text-accent" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-content-primary">{t('fitness.thisWeek')}</h2>
                <span className="text-sm font-medium text-accent">
                  {t('fitness.daysActive', { done: summary.week_activity.filter(Boolean).length })}
                </span>
              </div>
              <div className="flex justify-between mb-6">
                {DAYS.map((day, i) => (
                  <div key={day} className="flex flex-col items-center gap-1.5">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${summary.week_activity[i] ? 'bg-accent text-white' : 'bg-surface-sunken text-content-tertiary'}`}>
                      {summary.week_activity[i] ? <Check size={16} /> : day[0]}
                    </div>
                    <span className="text-[10px] text-content-secondary">{day}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border-subtle">
                {[
                  { icon: Dumbbell, value: summary.workouts, label: t('fitness.workouts'), color: '#F87404' },
                  { icon: Clock,    value: summary.minutes,  label: t('fitness.minutes'),  color: '#004AAD' },
                  { icon: Flame,    value: formatNumber(summary.calories, locale), label: t('fitness.calories'), color: '#FF0404' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="flex justify-center mb-1">
                      <s.icon size={18} style={{ color: s.color }} />
                    </div>
                    <p className="text-xl font-black text-content-primary">{s.value}</p>
                    <p className="text-xs text-content-secondary">{s.label}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Steps Tracker */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-md bg-[#10B981]/10 flex items-center justify-center">
                <Footprints size={18} className="text-[#10B981]" />
              </div>
              <div>
                <h2 className="font-semibold text-content-primary text-sm">{t('fitness.dailySteps')}</h2>
                <p className="text-xs text-content-tertiary">{t('fitness.steps.goal', { count: formatNumber(stepsGoal, locale) })}</p>
              </div>
            </div>
            <button onClick={() => setShowStepsInput(v => !v)}
              className="text-xs font-semibold text-accent bg-accent-surface px-3 py-1.5 rounded-lg hover:bg-accent hover:text-white transition-all">
              {t('fitness.update')}
            </button>
          </div>

          <div className="flex items-end gap-4 mb-4">
            <div>
              <span className="font-display text-4xl font-black text-content-primary">{formatNumber(steps, locale)}</span>
              <span className="text-content-tertiary text-sm ml-2">{t('fitness.stepsUnit')}</span>
            </div>
            <div className="mb-1 text-sm font-semibold" style={{ color: stepsPercent >= 100 ? '#10B981' : '#F87404' }}>
              {stepsPercent >= 100 ? t('fitness.steps.reached') : t('fitness.percentDone', { percent: Math.round(stepsPercent) })}
            </div>
          </div>

          <div className="h-4 bg-surface-sunken rounded-full overflow-hidden mb-2">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${stepsPercent}%`, background: stepsPercent >= 100 ? '#10B981' : 'linear-gradient(90deg, #F87404, #FF5C04)' }} />
          </div>
          <div className="flex justify-between text-xs text-content-tertiary">
            <span>0</span><span>{formatNumber(stepsGoal / 2, locale)}</span><span>{formatNumber(stepsGoal, locale)}</span>
          </div>

          {showStepsInput && (
            <div className="mt-4 flex gap-2">
              <input type="number" min={0} max={200000} value={stepsInput}
                onChange={e => { const v = e.target.value; if (v === '' || /^\d*$/.test(v)) setStepsInput(v); }}
                onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); if (e.key === 'Enter') handleStepsUpdate(); }}
                placeholder={t('fitness.steps.enter')} autoFocus disabled={stepsSaving}
                className="flex-1 px-3 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]/40 text-sm" />
              <button onClick={handleStepsUpdate} disabled={stepsSaving}
                className="px-4 py-2.5 rounded-md bg-[#10B981] text-white text-sm font-semibold hover:bg-[#0ea572] transition-colors disabled:opacity-60">
                {stepsSaving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border-subtle">
            {[
              { label: t('fitness.distance'), value: `${(steps * 0.000473).toFixed(2)} mi` },
              { label: t('fitness.calories'), value: `${Math.round(steps * 0.04)} kcal` },
              { label: t('fitness.steps.remaining'), value: formatNumber(Math.max(0, stepsGoal - steps), locale) },
            ].map(({ label, value }) => (
              <div key={label} className="text-center p-2 bg-gray-50 dark:bg-white/[0.04] rounded-md">
                <div className="font-bold text-content-primary text-sm">{value}</div>
                <div className="text-[10px] text-content-tertiary">{label}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Nav */}
        <div className="grid grid-cols-4 gap-3">
          {quickNav.map(({ icon: Icon, labelKey, bg, href }) => (
            <Link key={labelKey} href={href}>
              <button className="w-full bg-surface-raised border border-border-subtle rounded-md p-4 flex flex-col items-center gap-2 shadow-sm hover: hover:-translate-y-0.5 transition-all">
                <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: bg + '15' }}>
                  <Icon size={18} style={{ color: bg }} />
                </div>
                <span className="text-xs font-medium text-content-secondary">{t(labelKey)}</span>
              </button>
            </Link>
          ))}
        </div>

        {/* Recent Log / Quick Start tabs */}
        <Card padding="none">
          <div className="grid grid-cols-2 border-b border-border-subtle">
            {(['log', 'quick'] as const).map(tabKey => (
              <button key={tabKey} onClick={() => setTab(tabKey)}
                className={`py-3.5 text-sm font-semibold transition-colors ${tab === tabKey ? 'text-content-primary border-b-2 border-accent' : 'text-content-secondary hover:text-content-secondary dark:hover:text-gray-200'}`}>
                {tabKey === 'log' ? t('fitness.recentLog') : t('fitness.repeat')}
              </button>
            ))}
          </div>

          <div className="p-4">
            {tab === 'log' ? (
              loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={20} className="animate-spin text-accent" />
                </div>
              ) : recentWorkouts.length === 0 ? (
                <div className="text-center py-8">
                  <Dumbbell size={32} className="mx-auto mb-2 text-content-tertiary dark:text-content-secondary" />
                  <p className="text-sm text-content-tertiary">{t('fitness.empty')}</p>
                  <Link href="/fitness/log-workout">
                    <button className="mt-3 text-xs font-semibold text-accent hover:underline">{t('fitness.emptyAction')}</button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentWorkouts.map(w => (
                    <div key={w.id} className="flex items-center gap-4 p-3 rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer group">
                      <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: getTypeColor(w.category) + '15' }}>
                        {(() => { const Icon = getTypeIcon(w.category); return <Icon size={18} style={{ color: getTypeColor(w.category) }} />; })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sm text-content-primary truncate">{w.exercise_name}</span>
                          <Badge variant={getTypeVariant(w.category)}>{w.category}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-content-tertiary">
                          {w.duration_minutes && <span className="flex items-center gap-1"><Clock size={11} /> {w.duration_minutes}m</span>}
                          {w.calories_burned && <span className="flex items-center gap-1"><Flame size={11} /> {w.calories_burned} kcal</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-content-tertiary">{formatDayLabel(w.logged_date)}</span>
                        <ChevronRight size={14} className="text-content-tertiary dark:text-content-secondary group-hover:text-content-secondary dark:group-hover:text-content-tertiary transition-colors" />
                      </div>
                    </div>
                  ))}
                  <Link href="/fitness/history">
                    <button className="w-full text-center text-xs font-semibold text-accent hover:underline py-2">{t('fitness.viewAllArrow')}</button>
                  </Link>
                </div>
              )
            ) : (
              repeatWorkouts.length === 0 ? (
                <div className="text-center py-10">
                  <Dumbbell size={28} className="mx-auto text-content-tertiary mb-2" />
                  <p className="text-sm text-content-tertiary">{t('fitness.repeatEmpty')}</p>
                  <Link href="/fitness/log-workout">
                    <button className="mt-3 text-xs font-semibold text-accent hover:underline">{t('fitness.emptyAction')}</button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {repeatWorkouts.map(w => {
                    const Icon = getTypeIcon(w.category);
                    const color = getTypeColor(w.category);
                    return (
                      <Link key={w.name} href="/fitness/log-workout">
                        <div className="flex items-center gap-4 p-3 rounded-md border border-border-subtle hover:border-accent/30 hover:bg-accent/5 transition-all cursor-pointer group">
                          <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '15' }}>
                            <Icon size={18} style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-content-primary truncate">{w.name}</p>
                            <div className="flex items-center gap-3 text-xs text-content-tertiary mt-0.5">
                              <span>{w.count === 1 ? t('fitness.loggedOnce') : t('fitness.loggedTimes', { n: w.count })}</span>
                              {w.avgMins !== null && <span className="flex items-center gap-1"><Clock size={11} /> {w.avgMins}m</span>}
                              {w.avgKcal !== null && <span className="flex items-center gap-1"><Flame size={11} /> {formatNumber(w.avgKcal, locale)} kcal</span>}
                            </div>
                          </div>
                          <button className="flex items-center gap-1.5 text-xs font-semibold text-accent bg-accent-surface px-3 py-1.5 rounded-lg group-hover:bg-accent group-hover:text-white transition-all shrink-0">
                            <Zap size={12} /> {t('fitness.logAgain')}
                          </button>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </Card>

        {/* Body Weight Chart */}
        {bodyStats.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-content-primary">{t('fitness.weightTrend')}</h2>
              <span className="text-sm text-accent font-medium">{bodyStats[bodyStats.length - 1]?.weight} lbs</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={bodyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F620" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} width={35} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="weight" name={t('fitness.weightSeries')} stroke="#F87404" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#F87404' }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        <div className="h-6" />
      </div>
    </DashboardShell>
  );
}
