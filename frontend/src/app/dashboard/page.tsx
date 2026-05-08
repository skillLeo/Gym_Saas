'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { MacroBar } from '@/components/ui/MacroBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Utensils, Plus, Dumbbell, Droplets, Scale, ChevronRight, Shield, Users, Key, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data.data),
    refetchInterval: 60000,
  });

  const qc = useQueryClient();
  const waterMutation = useMutation({
    mutationFn: (action: 'increment' | 'decrement') => api.post(`/water-log/${action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-64">
      <LoadingSpinner size="lg" />
    </div>
  );

  const d = dashData;
  const n = d?.nutrition ?? {};
  const w = d?.water ?? {};
  const calPct = n.calorie_goal ? Math.min(100, Math.round((n.calories_consumed / n.calorie_goal) * 100)) : 0;
  const remaining = Math.max(0, (n.calorie_goal ?? 2000) - (n.calories_consumed ?? 0));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-gray-500 mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        {user?.is_on_trial && (
          <Badge variant="trial" className="text-sm px-3 py-1.5">
            🔥 {user.trial_days_remaining} days left
          </Badge>
        )}
      </div>

      {/* Admin quick-access banner — only for admins */}
      {user?.is_admin && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">Super Admin Access</p>
              <p className="text-blue-100 text-xs">You have full platform management rights</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { href: '/admin',          icon: BarChart2, label: 'Admin Panel' },
              { href: '/admin/users',    icon: Users,     label: 'Manage Users' },
              { href: '/admin/api-keys', icon: Key,       label: 'API Keys' },
            ].map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href} className="flex flex-col items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl py-3 px-2 transition-all">
                <Icon size={18} className="text-white" />
                <span className="text-[11px] font-semibold text-white/90 text-center leading-tight">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT: Calorie ring + macros (2 cols) */}
        <div className="lg:col-span-2 space-y-5">

          <Card>
            <CardHeader>
              <CardTitle>Today's Nutrition</CardTitle>
              <Link href="/food-log" className="text-xs text-[#F87404] hover:underline flex items-center gap-1">View Log <ChevronRight size={12} /></Link>
            </CardHeader>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-44 h-44 flex-shrink-0">
                <ProgressRing
                  value={n.calories_consumed ?? 0}
                  maxValue={n.calorie_goal ?? 2000}
                  text={Math.round(n.calories_consumed ?? 0).toString()}
                  subText="kcal eaten"
                  pathColor={calPct > 100 ? '#E63946' : '#F87404'}
                />
              </div>
              <div className="flex-1 w-full space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Goal: <strong className="text-gray-900">{n.calorie_goal ?? 2000} kcal</strong></span>
                  <span className="text-gray-500">Remaining: <strong className="text-[#3FB950]">{Math.round(remaining)} kcal</strong></span>
                </div>
                <MacroBar label="Protein" current={n.protein_g ?? 0} goal={n.goal_protein ?? 150} color="#F87404" />
                <MacroBar label="Carbs" current={n.carbs_g ?? 0} goal={n.goal_carbs ?? 200} color="#F97316" />
                <MacroBar label="Fat" current={n.fat_g ?? 0} goal={n.goal_fat ?? 65} color="#FACC15" />
              </div>
            </div>
          </Card>

          {/* Today's food log preview */}
          <Card>
            <CardHeader>
              <CardTitle>Food Log</CardTitle>
              <Link href="/food-log">
                <Button variant="secondary" size="sm"><Plus size={14} /> Add Food</Button>
              </Link>
            </CardHeader>
            {d?.recent_food_entries?.length > 0 ? (
              <div className="space-y-2">
                {d.recent_food_entries.map((entry: any) => (
                  <div key={entry.id} className="flex justify-between items-center py-2 border-b border-gray-200/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#F87404]/10 flex items-center justify-center">
                        <Utensils size={14} className="text-[#F87404]" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-900 font-medium">{entry.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{entry.meal_type}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{Math.round(entry.calories)} kcal</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Utensils size={32} className="text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No food logged today</p>
                <Link href="/food-log"><Button size="sm" className="mt-3">Log your first meal</Button></Link>
              </div>
            )}
          </Card>

          {/* Fitness preview */}
          <Card>
            <CardHeader>
              <CardTitle>Today's Fitness</CardTitle>
              <Link href="/fitness"><Button variant="secondary" size="sm"><Plus size={14} /> Log Workout</Button></Link>
            </CardHeader>
            {d?.fitness_today?.workouts_logged > 0 ? (
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{d.fitness_today.workouts_logged}</p>
                  <p className="text-xs text-gray-500">Workouts</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#E63946]">{d.fitness_today.calories_burned}</p>
                  <p className="text-xs text-gray-500">Kcal burned</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Dumbbell size={32} className="text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No workouts logged today</p>
                <p className="text-xs text-gray-400 mt-1">Head to Fitness to log your first workout</p>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT: Water + trial + quick stats */}
        <div className="space-y-5">

          {/* Water tracker */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#F87404]/10 flex items-center justify-center">
                  <Droplets size={14} className="text-[#F87404]" />
                </div>
                <CardTitle>Water Intake</CardTitle>
              </div>
            </CardHeader>

            {/* Big count */}
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-4xl font-black text-gray-900 leading-none">
                  {w.glasses_today ?? 0}
                  <span className="text-lg font-semibold text-gray-400 ml-1">/ {w.goal ?? 8}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">glasses today</p>
              </div>
              {(w.glasses_today ?? 0) >= (w.goal ?? 8) && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  ✓ Goal reached!
                </span>
              )}
            </div>

            {/* Glass icons */}
            <div className="flex gap-1.5 flex-wrap mb-4">
              {Array.from({ length: w.goal ?? 8 }).map((_, i) => (
                <div key={i}
                  className={`flex-1 min-w-[28px] h-9 rounded-xl flex items-center justify-center transition-all ${
                    i < (w.glasses_today ?? 0)
                      ? 'bg-[#F87404] shadow-sm shadow-[#F87404]/20'
                      : 'bg-gray-100 border border-gray-200'
                  }`}>
                  <Droplets size={14} className={i < (w.glasses_today ?? 0) ? 'text-white' : 'text-gray-300'} />
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-[#F87404] rounded-full transition-all"
                style={{ width: `${Math.min(100, ((w.glasses_today ?? 0) / (w.goal ?? 8)) * 100)}%` }}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => waterMutation.mutate('decrement')}
                disabled={waterMutation.isPending || (w.glasses_today ?? 0) <= 0}
                className="flex-1 h-9 rounded-xl border border-gray-200 bg-white text-gray-600 font-bold text-lg hover:bg-gray-50 disabled:opacity-40 transition-all"
              >−</button>
              <button
                onClick={() => waterMutation.mutate('increment')}
                disabled={waterMutation.isPending}
                className="flex-[2] h-9 rounded-xl bg-[#F87404] hover:bg-[#e06000] text-white font-semibold text-sm flex items-center justify-center gap-1.5 disabled:opacity-60 transition-all shadow-sm shadow-[#F87404]/25"
              >
                <Droplets size={14} /> + Glass
              </button>
            </div>
          </Card>

          {/* Trial card */}
          {user?.is_on_trial && (
            <Card>
              <CardHeader>
                <CardTitle>Free Trial</CardTitle>
                <Badge variant="trial">{user.trial_days_remaining}d left</Badge>
              </CardHeader>
              <div className="text-center py-2">
                <div className="w-24 h-24 mx-auto mb-3">
                  <ProgressRing value={30 - (user.trial_days_remaining ?? 0)} maxValue={30} text={`${user.trial_days_remaining}d`} subText="left" pathColor="#F97316" />
                </div>
                <p className="text-xs text-gray-500 mb-3">Upgrade to keep all your data & access</p>
                <Link href="/membership"><Button size="sm" variant="warning" className="w-full">Upgrade — from $7.99/mo</Button></Link>
              </div>
            </Card>
          )}

          {/* Quick stats */}
          <Card>
            <CardHeader><CardTitle>Quick Stats</CardTitle></CardHeader>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 flex items-center gap-2"><Scale size={14} /> Current Weight</span>
                <span className="text-sm font-semibold text-gray-900">{user?.current_weight_kg ? `${user.current_weight_kg} kg` : '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Goal Weight</span>
                <span className="text-sm font-semibold text-[#3FB950]">{user?.goal_weight_kg ? `${user.goal_weight_kg} kg` : '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Daily Goal</span>
                <span className="text-sm font-semibold text-[#F87404]">{user?.daily_calorie_goal ?? 2000} kcal</span>
              </div>
            </div>
            <Link href="/profile">
              <Button variant="ghost" size="sm" className="w-full mt-3">Update Stats</Button>
            </Link>
          </Card>

        </div>
      </div>
    </div>
  );
}
