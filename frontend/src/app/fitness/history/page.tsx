'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { mockWorkouts, mockWorkoutHistory } from '@/lib/mockData';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ChevronLeft, Flame, Clock, Dumbbell, Activity, TrendingUp, Calendar, Filter } from 'lucide-react';
import Link from 'next/link';

const RANGE_OPTIONS = ['7D', '30D', '3M'] as const;
type Range = typeof RANGE_OPTIONS[number];
const rangeMap: Record<Range, number> = { '7D': 7, '30D': 30, '3M': 90 };

export default function WorkoutHistoryPage() {
  const [range, setRange] = useState<Range>('30D');
  const [activeChart, setActiveChart] = useState<'calories' | 'duration' | 'volume' | 'distance'>('calories');
  const [typeFilter, setTypeFilter] = useState<string>('All');

  const sliced = mockWorkoutHistory.slice(-rangeMap[range]);
  const chartData = sliced.map((d, i) => ({
    ...d,
    day: i % Math.ceil(sliced.length / 7) === 0
      ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '',
  }));

  const totalWorkouts = sliced.filter(d => d.calories > 0).length;
  const totalCals = sliced.reduce((s, d) => s + d.calories, 0);
  const totalMins = sliced.reduce((s, d) => s + d.duration, 0);
  const avgCals = Math.round(totalCals / Math.max(totalWorkouts, 1));

  const allWorkouts = [...mockWorkouts, ...mockWorkouts.map(w => ({ ...w, id: w.id + 'b', date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0] }))];
  const filtered = allWorkouts.filter(w => typeFilter === 'All' || w.type === typeFilter);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white dark:bg-[#222] border border-gray-100 dark:border-white/10 rounded-xl p-3 shadow-xl text-xs">
        <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{payload[0]?.payload?.date}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
        ))}
      </div>
    );
  };

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/fitness">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Workout History</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Your training record</p>
          </div>
        </div>

        {/* Range */}
        <div className="flex gap-2 mb-5">
          {RANGE_OPTIONS.map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${range === r ? 'bg-[#F87404] text-white shadow-md shadow-orange-500/20' : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'}`}>
              {r}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Card padding="sm">
            <div className="p-4 grid grid-cols-2 gap-3">
              {[
                { label: 'Workouts', val: totalWorkouts, icon: Calendar, color: '#F87404' },
                { label: 'Avg Cal', val: avgCals, icon: TrendingUp, color: '#10B981' },
              ].map(({ label, val, icon: Icon, color }) => (
                <div key={label} className="text-center">
                  <Icon size={14} className="mx-auto mb-1" style={{ color }} />
                  <div className="font-bold text-gray-900 dark:text-white">{val}</div>
                  <div className="text-xs text-gray-400">{label}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card padding="sm">
            <div className="p-4 grid grid-cols-2 gap-3">
              {[
                { label: 'Total Cal', val: totalCals.toLocaleString(), icon: Flame, color: '#FF5C04' },
                { label: 'Minutes', val: totalMins, icon: Clock, color: '#004AAD' },
              ].map(({ label, val, icon: Icon, color }) => (
                <div key={label} className="text-center">
                  <Icon size={14} className="mx-auto mb-1" style={{ color }} />
                  <div className="font-bold text-gray-900 dark:text-white">{val}</div>
                  <div className="text-xs text-gray-400">{label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Chart */}
        <Card className="mb-5">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Performance Trend</h3>
              <div className="flex bg-gray-100 dark:bg-white/[0.07] p-0.5 rounded-lg">
                {(['calories', 'duration', 'volume', 'distance'] as const).map(c => (
                  <button key={c} onClick={() => setActiveChart(c)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all ${activeChart === c ? 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(155,155,155,0.1)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey={activeChart}
                    fill={activeChart === 'calories' ? '#F87404' : activeChart === 'duration' ? '#004AAD' : activeChart === 'volume' ? '#FF0404' : '#10B981'}
                    radius={[3, 3, 0, 0]}
                    name={activeChart === 'calories' ? 'Calories' : activeChart === 'duration' ? 'Duration (min)' : activeChart === 'volume' ? 'Volume (lbs)' : 'Distance (mi)'} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-3 mt-3 flex-wrap">
              {[
                { key: 'calories', label: 'Calories Burned', color: '#F87404' },
                { key: 'duration', label: 'Duration', color: '#004AAD' },
                { key: 'volume', label: 'Volume Lifted', color: '#FF0404' },
                { key: 'distance', label: 'Cardio Distance', color: '#10B981' },
              ].map(({ key, label, color }) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Filter */}
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-gray-400" />
          {['All', 'Strength', 'Cardio', 'HIIT'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${typeFilter === t ? 'bg-[#F87404] text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Workout List */}
        <div className="space-y-3">
          {filtered.map((workout) => (
            <div key={workout.id} className="flex items-center gap-4 p-4 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] shadow-sm">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${workout.type === 'Cardio' ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-orange-50 dark:bg-orange-500/10'}`}>
                {workout.type === 'Cardio' ? (
                  <Activity size={18} className="text-[#004AAD]" />
                ) : (
                  <Dumbbell size={18} className="text-[#F87404]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">{workout.name}</span>
                  <Badge variant={workout.type === 'Cardio' ? 'blue' : 'orange'} size="sm">{workout.type}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Clock size={10} />{workout.duration}m</span>
                  <span className="flex items-center gap-1"><Flame size={10} />{workout.calories} cal</span>
                  <span>{new Date(workout.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
