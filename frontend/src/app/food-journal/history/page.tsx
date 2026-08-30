'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/format';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { ChartTooltip } from '@/components/ui/ChartTooltip';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, Flame, Beef, Wheat, Droplets, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const RANGE_OPTIONS = ['7D', '14D', '30D'] as const;
type Range = typeof RANGE_OPTIONS[number];
const rangeMap: Record<Range, number> = { '7D': 7, '14D': 14, '30D': 30 };

type HistoryDay = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

export default function NutritionHistoryPage() {
  const { t, locale } = useI18nStore();
  const { user } = useAuthStore();
  const [range, setRange] = useState<Range>('14D');
  const [activeTab, setActiveTab] = useState<'calories' | 'macros'>('calories');
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [loading, setLoading] = useState(true);

  const calorieGoal = user?.daily_calorie_goal ?? 2000;

  useEffect(() => {
    setLoading(true);
    api.get('/food-log/history?period=month')
      .then(res => {
        const raw: Array<{ date: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }> = res.data.data;
        setHistory(raw.map(d => ({
          date:     d.date,
          calories: d.calories,
          protein:  d.protein_g,
          carbs:    d.carbs_g,
          fat:      d.fat_g,
        })));
      })
      .catch(() => toast.error(t('nutHistory.error.load')))
      .finally(() => setLoading(false));
  }, []);

  const sliced = history.slice(-rangeMap[range]);

  const avgCals    = avg(sliced.map(d => d.calories));
  const avgProtein = avg(sliced.map(d => d.protein));
  const avgCarbs   = avg(sliced.map(d => d.carbs));
  const avgFat     = avg(sliced.map(d => d.fat));
  const diff       = avgCals - calorieGoal;

  const chartData = sliced.map((d, i) => ({
    ...d,
    day: i % 5 === 0 ? formatDate(new Date(d.date), locale, { month: 'short', day: 'numeric' }) : '',
  }));

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <PageHeader
        title={t('nutHistory.title')}
        subtitle={t('nutHistory.subtitle')}
        back="/food-journal"
      />

        {/* Range Selector */}
        <div className="flex gap-2 mb-5">
          {RANGE_OPTIONS.map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${range === r ? 'bg-accent text-white shadow-orange-500/20' : 'bg-surface-raised border border-border-strong text-content-secondary'}`}>
              {t('range.' + r)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-accent" />
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <Card padding="sm">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame size={16} className="text-accent" />
                    <span className="text-xs font-medium text-content-secondary">{t('nutHistory.avgCalories')}</span>
                  </div>
                  <div className="font-display text-2xl font-bold text-content-primary">{avgCals.toLocaleString()}</div>
                  <div className={`flex items-center gap-1 text-xs mt-1 ${diff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {diff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {diff > 0 ? t('nutHistory.overGoal', { n: Math.abs(diff) }) : t('nutHistory.underGoal', { n: Math.abs(diff) })}
                  </div>
                </div>
              </Card>

              <Card padding="sm">
                <div className="p-4 grid grid-cols-3 gap-2">
                  {[
                    { label: t('common.protein'), val: avgProtein, color: '#F87404', icon: Beef },
                    { label: t('common.carbs'),   val: avgCarbs,   color: '#004AAD', icon: Wheat },
                    { label: t('common.fat'),     val: avgFat,     color: '#7C3AED', icon: Droplets },
                  ].map(({ label, val, color, icon: Icon }) => (
                    <div key={label} className="text-center">
                      <Icon size={14} className="mx-auto mb-1" style={{ color }} />
                      <div className="font-bold text-content-primary text-sm">{val}g</div>
                      <div className="text-xs text-content-tertiary">{label}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Tab Toggle */}
            <div className="flex bg-gray-100 dark:bg-white/[0.07] p-1 rounded-md mb-4">
              {(['calories', 'macros'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab ? 'bg-surface-raised text-content-primary shadow-sm' : 'text-content-secondary'}`}>
                  {t('chart.' + tab)}
                </button>
              ))}
            </div>

            {/* Chart */}
            <Card className="mb-5">
              <div className="p-5">
                <h3 className="font-semibold text-content-primary mb-4 text-sm">
                  {activeTab === 'calories' ? t('nutHistory.intakeVsGoal') : t('nutHistory.macros')}
                </h3>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    {activeTab === 'calories' ? (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} domain={[0, 'auto']} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="calories" stroke="#F87404" strokeWidth={2.5} dot={false} name={t('common.calories')} />
                        <Line type="monotone" dataKey={() => calorieGoal} stroke="#004AAD" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name={t('common.goal')} />
                      </LineChart>
                    ) : (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="protein" fill="#F87404" name={t('nutHistory.proteinG')} radius={[2, 2, 0, 0]} />
                        <Bar dataKey="carbs"   fill="#004AAD" name={t('nutHistory.carbsG')}   radius={[2, 2, 0, 0]} />
                        <Bar dataKey="fat"     fill="#7C3AED" name={t('nutHistory.fatG')}     radius={[2, 2, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            {/* Daily Log Table */}
            <Card>
              <div className="p-5">
                <h3 className="font-semibold text-content-primary mb-4 text-sm">{t('nutHistory.daily')}</h3>
                {sliced.length === 0 ? (
                  <p className="text-sm text-content-tertiary text-center py-4">{t('nutHistory.empty')}</p>
                ) : (
                  <div className="space-y-2">
                    {sliced.slice(-7).reverse().map((day) => {
                      const pct = Math.min((day.calories / calorieGoal) * 100, 100);
                      const over = day.calories > calorieGoal;
                      return (
                        <div key={day.date} className="flex items-center gap-3">
                          <div className="w-20 text-xs text-content-secondary shrink-0">
                            {formatDate(new Date(day.date), locale, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                          <div className="flex-1 h-2 bg-surface-sunken rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: over ? '#FF0404' : '#F87404' }} />
                          </div>
                          <div className={`text-xs font-semibold w-16 text-right shrink-0 ${over ? 'text-red-500' : 'text-content-primary'}`}>
                            {day.calories > 0 ? day.calories.toLocaleString() : '—'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
