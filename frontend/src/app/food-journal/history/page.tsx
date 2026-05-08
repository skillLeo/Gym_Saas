'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { mockNutritionHistory } from '@/lib/mockData';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, Flame, Beef, Wheat, Droplets, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

const RANGE_OPTIONS = ['7D', '14D', '30D'] as const;
type Range = typeof RANGE_OPTIONS[number];

const rangeMap: Record<Range, number> = { '7D': 7, '14D': 14, '30D': 30 };

function avg(arr: number[]) {
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

export default function NutritionHistoryPage() {
  const [range, setRange] = useState<Range>('14D');
  const [activeTab, setActiveTab] = useState<'calories' | 'macros'>('calories');

  const sliced = mockNutritionHistory.slice(-rangeMap[range]);

  const avgCals = avg(sliced.map(d => d.calories));
  const avgProtein = avg(sliced.map(d => d.protein));
  const avgCarbs = avg(sliced.map(d => d.carbs));
  const avgFat = avg(sliced.map(d => d.fat));

  const calorieGoal = 2000;
  const diff = avgCals - calorieGoal;

  const chartData = sliced.map((d, i) => ({
    ...d,
    day: i % 5 === 0 ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white dark:bg-[#222] border border-gray-100 dark:border-white/10 rounded-xl p-3 shadow-xl text-xs">
        <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{label || payload[0]?.payload?.date}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
        ))}
      </div>
    );
  };

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/food-journal">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Nutrition History</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Track your dietary trends</p>
          </div>
        </div>

        {/* Range Selector */}
        <div className="flex gap-2 mb-5">
          {RANGE_OPTIONS.map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${range === r ? 'bg-[#F87404] text-white shadow-md shadow-orange-500/20' : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'}`}>
              {r}
            </button>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Card padding="sm">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame size={16} className="text-[#F87404]" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Avg Calories</span>
              </div>
              <div className="font-display text-2xl font-bold text-gray-900 dark:text-white">{avgCals.toLocaleString()}</div>
              <div className={`flex items-center gap-1 text-xs mt-1 ${diff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {diff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(diff)} kcal {diff > 0 ? 'over' : 'under'} goal
              </div>
            </div>
          </Card>

          <Card padding="sm">
            <div className="p-4 grid grid-cols-3 gap-2">
              {[
                { label: 'Protein', val: avgProtein, color: '#F87404', icon: Beef },
                { label: 'Carbs', val: avgCarbs, color: '#004AAD', icon: Wheat },
                { label: 'Fat', val: avgFat, color: '#7C3AED', icon: Droplets },
              ].map(({ label, val, color, icon: Icon }) => (
                <div key={label} className="text-center">
                  <Icon size={14} className="mx-auto mb-1" style={{ color }} />
                  <div className="font-bold text-gray-900 dark:text-white text-sm">{val}g</div>
                  <div className="text-xs text-gray-400">{label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-gray-100 dark:bg-white/[0.07] p-1 rounded-xl mb-4">
          {(['calories', 'macros'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab ? 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Chart */}
        <Card className="mb-5">
          <div className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm">
              {activeTab === 'calories' ? 'Calorie Intake vs Goal' : 'Macros Breakdown'}
            </h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                {activeTab === 'calories' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} domain={[1000, 2800]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="calories" stroke="#F87404" strokeWidth={2.5} dot={false} name="Calories" />
                    <Line type="monotone" dataKey={() => calorieGoal} stroke="#004AAD" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Goal" />
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="protein" fill="#F87404" name="Protein (g)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="carbs" fill="#004AAD" name="Carbs (g)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="fat" fill="#7C3AED" name="Fat (g)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Daily Log Table */}
        <Card>
          <div className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm">Daily Breakdown</h3>
            <div className="space-y-2">
              {sliced.slice(-7).reverse().map((day) => {
                const pct = Math.min((day.calories / calorieGoal) * 100, 100);
                const over = day.calories > calorieGoal;
                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <div className="w-20 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: over ? '#FF0404' : '#F87404' }} />
                    </div>
                    <div className={`text-xs font-semibold w-16 text-right shrink-0 ${over ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                      {day.calories.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
