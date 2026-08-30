'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDate, formatNumber } from '@/lib/format';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RingChart } from '@/components/ui/RingChart';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import {
  Plus, ChevronLeft, ChevronRight, Droplets, Camera, Mic, Barcode,
  Trash2, Search, Utensils, Settings2,
  ChevronDown, ChevronUp, BookOpen, TrendingUp, X, Loader2, Check, Pencil, PencilLine, Image as ImageIcon, Upload
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useI18nStore } from '@/store/i18nStore';
import { useConfirm } from '@/components/ui/ConfirmDialog';

type FoodOption = {
  nutritionix_id?: string | null;
  name: string;
  brand?: string | null;
  serving_qty: number;
  serving_unit: string;
  serving_weight_grams?: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
};

type LogEntry = {
  id: number;
  food_item: {
    name: string;
    serving_qty: number;
    serving_unit: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  meal_type: string;
  servings: number;
  total_calories: number | string;
  total_protein_g: number | string;
  total_carbs_g: number | string;
  total_fat_g: number | string;
  image_url?: string | null;
};

type MealSlot = { slot_id: number; name: string; sort_order: number };

type MealData = {
  slot_id: number;
  name: string;
  sort_order: number;
  entries: LogEntry[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
};

const SLOT_PALETTE = ['#F87404', '#004AAD', '#7C3AED', '#10B981', '#FF5C04', '#0891B2', '#DB2777', '#65A30D'];
const slotColor = (i: number) => SLOT_PALETTE[i % SLOT_PALETTE.length];

const WATER_PRESETS = [4, 8, 12, 16];

export default function FoodJournalPage() {
  const { confirm } = useConfirm();
  const { user } = useAuthStore();
  const { t, locale } = useI18nStore();
  const [date, setDate] = useState(() => new Date());
  const [meals, setMeals] = useState<MealData[]>([]);
  const [water, setWater] = useState(0); // total ounces
  const [loading, setLoading] = useState(true);
  const [waterLoading, setWaterLoading] = useState(false);
  const [waterAmount, setWaterAmount] = useState(8);

  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAddFood, setShowAddFood] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodOption[]>([]);
  // false once a search has come back from a server with no Nutritionix keys.
  // Without this the screen shows 'No foods found' for everything outside the
  // 15-item built-in list, which reads as an empty database rather than an
  // unconfigured integration.
  const [foodDbConnected, setFoodDbConnected] = useState(true);
  const [recentFoods, setRecentFoods] = useState<FoodOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [foodPicker, setFoodPicker] = useState<{ food: FoodOption; slotId: number; servings: number; imageUrl: string | null } | null>(null);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Meal slot management
  const [showManageMeals, setShowManageMeals] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newSlotName, setNewSlotName] = useState('');
  const [savingSlot, setSavingSlot] = useState(false);

  const waterGoal = user?.daily_water_goal_glasses ? user.daily_water_goal_glasses * 8 : 64;
  const dailyGoal = {
    calories: user?.daily_calorie_goal ?? 2000,
    protein:  user?.daily_protein_goal_g ?? 150,
    carbs:    user?.daily_carbs_goal_g ?? 200,
    fat:      user?.daily_fat_goal_g ?? 65
  };

  const isToday = date.toDateString() === new Date().toDateString();
  const dateParam = format(date, 'yyyy-MM-dd');

  const loadDay = useCallback(async (d: Date) => {
    setLoading(true);
    const dp = format(d, 'yyyy-MM-dd');
    try {
      const [logRes, waterRes] = await Promise.all([
        api.get(`/food-log?date=${dp}`),
        api.get(`/water-log?date=${dp}`),
      ]);
      setMeals(logRes.data.data ?? []);
      setWater(waterRes.data.data.total_ounces ?? 0);
    } catch {
      toast.error(t('foodJournal.toast.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadDay(date); }, [date, loadDay]);

  useEffect(() => {
    api.get('/food/recent')
      .then(res => setRecentFoods(res.data.data))
      .catch(() => {});
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get(`/food/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data.data);
        if (res.data.configured === false) setFoodDbConnected(false);
      } catch {
        toast.error(t('foodJournal.toast.searchFailed'));
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const openFoodPicker = (food: FoodOption, slotId: number) => {
    // No suggested photo — source.unsplash.com's random-photo redirect was
    // retired and no longer returns images, and we have no other photo
    // source for an arbitrary food name. The user can attach a real one
    // via the upload button below.
    setFoodPicker({ food, slotId, servings: 1, imageUrl: null });
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', 'food');
      const res = await api.post('/uploads/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFoodPicker(prev => prev ? { ...prev, imageUrl: res.data.image_url } : prev);
    } catch {
      toast.error(t('recipeCreate.toast.uploadFailed'));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddFood = async () => {
    if (!foodPicker) return;
    setAdding(true);
    const { food, slotId, servings, imageUrl } = foodPicker;
    const slotName = meals.find(m => m.slot_id === slotId)?.name ?? 'meal';
    try {
      await api.post('/food-log/from-api', {
        food_data: food,
        meal_slot_id: slotId,
        logged_date: dateParam,
        servings,
        image_url: imageUrl
      });
      toast.success(t('foodJournal.toast.addedToMeal', { food: food.name, slot: slotName }));
      setFoodPicker(null);
      setShowAddFood(null);
      setSearchQuery('');
      await loadDay(date);
    } catch {
      toast.error(t('foodJournal.toast.addFoodFailed'));
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    setDeletingId(entryId);
    try {
      await api.delete(`/food-log/${entryId}`);
      await loadDay(date);
      toast.success(t('foodJournal.toast.entryRemoved'));
    } catch {
      toast.error(t('foodJournal.toast.deleteEntryFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleWaterAdd = async () => {
    if (!isToday || waterLoading) return;
    setWaterLoading(true);
    try {
      const res = await api.post('/water-log/increment', { ounces: waterAmount });
      setWater(res.data.data.total_ounces);
      toast.success(t('foodJournal.toast.waterAdded', { oz: waterAmount }), { id: 'water-log' });
    } catch {
      toast.error(t('foodJournal.toast.waterUpdateFailed'));
    } finally {
      setWaterLoading(false);
    }
  };

  const handleWaterRemove = async () => {
    if (!isToday || water <= 0 || waterLoading) return;
    setWaterLoading(true);
    try {
      const res = await api.post('/water-log/decrement', { ounces: waterAmount });
      setWater(res.data.data.total_ounces);
      toast.success(t('foodJournal.toast.waterRemoved'));
    } catch {
      toast.error(t('foodJournal.toast.waterUpdateFailed'));
    } finally {
      setWaterLoading(false);
    }
  };

  // Meal slot management
  const startRename = (slot: MealData) => { setEditingSlotId(slot.slot_id); setEditingName(slot.name); };

  const saveRename = async (slotId: number) => {
    if (!editingName.trim()) return;
    setSavingSlot(true);
    try {
      await api.put(`/meal-slots/${slotId}`, { name: editingName.trim() });
      setMeals(prev => prev.map(m => m.slot_id === slotId ? { ...m, name: editingName.trim() } : m));
      setEditingSlotId(null);
      toast.success(t('foodJournal.toast.renamed'));
    } catch {
      toast.error(t('foodJournal.toast.renameFailed'));
    } finally {
      setSavingSlot(false);
    }
  };

  const addSlot = async () => {
    if (!newSlotName.trim()) return;
    setSavingSlot(true);
    try {
      const res = await api.post('/meal-slots', { name: newSlotName.trim() });
      const slot = res.data.data;
      setMeals(prev => [...prev, { slot_id: slot.id, name: slot.name, sort_order: slot.sort_order, entries: [], total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0 }]);
      setNewSlotName('');
      toast.success(t('foodJournal.toast.slotAdded'));
    } catch {
      toast.error(t('foodJournal.toast.slotAddFailed'));
    } finally {
      setSavingSlot(false);
    }
  };

  const deleteSlot = async (slotId: number) => {
    if (meals.length <= 1) { toast.error(t('foodJournal.toast.keepOneSlot')); return; }
    if (!(await confirm({ title: t('foodJournal.deleteSlotTitle'), message: t('foodJournal.confirmDeleteSlot'), confirmLabel: t('foodJournal.deleteSlotConfirm'), destructive: true }))) return;
    try {
      await api.delete(`/meal-slots/${slotId}`);
      setMeals(prev => prev.filter(m => m.slot_id !== slotId));
      toast.success(t('foodJournal.toast.slotDeleted'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('foodJournal.toast.slotDeleteFailed'));
    }
  };

  const consumed = {
    calories: meals.reduce((s, m) => s + (m.total_calories ?? 0), 0),
    protein:  meals.reduce((s, m) => s + (m.total_protein ?? 0), 0),
    carbs:    meals.reduce((s, m) => s + (m.total_carbs ?? 0), 0),
    fat:      meals.reduce((s, m) => s + (m.total_fat ?? 0), 0)
  };
  const caloriesLeft = dailyGoal.calories - consumed.calories;
  const caloriesPercent = Math.min((consumed.calories / dailyGoal.calories) * 100, 100);

  const formatDayLabel = (d: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return t('foodJournal.today');
    if (d.toDateString() === yesterday.toDateString()) return t('foodJournal.yesterday');
    return formatDate(d, locale, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const changeDate = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    if (d <= new Date()) {
      setDate(d);
      setShowAddFood(null);
    }
  };

  const displayedFoods = searchQuery.trim() ? searchResults : recentFoods;
  const displayLabel = searchQuery.trim() ? t('foodJournal.searchResults') : t('foodJournal.recentFoods');

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        <PageHeader
        title={t('nav.food')}
        subtitle={t('foodJournal.subtitle')}
        actions={
          <Link href="/food-journal/history">
              <Button variant="outline" size="sm" icon={<TrendingUp size={15} />}>{t('foodJournal.history')}</Button>
            </Link>
        }
      />

        {/* Date Navigator */}
        <div className="flex items-center justify-between bg-surface-raised rounded-md border border-border-subtle px-4 py-3 mb-5 shadow-sm">
          <button onClick={() => changeDate(-1)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <ChevronLeft size={18} className="text-content-secondary" />
          </button>
          <div className="text-center">
            <div className="font-semibold text-content-primary" suppressHydrationWarning>{formatDayLabel(date)}</div>
            <div className="text-xs text-content-tertiary" suppressHydrationWarning>{formatDate(date, locale, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          <button onClick={() => changeDate(1)} disabled={isToday}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-30">
            <ChevronRight size={18} className="text-content-secondary" />
          </button>
        </div>

        {/* Calorie Summary */}
        <Card className="mb-5 overflow-hidden">
          <div className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-content-secondary uppercase tracking-wide mb-1">{t('foodJournal.dailySummary')}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-bold text-content-primary">{formatNumber(Math.round(consumed.calories), locale)}</span>
                  <span className="text-content-tertiary text-sm">/ {formatNumber(dailyGoal.calories, locale)} kcal</span>
                </div>
                <p className="text-sm mt-1">
                  <span className={caloriesLeft > 0 ? 'text-green-500' : 'text-red-500'}>
                    {caloriesLeft > 0 ? t('foodJournal.kcalRemaining', { n: Math.round(caloriesLeft) }) : t('foodJournal.kcalOver', { n: Math.round(Math.abs(caloriesLeft)) })}
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
                sublabel={t('foodJournal.done')}
              />
            </div>
            <ProgressBar value={caloriesPercent} max={100} color="#F87404" height={6} />
          </div>

          {/* Macros */}
          <div className="border-t border-border-subtle grid grid-cols-3 divide-x divide-gray-100 dark:divide-white/[0.07]">
            {[
              { labelKey: 'dashboard.macro.protein', val: consumed.protein, goal: dailyGoal.protein, color: '#F87404' },
              { labelKey: 'dashboard.macro.carbs',   val: consumed.carbs,   goal: dailyGoal.carbs,   color: '#004AAD' },
              { labelKey: 'dashboard.macro.fat',     val: consumed.fat,     goal: dailyGoal.fat,     color: '#7C3AED' },
            ].map(({ labelKey, val, goal, color }) => (
              <div key={labelKey} className="p-4 text-center">
                <div className="text-xs text-content-secondary mb-1">{t(labelKey)}</div>
                <div className="font-bold text-content-primary text-lg" style={{ color }}>{Math.round(val)}g</div>
                <div className="text-xs text-content-tertiary">/ {goal}g</div>
                <div className="mt-2">
                  <ProgressBar value={Math.min((val / goal) * 100, 100)} max={100} color={color} height={3} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Log Buttons */}
        <div className="grid grid-cols-4 gap-2.5 mb-5">
          <Link href="/food-journal/barcode">
            <button className="w-full flex flex-col items-center gap-1.5 py-3 px-2 rounded-md bg-surface-raised border border-border-subtle hover:border-accent/50 transition-all shadow-sm">
              <Barcode size={20} className="text-accent" />
              <span className="text-xs font-medium text-content-secondary">{t('foodJournal.scanBarcode')}</span>
            </button>
          </Link>
          <Link href="/food-journal/photo-log">
            <button className="w-full flex flex-col items-center gap-1.5 py-3 px-2 rounded-md bg-surface-raised border border-border-subtle hover:border-[#004AAD]/50 transition-all shadow-sm">
              <Camera size={20} className="text-brand-blue-deep" />
              <span className="text-xs font-medium text-content-secondary">{t('foodJournal.photoLog')}</span>
            </button>
          </Link>
          <Link href="/food-journal/voice-log">
            <button className="w-full flex flex-col items-center gap-1.5 py-3 px-2 rounded-md bg-surface-raised border border-border-subtle hover:border-[#10B981]/50 transition-all shadow-sm">
              <Mic size={20} className="text-[#10B981]" />
              <span className="text-xs font-medium text-content-secondary">{t('foodJournal.voiceLog')}</span>
            </button>
          </Link>
          {/* The fourth way in, and the only one that works without a food
              database behind it. Barcode, photo and voice all depend on
              Nutritionix; entering a food by hand does not. */}
          <Link href="/food-journal/custom-food">
            <button className="w-full flex flex-col items-center gap-1.5 py-3 px-2 rounded-md bg-surface-raised border border-border-subtle hover:border-brand-yellow/50 transition-all shadow-sm">
              <PencilLine size={20} className="text-brand-yellow" />
              <span className="text-xs font-medium text-content-secondary">{t('foodJournal.createFood')}</span>
            </button>
          </Link>
        </div>

        {/* Meal Sections */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-content-primary text-sm">{t('foodJournal.meals')}</h2>
          <button onClick={() => setShowManageMeals(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-content-secondary hover:text-accent transition-colors">
            <Settings2 size={13} /> {t('foodJournal.manageMeals')}
          </button>
        </div>
        <div className="space-y-3 mb-4">
          {meals.map((meal, idx) => {
            const { slot_id: id, name: label } = meal;
            const color = slotColor(idx);
            const items = meal.entries;
            const mealCals = meal.total_calories;
            const isExpanded = expanded === id;

            return (
              <div key={id} className="group bg-surface-raised rounded-md border border-border-subtle overflow-hidden shadow-sm">
                {/* Header row */}
                <div
                  className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: color + '18' }}>
                      <Utensils size={16} style={{ color }} />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="font-semibold text-content-primary text-sm">{label}</div>
                      <div className="text-xs text-content-secondary">{items.length} {items.length !== 1 ? t('foodJournal.itemPlural') : t('foodJournal.item')} · {Math.round(mealCals)} kcal</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isExpanded ? <ChevronUp size={16} className="text-content-tertiary" /> : <ChevronDown size={16} className="text-content-tertiary" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border-subtle">
                    {items.length === 0 ? (
                      <div className="py-6 text-center">
                        <BookOpen size={24} className="mx-auto text-content-tertiary dark:text-content-secondary mb-2" />
                        <p className="text-sm text-content-tertiary">{loading ? t('foodJournal.loading') : t('foodJournal.nothingLoggedYet')}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                        {items.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between px-4 py-3">
                            {entry.image_url ? (
                              <img src={entry.image_url} alt={entry.food_item.name} className="w-10 h-10 rounded-lg object-cover shrink-0 mr-3" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-surface-sunken flex items-center justify-center shrink-0 mr-3">
                                <ImageIcon size={14} className="text-content-tertiary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-content-primary truncate">{entry.food_item.name}</div>
                              <div className="text-xs text-content-tertiary mt-0.5">
                                {entry.servings} × {entry.food_item.serving_qty} {entry.food_item.serving_unit}
                                {' · '}P: {Math.round(Number(entry.total_protein_g))}g
                                {' · '}C: {Math.round(Number(entry.total_carbs_g))}g
                                {' · '}F: {Math.round(Number(entry.total_fat_g))}g
                              </div>
                            </div>
                            <div className="flex items-center gap-3 ml-2 shrink-0">
                              <span className="font-semibold text-content-primary text-sm">{Math.round(Number(entry.total_calories))}</span>
                              <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                disabled={deletingId === entry.id}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-content-tertiary hover:text-red-500 transition-colors disabled:opacity-40"
                              >
                                {deletingId === entry.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add food to this meal */}
                    {showAddFood === id ? (
                      <div className="p-4 border-t border-border-subtle">
                        <div className="relative mb-3">
                          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
                          <input
                            autoFocus
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={t('foodJournal.searchPlaceholder')}
                            className="w-full pl-9 pr-4 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 text-sm"
                          />
                          {searchLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary animate-spin" />}
                        </div>

                        {displayedFoods.length > 0 && (
                          <>
                            <p className="text-[11px] text-content-tertiary uppercase tracking-wide font-medium mb-2">{displayLabel}</p>
                            <div className="space-y-1.5">
                              {displayedFoods.slice(0, 8).map((food, i) => (
                                <button key={i}
                                  onClick={() => openFoodPicker(food, id)}
                                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors text-left">
                                  <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: color + '18' }}>
                                    <Utensils size={15} style={{ color }} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-content-primary truncate">{food.name}</div>
                                    <div className="text-xs text-content-tertiary">{food.serving_qty} {food.serving_unit} · P: {food.protein_g}g · C: {food.carbs_g}g · F: {food.fat_g}g</div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-sm font-semibold text-content-secondary">{Math.round(food.calories)} kcal</span>
                                    <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                                      <Plus size={12} className="text-white" />
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        {/* The wall a member hits, and the way past it. With no
                            food database connected the built-in list runs out
                            fast, so the escape hatch belongs right here rather
                            than buried in a menu. */}
                        {searchQuery.trim() && !searchLoading && searchResults.length === 0 && (
                          <div className="flex flex-col items-center gap-2 py-3">
                            <p className="text-sm text-content-tertiary text-center">
                              {foodDbConnected ? t('foodJournal.noFoodsFound') : t('foodJournal.dbNotConnected')}
                            </p>
                            <Link
                              href="/food-journal/custom-food"
                              className="text-sm font-semibold text-accent hover:underline"
                            >
                              {t('foodJournal.createOwn')}
                            </Link>
                          </div>
                        )}

                        {!searchQuery.trim() && recentFoods.length === 0 && (
                          <p className="text-sm text-content-tertiary text-center py-3">{t('foodJournal.searchToAdd')}</p>
                        )}

                        <button onClick={() => { setShowAddFood(null); setSearchQuery(''); }} className="mt-3 text-xs text-content-tertiary hover:text-content-secondary dark:hover:text-content-tertiary w-full text-center py-1">{t('goals.modal.cancel')}</button>
                      </div>
                    ) : (
                      <div className="px-4 pb-4 pt-2">
                        <button
                          onClick={() => { setShowAddFood(id); setSearchQuery(''); }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border-2 border-dashed transition-all text-sm font-medium"
                          style={{ borderColor: color + '40', color }}
                        >
                          <Plus size={16} /> {t('foodJournal.addFood')}
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
                <div className="w-10 h-10 rounded-md bg-accent-surface flex items-center justify-center">
                  <Droplets size={18} className="text-accent" />
                </div>
                <div>
                  <p className="font-bold text-sm text-content-primary">{t('foodJournal.waterIntake')}</p>
                  <p className="text-xs text-content-tertiary">
                    {isToday ? t('foodJournal.stayHydrated') : t('foodJournal.waterTodayOnly')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-content-primary leading-none">
                  {water}<span className="text-base font-semibold text-content-tertiary"> / {waterGoal}oz</span>
                </p>
                <p className="text-[11px] text-content-tertiary">
                  {t('foodJournal.ounces')} · {Math.round(water / 8)} / {Math.round(waterGoal / 8)} glasses
                </p>
              </div>
            </div>

            <div className="h-3 bg-surface-sunken rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (water / waterGoal) * 100)}%` }}
              />
            </div>

            <p className="text-xs text-content-tertiary text-center mb-4">
              {!isToday
                ? t('foodJournal.waterUpdateTodayOnly')
                : water >= waterGoal
                ? t('foodJournal.waterGoalReached')
                : t('foodJournal.ozMoreToGoal', { oz: waterGoal - water })}
            </p>

            {/* Amount picker: default 8oz, adjustable, capped at 16oz per entry */}
            <p className="text-[11px] font-semibold text-content-secondary uppercase tracking-wide mb-2 text-center">{t('foodJournal.amountPerLog')}</p>
            <div className="flex items-center justify-center gap-2 mb-4">
              {WATER_PRESETS.map(oz => (
                <button key={oz} onClick={() => setWaterAmount(oz)}
                  className={`px-3.5 py-2 rounded-md text-sm font-semibold transition-all ${waterAmount === oz ? 'bg-accent text-white' : 'bg-surface-sunken text-content-secondary'}`}>
                  {oz}oz
                </button>
              ))}
              <input type="number" min={1} max={16} value={waterAmount}
                onChange={e => setWaterAmount(Math.min(16, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-16 px-2 py-2 rounded-md border border-border-strong bg-surface-sunken text-center text-sm font-semibold text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleWaterRemove}
                disabled={!isToday || water <= 0 || waterLoading}
                className="w-12 h-11 rounded-md border-2 border-gray-200 bg-white dark:bg-transparent dark:border-white/10 text-content-secondary font-bold text-xl hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40 transition-all flex items-center justify-center"
              >−</button>
              <button
                onClick={handleWaterAdd}
                disabled={!isToday || waterLoading}
                className="flex-1 h-11 rounded-md bg-accent hover:bg-accent-hover text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {waterLoading ? <Loader2 size={16} className="animate-spin" /> : <Droplets size={16} />}
                {t('foodJournal.addOz', { oz: waterAmount })}
              </button>
            </div>
          </div>
        </Card>

      </div>

      {/* Manage Meals modal */}
      {showManageMeals && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowManageMeals(false)} />
          <div className="relative w-full max-w-sm bg-surface-raised rounded-md z-10 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-subtle">
              <h3 className="font-bold text-content-primary">{t('foodJournal.manageMealSlots')}</h3>
              <button onClick={() => setShowManageMeals(false)} className="w-8 h-8 rounded-md flex items-center justify-center text-content-tertiary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-2 max-h-80 overflow-y-auto">
              {meals.map((slot, idx) => (
                <div key={slot.slot_id} className="flex items-center gap-2 p-2.5 rounded-md bg-gray-50 dark:bg-white/[0.04]">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: slotColor(idx) + '18' }}>
                    <Utensils size={13} style={{ color: slotColor(idx) }} />
                  </div>
                  {editingSlotId === slot.slot_id ? (
                    <>
                      <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveRename(slot.slot_id)}
                        className="flex-1 px-2 py-1.5 rounded-lg border border-border-strong bg-surface-raised text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                      <button onClick={() => saveRename(slot.slot_id)} disabled={savingSlot}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10">
                        <Check size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-content-primary truncate">{slot.name}</span>
                      <button onClick={() => startRename(slot)} className="w-7 h-7 flex items-center justify-center rounded-lg text-content-tertiary hover:text-accent hover:bg-accent-surface transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deleteSlot(slot.slot_id)} disabled={meals.length <= 1}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-content-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="p-5 pt-0 flex gap-2">
              <input value={newSlotName} onChange={e => setNewSlotName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSlot()}
                placeholder={t('foodJournal.slotNamePlaceholder')} maxLength={50}
                className="flex-1 px-3 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
              <button onClick={addSlot} disabled={savingSlot || !newSlotName.trim()}
                className="px-4 py-2.5 rounded-md bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-1.5">
                <Plus size={14} /> {t('dashboard.action.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Food servings + image picker modal */}
      {foodPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setFoodPicker(null)} />
          <div className="relative w-full max-w-sm bg-surface-raised rounded-md z-10 overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-subtle">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-content-primary truncate">{foodPicker.food.name}</h3>
                <p className="text-xs text-content-tertiary mt-0.5">
                  {t('foodJournal.addingTo', { slot: meals.find(m => m.slot_id === foodPicker.slotId)?.name ?? '' })}
                </p>
              </div>
              <button onClick={() => setFoodPicker(null)} className="w-8 h-8 rounded-md flex items-center justify-center text-content-tertiary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors ml-2 shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* Image picker */}
            <div className="p-5 pb-0">
              <p className="text-xs font-semibold text-content-secondary mb-2 uppercase tracking-wide">{t('foodJournal.photo')}</p>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-md overflow-hidden bg-surface-sunken shrink-0 flex items-center justify-center">
                  {foodPicker.imageUrl
                    ? <img src={foodPicker.imageUrl} alt="" className="w-full h-full object-cover" />
                    : <ImageIcon size={20} className="text-content-tertiary" />}
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="flex items-center gap-1.5 justify-center w-full py-2 rounded-lg border border-dashed border-gray-300 dark:border-white/20 text-xs font-medium text-content-secondary hover:border-accent/50 cursor-pointer transition-colors">
                    {uploadingImage ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    {t('foodJournal.uploadYourOwn')}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingImage}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                  </label>
                  {foodPicker.imageUrl && (
                    <button onClick={() => setFoodPicker(prev => prev ? { ...prev, imageUrl: null } : prev)}
                      className="w-full text-center text-[11px] text-content-tertiary hover:text-red-500 transition-colors">{t('foodJournal.removePhoto')}</button>
                  )}
                </div>
              </div>
            </div>

            {/* Macro info */}
            <div className="flex items-center gap-3 px-5 py-3 mt-4 bg-gray-50 dark:bg-white/[0.03]">
              {[
                { labelKey: 'foodJournal.calories', val: Math.round(foodPicker.food.calories * foodPicker.servings), unit: ' kcal', color: '#F87404' },
                { labelKey: 'dashboard.macro.protein',  val: Math.round(foodPicker.food.protein_g * foodPicker.servings), unit: 'g', color: '#004AAD' },
                { labelKey: 'dashboard.macro.carbs',    val: Math.round(foodPicker.food.carbs_g * foodPicker.servings), unit: 'g', color: '#10B981' },
                { labelKey: 'dashboard.macro.fat',      val: Math.round(foodPicker.food.fat_g * foodPicker.servings), unit: 'g', color: '#7C3AED' },
              ].map(({ labelKey, val, unit, color }) => (
                <div key={labelKey} className="flex-1 text-center">
                  <div className="text-xs font-bold" style={{ color }}>{val}{unit}</div>
                  <div className="text-[10px] text-content-tertiary">{t(labelKey)}</div>
                </div>
              ))}
            </div>

            {/* Servings input */}
            <div className="p-5">
              <p className="text-xs font-semibold text-content-secondary mb-3 uppercase tracking-wide">
                {t('foodJournal.servingsLabel', { qty: foodPicker.food.serving_qty, unit: foodPicker.food.serving_unit })}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFoodPicker(prev => prev && prev.servings > 0.5 ? { ...prev, servings: Math.round((prev.servings - 0.5) * 10) / 10 } : prev)}
                  className="w-11 h-11 rounded-md border border-border-strong flex items-center justify-center font-bold text-xl text-content-secondary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >−</button>
                <input
                  type="number"
                  min={0.5}
                  max={20}
                  step={0.5}
                  value={foodPicker.servings}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) setFoodPicker(prev => prev ? { ...prev, servings: v } : null);
                  }}
                  className="flex-1 h-11 rounded-md border border-border-strong bg-surface-raised text-center font-bold text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 text-lg"
                />
                <button
                  onClick={() => setFoodPicker(prev => prev ? { ...prev, servings: Math.round((prev.servings + 0.5) * 10) / 10 } : null)}
                  className="w-11 h-11 rounded-md border border-border-strong flex items-center justify-center font-bold text-xl text-content-secondary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >+</button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setFoodPicker(null)}
                className="flex-1 py-3 rounded-md border border-border-strong text-sm font-medium text-content-secondary hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                {t('goals.modal.cancel')}
              </button>
              <button
                onClick={handleAddFood}
                disabled={adding}
                className="flex-1 py-3 rounded-md bg-accent text-white text-sm font-semibold hover:bg-[#FF5C04] transition-colors shadow-orange-500/25 flex items-center justify-center gap-2 disabled:opacity-70">
                {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {t('foodJournal.addToMeal')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
