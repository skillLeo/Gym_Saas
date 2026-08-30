'use client';

import { useState, useEffect } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Flame, Trophy, Calendar, Zap, Star, Target, TrendingUp, Award, Loader2 } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';

interface ActivityCell { date: string; active: boolean; intensity: number }
interface MonthlyPoint   { month: string; workouts: number }
interface StreakData {
  current_streak: number; longest_streak: number;
  total_workouts: number; this_month: number;
  activity_grid: ActivityCell[]; monthly_data: MonthlyPoint[];
}

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const milestoneTemplates: { days: number; labelKey: string; icon: IconName; color: string }[] = [
  { days: 7,   labelKey: 'streak.milestone.1week',   icon: 'flame',    color: '#F87404' },
  { days: 14,  labelKey: 'streak.milestone.2weeks',  icon: 'dumbbell', color: '#FF5C04' },
  { days: 30,  labelKey: 'streak.milestone.30days',  icon: 'trophy',   color: '#FFC000' },
  { days: 60,  labelKey: 'streak.milestone.60days',  icon: 'zap',      color: '#004AAD' },
  { days: 100, labelKey: 'streak.milestone.100days', icon: 'star',     color: '#7C3AED' },
  { days: 365, labelKey: 'streak.milestone.365days', icon: 'medal',    color: '#10B981' },
];

const intensityClass = (v: number) => {
  if (v === 0) return 'bg-gray-100 dark:bg-white/[0.06]';
  if (v === 1) return 'bg-accent/40';
  if (v === 2) return 'bg-accent/70';
  return 'bg-accent';
};

export default function StreakPage() {
  const { t } = useI18nStore();
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  useEffect(() => {
    api.get('/fitness-logs/streak')
      .then(res => setData(res.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const currentStreak  = data?.current_streak  ?? 0;
  const longestStreak  = data?.longest_streak  ?? 0;
  const totalWorkouts  = data?.total_workouts  ?? 0;
  const thisMonth      = data?.this_month      ?? 0;
  const activityGrid   = data?.activity_grid   ?? [];
  const monthlyData    = data?.monthly_data    ?? [];

  const milestones = milestoneTemplates.map(m => ({ ...m, achieved: longestStreak >= m.days }));
  const nextMilestone = milestones.find(m => !m.achieved);
  const daysToNext = nextMilestone ? nextMilestone.days - currentStreak : 0;

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <PageHeader
        title={t('streak.title')}
        subtitle={t('streak.subtitle')}
        back="/fitness"
      />

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-accent" />
          </div>
        ) : (
          <>
            {/* Hero Streak Card */}
            <div className="relative mb-5 rounded-md overflow-hidden">
              <div className="absolute inset-0 bg-[#F87404]" />
              <div className="absolute inset-0 opacity-20"
                style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fff 0%, transparent 60%)' }} />
              <div className="relative p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-white/80 text-sm font-medium mb-1">{t('streak.current')}</p>
                    <div className="flex items-end gap-2">
                      <span className="text-7xl font-black text-white leading-none">{currentStreak}</span>
                      <span className="text-white/80 text-xl font-semibold mb-2">{t('streak.days')}</span>
                    </div>
                  </div>
                  <div className="w-16 h-16 rounded-md bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Flame size={32} className="text-white" />
                  </div>
                </div>
                {nextMilestone && currentStreak < nextMilestone.days && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-white/80 text-xs">{t('streak.toNext', { days: daysToNext, milestone: t(nextMilestone.labelKey) })}</p>
                      <p className="text-white text-xs font-bold">{Math.round((currentStreak / nextMilestone.days) * 100)}%</p>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full transition-all"
                        style={{ width: `${Math.min((currentStreak / nextMilestone.days) * 100, 100)}%` }} />
                    </div>
                  </div>
                )}
                {!nextMilestone && (
                  <p className="text-white/90 text-sm font-semibold">{t('streak.allDone')}</p>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { icon: Trophy,   label: t('streak.best'),    val: `${longestStreak}d`, color: '#FFC000' },
                { icon: Zap,      label: t('streak.totalWorkouts'), val: totalWorkouts,       color: '#F87404' },
                { icon: Calendar, label: t('common.thisMonth'),     val: thisMonth,           color: '#004AAD' },
              ].map(({ icon: Icon, label, val, color }) => (
                <Card key={label} padding="sm">
                  <div className="p-4 text-center">
                    <Icon size={18} className="mx-auto mb-1.5" style={{ color }} />
                    <div className="font-black text-content-primary text-xl">{val}</div>
                    <div className="text-xs text-content-tertiary mt-0.5">{label}</div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Activity Heatmap */}
            {activityGrid.length > 0 && (
              <Card className="mb-5">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-content-primary text-sm">{t('streak.activity')}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
                      <span>{t('streak.less')}</span>
                      <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-white/[0.06]" />
                      <div className="w-3 h-3 rounded-sm bg-accent/40" />
                      <div className="w-3 h-3 rounded-sm bg-accent/70" />
                      <div className="w-3 h-3 rounded-sm bg-accent" />
                      <span>{t('streak.more')}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 mb-1">
                    {WEEK_LABELS.map((d, i) => (
                      <div key={i} className="w-7 text-center text-[9px] text-content-tertiary font-medium">{d}</div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {Array.from({ length: 12 }).map((_, weekIdx) => (
                      <div key={weekIdx} className="flex gap-1">
                        {Array.from({ length: 7 }).map((_, dayIdx) => {
                          const cell = activityGrid[weekIdx * 7 + dayIdx];
                          if (!cell) return <div key={dayIdx} className="w-7 h-7" />;
                          return (
                            <div key={dayIdx}
                              onMouseEnter={() => setHoveredDay(cell.date)}
                              onMouseLeave={() => setHoveredDay(null)}
                              title={cell.date}
                              className={`w-7 h-7 rounded-md transition-all cursor-default ${intensityClass(cell.intensity)}`} />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {hoveredDay && <p className="mt-3 text-xs text-center text-content-tertiary">{hoveredDay}</p>}
                </div>
              </Card>
            )}

            {/* Monthly Bar Chart */}
            {monthlyData.length > 0 && (
              <Card className="mb-5">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-content-primary text-sm">{t('streak.monthlyWorkouts')}</h3>
                    <div className="flex items-center gap-1 text-xs text-[#10B981] font-semibold">
                      <TrendingUp size={13} />
                      {t('streak.last6')}
                    </div>
                  </div>
                  <div className="flex items-end gap-2 h-28">
                    {monthlyData.map(({ month, workouts }, idx) => {
                      const maxVal = Math.max(...monthlyData.map(d => d.workouts), 1);
                      const heightPct = (workouts / maxVal) * 100;
                      const isLast = idx === monthlyData.length - 1;
                      return (
                        <div key={month} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] font-bold text-content-secondary">{workouts}</span>
                          <div className="w-full rounded-t-lg transition-all" style={{
                            height: `${heightPct}%`,
                            background:     isLast ? 'linear-gradient(180deg, #F87404, #FF5C04)' : undefined,
                            backgroundColor:!isLast ? 'rgba(248,116,4,0.25)' : undefined,
                          }} />
                          <span className="text-[10px] text-content-tertiary">{t('month.' + month.toLowerCase())}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}

            {/* Milestones */}
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-4">
                <Award size={16} className="text-brand-yellow" />
                <h3 className="font-semibold text-content-primary text-sm">{t('streak.milestones')}</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {milestones.map(({ days, labelKey, icon, color, achieved }) => (
                  <div key={days}
                    className={`relative p-4 rounded-md border transition-all ${achieved ? 'bg-surface-raised border-border-subtle shadow-sm' : 'bg-gray-50 dark:bg-white/[0.03] border-gray-100 dark:border-white/[0.04] opacity-60'}`}>
                    {achieved && (
                      <div className="absolute top-2.5 right-2.5">
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <Star size={10} className="text-white fill-white" />
                        </div>
                      </div>
                    )}
                    <span
                      className="h-10 w-10 rounded-sm flex items-center justify-center mb-2"
                      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
                    >
                      <Icon name={icon} size="lg" />
                    </span>
                    <div className="font-bold text-content-primary text-sm">{t(labelKey)}</div>
                    <div className="text-xs mt-0.5" style={{ color: achieved ? color : 'var(--text-tertiary)' }}>
                      {achieved ? t('streak.unlocked') : t('streak.daysAway', { n: days - currentStreak })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Motivational CTA */}
            <div className="mt-5 flex items-center gap-4 bg-accent-surface border border-accent/20 rounded-md p-4">
              <div className="w-12 h-12 rounded-md bg-accent flex items-center justify-center shrink-0">
                <Target size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-content-primary text-sm">{t('streak.keepGoing')}</div>
                <div className="text-xs text-content-secondary mt-0.5">
                  {nextMilestone
                    ? `${Math.max(0, daysToNext)} more workouts to unlock ${t(nextMilestone.labelKey)}`
                    : t('streak.allUnlocked')}
                </div>
              </div>
              <Link href="/fitness/log-workout">
                <button className="flex items-center gap-1.5 text-xs font-bold text-white bg-accent px-4 py-2.5 rounded-md hover:bg-accent-hover transition-colors whitespace-nowrap">
                  <Flame size={13} /> {t('streak.logNow')}
                </button>
              </Link>
            </div>
          </>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
