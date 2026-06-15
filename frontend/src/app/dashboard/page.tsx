'use client';
import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { MacroBar } from '@/components/ui/MacroBar';
import { mockFoodLog, mockWorkouts } from '@/lib/mockData';
import { Utensils, Plus, Dumbbell, Droplets, Scale, ChevronRight, Shield, Users, Key, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';

const MOCK_NUTRITION = {
  calories_consumed: mockFoodLog.consumed.calories,
  calorie_goal: mockFoodLog.dailyGoal.calories,
  protein_g: mockFoodLog.consumed.protein,
  goal_protein: mockFoodLog.dailyGoal.protein,
  carbs_g: mockFoodLog.consumed.carbs,
  goal_carbs: mockFoodLog.dailyGoal.carbs,
  fat_g: mockFoodLog.consumed.fat,
  goal_fat: mockFoodLog.dailyGoal.fat,
};

const MOCK_FOOD_ENTRIES = [
  ...mockFoodLog.meals.breakfast.map((f: any) => ({ ...f, meal_type: 'breakfast' })),
  ...mockFoodLog.meals.lunch.map((f: any) => ({ ...f, meal_type: 'lunch' })),
].slice(0, 5);

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [waterGlasses, setWaterGlasses] = useState(mockFoodLog.waterGlasses);
  const waterGoal = mockFoodLog.waterGoal;

  const n = MOCK_NUTRITION;
  const calPct = n.calorie_goal ? Math.min(100, Math.round((n.calories_consumed / n.calorie_goal) * 100)) : 0;
  const remaining = Math.max(0, n.calorie_goal - n.calories_consumed);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        {user?.is_on_trial && (
          <Badge variant="trial" className="text-sm px-3 py-1.5">
            🔥 {user.trial_days_remaining} days left
          </Badge>
        )}
      </div>

      {/* Admin quick-access banner */}
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
              <Link href="/food-journal" className="text-xs text-[#F87404] hover:underline flex items-center gap-1">View Log <ChevronRight size={12} /></Link>
            </CardHeader>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-44 h-44 flex-shrink-0">
                <ProgressRing
                  value={n.calories_consumed}
                  maxValue={n.calorie_goal}
                  text={Math.round(n.calories_consumed).toString()}
                  subText="kcal eaten"
                  pathColor={calPct > 100 ? '#FF0404' : '#F87404'}
                />
              </div>
              <div className="flex-1 w-full space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Goal: <strong className="text-gray-900 dark:text-white">{n.calorie_goal} kcal</strong></span>
                  <span className="text-gray-500 dark:text-gray-400">Remaining: <strong className="text-[#3FB950]">{Math.round(remaining)} kcal</strong></span>
                </div>
                <MacroBar label="Protein" current={n.protein_g} goal={n.goal_protein} color="#F87404" />
                <MacroBar label="Carbs" current={n.carbs_g} goal={n.goal_carbs} color="#F97316" />
                <MacroBar label="Fat" current={n.fat_g} goal={n.goal_fat} color="#FFC000" />
              </div>
            </div>
          </Card>

          {/* Today's food log preview */}
          <Card>
            <CardHeader>
              <CardTitle>Food Log</CardTitle>
              <Link href="/food-journal">
                <Button variant="secondary" size="sm"><Plus size={14} /> Add Food</Button>
              </Link>
            </CardHeader>
            {MOCK_FOOD_ENTRIES.length > 0 ? (
              <div className="space-y-2">
                {MOCK_FOOD_ENTRIES.map((entry: any) => (
                  <div key={entry.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#F87404]/10 flex items-center justify-center">
                        <Utensils size={14} className="text-[#F87404]" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white font-medium">{entry.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{entry.meal_type}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{Math.round(entry.calories)} kcal</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Utensils size={32} className="text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No food logged today</p>
                <Link href="/food-journal"><Button size="sm" className="mt-3">Log your first meal</Button></Link>
              </div>
            )}
          </Card>

          {/* Fitness preview */}
          <Card>
            <CardHeader>
              <CardTitle>Today's Fitness</CardTitle>
              <Link href="/fitness"><Button variant="secondary" size="sm"><Plus size={14} /> Log Workout</Button></Link>
            </CardHeader>
            {mockWorkouts.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">1</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Workouts</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#FF0404]">{mockWorkouts[0]?.calories ?? 380}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Kcal burned</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#F87404]">{mockWorkouts[0]?.duration ?? 45}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Minutes</p>
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

            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-4xl font-black text-gray-900 dark:text-white leading-none">
                  {waterGlasses}
                  <span className="text-lg font-semibold text-gray-400 ml-1">/ {waterGoal}</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">glasses today</p>
              </div>
              {waterGlasses >= waterGoal && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  ✓ Goal reached!
                </span>
              )}
            </div>

            <div className="flex gap-1.5 flex-wrap mb-4">
              {Array.from({ length: waterGoal }).map((_, i) => (
                <div key={i}
                  className={`flex-1 min-w-[28px] h-9 rounded-xl flex items-center justify-center transition-all ${
                    i < waterGlasses
                      ? 'bg-[#F87404] shadow-sm shadow-[#F87404]/20'
                      : 'bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10'
                  }`}>
                  <Droplets size={14} className={i < waterGlasses ? 'text-white' : 'text-gray-300 dark:text-gray-600'} />
                </div>
              ))}
            </div>

            <div className="h-1.5 bg-gray-100 dark:bg-white/10 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-[#F87404] rounded-full transition-all"
                style={{ width: `${Math.min(100, (waterGlasses / waterGoal) * 100)}%` }}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (waterGlasses > 0) {
                    setWaterGlasses(v => v - 1);
                    toast.success('Water removed');
                  }
                }}
                disabled={waterGlasses <= 0}
                className="flex-1 h-9 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 font-bold text-lg hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-40 transition-all"
              >−</button>
              <button
                onClick={() => {
                  setWaterGlasses(v => v + 1);
                  toast.success('Glass of water logged! 💧');
                }}
                className="flex-[2] h-9 rounded-xl bg-[#F87404] hover:bg-[#e06000] text-white font-semibold text-sm flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-[#F87404]/25"
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Upgrade to keep all your data & access</p>
                <Link href="/membership"><Button size="sm" variant="warning" className="w-full">Upgrade — from $7.99/mo</Button></Link>
              </div>
            </Card>
          )}

          {/* Quick stats */}
          <Card>
            <CardHeader><CardTitle>Quick Stats</CardTitle></CardHeader>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2"><Scale size={14} /> Current Weight</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{user?.current_weight_kg ? `${user.current_weight_kg} kg` : '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Goal Weight</span>
                <span className="text-sm font-semibold text-[#3FB950]">{user?.goal_weight_kg ? `${user.goal_weight_kg} kg` : '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Daily Goal</span>
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
