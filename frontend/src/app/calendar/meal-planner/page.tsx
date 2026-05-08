'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, ChevronRight, Plus, Utensils, Flame, X } from 'lucide-react';
import Link from 'next/link';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

const initialPlan: Record<string, Record<string, { name: string; calories: number } | null>> = {
  Mon: { Breakfast: { name: 'Overnight Oats', calories: 412 }, Lunch: { name: 'Chicken Bowl', calories: 485 }, Dinner: { name: 'Salmon & Quinoa', calories: 520 }, Snack: null },
  Tue: { Breakfast: { name: 'Scrambled Eggs & Toast', calories: 372 }, Lunch: { name: 'Turkey Wrap', calories: 420 }, Dinner: null, Snack: { name: 'Greek Yogurt', calories: 130 } },
  Wed: { Breakfast: null, Lunch: null, Dinner: { name: 'Turkey Taco Bowls', calories: 455 }, Snack: null },
  Thu: { Breakfast: { name: 'Protein Smoothie', calories: 310 }, Lunch: null, Dinner: null, Snack: null },
  Fri: { Breakfast: null, Lunch: null, Dinner: null, Snack: null },
  Sat: { Breakfast: null, Lunch: null, Dinner: null, Snack: null },
  Sun: { Breakfast: { name: 'Pancakes (protein)', calories: 380 }, Lunch: { name: 'Meal Prep Bowl', calories: 510 }, Dinner: null, Snack: null },
};

const mealSuggestions = [
  { name: 'Overnight Oats', calories: 412 },
  { name: 'Scrambled Eggs', calories: 234 },
  { name: 'Chicken Bowl', calories: 485 },
  { name: 'Salmon & Quinoa', calories: 520 },
  { name: 'Turkey Tacos', calories: 455 },
  { name: 'Protein Smoothie', calories: 310 },
];

export default function MealPlannerPage() {
  const [plan, setPlan] = useState(initialPlan);
  const [selectedCell, setSelectedCell] = useState<{ day: string; meal: string } | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const getDayCalories = (day: string) =>
    Object.values(plan[day]).reduce((s, m) => s + (m?.calories || 0), 0);

  const clearMeal = (day: string, meal: string) => {
    setPlan(p => ({ ...p, [day]: { ...p[day], [meal]: null } }));
  };

  const addMeal = (day: string, meal: string, suggestion: { name: string; calories: number }) => {
    setPlan(p => ({ ...p, [day]: { ...p[day], [meal]: suggestion } }));
    setSelectedCell(null);
  };

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/calendar">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Meal Planner</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Plan your nutrition for the week</p>
          </div>
        </div>

        {/* Week Nav */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => setWeekOffset(w => w - 1)} className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-[#F87404] transition-colors">
            <ChevronLeft size={16} /> Prev Week
          </button>
          <span className="font-semibold text-gray-900 dark:text-white text-sm">
            {weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : `Week ${weekOffset > 0 ? '+' : ''}${weekOffset}`}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)} className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-[#F87404] transition-colors">
            Next Week <ChevronRight size={16} />
          </button>
        </div>

        {/* Mobile-friendly meal grid */}
        <div className="space-y-4">
          {DAYS.map(day => (
            <Card key={day}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white">{day}</span>
                    <span className="text-xs text-gray-400">— {getDayCalories(day)} kcal</span>
                  </div>
                  <div className="h-1.5 w-20 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#F87404] rounded-full transition-all" style={{ width: `${Math.min((getDayCalories(day) / 2000) * 100, 100)}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {MEALS.map(meal => {
                    const entry = plan[day][meal];
                    return (
                      <div key={meal} className="relative">
                        {entry ? (
                          <div className="p-2.5 bg-[#F87404]/10 border border-[#F87404]/20 rounded-xl">
                            <div className="flex items-start justify-between mb-0.5">
                              <span className="text-xs font-medium text-[#F87404]">{meal}</span>
                              <button onClick={() => clearMeal(day, meal)} className="text-gray-400 hover:text-red-500 -mt-0.5 -mr-0.5">
                                <X size={12} />
                              </button>
                            </div>
                            <div className="text-xs font-medium text-gray-900 dark:text-white leading-snug">{entry.name}</div>
                            <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Flame size={9} className="text-[#F87404]" /> {entry.calories}
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setSelectedCell({ day, meal })}
                            className="w-full p-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 hover:border-[#F87404]/40 transition-all flex flex-col items-center gap-1">
                            <span className="text-xs text-gray-400">{meal}</span>
                            <Plus size={14} className="text-gray-300 dark:text-gray-600" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Meal Picker Modal */}
        {selectedCell && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedCell(null)} />
            <div className="relative w-full sm:max-w-sm bg-white dark:bg-[#1a1a1a] rounded-t-3xl sm:rounded-3xl p-5 z-10 shadow-2xl border border-gray-100 dark:border-white/[0.07]">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Add {selectedCell.meal}</h3>
              <p className="text-xs text-gray-400 mb-4">{selectedCell.day}</p>
              <div className="space-y-2">
                {mealSuggestions.map(s => (
                  <button key={s.name} onClick={() => addMeal(selectedCell.day, selectedCell.meal, s)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors text-left border border-transparent hover:border-[#F87404]/20">
                    <div className="flex items-center gap-2">
                      <Utensils size={14} className="text-[#F87404]" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</span>
                    </div>
                    <span className="text-xs text-gray-400">{s.calories} kcal</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setSelectedCell(null)} className="mt-3 text-xs text-gray-400 w-full text-center py-1">Cancel</button>
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
