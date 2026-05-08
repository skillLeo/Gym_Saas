'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, subDays, parseISO, isToday } from 'date-fns';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import FoodSearchModal from '@/components/food/FoodSearchModal';
import {
  Plus, ChevronLeft, ChevronRight, Trash2, Droplets,
  Utensils, Flame, CalendarDays, TrendingUp,
} from 'lucide-react';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅', accent: '#F59E0B', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
  { key: 'lunch',     label: 'Lunch',     emoji: '☀️',  accent: '#F87404', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
  { key: 'dinner',    label: 'Dinner',    emoji: '🌙', accent: '#6366F1', bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
  { key: 'snack',     label: 'Snacks',    emoji: '🍎', accent: '#10B981', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
] as const;

export default function FoodLogPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [modal, setModal] = useState<{ open: boolean; meal: string }>({ open: false, meal: 'breakfast' });

  const { data: logData, isLoading } = useQuery({
    queryKey: ['food-log', date],
    queryFn: () => api.get('/food-log', { params: { date } }).then(r => r.data.data),
  });

  const { data: summaryData } = useQuery({
    queryKey: ['food-log-summary', date],
    queryFn: () => api.get('/food-log/summary', { params: { date } }).then(r => r.data.data),
  });

  const { data: waterData } = useQuery({
    queryKey: ['water-log', date],
    queryFn: () => api.get('/water-log', { params: { date } }).then(r => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/food-log/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['food-log', date] });
      qc.invalidateQueries({ queryKey: ['food-log-summary', date] });
      toast.success('Entry removed.');
    },
  });

  const waterMutation = useMutation({
    mutationFn: (action: 'increment' | 'decrement') => api.post(`/water-log/${action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['water-log', date] }),
  });

  const dateObj    = parseISO(date);
  const isDateToday = isToday(dateObj);
  const s          = summaryData ?? {};
  const calorieGoal  = s.calorie_goal ?? user?.daily_calorie_goal ?? 2000;
  const calConsumed  = Math.round(s.total_calories ?? 0);
  const calPct       = Math.min(100, calorieGoal > 0 ? (calConsumed / calorieGoal) * 100 : 0);
  const calRemaining = Math.max(0, calorieGoal - calConsumed);
  const overGoal     = calConsumed > calorieGoal;
  const waterGoal  = user?.daily_water_goal_glasses ?? 8;
  const waterCount = waterData?.glasses_count ?? 0;
  const waterPct   = Math.min(100, (waterCount / waterGoal) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-4">

      {/* ── Page header + date nav ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Food Journal</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <CalendarDays size={13} className="text-gray-400" />
            <p className="text-sm text-gray-500">
              {isDateToday ? 'Today — ' : ''}{format(dateObj, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate(format(subDays(dateObj, 1), 'yyyy-MM-dd'))}
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-400 hover:text-gray-900 transition-all shadow-sm"
          ><ChevronLeft size={16} /></button>
          {!isDateToday && (
            <button
              onClick={() => setDate(format(new Date(), 'yyyy-MM-dd'))}
              className="px-3 h-9 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#F87404] hover:text-[#F87404] transition-all shadow-sm"
            >Today</button>
          )}
          <button
            onClick={() => setDate(format(addDays(dateObj, 1), 'yyyy-MM-dd'))}
            disabled={isDateToday}
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-400 hover:text-gray-900 disabled:opacity-40 transition-all shadow-sm"
          ><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* ── Calorie summary card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {/* Top row: eaten / goal / remaining */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 mb-5">
          <div className="pr-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Eaten</p>
            <p className="text-3xl font-black text-gray-900 leading-none">{calConsumed}</p>
            <p className="text-xs text-gray-400 mt-1">kcal</p>
          </div>
          <div className="px-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Goal</p>
            <p className="text-3xl font-black text-[#F87404] leading-none">{calorieGoal}</p>
            <p className="text-xs text-gray-400 mt-1">kcal</p>
          </div>
          <div className="pl-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">{overGoal ? 'Over' : 'Left'}</p>
            <p className={`text-3xl font-black leading-none ${overGoal ? 'text-red-500' : 'text-emerald-500'}`}>
              {overGoal ? calConsumed - calorieGoal : calRemaining}
            </p>
            <p className="text-xs text-gray-400 mt-1">kcal</p>
          </div>
        </div>

        {/* Calorie progress bar */}
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${overGoal ? 'bg-red-500' : 'bg-[#F87404]'}`}
            style={{ width: `${calPct}%` }}
          />
        </div>

        {/* Macro row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Protein', val: Math.round(s.total_protein_g ?? 0), goal: s.protein_goal ?? user?.daily_protein_goal_g ?? 150, color: '#F87404' },
            { label: 'Carbs',   val: Math.round(s.total_carbs_g ?? 0),   goal: s.carbs_goal ?? user?.daily_carbs_goal_g ?? 200,     color: '#F59E0B' },
            { label: 'Fat',     val: Math.round(s.total_fat_g ?? 0),     goal: s.fat_goal ?? user?.daily_fat_goal_g ?? 65,           color: '#6366F1' },
          ].map(({ label, val, goal, color }) => {
            const pct = Math.min(100, goal > 0 ? (val / goal) * 100 : 0);
            return (
              <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500">{label}</p>
                  <p className="text-[10px] text-gray-400">{val}/{goal}g</p>
                </div>
                <p className="text-xl font-black text-gray-900 mb-2 leading-none">{val}<span className="text-sm font-normal text-gray-400">g</span></p>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">{Math.round(pct)}% of goal</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Meal sections ── */}
      {isLoading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="space-y-3">
          {MEALS.map(({ key, label, emoji, accent, bg, text, border }) => {
            const meal = logData?.[key] ?? { entries: [], total_calories: 0 };
            const hasEntries = meal.entries.length > 0;
            return (
              <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Meal header */}
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${bg} ${border} border flex items-center justify-center text-lg`}>
                      {emoji}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{label}</p>
                      <p className="text-xs text-gray-400">
                        {hasEntries
                          ? `${Math.round(meal.total_calories)} kcal · ${meal.entries.length} item${meal.entries.length !== 1 ? 's' : ''}`
                          : 'No food logged yet'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setModal({ open: true, meal: key })}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-sm"
                    style={{ backgroundColor: accent, boxShadow: `0 2px 8px ${accent}30` }}
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>

                {/* Thin accent line */}
                <div className="h-0.5 mx-5" style={{ backgroundColor: accent + '20' }} />

                {/* Entries */}
                {hasEntries ? (
                  <div className="divide-y divide-gray-50/80">
                    {meal.entries.map((entry: any) => (
                      <div key={entry.id}
                        className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/60 transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: accent + '15' }}>
                            <Utensils size={13} style={{ color: accent }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{entry.food_item?.name}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {entry.servings} × {entry.food_item?.serving_qty}{entry.food_item?.serving_unit}
                              <span className="mx-1 text-gray-300">·</span>
                              P:{Math.round(entry.total_protein_g)}g C:{Math.round(entry.total_carbs_g)}g F:{Math.round(entry.total_fat_g)}g
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0 ml-3">
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">{Math.round(entry.total_calories)}</p>
                            <p className="text-[10px] text-gray-400">kcal</p>
                          </div>
                          <button
                            onClick={() => deleteMutation.mutate(entry.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                          ><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => setModal({ open: true, meal: key })}
                    className="w-full flex items-center justify-center gap-2.5 py-5 text-sm text-gray-400 hover:text-gray-600 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl border-2 border-dashed border-gray-200 group-hover:border-gray-300 flex items-center justify-center transition-colors">
                      <Plus size={14} />
                    </div>
                    Log your {label.toLowerCase()}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Water tracker ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F87404]/10 flex items-center justify-center">
              <Droplets size={18} className="text-[#F87404]" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Water Intake</p>
              <p className="text-xs text-gray-400">Stay hydrated throughout the day</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-gray-900 leading-none">
              {waterCount}
              <span className="text-base font-semibold text-gray-400"> / {waterGoal}</span>
            </p>
            <p className="text-[11px] text-gray-400">glasses</p>
          </div>
        </div>

        {/* Glass bubbles */}
        <div className="flex gap-2 mb-3">
          {Array.from({ length: waterGoal }).map((_, i) => (
            <div key={i}
              className={`flex-1 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                i < waterCount
                  ? 'bg-[#F87404] shadow-md shadow-[#F87404]/20'
                  : 'bg-gray-100 border border-gray-200'
              }`}>
              <Droplets size={15} className={i < waterCount ? 'text-white' : 'text-gray-300'} />
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-[#F87404] rounded-full transition-all duration-500"
            style={{ width: `${waterPct}%` }}
          />
        </div>

        {waterCount >= waterGoal && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-emerald-600" />
            <p className="text-xs font-semibold text-emerald-700">Daily hydration goal reached! Great job 💪</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => waterMutation.mutate('decrement')}
            disabled={!isDateToday || waterCount <= 0}
            className="w-12 h-11 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-bold text-xl hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40 transition-all flex items-center justify-center"
          >−</button>
          <button
            onClick={() => waterMutation.mutate('increment')}
            disabled={!isDateToday}
            className="flex-1 h-11 rounded-xl bg-[#F87404] hover:bg-[#e06000] disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-[#F87404]/25"
          >
            <Droplets size={16} /> + Add Glass
          </button>
        </div>

        {!isDateToday && (
          <p className="text-xs text-gray-400 text-center mt-3">Water logging is only available for today</p>
        )}
      </div>

      <FoodSearchModal
        open={modal.open}
        onClose={() => setModal(m => ({ ...m, open: false }))}
        mealType={modal.meal}
        date={date}
        onAdded={() => {
          qc.invalidateQueries({ queryKey: ['food-log', date] });
          qc.invalidateQueries({ queryKey: ['food-log-summary', date] });
        }}
      />
    </div>
  );
}
