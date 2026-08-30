'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { ChevronLeft, ChevronRight, Plus, Utensils, Flame, X, Search, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const DAY_KEYS = ['day.sunday', 'day.monday', 'day.tuesday', 'day.wednesday', 'day.thursday', 'day.friday', 'day.saturday'];
const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
// Dictionary keys, not sentences — module scope runs before the component
// mounts, so these are resolved with t() at render time.
const MEAL_LABEL_KEYS: Record<string, string> = {
  breakfast: 'common.breakfast', lunch: 'common.lunch',
  dinner: 'common.dinner', snack: 'common.snack',
};

interface MealPlanEntry {
  id: number; recipe_id: number | null; recipe_name: string | null;
  day_of_week: number; meal_slot: string; notes: string | null;
}
interface RecipeOption { id: number; name: string; calories: number }

function getWeekStart(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + offset * 7);
  return d.toISOString().split('T')[0];
}

export default function MealPlannerPage() {
  const { t } = useI18nStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [plans, setPlans] = useState<MealPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ day: number; meal: string } | null>(null);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeResults, setRecipeResults] = useState<RecipeOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  const weekStart = getWeekStart(weekOffset);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/calendar/meal-plans', { params: { week_start: weekStart } });
      setPlans(res.data.meal_plans ?? []);
    } catch {
      toast.error(t('mealPlanner.error.load'));
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  useEffect(() => {
    if (!recipeSearch.trim()) { setRecipeResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/recipes', { params: { search: recipeSearch } });
        setRecipeResults((res.data.data ?? []).slice(0, 8));
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [recipeSearch]);

  const entryFor = (day: number, meal: string) => plans.find(p => p.day_of_week === day && p.meal_slot === meal);

  const getDayCalories = (day: number) => {
    // Calories aren't stored on the meal plan row itself; this shows entry count as a lightweight proxy.
    return MEAL_SLOTS.filter(m => entryFor(day, m)).length;
  };

  const clearMeal = async (entry: MealPlanEntry) => {
    setPlans(p => p.filter(e => e.id !== entry.id));
    try {
      await api.delete(`/calendar/meal-plans/${entry.id}`);
    } catch {
      toast.error(t('mealPlanner.error.remove'));
      loadPlans();
    }
  };

  const addMeal = async (recipe: RecipeOption) => {
    if (!selectedCell) return;
    setAdding(true);
    try {
      const res = await api.post(`/recipes/${recipe.id}/meal-plan`, {
        week_start: weekStart,
        day_of_week: selectedCell.day,
        meal_slot: selectedCell.meal,
      });
      toast.success(res.data.message);
      setSelectedCell(null);
      setRecipeSearch('');
      await loadPlans();
    } catch {
      toast.error(t('mealPlanner.error.add'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto px-4 py-6">

        <PageHeader
        title={t('mealPlanner.title')}
        subtitle={t('mealPlanner.subtitle')}
        back="/calendar"
      />

        {/* Week Nav */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => setWeekOffset(w => w - 1)} className="flex items-center gap-1.5 text-sm text-content-secondary hover:text-accent transition-colors">
            <ChevronLeft size={16} /> {t('mealPlanner.prevWeek')}
          </button>
          <span className="font-semibold text-content-primary text-sm">
            {weekOffset === 0 ? t('mealPlanner.thisWeek') : weekOffset === 1 ? t('mealPlanner.nextWeek') : weekOffset === -1 ? t('mealPlanner.lastWeek') : `Week of ${weekStart}`}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)} className="flex items-center gap-1.5 text-sm text-content-secondary hover:text-accent transition-colors">
            {t('mealPlanner.nextWeek')} <ChevronRight size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-accent" />
          </div>
        ) : (
          <div className="space-y-4">
            {DAY_KEYS.map((dayKey, day) => (
              <Card key={day}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-content-primary">{t(dayKey)}</span>
                      <span className="text-xs text-content-tertiary">{t('mealPlanner.mealsPlanned', { done: getDayCalories(day) })}</span>
                    </div>
                    <div className="h-1.5 w-20 bg-surface-sunken rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(getDayCalories(day) / 4) * 100}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {MEAL_SLOTS.map(meal => {
                      const entry = entryFor(day, meal);
                      return (
                        <div key={meal} className="relative">
                          {entry ? (
                            <div className="p-2.5 bg-accent-surface border border-accent/20 rounded-md">
                              <div className="flex items-start justify-between mb-0.5">
                                <span className="text-xs font-medium text-accent">{t(MEAL_LABEL_KEYS[meal])}</span>
                                <button onClick={() => clearMeal(entry)} className="text-content-tertiary hover:text-red-500 -mt-0.5 -mr-0.5">
                                  <X size={12} />
                                </button>
                              </div>
                              <div className="text-xs font-medium text-content-primary leading-snug line-clamp-2">{entry.recipe_name}</div>
                            </div>
                          ) : (
                            <button onClick={() => setSelectedCell({ day, meal })}
                              // The visible label is just the meal name plus a
                              // plus icon, which reads as a heading rather than
                              // a control to anyone not looking at the dashes.
                              aria-label={t('mealPlanner.addMealFor', { meal: t(MEAL_LABEL_KEYS[meal]), day: t(DAY_KEYS[day]) })}
                              className="w-full h-full min-h-[70px] p-2.5 rounded-md border-2 border-dashed border-border-strong hover:border-accent/40 transition-all flex flex-col items-center justify-center gap-1">
                              <span className="text-xs text-content-tertiary">{t(MEAL_LABEL_KEYS[meal])}</span>
                              <Plus size={14} className="text-content-tertiary dark:text-content-secondary" />
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
        )}

        {/* Recipe Picker Modal */}
        {selectedCell && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setSelectedCell(null); setRecipeSearch(''); }} />
            <div className="relative w-full sm:max-w-sm bg-surface-raised rounded-t-3xl sm:rounded-md p-5 z-10 border border-border-subtle">
              <h3 className="font-semibold text-content-primary mb-1">{t('mealPlanner.addMeal', { meal: t(MEAL_LABEL_KEYS[selectedCell.meal]) })}</h3>
              <p className="text-xs text-content-tertiary mb-4">{t(DAY_KEYS[selectedCell.day])}</p>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
                <input value={recipeSearch} onChange={e => setRecipeSearch(e.target.value)} autoFocus
                  placeholder={t('mealPlanner.search')}
                  className="w-full pl-8 pr-3 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary animate-spin" />}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recipeResults.length === 0 && recipeSearch.trim() && !searching && (
                  <p className="text-sm text-content-tertiary text-center py-4">{t('mealPlanner.noRecipes')}</p>
                )}
                {!recipeSearch.trim() && (
                  <p className="text-sm text-content-tertiary text-center py-4">{t('mealPlanner.searchAdd')}</p>
                )}
                {recipeResults.map(r => (
                  <button key={r.id} onClick={() => addMeal(r)} disabled={adding}
                    className="w-full flex items-center justify-between p-3 rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors text-left border border-transparent hover:border-accent/20 disabled:opacity-60">
                    <div className="flex items-center gap-2">
                      <Utensils size={14} className="text-accent" />
                      <span className="text-sm font-medium text-content-primary">{r.name}</span>
                    </div>
                    <span className="text-xs text-content-tertiary flex items-center gap-1"><Flame size={10} />{r.calories} kcal</span>
                  </button>
                ))}
              </div>
              <button onClick={() => { setSelectedCell(null); setRecipeSearch(''); }} className="mt-3 text-xs text-content-tertiary w-full text-center py-1">{t('common.cancel')}</button>
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
