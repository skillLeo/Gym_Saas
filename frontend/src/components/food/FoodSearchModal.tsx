'use client';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/Button';
import { Search, X, Plus } from 'lucide-react';

interface FoodItem {
  name: string; brand?: string;
  serving_qty: number; serving_unit: string;
  calories: number; protein_g: number; carbs_g: number; fat_g: number;
}

interface Props {
  open: boolean; onClose: () => void;
  mealType: string; date: string;
  onAdded: () => void;
}

const MOCK_FOODS: FoodItem[] = [
  { name: 'Grilled Chicken Breast', brand: 'Generic', serving_qty: 1, serving_unit: '3.5 oz', calories: 165, protein_g: 31, carbs_g: 0, fat_g: 4 },
  { name: 'Brown Rice', brand: 'Generic', serving_qty: 1, serving_unit: 'cup cooked', calories: 216, protein_g: 5, carbs_g: 45, fat_g: 2 },
  { name: 'Banana', brand: 'Fresh', serving_qty: 1, serving_unit: 'medium', calories: 89, protein_g: 1, carbs_g: 23, fat_g: 0 },
  { name: 'Greek Yogurt', brand: 'Chobani', serving_qty: 1, serving_unit: '170g', calories: 100, protein_g: 17, carbs_g: 6, fat_g: 0 },
  { name: 'Whole Egg', brand: 'Generic', serving_qty: 1, serving_unit: 'large', calories: 78, protein_g: 6, carbs_g: 1, fat_g: 5 },
  { name: 'Oatmeal', brand: 'Quaker', serving_qty: 1, serving_unit: 'cup cooked', calories: 158, protein_g: 6, carbs_g: 27, fat_g: 3 },
  { name: 'Salmon Fillet', brand: 'Generic', serving_qty: 1, serving_unit: '4 oz', calories: 208, protein_g: 28, carbs_g: 0, fat_g: 10 },
  { name: 'Protein Shake', brand: 'MyProtein', serving_qty: 1, serving_unit: 'scoop', calories: 120, protein_g: 25, carbs_g: 3, fat_g: 1 },
  { name: 'Sweet Potato', brand: 'Fresh', serving_qty: 1, serving_unit: 'medium', calories: 103, protein_g: 2, carbs_g: 24, fat_g: 0 },
  { name: 'Almonds', brand: 'Blue Diamond', serving_qty: 1, serving_unit: 'oz (23 nuts)', calories: 164, protein_g: 6, carbs_g: 6, fat_g: 14 },
  { name: 'Apple', brand: 'Fresh', serving_qty: 1, serving_unit: 'medium', calories: 72, protein_g: 0, carbs_g: 19, fat_g: 0 },
  { name: 'Broccoli', brand: 'Fresh', serving_qty: 1, serving_unit: 'cup', calories: 55, protein_g: 4, carbs_g: 11, fat_g: 0 },
  { name: 'Avocado', brand: 'Fresh', serving_qty: 0.5, serving_unit: 'medium', calories: 120, protein_g: 1.5, carbs_g: 6, fat_g: 11 },
  { name: 'Whole Milk', brand: 'Generic', serving_qty: 1, serving_unit: 'cup', calories: 149, protein_g: 8, carbs_g: 12, fat_g: 8 },
  { name: 'Cottage Cheese', brand: 'Daisy', serving_qty: 0.5, serving_unit: 'cup', calories: 90, protein_g: 13, carbs_g: 5, fat_g: 1 },
];

export default function FoodSearchModal({ open, onClose, mealType, onAdded }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [servings, setServings] = useState('1');
  const [tab, setTab] = useState<'search' | 'recent' | 'custom'>('search');
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setQuery(''); setSelected(null); setServings('1'); setTab('search'); setTimeout(() => inputRef.current?.focus(), 100); }
  }, [open]);

  const filtered = MOCK_FOODS.filter(f =>
    !query || f.name.toLowerCase().includes(query.toLowerCase()) || f.brand?.toLowerCase().includes(query.toLowerCase())
  );

  const recentFoods = MOCK_FOODS.slice(0, 5);
  const currentList = tab === 'recent' ? recentFoods : tab === 'custom' ? MOCK_FOODS.slice(5, 9) : filtered;

  const srv = parseFloat(servings) || 1;
  const calc = selected ? {
    calories: Math.round(selected.calories * srv),
    protein:  Math.round(selected.protein_g * srv * 10) / 10,
    carbs:    Math.round(selected.carbs_g * srv * 10) / 10,
    fat:      Math.round(selected.fat_g * srv * 10) / 10,
  } : null;

  const handleAdd = async () => {
    if (!selected) return;
    setAdding(true);
    await new Promise(r => setTimeout(r, 400));
    setAdding(false);
    toast.success(`${selected.name} added to ${mealType}!`);
    onAdded();
    onClose();
    setSelected(null);
    setQuery('');
  };

  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed inset-x-4 top-8 bottom-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
            <h2 className="text-base font-bold text-gray-900 dark:text-white capitalize">Add to {mealType}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"><X size={18} /></button>
          </div>

          {!selected ? (
            <>
              <div className="p-4 border-b border-gray-200 dark:border-white/10">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Search foods…"
                    className="w-full bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-[#F87404]" />
                </div>
                <div className="flex gap-2 mt-3">
                  {(['search', 'recent', 'custom'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all capitalize ${tab === t ? 'bg-[#F87404] text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
                      {t === 'search' ? 'All Foods' : t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {currentList.length > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {currentList.map((food, i) => (
                      <button key={`${food.name}-${i}`} onClick={() => setSelected(food)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors text-left">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{food.name}</p>
                          <p className="text-xs text-gray-400">{food.brand ? `${food.brand} · ` : ''}{food.serving_qty} {food.serving_unit}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{food.calories}</p>
                          <p className="text-xs text-gray-400">kcal</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-500 dark:text-gray-400">No foods found for "{query}"</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-5">
              <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors">
                ← Back to search
              </button>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">{selected.name}</h3>
              {selected.brand && <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{selected.brand}</p>}

              <div className="bg-gray-50 dark:bg-white/[0.05] rounded-xl p-4 mb-5">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Per {selected.serving_qty} {selected.serving_unit}</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[['Calories', selected.calories, '#111827'], ['Protein', `${selected.protein_g}g`, '#F87404'], ['Carbs', `${selected.carbs_g}g`, '#004AAD'], ['Fat', `${selected.fat_g}g`, '#7C3AED']].map(([l, v, c]) => (
                    <div key={l as string}>
                      <p className="text-lg font-bold dark:text-white" style={{ color: c as string }}>{v}</p>
                      <p className="text-xs text-gray-400">{l}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Number of servings</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setServings(s => String(Math.max(0.25, parseFloat(s) - 0.25)))}
                      className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white font-bold hover:bg-gray-200 dark:hover:bg-white/20 transition-colors text-lg">−</button>
                    <input type="number" value={servings} onChange={e => setServings(e.target.value)} step="0.25" min="0.25" max="100"
                      className="flex-1 bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white text-center outline-none focus:border-[#F87404]" />
                    <button onClick={() => setServings(s => String(parseFloat(s) + 0.25))}
                      className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white font-bold hover:bg-gray-200 dark:hover:bg-white/20 transition-colors text-lg">+</button>
                  </div>
                </div>

                {calc && (
                  <div className="bg-[#F87404]/10 border border-[#F87404]/20 rounded-xl p-4">
                    <p className="text-xs text-[#F87404] font-medium mb-2">Total for {srv} serving{srv !== 1 ? 's' : ''}</p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[['Cal', calc.calories], ['Pro', `${calc.protein}g`], ['Carb', `${calc.carbs}g`], ['Fat', `${calc.fat}g`]].map(([l, v]) => (
                        <div key={l as string}>
                          <p className="text-base font-bold text-gray-900 dark:text-white">{v}</p>
                          <p className="text-xs text-gray-400">{l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={handleAdd} loading={adding} className="w-full" size="lg">
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
