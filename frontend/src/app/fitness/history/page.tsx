'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/format';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { ChartTooltip } from '@/components/ui/ChartTooltip';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Flame, Clock, Dumbbell, Activity, TrendingUp, Calendar, Filter, Loader2, Trash2, Zap, PersonStanding } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const RANGE_OPTIONS = ['7D', '30D', '3M'] as const;
type Range = typeof RANGE_OPTIONS[number];
const rangeToApi: Record<Range, string> = { '7D': 'week', '30D': 'month', '3M': '3months' };

const TYPE_STYLE: Record<string, { color: string; variant: 'red' | 'blue' | 'orange' | 'purple' | 'pink' | 'green'; icon: typeof Dumbbell }> = {
  Strength:    { color: '#FF0404', variant: 'red',    icon: Dumbbell },
  Cardio:      { color: '#004AAD', variant: 'blue',   icon: Activity },
  HIIT:        { color: '#FF5C04', variant: 'orange', icon: Zap },
  Yoga:        { color: '#7C3AED', variant: 'purple', icon: PersonStanding },
  Pilates:     { color: '#EC4899', variant: 'pink',   icon: PersonStanding },
  Flexibility: { color: '#10B981', variant: 'green',  icon: PersonStanding },
};

type ChartKey = 'calories' | 'duration' | 'workouts';
interface ChartPoint { date: string; calories: number; duration: number; workouts: number; day?: string }
interface WorkoutLog {
  id: number; exercise_name: string; category: string;
  duration_minutes: number | null; calories_burned: number | null; logged_date: string;
}

export default function WorkoutHistoryPage() {
  const { t, locale } = useI18nStore();
  const { confirm } = useConfirm();
  const [range, setRange] = useState<Range>('30D');
  const [activeChart, setActiveChart] = useState<ChartKey>('calories');
  const [typeFilter, setTypeFilter] = useState('All');

  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    setChartLoading(true);
    api.get('/fitness-logs/history', { params: { period: rangeToApi[range] } })
      .then(res => {
        // Keep every point's own date intact. This previously blanked `day` for
        // all but every Nth entry to stop the axis crowding — but `day` was the
        // x-axis dataKey, so ~26 of 30 days shared the identical empty
        // category. Recharts then resolved a hover on ANY of them to the first
        // one, so the tooltip reported a date weeks away from the bar under the
        // cursor. Label thinning is now done with `interval` on the axis, which
        // is a display concern, not a data one.
        setChartData(res.data.data ?? []);
      })
      .catch(() => setChartData([]))
      .finally(() => setChartLoading(false));
  }, [range]);

  useEffect(() => {
    setListLoading(true);
    const params: any = { per_page: 50 };
    if (typeFilter !== 'All') params.type = typeFilter;
    api.get('/fitness-logs', { params })
      .then(res => setWorkouts(res.data.data?.data ?? []))
      .catch(() => setWorkouts([]))
      .finally(() => setListLoading(false));
  }, [typeFilter]);

  const deleteWorkout = async (id: number, name: string) => {
    // There was no confirmation here at all — a single tap on the bin
    // permanently destroyed a logged workout, with the only feedback being a
    // "deleted" toast after the fact.
    if (!(await confirm({
      title: `Delete "${name}"?`,
      message: 'This removes the workout and its sets from your history and weekly totals. It cannot be undone.',
      confirmLabel: t('history.deleteWorkout'),
      destructive: true,
    }))) return;

    setDeleting(id);
    try {
      await api.delete(`/fitness-logs/${id}`);
      setWorkouts(prev => prev.filter(w => w.id !== id));
      toast.success(t('history.deleted'));
    } catch {
      toast.error(t('history.error.delete'));
    } finally {
      setDeleting(null);
    }
  };

  // This card said "Workouts" but counted DAYS on which anything was logged —
  // 5 workouts on Monday and 3 on Tuesday reported as "2". Now it sums the
  // actual workouts, and "Avg Cal" divides by workouts rather than by days.
  const totalWorkouts = chartData.reduce((s, d) => s + d.workouts, 0);
  const activeDays    = chartData.filter(d => d.workouts > 0).length;
  const totalCals     = chartData.reduce((s, d) => s + d.calories, 0);
  const totalMins     = chartData.reduce((s, d) => s + d.duration, 0);
  const avgCals       = Math.round(totalCals / Math.max(totalWorkouts, 1));

  const chartColor = activeChart === 'calories' ? '#F87404' : activeChart === 'duration' ? '#004AAD' : '#10B981';
  const chartLabel = activeChart === 'calories' ? t('common.calories') : activeChart === 'duration' ? t('common.durationMin') : t('common.workouts');

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        <PageHeader
        title={t('history.title')}
        subtitle={t('history.subtitle')}
        back="/fitness"
      />

        {/* Range */}
        <div className="flex gap-2 mb-5">
          {RANGE_OPTIONS.map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${range === r ? 'bg-accent text-white shadow-orange-500/20' : 'bg-surface-raised border border-border-strong text-content-secondary'}`}>
              {t('range.' + r)}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Card padding="sm">
            <div className="p-4 grid grid-cols-2 gap-3">
              {[
                { label: t('common.workouts'), val: totalWorkouts, icon: Dumbbell, color: '#FF0404' },
                { label: t('history.activeDays'), val: activeDays, icon: Calendar, color: '#F87404' },
              ].map(({ label, val, icon: Icon, color }) => (
                <div key={label} className="text-center">
                  <Icon size={14} className="mx-auto mb-1" style={{ color }} />
                  <div className="font-bold text-content-primary">{val}</div>
                  <div className="text-xs text-content-tertiary">{label}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card padding="sm">
            {/* Three stats here rather than two, so `grid-cols-3` — otherwise
                the third wraps onto its own row and the card grows taller than
                the one beside it. */}
            <div className="p-4 grid grid-cols-3 gap-2">
              {[
                { label: t('history.totalCal'), val: totalCals.toLocaleString(), icon: Flame, color: '#FF5C04' },
                { label: t('history.avgCal'), val: avgCals.toLocaleString(), icon: TrendingUp, color: '#10B981' },
                { label: t('common.minutes'), val: totalMins, icon: Clock, color: '#004AAD' },
              ].map(({ label, val, icon: Icon, color }) => (
                <div key={label} className="text-center">
                  <Icon size={14} className="mx-auto mb-1" style={{ color }} />
                  <div className="font-bold text-content-primary">{val}</div>
                  <div className="text-xs text-content-tertiary">{label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Chart */}
        <Card className="mb-5">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-content-primary text-sm">{t('history.trend')}</h3>
              <div className="flex bg-gray-100 dark:bg-white/[0.07] p-0.5 rounded-lg">
                {(['calories', 'duration', 'workouts'] as ChartKey[]).map(c => (
                  <button key={c} onClick={() => setActiveChart(c)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all ${activeChart === c ? 'bg-surface-raised text-content-primary shadow-sm' : 'text-content-secondary'}`}>
                    {t('chart.' + c)}
                  </button>
                ))}
              </div>
            </div>
            {chartLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 size={22} className="animate-spin text-accent" />
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(155,155,155,0.1)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      // Thin the labels for display only — the underlying
                      // category stays unique per day so hovers resolve correctly.
                      interval={Math.max(0, Math.ceil(chartData.length / 7) - 1)}
                      tickFormatter={(d: string) =>
                        formatDate(new Date(d), locale, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey={activeChart} fill={chartColor} radius={[3, 3, 0, 0]} name={chartLabel} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex gap-3 mt-3 flex-wrap">
              {[
                { key: 'calories', label: t('history.caloriesBurned'), color: '#F87404' },
                { key: 'duration', label: t('history.duration'),        color: '#004AAD' },
                { key: 'workouts', label: t('common.workouts'),        color: '#10B981' },
              ].map(({ key, label, color }) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-content-tertiary">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Filter
            Seven chips do not fit in 375px: "Pilates" and "Flexibility" ran to
            489px and made the whole page scroll sideways. The row scrolls
            inside itself instead, which is the rule for wide content. */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Filter size={14} className="text-content-tertiary shrink-0" />
          {['All', 'Strength', 'Cardio', 'HIIT', 'Yoga', 'Pilates', 'Flexibility'].map(kind => (
            <button key={kind} onClick={() => setTypeFilter(kind)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 ${typeFilter === kind ? 'bg-accent text-white' : 'bg-surface-sunken text-content-secondary'}`}>
              {t('workout.type.' + kind.toLowerCase())}
            </button>
          ))}
        </div>

        {/* Workout List */}
        {listLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={22} className="animate-spin text-accent" />
          </div>
        ) : workouts.length === 0 ? (
          <div className="text-center py-10">
            <Dumbbell size={32} className="mx-auto mb-2 text-content-tertiary dark:text-content-secondary" />
            <p className="text-sm text-content-tertiary">{t('history.empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {workouts.map((workout) => (
              <div key={workout.id} className="flex items-center gap-4 p-4 bg-surface-raised rounded-md border border-border-subtle shadow-sm">
                <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: (TYPE_STYLE[workout.category]?.color ?? '#F87404') + '18' }}>
                  {(() => { const Icon = TYPE_STYLE[workout.category]?.icon ?? Dumbbell; return <Icon size={18} style={{ color: TYPE_STYLE[workout.category]?.color ?? '#F87404' }} />; })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-content-primary text-sm truncate">{workout.exercise_name}</span>
                    <Badge variant={TYPE_STYLE[workout.category]?.variant ?? 'orange'} size="sm">{workout.category}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-content-tertiary">
                    {workout.duration_minutes && <span className="flex items-center gap-1"><Clock size={10} />{workout.duration_minutes}m</span>}
                    {workout.calories_burned  && <span className="flex items-center gap-1"><Flame size={10} />{workout.calories_burned} cal</span>}
                    <span>{formatDate(new Date(workout.logged_date), locale, { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
                <button onClick={() => deleteWorkout(workout.id, workout.exercise_name)} disabled={deleting === workout.id}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-content-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
                  {deleting === workout.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
