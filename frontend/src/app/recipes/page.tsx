'use client';

import { useState, useEffect, useCallback } from 'react';
import { RecipeImage } from '@/components/ui/RecipeImage';
import Link from 'next/link';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Search, Bookmark, BookmarkCheck, Clock, Star, Plus, ChefHat,
  Heart, Zap, Leaf, Package, CalendarDays, CheckCircle, X, Loader2, Send, Pencil, Trash2,
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useI18nStore } from '@/store/i18nStore';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { getErrorMessage } from '@/lib/errors';

const CATEGORIES = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Smoothies'];
const TAGS = ['High Protein', 'Low Carb', 'Quick', 'Vegetarian', 'Meal Prep'] as const;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

const TAG_ICONS: Record<string, React.ReactNode> = {
  'High Protein': <Zap size={11} />,
  'Low Carb':     <Leaf size={11} />,
  'Quick':        <Clock size={11} />,
  'Vegetarian':   <Heart size={11} />,
  'Meal Prep':    <Package size={11} />,
};

// Canonical English values stay as data (sent to the API, used to key TAG_ICONS
// and to compare state) — these maps are display-only, same split as recipe-create.
const CATEGORY_KEYS: Record<string, string> = {
  All: 'goals.category.all', Breakfast: 'recipeCreate.category.breakfast', Lunch: 'recipeCreate.category.lunch',
  Dinner: 'recipeCreate.category.dinner', Snacks: 'recipeCreate.category.snacks', Smoothies: 'recipeCreate.category.smoothies',
};
const TAG_KEYS: Record<string, string> = {
  'High Protein': 'recipeCreate.tag.highProtein', 'Low Carb': 'recipeCreate.tag.lowCarb',
  Quick: 'recipeCreate.tag.quick', Vegetarian: 'recipeCreate.tag.vegetarian', 'Meal Prep': 'recipeCreate.tag.mealPrep',
};
const DIFFICULTY_KEYS: Record<string, string> = {
  Easy: 'recipeCreate.difficultyLevel.easy', Medium: 'recipeCreate.difficultyLevel.medium', Hard: 'recipeCreate.difficultyLevel.hard',
};
const DAY_KEYS: Record<string, string> = {
  Sun: 'recipes.day.sun', Mon: 'recipes.day.mon', Tue: 'recipes.day.tue', Wed: 'recipes.day.wed',
  Thu: 'recipes.day.thu', Fri: 'recipes.day.fri', Sat: 'recipes.day.sat',
};
const SLOT_KEYS: Record<string, string> = {
  breakfast: 'recipeCreate.category.breakfast', lunch: 'recipeCreate.category.lunch',
  dinner: 'recipeCreate.category.dinner', snack: 'recipes.slot.snack',
};

interface Recipe {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  category: string;
  difficulty: string | null;
  tags: string[];
  prep_time: number;
  cook_time: number;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  ingredients: { name: string; amount: string; unit: string }[];
  instructions: string[];
  rating: number;
  reviews_count: number;
  is_saved: boolean;
  /** Server-computed: only the author sees Edit and Delete. */
  is_mine?: boolean;
  /** private | pending | approved | rejected — only meaningful on your own. */
  status?: string;
  rejection_reason?: string | null;
}


interface JournalMealSlot { id: number; name: string; sort_order: number }

export default function RecipesPage() {
  const { t } = useI18nStore();
  const { confirm } = useConfirm();
  const [recipes, setRecipes]       = useState<Recipe[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [category, setCategory]     = useState('All');
  const [activeTag, setActiveTag]   = useState<string | null>(null);
  const [ingredient, setIngredient] = useState('');
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [calorieMin, setCalorieMin] = useState('');
  const [calorieMax, setCalorieMax] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [selected, setSelected]     = useState<Recipe | null>(null);
  const [savingId, setSavingId]     = useState<number | null>(null);
  const [journalSlots, setJournalSlots] = useState<JournalMealSlot[]>([]);
  const [logSlotId, setLogSlotId]   = useState<number | null>(null);
  const [logServings, setLogServings] = useState(1);
  const [loggedIds, setLoggedIds]   = useState<Record<number, boolean>>({});
  const [loggingId, setLoggingId]   = useState<number | null>(null);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [mealDay, setMealDay]       = useState('Mon');
  const [mealSlot, setMealSlot]     = useState<typeof SLOTS[number]>('lunch');
  const [mealAddedIds, setMealAddedIds] = useState<Record<number, boolean>>({});
  const [addingMeal, setAddingMeal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (category !== 'All') params.category = category;
      if (activeTag) params.tag = activeTag;
      if (ingredient.trim()) params.ingredient = ingredient.trim();
      if (difficulty) params.difficulty = difficulty;
      if (calorieMin) params.calorie_min = calorieMin;
      if (calorieMax) params.calorie_max = calorieMax;
      const res = await api.get('/recipes', { params });
      setRecipes(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      toast.error(t('recipes.toast.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, category, activeTag, ingredient, difficulty, calorieMin, calorieMax, t]);

  useEffect(() => {
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api.get('/meal-slots').then(res => {
      const slots = res.data.data ?? [];
      setJournalSlots(slots);
      if (slots.length) setLogSlotId(slots[0].id);
    }).catch(() => {});
  }, []);

  const toggleSave = async (e: React.MouseEvent, recipe: Recipe) => {
    e.stopPropagation();
    setSavingId(recipe.id);
    try {
      const res = await api.post(`/recipes/${recipe.id}/save`);
      const saved = res.data.is_saved;
      setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, is_saved: saved } : r));
      if (selected?.id === recipe.id) setSelected(r => r ? { ...r, is_saved: saved } : r);
      toast.success(saved ? t('recipes.toast.saved') : t('recipes.toast.unsaved'));
    } catch {
      toast.error(t('recipes.toast.failed'));
    } finally {
      setSavingId(null);
    }
  };

  // How far the displayed recipe is scaled from its own yield. 1 means the
  // recipe exactly as written. Also what gets sent when logging.
  const scaleRatio = logServings / (selected?.servings || 1);

  const submitForReview = async (recipe: Recipe) => {
    try {
      const res = await api.post(`/recipes/${recipe.id}/submit`);
      const updated = res.data.data;
      setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, ...updated } : r));
      setSelected(r => r ? { ...r, ...updated } : r);
      toast.success(res.data.message ?? 'Sent for review');
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not send this for review'));
    }
  };

  const deleteRecipe = async (recipe: Recipe) => {
    if (!(await confirm({
      title: `Delete "${recipe.name}"?`,
      message: 'This removes the recipe for good, along with any meal-plan entries using it. It cannot be undone.',
      confirmLabel: 'Delete recipe',
      destructive: true,
    }))) return;
    try {
      await api.delete(`/recipes/${recipe.id}`);
      setRecipes(prev => prev.filter(r => r.id !== recipe.id));
      closeModal();
      toast.success(t('recipes.deleted'));
    } catch (e) {
      toast.error(getErrorMessage(e, t('recipes.deleteFailed')));
    }
  };

  const logToJournal = async () => {
    if (!selected) return;
    if (!logSlotId) { toast.error(t('recipes.toast.noSlotSelected')); return; }
    setLoggingId(selected.id);
    try {
      await api.post(`/recipes/${selected.id}/log-journal`, {
        meal_slot_id: logSlotId,
        // Send the number of servings EATEN. The API multiplies by the recipe's
        // per-serving nutrition, so dividing by the yield first counted each
        // serving as a fraction of one: logging 2 servings of a 4-serving,
        // 500 kcal recipe recorded 62.5 kcal instead of 250 — a fourfold
        // undercount in someone's food diary.
        servings: logServings,
      });
      setLoggedIds(prev => ({ ...prev, [selected.id]: true }));
      toast.success(t('recipes.addedToJournal'));
    } catch {
      toast.error(t('recipes.toast.logFailed'));
    } finally {
      setLoggingId(null);
    }
  };

  const addToMealPlan = async () => {
    if (!selected) return;
    setAddingMeal(true);
    try {
      const dayIdx = DAYS.indexOf(mealDay);
      const today  = new Date();
      const dow    = today.getDay();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - dow);
      await api.post(`/recipes/${selected.id}/meal-plan`, {
        week_start:  weekStart.toISOString().slice(0, 10),
        day_of_week: dayIdx,
        meal_slot:   mealSlot,
      });
      setMealAddedIds(prev => ({ ...prev, [selected.id]: true }));
      setShowMealPicker(false);
      toast.success(t('recipes.addedToMealPlan'));
    } catch {
      toast.error(t('recipes.toast.failed'));
    } finally {
      setAddingMeal(false);
    }
  };

  const closeModal = () => {
    setSelected(null);
    setShowMealPicker(false);
  };

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto space-y-5 pb-6">

        <PageHeader
        title={t('recipes.title')}
        subtitle={t('recipes.subtitle', { n: loading ? '…' : total })}
        actions={
          <>
            <Link
              href="/recipes/saved"
              aria-label={t('recipes.savedAria')}
              className="h-11 w-11 rounded-sm flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition-colors"
            >
              <Bookmark size={20} strokeWidth={1.75} />
            </Link>
            <Link
              href="/recipes/create"
              aria-label={t('recipes.createAria')}
              className="h-11 w-11 rounded-sm flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition-colors"
            >
              <Plus size={20} strokeWidth={2} />
            </Link>
          </>
        }
      />

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('recipes.searchPlaceholder')}
            className="w-full pl-9 pr-4 py-3 border border-border-strong rounded-md text-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent bg-surface-raised shadow-sm"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${category === cat ? 'bg-accent text-white' : 'bg-surface-raised border border-border-strong text-content-secondary hover:border-accent/50'}`}>
              {t(CATEGORY_KEYS[cat])}
            </button>
          ))}
        </div>

        {/* Tag filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TAGS.map(tag => (
            <button key={tag} onClick={() => setActiveTag(v => v === tag ? null : tag)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${activeTag === tag ? 'bg-[#004AAD] text-white' : 'bg-surface-raised border border-border-strong text-content-secondary hover:border-[#004AAD]/40'}`}>
              {TAG_ICONS[tag]} {t(TAG_KEYS[tag])}
            </button>
          ))}
          <button onClick={() => setShowMoreFilters(v => !v)}
            className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${showMoreFilters ? 'bg-accent text-white' : 'bg-surface-raised border border-border-strong text-content-secondary'}`}>
            {t('recipes.moreFilters')}
          </button>
        </div>

        {showMoreFilters && (
          <div className="bg-surface-raised rounded-md border border-border-subtle p-4 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-content-secondary mb-1 block">{t('recipes.ingredient')}</label>
              <input value={ingredient} onChange={e => setIngredient(e.target.value)}
                placeholder={t('recipes.ingredientPlaceholder')}
                className="w-full px-3 py-2 rounded-lg border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
            </div>
            <div>
              <label className="text-xs font-medium text-content-secondary mb-1 block">{t('recipeCreate.difficulty')}</label>
              <div className="flex gap-1.5">
                {['Easy', 'Medium', 'Hard'].map(d => (
                  <button key={d} onClick={() => setDifficulty(v => v === d ? null : d)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${difficulty === d ? 'bg-accent text-white' : 'bg-surface-sunken text-content-secondary'}`}>
                    {t(DIFFICULTY_KEYS[d])}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-content-secondary mb-1 block">{t('recipes.calorieRange')}</label>
              <div className="flex items-center gap-2">
                <input type="number" min={0} value={calorieMin}
                  onChange={e => { const v = e.target.value; if (v === '' || /^\d*$/.test(v)) setCalorieMin(v); }}
                  onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                  placeholder={t('recipes.min')}
                  className="w-full px-3 py-2 rounded-lg border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                <span className="text-content-tertiary text-xs">{t('recipes.to')}</span>
                <input type="number" min={0} value={calorieMax}
                  onChange={e => { const v = e.target.value; if (v === '' || /^\d*$/.test(v)) setCalorieMax(v); }}
                  onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                  placeholder={t('recipes.max')}
                  className="w-full px-3 py-2 rounded-lg border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-accent" />
          </div>
        ) : recipes.length === 0 ? (
          <div className="py-16 text-center">
            <ChefHat size={40} className="mx-auto text-gray-200 dark:text-content-secondary mb-3" />
            <p className="text-sm font-semibold text-content-secondary">{t('recipes.emptyTitle')}</p>
            <p className="text-xs text-content-tertiary mt-1">{t('recipes.emptyDesc')}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-content-tertiary font-medium">{recipes.length} {recipes.length !== 1 ? t('recipes.recipePlural') : t('recipes.recipeSingular')} {t('recipes.shown')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipes.map(recipe => (
                <div key={recipe.id}
                  className="bg-surface-raised rounded-md border border-border-subtle shadow-sm overflow-hidden hover: transition-all cursor-pointer group"
                  onClick={() => { setSelected(recipe); setShowMealPicker(false); setLogServings(recipe.servings || 1); }}>
                  <div className="relative overflow-hidden h-44">
                    <RecipeImage src={recipe.image_url} alt={recipe.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    <button
                      onClick={e => toggleSave(e, recipe)}
                      disabled={savingId === recipe.id}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors">
                      {savingId === recipe.id
                        ? <Loader2 size={14} className="animate-spin text-accent" />
                        : recipe.is_saved
                          ? <BookmarkCheck size={16} className="text-accent" />
                          : <Bookmark size={16} className="text-content-secondary" />}
                    </button>
                    <div className="absolute bottom-3 left-3">
                      <span className="text-xs font-semibold bg-accent text-white px-2.5 py-1 rounded-full">{t(CATEGORY_KEYS[recipe.category] ?? recipe.category)}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-content-primary text-sm mb-1 line-clamp-1">{recipe.name}</h3>
                    <p className="text-xs text-content-secondary line-clamp-2 mb-3">{recipe.description}</p>
                    {recipe.tags?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mb-3">
                        {recipe.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#004AAD]/10 text-brand-blue-deep dark:text-blue-400">{t(TAG_KEYS[tag] ?? tag)}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-content-tertiary">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Clock size={11} /> {recipe.prep_time + recipe.cook_time}m</span>
                        {recipe.rating != null && (
                          <span className="flex items-center gap-1"><Star size={11} className="text-yellow-400" fill="currentColor" /> {recipe.rating.toFixed(1)}</span>
                        )}
                        {recipe.difficulty && (
                          <span className={`font-semibold ${recipe.difficulty === 'Easy' ? 'text-green-500' : recipe.difficulty === 'Hard' ? 'text-red-500' : 'text-yellow-500'}`}>{t(DIFFICULTY_KEYS[recipe.difficulty] ?? recipe.difficulty)}</span>
                        )}
                      </div>
                      {/* The column is the WHOLE-RECIPE total - the API divides it by the yield
                          to get per-serving. Unlabelled it read as a per-serving figure, which
                          for a 12-serving recipe is out by 12x to the reader. */}
                      <span className="font-bold text-content-primary">{t('recipes.kcalTotal', { cal: recipe.calories })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Recipe detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white dark:bg-[#111] rounded-t-3xl sm:rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto z-10">

            {/* Hero */}
            <div className="relative h-52 shrink-0">
              <RecipeImage src={selected.image_url} alt={selected.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <button onClick={closeModal}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white">
                <X size={16} />
              </button>
              <div className="absolute bottom-4 left-4 right-4">
                <h2 className="font-bold text-white text-xl">{selected.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-white/80 flex items-center gap-1"><Clock size={11} /> {selected.prep_time + selected.cook_time}m</span>
                  {selected.rating != null && (
                    <span className="text-xs text-white/80 flex items-center gap-1"><Star size={11} fill="currentColor" className="text-yellow-400" /> {selected.rating.toFixed(1)} ({selected.reviews_count})</span>
                  )}
                  <button onClick={e => toggleSave(e, selected)} disabled={savingId === selected.id}
                    className="ml-auto w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    {savingId === selected.id
                      ? <Loader2 size={14} className="animate-spin text-white" />
                      : selected.is_saved
                        ? <BookmarkCheck size={15} className="text-accent" />
                        : <Bookmark size={15} className="text-white" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Tags */}
              {selected.tags?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {selected.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-[#004AAD]/10 text-brand-blue-deep dark:text-blue-400">
                      {TAG_ICONS[tag]} {t(TAG_KEYS[tag] ?? tag)}
                    </span>
                  ))}
                </div>
              )}

              {/* Servings — sits ABOVE the numbers it changes.
                  It used to live at the bottom next to "Log to Food Journal" and
                  scaled nothing on screen, so the macros stayed at the recipe's
                  own total however many servings you picked. Reading big
                  unlabelled calorie figures with a servings box under them, the
                  obvious conclusion is that the app cannot do arithmetic. */}
              <div className="flex items-center justify-between bg-surface-sunken rounded-md px-3 py-2">
                <span className="text-sm font-medium text-content-primary">{t('recipes.servings')}</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setLogServings(v => Math.max(0.5, +(v - 0.5).toFixed(1)))}
                    aria-label="Fewer servings"
                    className="w-7 h-7 rounded-md bg-surface-raised border border-border-strong text-content-secondary hover:text-accent transition-colors">−</button>
                  <span className="w-10 text-center font-bold text-content-primary tabular">{logServings}</span>
                  <button onClick={() => setLogServings(v => Math.min(20, +(v + 0.5).toFixed(1)))}
                    aria-label="More servings"
                    className="w-7 h-7 rounded-md bg-surface-raised border border-border-strong text-content-secondary hover:text-accent transition-colors">+</button>
                </div>
              </div>

              {/* Macros */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { labelKey: 'foodJournal.calories', value: Math.round(selected.calories * scaleRatio), color: '#F87404' },
                  { labelKey: 'dashboard.macro.protein',  value: `${+(selected.protein * scaleRatio).toFixed(1)}g`, color: '#004AAD' },
                  { labelKey: 'dashboard.macro.carbs',    value: `${+(selected.carbs * scaleRatio).toFixed(1)}g`,   color: '#10B981' },
                  { labelKey: 'dashboard.macro.fat',      value: `${+(selected.fat * scaleRatio).toFixed(1)}g`,     color: '#FACC15' },
                ].map(m => (
                  <div key={m.labelKey} className="text-center bg-surface-sunken rounded-md p-2.5">
                    <p className="text-base font-black" style={{ color: m.color }}>{m.value}</p>
                    <p className="text-[10px] text-content-secondary mt-0.5">{t(m.labelKey)}</p>
                  </div>
                ))}
              </div>

              {/* Ingredients */}
              {selected.ingredients?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-content-primary mb-2">{t('recipeCreate.ingredients')}</h3>
                  <div className="space-y-1">
                    {selected.ingredients.map((ing, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 dark:border-white/[0.05]">
                        <span className="text-content-secondary">{ing.name}</span>
                        <span className="text-content-tertiary text-xs">
                          {/* Nutrition without the ingredient amounts would be
                              worse than not scaling at all — you would cook the
                              wrong quantity while believing the macros. */}
                          {scaleRatio !== 1 && !isNaN(parseFloat(ing.amount))
                            ? +(parseFloat(ing.amount) * scaleRatio).toFixed(2)
                            : ing.amount} {ing.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructions */}
              {selected.instructions?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-content-primary mb-2">{t('recipeCreate.instructions')}</h3>
                  <ol className="space-y-2">
                    {selected.instructions.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm text-content-secondary">
                        <span className="w-6 h-6 rounded-full bg-accent-surface text-accent font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Where this recipe stands. Members' recipes are private until an
                  admin approves them into the shared library, so the author needs
                  to be told plainly which of those they are looking at. */}
              {selected.is_mine && selected.status && selected.status !== 'approved' && (
                <div className="rounded-md border border-border-subtle bg-surface-sunken p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    {selected.status === 'pending'
                      ? <Clock size={15} className="text-accent shrink-0" />
                      : selected.status === 'rejected'
                        ? <X size={15} className="text-red-500 shrink-0" />
                        : <Bookmark size={15} className="text-content-tertiary shrink-0" />}
                    <p className="text-sm font-semibold text-content-primary">
                      {selected.status === 'pending' ? 'Waiting for review'
                        : selected.status === 'rejected' ? 'Not added to the library'
                        : 'Private to you'}
                    </p>
                  </div>
                  <p className="text-xs text-content-secondary">
                    {selected.status === 'pending'
                      ? 'Only you can see this until it has been looked at. You will be notified either way.'
                      : selected.status === 'rejected'
                        ? (selected.rejection_reason || 'You can change it and send it again.')
                        : 'Only you can see this. Send it for review if you would like it in the shared library.'}
                  </p>
                  {selected.status !== 'pending' && (
                    <button onClick={() => submitForReview(selected)}
                      className="w-full py-2 rounded-md bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors">
                      Submit to library
                    </button>
                  )}
                </div>
              )}

              {/* Your own recipes are editable. Until now creating one was a
                  one-way door: no member-facing update or delete existed, so a
                  typo lived forever. */}
              {selected.is_mine && (
                <div className="flex gap-2">
                  <Link href={`/recipes/create?edit=${selected.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md border border-border-strong text-sm font-semibold text-content-secondary hover:text-accent hover:border-accent transition-colors">
                    <Pencil size={14} /> Edit recipe
                  </Link>
                  <button onClick={() => deleteRecipe(selected)}
                    className="px-4 py-2.5 rounded-md border border-border-strong text-sm font-semibold text-content-secondary hover:text-red-500 hover:border-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}

              {/* Log to Food Journal */}
              {loggedIds[selected.id] ? (
                <div className="flex items-center justify-center gap-2 py-3 bg-green-50 dark:bg-green-500/10 rounded-md text-green-600 dark:text-green-400 text-sm font-semibold">
                  <CheckCircle size={16} /> {t('recipes.addedToJournal')}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-content-secondary">{t('recipes.logAsWhichMeal')}</p>
                  <div className="flex gap-2 flex-wrap">
                    {journalSlots.map(slot => (
                      <button key={slot.id} onClick={() => setLogSlotId(slot.id)}
                        className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${logSlotId === slot.id ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-white/[0.07] text-content-secondary'}`}>
                        {slot.name}
                      </button>
                    ))}
                  </div>
                  {/* One servings control per panel. Two of them, disagreeing
                      about what they scaled, is how this got confusing. */}
                  <p className="text-xs text-content-tertiary">
                    Logging <strong className="text-content-secondary">{logServings}</strong> of {selected.servings} servings
                    — {Math.round(selected.calories * scaleRatio)} cal
                  </p>
                  <button onClick={logToJournal} disabled={loggingId === selected.id}
                    className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 rounded-md text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                    {loggingId === selected.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {t('recipes.logToJournal')}
                  </button>
                </div>
              )}

              {/* Add to Meal Plan */}
              {mealAddedIds[selected.id] ? (
                <div className="flex items-center justify-center gap-2 py-3 bg-blue-50 dark:bg-[#004AAD]/10 rounded-md text-brand-blue-deep dark:text-blue-400 text-sm font-semibold">
                  <CalendarDays size={16} /> {t('recipes.addedToMealPlan')}
                </div>
              ) : !showMealPicker ? (
                <button onClick={() => setShowMealPicker(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-[#004AAD]/30 hover:border-[#004AAD] rounded-md text-brand-blue-deep dark:text-blue-400 text-sm font-semibold transition-all hover:bg-[#004AAD]/5">
                  <CalendarDays size={16} /> {t('recipes.addToMealPlan')}
                </button>
              ) : (
                <div className="border-2 border-[#004AAD]/20 rounded-md p-4 space-y-3 bg-[#004AAD]/[0.03]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-800 dark:text-white">{t('recipes.pickDayMeal')}</p>
                    <button onClick={() => setShowMealPicker(false)} className="text-content-tertiary hover:text-content-secondary">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS.map(d => (
                      <button key={d} onClick={() => setMealDay(d)}
                        className={`py-2 rounded-lg text-xs font-bold transition-all ${mealDay === d ? 'bg-[#004AAD] text-white' : 'bg-gray-100 dark:bg-white/[0.08] text-content-secondary hover:bg-gray-200 dark:hover:bg-white/[0.13]'}`}>
                        {t(DAY_KEYS[d])}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {SLOTS.map(s => (
                      <button key={s} onClick={() => setMealSlot(s)}
                        className={`py-2 rounded-lg text-xs font-bold capitalize transition-all ${mealSlot === s ? 'bg-[#004AAD] text-white' : 'bg-gray-100 dark:bg-white/[0.08] text-content-secondary hover:bg-gray-200 dark:hover:bg-white/[0.13]'}`}>
                        {t(SLOT_KEYS[s])}
                      </button>
                    ))}
                  </div>
                  <button onClick={addToMealPlan} disabled={addingMeal}
                    className="w-full bg-[#004AAD] hover:bg-[#003890] text-white font-bold py-2.5 rounded-md text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                    {addingMeal ? <Loader2 size={14} className="animate-spin" /> : <CalendarDays size={14} />}
                    {t('recipes.confirmDaySlot', { day: t(DAY_KEYS[mealDay]), slot: t(SLOT_KEYS[mealSlot]) })}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
