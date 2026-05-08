'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ChevronLeft, Target, Plus, CheckCircle, Edit3, Trash2, Trophy, Zap, Calendar } from 'lucide-react';
import Link from 'next/link';

const initialGoals = [
  { id: '1', title: 'Bench Press 225 lbs', category: 'Strength', current: 185, target: 225, unit: 'lbs', deadline: '2025-06-30', color: '#F87404', emoji: '🏋️', completed: false },
  { id: '2', title: 'Run 5K in under 25 min', category: 'Cardio', current: 27.5, target: 25, unit: 'min', deadline: '2025-05-15', color: '#004AAD', emoji: '🏃', completed: false, lowerIsBetter: true },
  { id: '3', title: 'Lose 15 lbs', category: 'Weight', current: 12, target: 15, unit: 'lbs lost', deadline: '2025-07-01', color: '#10B981', emoji: '⚖️', completed: false },
  { id: '4', title: 'Complete 30-day streak', category: 'Consistency', current: 30, target: 30, unit: 'days', deadline: '2025-04-30', color: '#FFC000', emoji: '🔥', completed: true },
];

const categories = ['All', 'Strength', 'Cardio', 'Weight', 'Consistency', 'Flexibility'];

export default function FitnessGoalsPage() {
  const [goals, setGoals] = useState(initialGoals);
  const [filter, setFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', category: 'Strength', target: '', unit: 'lbs', deadline: '' });

  const filtered = goals.filter(g => filter === 'All' || g.category === filter);
  const completed = goals.filter(g => g.completed).length;

  const getProgress = (g: typeof initialGoals[0]) => {
    if (g.lowerIsBetter) {
      const baseline = g.current * 1.2;
      return Math.min(((baseline - g.current) / (baseline - g.target)) * 100, 100);
    }
    return Math.min((g.current / g.target) * 100, 100);
  };

  const toggleComplete = (id: string) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  };

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
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Fitness Goals</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{completed}/{goals.length} goals completed</p>
          </div>
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowAdd(true)}>Add Goal</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Total Goals', val: goals.length, icon: Target, color: '#F87404' },
            { label: 'Completed', val: completed, icon: Trophy, color: '#FFC000' },
            { label: 'In Progress', val: goals.length - completed, icon: Zap, color: '#004AAD' },
          ].map(({ label, val, icon: Icon, color }) => (
            <Card key={label} padding="sm">
              <div className="p-4 text-center">
                <Icon size={18} className="mx-auto mb-1.5" style={{ color }} />
                <div className="font-display font-bold text-gray-900 dark:text-white text-xl">{val}</div>
                <div className="text-xs text-gray-400">{label}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-all ${filter === cat ? 'bg-[#F87404] text-white shadow-md shadow-orange-500/20' : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Goals List */}
        <div className="space-y-4 mb-5">
          {filtered.map((goal) => {
            const progress = getProgress(goal);
            const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000);

            return (
              <Card key={goal.id} className={goal.completed ? 'opacity-70' : ''}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{goal.emoji}</div>
                      <div>
                        <div className={`font-semibold text-sm ${goal.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                          {goal.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: goal.color + '20', color: goal.color }}>
                            {goal.category}
                          </span>
                          {!goal.completed && daysLeft > 0 && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Calendar size={10} />{daysLeft} days left
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => toggleComplete(goal.id)}
                        className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${goal.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600 hover:border-green-500'}`}>
                        {goal.completed && <CheckCircle size={14} className="text-white" />}
                      </button>
                      <button className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#F87404] hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">
                        <Edit3 size={13} />
                      </button>
                      <button onClick={() => setGoals(prev => prev.filter(g => g.id !== goal.id))}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-end justify-between mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {goal.lowerIsBetter ? `${goal.current} → ${goal.target} ${goal.unit}` : `${goal.current} / ${goal.target} ${goal.unit}`}
                    </span>
                    <span className="text-xs font-bold" style={{ color: goal.color }}>{Math.round(progress)}%</span>
                  </div>
                  <ProgressBar value={progress} max={100} color={goal.completed ? '#10B981' : goal.color} height={6} />
                </div>
              </Card>
            );
          })}
        </div>

        {/* Add Goal Modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
            <div className="relative w-full sm:max-w-md bg-white dark:bg-[#1a1a1a] rounded-t-3xl sm:rounded-3xl p-6 z-10 border border-gray-100 dark:border-white/[0.07] shadow-2xl">
              <h3 className="font-display text-xl font-bold text-gray-900 dark:text-white mb-5">Add New Goal</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Goal Title</label>
                  <input value={newGoal.title} onChange={e => setNewGoal(g => ({ ...g, title: e.target.value }))}
                    placeholder="e.g., Squat 300 lbs"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Target Value</label>
                    <input type="number" value={newGoal.target} onChange={e => setNewGoal(g => ({ ...g, target: e.target.value }))}
                      placeholder="300"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Unit</label>
                    <input value={newGoal.unit} onChange={e => setNewGoal(g => ({ ...g, unit: e.target.value }))}
                      placeholder="lbs"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Target Date</label>
                  <input type="date" value={newGoal.deadline} onChange={e => setNewGoal(g => ({ ...g, deadline: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50" />
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" fullWidth onClick={() => setShowAdd(false)}>Cancel</Button>
                  <Button fullWidth onClick={() => {
                    if (newGoal.title && newGoal.target) {
                      setGoals(prev => [...prev, {
                        id: Date.now().toString(), title: newGoal.title, category: newGoal.category,
                        current: 0, target: parseFloat(newGoal.target), unit: newGoal.unit,
                        deadline: newGoal.deadline || '2025-12-31', color: '#F87404',
                        emoji: '🎯', completed: false,
                      }]);
                      setShowAdd(false);
                    }
                  }}>Add Goal</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
