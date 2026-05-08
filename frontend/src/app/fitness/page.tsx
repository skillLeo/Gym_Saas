'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { mockWorkouts, mockBodyStats } from '@/lib/mockData';
import {
  Plus, Dumbbell, Flame, Clock, Check, TrendingUp,
  Activity, Target, Trophy, BarChart2, ChevronRight,
  Zap, Bike, PersonStanding,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const weekActivity = [true, false, true, true, false, true, false];

const quickStartWorkouts = [
  { icon: Dumbbell, name: 'Upper Body Blast', duration: '45 min', level: 'Intermediate', color: '#FF0404' },
  { icon: Activity, name: 'HIIT Cardio', duration: '30 min', level: 'Advanced', color: '#F87404' },
  { icon: Bike, name: 'Lower Body Power', duration: '50 min', level: 'Intermediate', color: '#004AAD' },
  { icon: PersonStanding, name: 'Full Body Stretch', duration: '20 min', level: 'Beginner', color: '#10B981' },
];

const quickNav = [
  { icon: Target, label: 'Goals', color: '#F87404', bg: '#F87404' },
  { icon: BarChart2, label: 'History', color: '#004AAD', bg: '#004AAD' },
  { icon: TrendingUp, label: 'Body Stats', color: '#10B981', bg: '#10B981' },
  { icon: Trophy, label: 'Streak', color: '#FACC15', bg: '#FACC15' },
];

const weekStats = {
  workouts: 4,
  minutes: 142,
  calories: 1130,
};

export default function FitnessPage() {
  const [tab, setTab] = useState<'log' | 'quick'>('log');
  const recentWorkouts = mockWorkouts.slice(0, 5);

  const getTypeColor = (type: string) => type === 'Strength' ? '#FF0404' : type === 'Cardio' ? '#F87404' : '#004AAD';
  const getTypeVariant = (type: string) => type === 'Strength' ? 'red' : type === 'Cardio' ? 'orange' : 'blue';

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <DashboardShell>
      <div className="space-y-6 max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Fitness Tracker</h1>
            <p className="text-gray-500 text-sm mt-0.5">Train hard, track everything</p>
          </div>
          <button className="flex items-center gap-2 bg-[#F87404] hover:bg-[#e06000] text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-[#F87404]/25">
            <Plus size={16} /> Log Workout
          </button>
        </div>

        {/* This Week */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">This Week</h2>
            <span className="text-sm font-medium text-[#F87404]">{weekActivity.filter(Boolean).length}/7 days active</span>
          </div>

          {/* Day circles */}
          <div className="flex justify-between mb-6">
            {DAYS.map((day, i) => (
              <div key={day} className="flex flex-col items-center gap-1.5">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${weekActivity[i] ? 'bg-[#F87404] text-white shadow-md shadow-[#F87404]/30' : 'bg-gray-100 text-gray-400'}`}>
                  {weekActivity[i] ? <Check size={16} /> : day[0]}
                </div>
                <span className="text-[10px] text-gray-500">{day}</span>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
            {[
              { icon: Dumbbell, value: weekStats.workouts, label: 'Workouts', color: '#F87404' },
              { icon: Clock, value: weekStats.minutes, label: 'Minutes', color: '#004AAD' },
              { icon: Flame, value: weekStats.calories.toLocaleString(), label: 'Calories', color: '#FF0404' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="flex justify-center mb-1">
                  <s.icon size={18} style={{ color: s.color }} />
                </div>
                <p className="text-xl font-black text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Nav */}
        <div className="grid grid-cols-4 gap-3">
          {quickNav.map(({ icon: Icon, label, bg }) => (
            <button key={label} className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg + '15' }}>
                <Icon size={18} style={{ color: bg }} />
              </div>
              <span className="text-xs font-medium text-gray-700">{label}</span>
            </button>
          ))}
        </div>

        {/* Recent Log / Quick Start tabs */}
        <Card padding="none">
          <div className="grid grid-cols-2 border-b border-gray-100">
            {(['log', 'quick'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-3.5 text-sm font-semibold transition-colors ${tab === t ? 'text-gray-900 border-b-2 border-[#F87404]' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t === 'log' ? 'Recent Log' : 'Quick Start'}
              </button>
            ))}
          </div>

          <div className="p-4">
            {tab === 'log' ? (
              <div className="space-y-3">
                {recentWorkouts.map(w => (
                  <div key={w.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: getTypeColor(w.type) + '15' }}>
                      {w.type === 'Cardio'
                        ? <Activity size={18} style={{ color: getTypeColor(w.type) }} />
                        : <Dumbbell size={18} style={{ color: getTypeColor(w.type) }} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm text-gray-900">{w.name}</span>
                        <Badge variant={getTypeVariant(w.type)}>{w.type}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Clock size={11} /> {w.duration}m</span>
                        <span className="flex items-center gap-1"><Flame size={11} /> {w.calories} kcal</span>
                        {'distance' in w && <span className="flex items-center gap-1"><Activity size={11} /> {(w as any).distance} mi</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">{formatDate(w.date)}</span>
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {quickStartWorkouts.map(w => (
                  <div key={w.name} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 hover:border-[#F87404]/30 hover:bg-[#F87404]/5 transition-all cursor-pointer group">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: w.color + '15' }}>
                      <w.icon size={18} style={{ color: w.color }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-gray-900">{w.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        <span><Clock size={11} className="inline mr-0.5" />{w.duration}</span>
                        <span>{w.level}</span>
                      </div>
                    </div>
                    <button className="flex items-center gap-1.5 text-xs font-semibold text-[#F87404] bg-[#F87404]/10 px-3 py-1.5 rounded-lg group-hover:bg-[#F87404] group-hover:text-white transition-all">
                      <Zap size={12} /> Start
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Body Weight Chart */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Body Weight (12 weeks)</h2>
            <span className="text-sm text-[#F87404] font-medium">{mockBodyStats[mockBodyStats.length - 1]?.weight} lbs</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={mockBodyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
              <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} width={35} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="weight" name="Weight (lbs)" stroke="#F87404" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#F87404' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

      </div>
    </DashboardShell>
  );
}
