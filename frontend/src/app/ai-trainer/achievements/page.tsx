'use client';

import { useState, useEffect } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Trophy, Loader2, Lock} from 'lucide-react';
import api from '@/lib/api';

type Achievement = {
  key:         string;
  title:       string;
  description: string;
  icon:        string;
  category:    string;
  earned:      boolean;
  progress:    number;
  max:         number;
};

export default function AchievementsPage() {
  const { t } = useI18nStore();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats,        setStats]        = useState<Record<string, number>>({});
  const [earnedCount,  setEarnedCount]  = useState(0);
  const [totalCount,   setTotalCount]   = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState<'all' | 'earned' | 'locked'>('all');

  useEffect(() => {
    api.get('/achievements').then(res => {
      setAchievements(res.data.achievements);
      setStats(res.data.stats);
      setEarnedCount(res.data.earned_count);
      setTotalCount(res.data.total_count);
    }).finally(() => setLoading(false));
  }, []);

  const displayed = achievements.filter(a => {
    if (filter === 'earned') return a.earned;
    if (filter === 'locked') return !a.earned;
    return true;
  });

  const categories = ['all', ...Array.from(new Set(achievements.map(a => a.category)))];

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">

        {/* Header */}
        <PageHeader
        title={t('achievements.title')}
        subtitle={loading ? t('common.loading') : t('achievements.earnedOfShort', { earned: earnedCount, total: totalCount })}
        back="/ai-trainer"
      />

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-brand-yellow" />
          </div>
        ) : (
          <>
            {/* Overall progress bar */}
            <Card padding="none" className="mb-6">
              <div className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-md bg-[#FFC000]/15 flex items-center justify-center">
                    <Trophy size={28} className="text-brand-yellow" />
                  </div>
                  <div className="flex-1">
                    <div className="font-display text-3xl font-bold text-content-primary">
                      {Math.round((earnedCount / Math.max(totalCount, 1)) * 100)}%
                    </div>
                    <div className="text-sm text-content-secondary">{t('achievements.overall')}</div>
                  </div>
                </div>
                <div className="w-full bg-surface-sunken rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all duration-700"
                    style={{ width: `${(earnedCount / Math.max(totalCount, 1)) * 100}%`, background: 'linear-gradient(90deg, #FFC000, #F87404)' }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    { label: t('achievements.mealsLogged'),   val: stats.total_food_logs ?? 0 },
                    { label: t('common.workouts'),        val: stats.total_workouts ?? 0 },
                    { label: t('achievements.recipesSaved'),   val: stats.saved_recipes ?? 0 },
                  ].map(({ label, val }) => (
                    <div key={label} className="text-center bg-surface-sunken rounded-md py-3">
                      <div className="font-bold text-xl text-content-primary">{val}</div>
                      <div className="text-xs text-content-tertiary">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Filter */}
            <div className="flex gap-2 mb-4">
              {(['all', 'earned', 'locked'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${filter === f ? 'bg-[#FFC000] text-white' : 'bg-surface-sunken text-content-secondary'}`}>
                  {t('achievements.filter' + f.charAt(0).toUpperCase() + f.slice(1))}
                </button>
              ))}
            </div>

            {/* Achievements grid */}
            <div className="grid grid-cols-1 gap-3">
              {displayed.map(a => (
                <div key={a.key}
                  className={`flex items-center gap-4 p-4 rounded-md border transition-all ${a.earned ? 'bg-surface-raised border-border-subtle shadow-sm' : 'bg-gray-50 dark:bg-white/[0.03] border-gray-100/50 dark:border-white/[0.04] opacity-60'}`}>
                  <div className={`w-14 h-14 rounded-md flex items-center justify-center text-2xl flex-shrink-0 ${a.earned ? 'bg-[#FFC000]/15' : 'bg-surface-sunken'}`}>
                    {a.earned ? a.icon : <Lock size={20} strokeWidth={1.75} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-content-primary">{a.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-sunken text-content-secondary">{t('achievements.category.' + a.category)}</span>
                    </div>
                    <p className="text-xs text-content-secondary mt-0.5">{a.description}</p>
                    {!a.earned && a.max > 1 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-content-tertiary mb-1">
                          <span>{a.progress} / {a.max}</span>
                          <span>{Math.round((a.progress / a.max) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-[#FFC000] transition-all"
                            style={{ width: `${(a.progress / a.max) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {a.earned && (
                    <div className="w-8 h-8 rounded-full bg-[#FFC000]/15 flex items-center justify-center flex-shrink-0">
                      <Trophy size={14} className="text-brand-yellow" />
                    </div>
                  )}
                </div>
              ))}

              {displayed.length === 0 && (
                <div className="text-center py-12">
                  <Trophy size={32} className="mx-auto text-content-tertiary dark:text-content-secondary mb-3" />
                  <p className="text-content-secondary">{t('achievements.empty')}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
