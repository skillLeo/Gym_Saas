'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Search, X, Plus, ChevronRight } from 'lucide-react';

interface FoodItem {
  nutritionix_id?: string; name: string; brand?: string;
  serving_qty: number; serving_unit: string; serving_weight_grams?: number;
  calories: number; protein_g: number; carbs_g: number; fat_g: number;
  fiber_g?: number; sugar_g?: number; sodium_mg?: number;
}

interface Props {
  open: boolean; onClose: () => void;
  mealType: string; date: string;
  onAdded: () => void;
}

export default function FoodSearchModal({ open, onClose, mealType, date, onAdded }: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [servings, setServings] = useState('1');
  const [tab, setTab] = useState<'search' | 'recent' | 'custom'>('search');
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setQuery(''); setSelected(null); setServings('1'); setTab('search'); setTimeout(() => inputRef.current?.focus(), 100); }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(t);
  }, [query]);

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ['food-search', debouncedQuery],
    queryFn: () => api.get('/food/search', { params: { q: debouncedQuery } }).then(r => r.data.data),
    enabled: debouncedQuery.length >= 2 && tab === 'search',
  });

  const { data: recentFoods } = useQuery({
    queryKey: ['food-recent'],
    queryFn: () => api.get('/food/recent').then(r => r.data.data),
    enabled: tab === 'recent',
  });

  const { data: customFoods } = useQuery({
    queryKey: ['food-custom'],
    queryFn: () => api.get('/food/custom').then(r => r.data.data?.data || []),
    enabled: tab === 'custom',
  });

  const addMutation = useMutation({
    mutationFn: (food: FoodItem) => api.post('/food-log/from-api', {
      food_data: food, meal_type: mealType, logged_date: date, servings: parseFloat(servings) || 1,
    }),
    onSuccess: () => {
      toast.success('Food logged!');
      qc.invalidateQueries({ queryKey: ['food-log'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onAdded();
      setSelected(null);
      setQuery('');
    },
    onError: () => toast.error('Failed to log food.'),
  });

  const srv = parseFloat(servings) || 1;
  const calc = selected ? {
    calories: Math.round(selected.calories * srv),
    protein:  Math.round(selected.protein_g * srv * 10) / 10,
    carbs:    Math.round(selected.carbs_g * srv * 10) / 10,
    fat:      Math.round(selected.fat_g * srv * 10) / 10,
  } : null;

  const currentList = tab === 'recent' ? recentFoods : tab === 'custom' ? customFoods : searchResults;

  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed inset-x-4 top-8 bottom-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-xl bg-white border border-gray-200 rounded-2xl z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-900 capitalize">Add to {mealType}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"><X size={18} /></button>
          </div>

          {!selected ? (
            <>
              <div className="p-4 border-b border-gray-200">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search foods..." className="w-full bg-[#F8F9FA] border border-gray-200 rounded-lg pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#F87404]" />
                  {isFetching && <LoadingSpinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />}
                </div>
                <div className="flex gap-2 mt-3">
                  {(['search', 'recent', 'custom'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)} className={`px-3 py-1 rounded-full text-xs font-medium transition-all capitalize ${tab === t ? 'bg-[#F87404] text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-900'}`}>{t}</button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {currentList && currentList.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {currentList.map((food: any, i: number) => (
                      <button key={`${food.nutritionix_id || food.name}-${i}`} onClick={() => setSelected(food)}
                        className="w-full flex items-center justify-between p-4 hover:bg-white transition-colors text-left">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{food.name}</p>
                          <p className="text-xs text-gray-400">{food.brand ? `${food.brand} · ` : ''}{food.serving_qty} {food.serving_unit}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{Math.round(food.calories)}</p>
                          <p className="text-xs text-gray-400">kcal</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    {tab === 'search' && debouncedQuery.length < 2
                      ? <p className="text-sm text-gray-500">Type at least 2 characters to search</p>
                      : <p className="text-sm text-gray-500">No results found</p>}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-5">
              <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 mb-4 transition-colors">
                ← Back to search
              </button>
              <h3 className="text-lg font-bold text-gray-900 mb-0.5">{selected.name}</h3>
              {selected.brand && <p className="text-sm text-gray-500 mb-4">{selected.brand}</p>}

              <div className="bg-[#F8F9FA] rounded-xl p-4 mb-5">
                <p className="text-xs text-gray-500 mb-2">Per {selected.serving_qty} {selected.serving_unit}</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[['Calories', Math.round(selected.calories), '#111827'], ['Protein', `${selected.protein_g}g`, '#F87404'], ['Carbs', `${selected.carbs_g}g`, '#F97316'], ['Fat', `${selected.fat_g}g`, '#FACC15']].map(([l, v, c]) => (
                    <div key={l as string}><p className="text-lg font-bold" style={{ color: c as string }}>{v}</p><p className="text-xs text-gray-400">{l}</p></div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">Number of servings</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setServings(s => String(Math.max(0.25, parseFloat(s) - 0.25)))} className="w-10 h-10 rounded-lg bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-colors text-lg">−</button>
                    <input type="number" value={servings} onChange={e => setServings(e.target.value)} step="0.25" min="0.25" max="100" className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 text-center outline-none focus:border-[#F87404]" />
                    <button onClick={() => setServings(s => String(parseFloat(s) + 0.25))} className="w-10 h-10 rounded-lg bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-colors text-lg">+</button>
                  </div>
                </div>

                {calc && (
                  <div className="bg-[#F87404]/10 border border-[#F87404]/20 rounded-xl p-4">
                    <p className="text-xs text-[#F87404] font-medium mb-2">Total for {srv} serving{srv !== 1 ? 's' : ''}</p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[['Cal', calc.calories], ['Pro', `${calc.protein}g`], ['Carb', `${calc.carbs}g`], ['Fat', `${calc.fat}g`]].map(([l, v]) => (
                        <div key={l as string}><p className="text-base font-bold text-gray-900">{v}</p><p className="text-xs text-gray-400">{l}</p></div>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={() => addMutation.mutate(selected)} loading={addMutation.isPending} className="w-full" size="lg">
                  <Plus size={16} /> Add to {mealType}
                </Button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
