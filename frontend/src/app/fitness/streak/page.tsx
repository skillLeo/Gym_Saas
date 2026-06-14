'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { ChevronLeft, Flame, Trophy, Calendar, Zap, Star, Target, TrendingUp, Award } from 'lucide-react';
import Link from 'next/link';

const CURRENT_STREAK = 12;
const LONGEST_STREAK = 28;
const TOTAL_WORKOUTS = 94;
const THIS_MONTH_WORKOUTS = 18;

const milestones = [
  { days: 7,   label: '1 Week Warrior',    emoji: '🔥', color: '#F87404', achieved: true  },
  { days: 14,  label: '2 Week Beast',       emoji: '💪', color: '#FF5C04', achieved: true  },
  { days: 30,  label: '30-Day Legend',      emoji: '🏆', color: '#FFC000', achieved: true  },
  { days: 60,  label: '60-Day Champion',    emoji: '⚡', color: '#004AAD', achieved: false },
  { days: 100, label: '100-Day Elite',      emoji: '🌟', color: '#7C3AED', achieved: false },
  { days: 365, label: '365-Day Immortal',   emoji: '👑', color: '#10B981', achieved: false },
];

// Deterministic pseudo-random based on seed (avoids hydration mismatch)
const seededRand = (seed: number) => {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
};

// Generate 84 days of activity (12 weeks) — fixed reference date to avoid hydration issues
const REF_DATE = new Date('2026-06-14');
const generateActivityGrid = () => {
  const days: { date: string; active: boolean; intensity: number }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(REF_DATE);
    d.setDate(REF_DATE.getDate() - i);
    const active = i < 12 ? true : seededRand(i) > 0.45;
    const intensity = active ? Math.floor(seededRand(i + 100) * 3) + 1 : 0;
    days.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      active,
      intensity,
    });
  }
  return days;
};

const activityGrid = generateActivityGrid();
const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const monthlyData = [
  { month: 'Jan', workouts: 14 },
  { month: 'Feb', workouts: 16 },
  { month: 'Mar', workouts: 19 },
  { month: 'Apr', workouts: 22 },
  { month: 'May', workouts: 20 },
  { month: 'Jun', workouts: 18 },
];

const intensityColor = (v: number, dark = false) => {
  if (v === 0) return dark ? 'bg-white/[0.06]' : 'bg-gray-100';
  if (v === 1) return 'bg-[#F87404]/40';
  if (v === 2) return 'bg-[#F87404]/70';
  return 'bg-[#F87404]';
};

export default function StreakPage() {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const daysToNext = 30 - CURRENT_STREAK;
  const nextMilestone = milestones.find(m => !m.achieved);

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/fitness">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">My Streak</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Stay consistent, stay unstoppable</p>
          </div>
        </div>

        {/* Hero Streak Card */}
        <div className="relative mb-5 rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F87404] via-[#FF5C04] to-[#FF0404]" />
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fff 0%, transparent 60%)' }} />
          <div className="relative p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/80 text-sm font-medium mb-1">Current Streak</p>
                <div className="flex items-end gap-2">
                  <span className="text-7xl font-black text-white leading-none">{CURRENT_STREAK}</span>
                  <span className="text-white/80 text-xl font-semibold mb-2">days</span>
                </div>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Flame size={32} className="text-white" />
              </div>
            </div>

            {/* Next milestone progress */}
            {nextMilestone && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white/80 text-xs">{daysToNext} days to {nextMilestone.emoji} {nextMilestone.label}</p>
                  <p className="text-white text-xs font-bold">{Math.round((CURRENT_STREAK / nextMilestone.days) * 100)}%</p>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${Math.min((CURRENT_STREAK / nextMilestone.days) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { icon: Trophy,      label: 'Best Streak',     val: `${LONGEST_STREAK}d`, color: '#FFC000' },
            { icon: Zap,         label: 'Total Workouts',  val: TOTAL_WORKOUTS,        color: '#F87404' },
            { icon: Calendar,    label: 'This Month',      val: THIS_MONTH_WORKOUTS,   color: '#004AAD' },
          ].map(({ icon: Icon, label, val, color }) => (
            <Card key={label} padding="sm">
              <div className="p-4 text-center">
                <Icon size={18} className="mx-auto mb-1.5" style={{ color }} />
                <div className="font-black text-gray-900 dark:text-white text-xl">{val}</div>
                <div className="text-xs text-gray-400 mt-0.5">{label}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Activity Heatmap */}
        <Card className="mb-5">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Activity — Last 12 Weeks</h3>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-white/[0.06]" />
                <div className="w-3 h-3 rounded-sm bg-[#F87404]/40" />
                <div className="w-3 h-3 rounded-sm bg-[#F87404]/70" />
                <div className="w-3 h-3 rounded-sm bg-[#F87404]" />
                <span>More</span>
              </div>
            </div>

            {/* Week day labels */}
            <div className="flex gap-1 mb-1 pl-0">
              {WEEK_LABELS.map((d, i) => (
                <div key={i} className="w-7 text-center text-[9px] text-gray-400 font-medium">{d}</div>
              ))}
            </div>

            {/* Grid — 12 rows (weeks) × 7 columns (days) */}
            <div className="space-y-1">
              {Array.from({ length: 12 }).map((_, weekIdx) => (
                <div key={weekIdx} className="flex gap-1">
                  {Array.from({ length: 7 }).map((_, dayIdx) => {
                    const cellIdx = weekIdx * 7 + dayIdx;
                    const cell = activityGrid[cellIdx];
                    if (!cell) return <div key={dayIdx} className="w-7 h-7" />;
                    return (
                      <div
                        key={dayIdx}
                        onMouseEnter={() => setHoveredDay(cell.date)}
                        onMouseLeave={() => setHoveredDay(null)}
                        title={cell.date}
                        className={`w-7 h-7 rounded-md transition-all cursor-default relative ${intensityColor(cell.intensity, true)}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {hoveredDay && (
              <p className="mt-3 text-xs text-center text-gray-400">{hoveredDay}</p>
            )}
          </div>
        </Card>

        {/* Monthly Workouts Bar Chart */}
        <Card className="mb-5">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Monthly Workouts</h3>
              <div className="flex items-center gap-1 text-xs text-[#10B981] font-semibold">
                <TrendingUp size={13} />
                +28% vs last year
              </div>
            </div>
            <div className="flex items-end gap-2 h-28">
              {monthlyData.map(({ month, workouts }) => {
                const maxVal = Math.max(...monthlyData.map(d => d.workouts));
                const heightPct = (workouts / maxVal) * 100;
                const isLast = month === 'Jun';
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{workouts}</span>
                    <div className="w-full rounded-t-lg transition-all" style={{
                      height: `${heightPct}%`,
                      background: isLast ? 'linear-gradient(180deg, #F87404, #FF5C04)' : undefined,
                      backgroundColor: !isLast ? 'rgba(248,116,4,0.25)' : undefined,
                    }} />
                    <span className="text-[10px] text-gray-400">{month}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Milestones */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-4">
            <Award size={16} className="text-[#FFC000]" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Streak Milestones</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {milestones.map(({ days, label, emoji, color, achieved }) => (
              <div
                key={days}
                className={`relative p-4 rounded-2xl border transition-all ${
                  achieved
                    ? 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/[0.07] shadow-sm'
                    : 'bg-gray-50 dark:bg-white/[0.03] border-gray-100 dark:border-white/[0.04] opacity-60'
                }`}
              >
                {achieved && (
                  <div className="absolute top-2.5 right-2.5">
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <Star size={10} className="text-white fill-white" />
                    </div>
                  </div>
                )}
                <div className="text-2xl mb-2">{emoji}</div>
                <div className="font-bold text-gray-900 dark:text-white text-sm">{label}</div>
                <div className="text-xs mt-0.5" style={{ color: achieved ? color : '#9CA3AF' }}>
                  {days} day streak {achieved ? '✓ Unlocked' : `— ${days - CURRENT_STREAK} days away`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Motivational CTA */}
        <div className="mt-5 flex items-center gap-4 bg-gradient-to-r from-[#F87404]/10 to-[#FF5C04]/10 border border-[#F87404]/20 rounded-2xl p-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F87404] to-[#FF5C04] flex items-center justify-center shrink-0">
            <Target size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-900 dark:text-white text-sm">Keep the fire going!</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {daysToNext} more workouts to unlock <strong>{nextMilestone?.label}</strong>
            </div>
          </div>
          <Link href="/fitness/log-workout">
            <button className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#F87404] px-4 py-2.5 rounded-xl hover:bg-[#e06000] transition-colors whitespace-nowrap">
              <Flame size={13} /> Log Now
            </button>
          </Link>
        </div>

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
