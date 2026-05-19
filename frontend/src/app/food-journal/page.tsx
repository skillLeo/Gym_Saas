'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RingChart } from '@/components/ui/RingChart';
import { mockFoodLog } from '@/lib/mockData';
import {
  Plus, ChevronLeft, ChevronRight, Droplets, Camera, Mic, Barcode,
  Trash2, Search, Coffee, Sun, Sunset, Apple, ChevronDown, ChevronUp,
  BookOpen, TrendingUp, Check, X
} from 'lucide-react';
import Link from 'next/link';

const meals = [
  { key: 'breakfast', label: 'Breakfast', icon: Coffee, color: '#F87404', target: 500 },
  { key: 'lunch', label: 'Lunch', icon: Sun, color: '#004AAD', target: 600 },
  { key: 'dinner', label: 'Dinner', icon: Sunset, color: '#7C3AED', target: 600 },
  { key: 'snacks', label: 'Snacks', icon: Apple, color: '#10B981', target: 300 },
] as const;

type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

function getMealCalories(items: typeof mockFoodLog.meals.breakfast) {
  return items.reduce((sum, i) => sum + i.calories, 0);
}

type FoodItem = {
  name: string; calories: number; protein: number; carbs: number; fat: number; serving: string;
  images: string[];
};

const ALL_FOODS: FoodItem[] = [
  {
    name: 'Banana', calories: 89, protein: 1, carbs: 23, fat: 0, serving: '1 medium',
    images: [
      'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1543218024-57a70143c369?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=200&h=200&fit=crop',
    ],
  },
  {
    name: 'Protein Shake', calories: 150, protein: 25, carbs: 8, fat: 3, serving: '1 scoop',
    images: [
      'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1607013407627-6ee814329547?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=200&h=200&fit=crop',
    ],
  },
  {
    name: 'Apple', calories: 72, protein: 0, carbs: 19, fat: 0, serving: '1 medium',
    images: [
      'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1576179635662-9d1983e97e1e?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=200&h=200&fit=crop',
    ],
  },
  {
    name: 'Boiled Egg', calories: 78, protein: 6, carbs: 1, fat: 5, serving: '1 large',
    images: [
      'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1607532941433-304659e8198a?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1582169505937-b9992bd01ed9?w=200&h=200&fit=crop',
    ],
  },
  {
    name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 4, serving: '3.5 oz',
    images: [
      'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1569058242567-93de6f36f8eb?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=200&fit=crop',
    ],
  },
  {
    name: 'Oatmeal', calories: 158, protein: 6, carbs: 27, fat: 3, serving: '1 cup cooked',
    images: [
      'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=200&h=200&fit=crop',
    ],
  },
  {
    name: 'Greek Yogurt', calories: 100, protein: 17, carbs: 6, fat: 0, serving: '170g',
    images: [
      'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1571212515416-fca988083e7d?w=200&h=200&fit=crop',
    ],
  },
  {
    name: 'Salmon', calories: 208, protein: 28, carbs: 0, fat: 10, serving: '4 oz',
    images: [
      'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1574781330855-d0db8cc6a79c?w=200&h=200&fit=crop',
    ],
  },
];

export default function FoodJournalPage() {
  const [date, setDate] = useState(new Date());
  const [expanded, setExpanded] = useState<MealKey | null>('breakfast');
  const [water, setWater] = useState(mockFoodLog.waterGlasses);
  const [showAddFood, setShowAddFood] = useState<MealKey | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [imagePicker, setImagePicker] = useState<{ food: FoodItem; selectedIdx: number } | null>(null);

  const { dailyGoal, consumed, meals: mealData } = mockFoodLog;

  const caloriesLeft = dailyGoal.calories - consumed.calories;
  const caloriesPercent = Math.min((consumed.calories / dailyGoal.calories) * 100, 100);

  const formatDate = (d: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const changeDate = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    if (d <= new Date()) setDate(d);
  };

  const quickSearchFoods = ALL_FOODS.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Food Journal</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Track every meal, every day</p>
          </div>
          <Link href="/food-journal/history">
            <Button variant="outline" size="sm" icon={<TrendingUp size={15} />}>History</Button>
          </Link>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center justify-between bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] px-4 py-3 mb-5 shadow-sm">
          <button onClick={() => changeDate(-1)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="text-center">
            <div className="font-semibold text-gray-900 dark:text-white">{formatDate(date)}</div>
            <div className="text-xs text-gray-400">{date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <button onClick={() => changeDate(1)} disabled={date.toDateString() === new Date().toDateString()}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-30">
            <ChevronRight size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Calorie Summary */}
        <Card className="mb-5 overflow-hidden">
          <div className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Daily Summary</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-bold text-gray-900 dark:text-white">{consumed.calories.toLocaleString()}</span>
                  <span className="text-gray-400 text-sm">/ {dailyGoal.calories.toLocaleString()} kcal</span>
                </div>
                <p className="text-sm mt-1">
                  <span className={caloriesLeft > 0 ? 'text-green-500' : 'text-red-500'}>
                    {caloriesLeft > 0 ? `${caloriesLeft} kcal remaining` : `${Math.abs(caloriesLeft)} kcal over`}
                  </span>
                </p>
              </div>
              <RingChart
                value={caloriesPercent}
                max={100}
                size={80}
                strokeWidth={8}
                color="#F87404"
                label={`${Math.round(caloriesPercent)}%`}
                sublabel="done"
              />
            </div>
            <ProgressBar value={caloriesPercent} max={100} color="#F87404" height={6} />
          </div>

          {/* Macros */}
          <div className="border-t border-gray-100 dark:border-white/[0.07] grid grid-cols-3 divide-x divide-gray-100 dark:divide-white/[0.07]">
            {[
              { label: 'Protein', val: consumed.protein, goal: dailyGoal.protein, color: '#F87404', unit: 'g' },
              { label: 'Carbs', val: consumed.carbs, goal: dailyGoal.carbs, color: '#004AAD', unit: 'g' },
              { label: 'Fat', val: consumed.fat, goal: dailyGoal.fat, color: '#7C3AED', unit: 'g' },
            ].map(({ label, val, goal, color, unit }) => (
              <div key={label} className="p-4 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
                <div className="font-bold text-gray-900 dark:text-white text-lg" style={{ color }}>{val}{unit}</div>
                <div className="text-xs text-gray-400">/ {goal}{unit}</div>
                <div className="mt-2">
                  <ProgressBar value={Math.min((val / goal) * 100, 100)} max={100} color={color} height={3} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Log Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <Link href="/food-journal/barcode">
            <button className="w-full flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/50 transition-all shadow-sm">
              <Barcode size={20} className="text-[#F87404]" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Scan Barcode</span>
            </button>
          </Link>
          <Link href="/food-journal/photo-log">
            <button className="w-full flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#004AAD]/50 transition-all shadow-sm">
              <Camera size={20} className="text-[#004AAD]" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Photo Log</span>
            </button>
          </Link>
          <Link href="/food-journal/voice-log">
            <button className="w-full flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#10B981]/50 transition-all shadow-sm">
              <Mic size={20} className="text-[#10B981]" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Voice Log</span>
            </button>
          </Link>
        </div>

        {/* Meal Sections */}
        <div className="space-y-3 mb-5">
          {meals.map(({ key, label, icon: Icon, color, target }) => {
            const items = mealData[key as MealKey] as typeof mockFoodLog.meals.breakfast;
            const mealCals = getMealCalories(items);
            const isExpanded = expanded === key;

            return (
              <div key={key} className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] overflow-hidden shadow-sm">
                <button
                  onClick={() => setExpanded(isExpanded ? null : key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-gray-900 dark:text-white text-sm">{label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{items.length} item{items.length !== 1 ? 's' : ''} · {mealCals} kcal</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-gray-400">{target} kcal target</div>
                      <div className="w-20 mt-1">
                        <ProgressBar value={Math.min((mealCals / target) * 100, 100)} max={100} color={color} height={3} />
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-white/[0.07]">
                    {items.length === 0 ? (
                      <div className="py-6 text-center">
                        <BookOpen size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                        <p className="text-sm text-gray-400">Nothing logged yet</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between px-4 py-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {item.serving} · P: {item.protein}g · C: {item.carbs}g · F: {item.fat}g
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-gray-900 dark:text-white text-sm">{item.calories}</span>
                              <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add food to this meal */}
                    {showAddFood === key ? (
                      <div className="p-4 border-t border-gray-100 dark:border-white/[0.07]">
                        <div className="relative mb-3">
                          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            autoFocus
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search foods..."
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F87404]/40 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          {quickSearchFoods.slice(0, 5).map(food => (
                            <button key={food.name}
                              onClick={() => setImagePicker({ food, selectedIdx: 0 })}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors text-left">
                              <img
                                src={food.images[0]}
                                alt={food.name}
                                className="w-11 h-11 rounded-xl object-cover shrink-0"
                                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{food.name}</div>
                                <div className="text-xs text-gray-400">{food.serving} · P: {food.protein}g · C: {food.carbs}g · F: {food.fat}g</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{food.calories} kcal</span>
                                <div className="w-6 h-6 rounded-full bg-[#F87404] flex items-center justify-center">
                                  <Plus size={12} className="text-white" />
                                </div>
                              </div>
                            </button>
                          ))}
                          {quickSearchFoods.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-3">No foods found</p>
                          )}
                        </div>
                        <button onClick={() => setShowAddFood(null)} className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-full text-center py-1">Cancel</button>
                      </div>
                    ) : (
                      <div className="px-4 pb-4 pt-2">
                        <button
                          onClick={() => { setShowAddFood(key); setSearchQuery(''); }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed transition-all text-sm font-medium"
                          style={{ borderColor: color + '40', color }}
                        >
                          <Plus size={16} /> Add Food
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Water Tracker */}
        <Card className="mb-20">
          <div className="p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F87404]/10 flex items-center justify-center">
                  <Droplets size={18} className="text-[#F87404]" />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900 dark:text-white">Water Intake</p>
                  <p className="text-xs text-gray-400">Stay hydrated throughout the day</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">
                  {water}<span className="text-base font-semibold text-gray-400"> / {mockFoodLog.waterGoal}</span>
                </p>
                <p className="text-[11px] text-gray-400">glasses</p>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              {Array.from({ length: mockFoodLog.waterGoal }).map((_, i) => (
                <button key={i} onClick={() => setWater(i + 1 <= water && i + 1 === water ? water - 1 : i + 1)}
                  className="flex-1 transition-all duration-200">
                  <div className={`h-11 rounded-xl flex items-center justify-center transition-all ${
                    i < water
                      ? 'bg-[#F87404] shadow-md shadow-[#F87404]/20'
                      : 'bg-gray-100 dark:bg-white/[0.07] border border-gray-200 dark:border-white/10'
                  }`}>
                    <Droplets size={14} className={i < water ? 'text-white' : 'text-gray-300'} />
                  </div>
                </button>
              ))}
            </div>

            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-[#F87404] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (water / mockFoodLog.waterGoal) * 100)}%` }}
              />
            </div>

            <p className="text-xs text-gray-400 text-center">
              {water >= mockFoodLog.waterGoal
                ? '✓ Daily goal reached! Great job 💪'
                : `${mockFoodLog.waterGoal - water} more glass${mockFoodLog.waterGoal - water !== 1 ? 'es' : ''} to reach your goal`}
            </p>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setWater(w => Math.max(0, w - 1))}
                disabled={water <= 0}
                className="w-12 h-11 rounded-xl border-2 border-gray-200 bg-white dark:bg-transparent dark:border-white/10 text-gray-700 dark:text-gray-300 font-bold text-xl hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40 transition-all flex items-center justify-center"
              >−</button>
              <button
                onClick={() => setWater(w => w + 1)}
                className="flex-1 h-11 rounded-xl bg-[#F87404] hover:bg-[#e06000] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-[#F87404]/25"
              >
                <Droplets size={16} /> + Add Glass
              </button>
            </div>
          </div>
        </Card>

      </div>

      {/* FAB */}
      <div className="fixed bottom-24 right-4 md:bottom-8">
        <button
          onClick={() => setExpanded('breakfast')}
          className="w-14 h-14 rounded-full bg-[#F87404] text-white flex items-center justify-center shadow-2xl shadow-orange-500/40 hover:bg-[#e66a00] transition-all active:scale-95">
          <Plus size={24} />
        </button>
      </div>

      {/* Food image picker modal */}
      {imagePicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setImagePicker(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-2xl z-10 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-white/[0.07]">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">{imagePicker.food.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Pick the photo that best matches what you ate</p>
              </div>
              <button onClick={() => setImagePicker(null)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Food info */}
            <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 dark:bg-white/[0.03]">
              {['Calories', 'Protein', 'Carbs', 'Fat'].map((label, i) => {
                const vals = [imagePicker.food.calories, imagePicker.food.protein, imagePicker.food.carbs, imagePicker.food.fat];
                const units = [' kcal', 'g', 'g', 'g'];
                const colors = ['#F87404', '#004AAD', '#10B981', '#7C3AED'];
                return (
                  <div key={label} className="flex-1 text-center">
                    <div className="text-xs font-bold" style={{ color: colors[i] }}>{vals[i]}{units[i]}</div>
                    <div className="text-[10px] text-gray-400">{label}</div>
                  </div>
                );
              })}
            </div>

            {/* Image grid */}
            <div className="p-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Select a photo</p>
              <div className="grid grid-cols-3 gap-2">
                {imagePicker.food.images.map((src, i) => (
                  <button key={i} onClick={() => setImagePicker(prev => prev ? { ...prev, selectedIdx: i } : null)}
                    className={`relative aspect-square rounded-2xl overflow-hidden transition-all ${
                      imagePicker.selectedIdx === i
                        ? 'ring-2 ring-[#F87404] ring-offset-2 dark:ring-offset-[#1a1a1a] scale-[1.03]'
                        : 'hover:scale-[1.02]'
                    }`}>
                    <img src={src} alt={imagePicker.food.name} className="w-full h-full object-cover" />
                    {imagePicker.selectedIdx === i && (
                      <div className="absolute inset-0 bg-[#F87404]/20 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-[#F87404] flex items-center justify-center shadow-lg">
                          <Check size={13} className="text-white" strokeWidth={3} />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 text-center mt-3">or skip and log without a photo</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setImagePicker(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                Skip Photo
              </button>
              <button onClick={() => { setImagePicker(null); setShowAddFood(null); setSearchQuery(''); }}
                className="flex-1 py-3 rounded-2xl bg-[#F87404] text-white text-sm font-semibold hover:bg-[#FF5C04] transition-colors shadow-md shadow-orange-500/25 flex items-center justify-center gap-2">
                <Check size={15} /> Add to Meal
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
