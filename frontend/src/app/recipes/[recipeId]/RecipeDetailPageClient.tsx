'use client';

import { useState, useEffect } from 'react';
import { RecipeImage } from '@/components/ui/RecipeImage';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  ChevronLeft, Bookmark, BookmarkCheck, Clock, Users, Star,
  CheckCircle, ChefHat, CalendarDays, X, Loader2, Check,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Ingredient { name: string; amount: string; unit: string }
interface Recipe {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  category: string;
  tags: string[];
  prep_time: number;
  cook_time: number;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  ingredients: Ingredient[];
  instructions: string[];
  rating: number;
  reviews_count: number;
  is_saved: boolean;
}

const DAYS  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Same order as DAYS — the label a member reads for each. */
const DAY_KEYS = ['day.sunday', 'day.monday', 'day.tuesday', 'day.wednesday', 'day.thursday', 'day.friday', 'day.saturday'];
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

interface JournalMealSlot { id: number; name: string; sort_order: number }

export default function RecipeDetailPage() {
  const { t } = useI18nStore();
  const params   = useParams();
  const recipeId = params?.recipeId as string;

  const [recipe,         setRecipe]         = useState<Recipe | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [activeTab,      setActiveTab]      = useState<'ingredients' | 'instructions' | 'nutrition'>('ingredients');
  const [servings,       setServings]       = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [journalSlots,   setJournalSlots]   = useState<JournalMealSlot[]>([]);
  const [logSlotId,      setLogSlotId]      = useState<number | null>(null);
  const [addedToLog,     setAddedToLog]     = useState(false);
  const [loggingJournal, setLoggingJournal] = useState(false);
  const [showMealModal,  setShowMealModal]  = useState(false);
  const [mealDay,        setMealDay]        = useState('Monday');
  const [mealSlot,       setMealSlot]       = useState<typeof SLOTS[number]>('lunch');
  const [addedToMeal,    setAddedToMeal]    = useState(false);
  const [addingMeal,     setAddingMeal]     = useState(false);

  useEffect(() => {
    if (!recipeId) return;
    api.get(`/recipes/${recipeId}`)
      .then(res => {
        const r = res.data.data;
        setRecipe(r);
        setServings(r.servings || 1);
      })
      .catch(() => toast.error(t('recipeDetail.notFound')))
      .finally(() => setLoading(false));
  }, [recipeId]);

  useEffect(() => {
    api.get('/meal-slots').then(res => {
      const slots = res.data.data ?? [];
      setJournalSlots(slots);
      if (slots.length) setLogSlotId(slots[0].id);
    }).catch(() => {});
  }, []);

  const toggleBookmark = async () => {
    if (!recipe) return;
    setSavingBookmark(true);
    try {
      const res = await api.post(`/recipes/${recipe.id}/save`);
      setRecipe(r => r ? { ...r, is_saved: res.data.is_saved } : r);
      toast.success(res.data.is_saved ? t('recipeDetail.saved') : t('recipeDetail.unsaved'));
    } catch {
      toast.error(t('common.failed'));
    } finally {
      setSavingBookmark(false);
    }
  };

  const logToJournal = async () => {
    if (!recipe) return;
    if (!logSlotId) { toast.error(t('foodLog.noSlot')); return; }
    setLoggingJournal(true);
    try {
      await api.post(`/recipes/${recipe.id}/log-journal`, {
        meal_slot_id: logSlotId,
        // Send the number of servings EATEN. The API multiplies by the recipe's
        // per-serving nutrition, so dividing by the yield first counted each
        // serving as a fraction of one: logging 2 servings of a 4-serving,
        // 500 kcal recipe recorded 62.5 kcal instead of 250 — a fourfold
        // undercount in someone's food diary.
        servings: servings,
      });
      setAddedToLog(true);
      toast.success(t('recipeDetail.addedToJournal'));
    } catch {
      toast.error(t('foodLog.error.log'));
    } finally {
      setLoggingJournal(false);
    }
  };

  const addToMealPlan = async () => {
    if (!recipe) return;
    setAddingMeal(true);
    try {
      const dayIdx = DAYS.indexOf(mealDay);
      const today  = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      await api.post(`/recipes/${recipe.id}/meal-plan`, {
        week_start:  weekStart.toISOString().slice(0, 10),
        day_of_week: dayIdx,
        meal_slot:   mealSlot,
      });
      setAddedToMeal(true);
      setShowMealModal(false);
      toast.success(t('recipeDetail.addedToPlan'));
    } catch {
      toast.error(t('common.failed'));
    } finally {
      setAddingMeal(false);
    }
  };

  const toggleStep = (i: number) => setCompletedSteps(s => {
    const n = new Set(s);
    n.has(i) ? n.delete(i) : n.add(i);
    return n;
  });

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex justify-center py-32">
          <Loader2 size={36} className="animate-spin text-accent" />
        </div>
      </DashboardShell>
    );
  }

  if (!recipe) {
    return (
      <DashboardShell>
        <div className="text-center py-32">
          <ChefHat size={40} className="mx-auto text-content-tertiary mb-3" />
          <p className="text-content-secondary">{t('recipeDetail.notFound')}</p>
          <Link href="/recipes" className="text-sm text-accent hover:underline mt-2 inline-block">{t('recipeDetail.back')}</Link>
        </div>
      </DashboardShell>
    );
  }

  const scaleRatio  = servings / (recipe.servings || 1);
  const scaledCal   = Math.round(recipe.calories  * scaleRatio);
  const scaledProt  = +(recipe.protein  * scaleRatio).toFixed(1);
  const scaledCarbs = +(recipe.carbs    * scaleRatio).toFixed(1);
  const scaledFat   = +(recipe.fat      * scaleRatio).toFixed(1);
  const scaledFiber = +(recipe.fiber    * scaleRatio).toFixed(1);

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto">

        {/*
          Intentionally NOT the shared <PageHeader />. This screen leads with a
          full-bleed hero image and floats its back button over it — the standard
          immersive detail pattern. A solid sticky header above would push the
          hero down and break that. The floating control below satisfies the same
          "back affordance on a nested screen" requirement.
        */}
        <div className="relative h-64 sm:h-80 overflow-hidden">
          <RecipeImage src={recipe.image_url} alt={recipe.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <Link href="/recipes">
              <button className="w-9 h-9 flex items-center justify-center rounded-md bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-black/60 transition-colors">
                <ChevronLeft size={18} className="text-white" />
              </button>
            </Link>
            <button onClick={toggleBookmark} disabled={savingBookmark}
              className="w-9 h-9 flex items-center justify-center rounded-md bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-black/60 transition-colors">
              {savingBookmark
                ? <Loader2 size={16} className="text-white animate-spin" />
                : recipe.is_saved
                  ? <BookmarkCheck size={18} className="text-accent" />
                  : <Bookmark size={18} className="text-white" />}
            </button>
          </div>

          <div className="absolute bottom-4 left-4">
            <span className="inline-block bg-accent text-white text-xs font-bold px-3 py-1 rounded-full mb-2">{recipe.category}</span>
            <h1 className="font-display text-2xl font-bold text-white leading-tight max-w-xs">{recipe.name}</h1>
          </div>
        </div>

        <div className="px-4 py-5">
          {/* Meta row */}
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            {/* `rating` is null until a recipe has genuinely been rated, and no
                recipe has been. This used to render a star, an empty strong tag
                and a bare "(0)" — a rating badge with no rating in it. Nothing
                is better than a hollow one. */}
            {recipe.rating != null && (
              <span className="flex items-center gap-1.5 text-sm text-content-secondary">
                <Star size={14} className="text-brand-yellow" />
                <strong className="text-content-primary">{recipe.rating.toFixed(1)}</strong>
                ({recipe.reviews_count})
              </span>
            )}
            <span className="flex items-center gap-1.5 text-sm text-content-secondary">
              <Clock size={14} className="text-accent" /> {recipe.prep_time + recipe.cook_time} min
            </span>
            <span className="flex items-center gap-1.5 text-sm text-content-secondary">
              <Users size={14} className="text-brand-blue-deep" /> {recipe.servings} servings
            </span>
          </div>

          {recipe.description && (
            <p className="text-sm text-content-secondary mb-5 leading-relaxed">{recipe.description}</p>
          )}

          {/* Servings adjuster */}
          <div className="flex items-center justify-between bg-surface-sunken rounded-md px-4 py-3 mb-5">
            <span className="text-sm font-medium text-content-primary">{t('common.servings')}</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setServings(s => Math.max(1, s - 1))}
                className="w-8 h-8 rounded-full bg-surface-raised border border-border-strong flex items-center justify-center font-bold hover:border-accent/40 transition-colors">−</button>
              <span className="font-bold text-xl text-accent w-6 text-center">{servings}</span>
              <button onClick={() => setServings(s => s + 1)}
                className="w-8 h-8 rounded-full bg-surface-raised border border-border-strong flex items-center justify-center font-bold hover:border-accent/40 transition-colors">+</button>
            </div>
          </div>

          {/* Log to Food Journal */}
          {addedToLog ? (
            <div className="flex items-center justify-center gap-2 py-3 bg-green-50 dark:bg-green-500/10 rounded-md text-green-600 dark:text-green-400 text-sm font-medium mb-3">
              <CheckCircle size={16} /> {t('recipeDetail.addedToJournal')}
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              <p className="text-xs font-medium text-content-secondary">{t('recipeDetail.logAs')}</p>
              <div className="flex gap-2 flex-wrap">
                {journalSlots.map(slot => (
                  <button key={slot.id} onClick={() => setLogSlotId(slot.id)}
                    className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${logSlotId === slot.id ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-white/[0.07] text-content-secondary'}`}>
                    {slot.name}
                  </button>
                ))}
              </div>
              <button onClick={logToJournal} disabled={loggingJournal}
                className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 rounded-md text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                {loggingJournal ? <Loader2 size={16} className="animate-spin" /> : <ChefHat size={16} />}
                Log to Food Journal
              </button>
            </div>
          )}

          {/* Add to Meal Plan */}
          {addedToMeal ? (
            <div className="flex items-center justify-center gap-2 py-3 mb-5 bg-blue-50 dark:bg-[#004AAD]/10 rounded-md text-brand-blue-deep dark:text-blue-400 text-sm font-medium">
              <CalendarDays size={16} /> {t('recipeDetail.addedToPlan')}
            </div>
          ) : (
            <button onClick={() => setShowMealModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 mb-5 border-2 border-[#004AAD]/30 hover:border-[#004AAD] rounded-md text-brand-blue-deep dark:text-blue-400 text-sm font-semibold transition-all hover:bg-[#004AAD]/5">
              <CalendarDays size={16} /> {t('recipeDetail.addToPlan')}
            </button>
          )}

          {/* Tabs */}
          <div className="flex bg-gray-100 dark:bg-white/[0.07] p-1 rounded-md mb-5">
            {(['ingredients', 'instructions', 'nutrition'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all ${activeTab === tab ? 'bg-surface-raised text-content-primary shadow-sm' : 'text-content-secondary'}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* Ingredients */}
          {activeTab === 'ingredients' && (
            <div className="space-y-2">
              {recipe.ingredients?.map((ing, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-white/[0.06] last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <span className="flex-1 text-sm text-content-primary">{ing.name}</span>
                  <span className="text-sm text-content-secondary font-medium">
                    {scaleRatio !== 1 && !isNaN(parseFloat(ing.amount))
                      ? (parseFloat(ing.amount) * scaleRatio).toFixed(1)
                      : ing.amount} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Instructions */}
          {activeTab === 'instructions' && (
            <div className="space-y-3">
              {recipe.instructions?.map((step, i) => (
                <button key={i} onClick={() => toggleStep(i)}
                  className={`w-full flex items-start gap-3 p-4 rounded-md border-2 text-left transition-all ${completedSteps.has(i) ? 'border-green-500/30 bg-green-50/50 dark:bg-green-500/5' : 'border-border-subtle bg-surface-raised'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${completedSteps.has(i) ? 'bg-green-500 text-white' : 'bg-accent-surface text-accent'}`}>
                    {completedSteps.has(i) ? <CheckCircle size={14} /> : i + 1}
                  </div>
                  <p className={`text-sm leading-relaxed ${completedSteps.has(i) ? 'line-through text-content-tertiary' : 'text-content-secondary'}`}>
                    {step}
                  </p>
                </button>
              ))}
              {recipe.instructions?.length > 0 && completedSteps.size === recipe.instructions.length && (
                <div className="text-center py-4">
                  <div className="h-12 w-12 rounded-full bg-success-surface text-success flex items-center justify-center mx-auto mb-2"><Check size={24} strokeWidth={2.5} /></div>
                  <p className="font-semibold text-content-primary">{t('recipeDetail.complete')}</p>
                </div>
              )}
            </div>
          )}

          {/* Nutrition */}
          {activeTab === 'nutrition' && (
            <div>
              <div className="bg-surface-sunken rounded-md p-4 mb-4 text-center">
                <div className="font-display text-4xl font-bold text-accent">{scaledCal}</div>
                <div className="text-sm text-content-secondary">calories ({servings} serving{servings !== 1 ? 's' : ''})</div>
              </div>
              <div className="space-y-3">
                {[
                  { label: t('common.protein'),       val: scaledProt,  goal: 50,  color: '#F87404' },
                  { label: t('recipeDetail.carbohydrates'), val: scaledCarbs, goal: 65,  color: '#004AAD' },
                  { label: t('common.fat'),           val: scaledFat,   goal: 25,  color: '#7C3AED' },
                  { label: t('common.fiber'),         val: scaledFiber, goal: 25,  color: '#10B981' },
                ].map(({ label, val, goal, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-content-secondary">{label}</span>
                      <span className="font-semibold" style={{ color }}>{val}g</span>
                    </div>
                    <ProgressBar value={Math.min((val / goal) * 100, 100)} max={100} color={color} height={5} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="h-20" />
      </div>

      {/* Meal plan modal */}
      {showMealModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMealModal(false)} />
          <div className="relative bg-surface-raised rounded-t-3xl sm:rounded-md w-full max-w-sm p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-content-primary">{t('recipeDetail.addToPlan')}</h3>
                <p className="text-xs text-content-tertiary mt-0.5 truncate max-w-[220px]">{recipe.name}</p>
              </div>
              <button onClick={() => setShowMealModal(false)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-content-tertiary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-content-secondary uppercase tracking-widest block mb-2">{t('recipeDetail.day')}</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {DAYS.map((d, di) => (
                    <button key={d} onClick={() => setMealDay(d)}
                      className={`py-2 rounded-md text-xs font-semibold transition-all ${mealDay === d ? 'bg-[#004AAD] text-white' : 'bg-surface-sunken text-content-secondary hover:bg-gray-200 dark:hover:bg-white/20'}`}>
                      {t(DAY_KEYS[di]).slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-content-secondary uppercase tracking-widest block mb-2">{t('recipeDetail.meal')}</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {SLOTS.map(s => (
                    <button key={s} onClick={() => setMealSlot(s)}
                      className={`py-2 rounded-md text-xs font-semibold capitalize transition-all ${mealSlot === s ? 'bg-[#004AAD] text-white' : 'bg-surface-sunken text-content-secondary hover:bg-gray-200 dark:hover:bg-white/20'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={addToMealPlan} disabled={addingMeal}
                className="w-full bg-[#004AAD] hover:bg-[#003890] text-white font-bold py-3 rounded-md text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                {addingMeal ? <Loader2 size={16} className="animate-spin" /> : <CalendarDays size={16} />}
                Confirm — {mealDay.slice(0,3)} {mealSlot}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
