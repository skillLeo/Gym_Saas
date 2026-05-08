'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Plus, Trash2, Check, ShoppingCart, Sparkles, X } from 'lucide-react';
import Link from 'next/link';

type ShoppingItem = { id: string; name: string; qty: string; category: string; checked: boolean };

const initialItems: ShoppingItem[] = [
  { id: '1', name: 'Chicken Breast', qty: '3 lbs', category: 'Protein', checked: false },
  { id: '2', name: 'Salmon Fillets', qty: '2 fillets', category: 'Protein', checked: true },
  { id: '3', name: 'Greek Yogurt', qty: '2 containers', category: 'Dairy', checked: false },
  { id: '4', name: 'Brown Rice', qty: '2 lbs', category: 'Grains', checked: false },
  { id: '5', name: 'Broccoli', qty: '2 heads', category: 'Vegetables', checked: true },
  { id: '6', name: 'Sweet Potato', qty: '4 medium', category: 'Vegetables', checked: false },
  { id: '7', name: 'Oats', qty: '1 container', category: 'Grains', checked: false },
  { id: '8', name: 'Protein Powder', qty: '1 bag', category: 'Supplements', checked: false },
  { id: '9', name: 'Almonds', qty: '1 bag', category: 'Snacks', checked: false },
  { id: '10', name: 'Avocado', qty: '4', category: 'Produce', checked: false },
];

const categories = ['All', 'Protein', 'Dairy', 'Grains', 'Vegetables', 'Produce', 'Snacks', 'Supplements'];
const categoryColors: Record<string, string> = {
  Protein: '#F87404', Dairy: '#004AAD', Grains: '#FFC000', Vegetables: '#10B981',
  Produce: '#10B981', Snacks: '#7C3AED', Supplements: '#FF5C04'
};

export default function ShoppingListPage() {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState('All');
  const [newItem, setNewItem] = useState({ name: '', qty: '', category: 'Protein' });
  const [showAdd, setShowAdd] = useState(false);

  const filtered = items.filter(i => filter === 'All' || i.category === filter);
  const checked = items.filter(i => i.checked).length;

  const toggle = (id: string) => setItems(p => p.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  const remove = (id: string) => setItems(p => p.filter(i => i.id !== id));
  const clearChecked = () => setItems(p => p.filter(i => !i.checked));

  const addItem = () => {
    if (newItem.name.trim()) {
      setItems(p => [...p, { id: Date.now().toString(), name: newItem.name, qty: newItem.qty, category: newItem.category, checked: false }]);
      setNewItem({ name: '', qty: '', category: 'Protein' });
      setShowAdd(false);
    }
  };

  const groupedFiltered = categories.slice(1).reduce((acc, cat) => {
    const catItems = filtered.filter(i => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {} as Record<string, ShoppingItem[]>);

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/calendar">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#10B981]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Shopping List</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{checked}/{items.length} items checked off</p>
          </div>
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowAdd(true)}>Add Item</Button>
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
            <span>Progress</span>
            <span>{Math.round((checked / items.length) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#10B981] rounded-full transition-all" style={{ width: `${(checked / items.length) * 100}%` }} />
          </div>
        </div>

        {/* AI Suggest */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-[#F87404]/10 to-[#004AAD]/10 border border-[#F87404]/20 rounded-2xl p-4 mb-5">
          <Sparkles size={18} className="text-[#F87404] shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white">AI can auto-generate your list</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Based on your meal plan for the week</div>
          </div>
          <Button size="sm" variant="outline">Generate</Button>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all ${filter === cat ? 'bg-[#10B981] text-white' : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Item Groups */}
        <div className="space-y-4 mb-5">
          {Object.entries(groupedFiltered).map(([cat, catItems]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors[cat] || '#F87404' }} />
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{cat}</span>
                <span className="text-xs text-gray-400">({catItems.length})</span>
              </div>
              <div className="space-y-1.5">
                {catItems.map(item => (
                  <div key={item.id} className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${item.checked ? 'bg-gray-50 dark:bg-white/[0.03] border-gray-100 dark:border-white/[0.05] opacity-60' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/[0.07]'}`}>
                    <button onClick={() => toggle(item.id)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${item.checked ? 'bg-[#10B981] border-[#10B981]' : 'border-gray-300 dark:border-gray-600 hover:border-[#10B981]'}`}>
                      {item.checked && <Check size={13} className="text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium ${item.checked ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                        {item.name}
                      </span>
                      {item.qty && <span className="text-xs text-gray-400 ml-2">{item.qty}</span>}
                    </div>
                    <button onClick={() => remove(item.id)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {checked > 0 && (
          <Button variant="ghost" fullWidth size="sm" onClick={clearChecked} icon={<Check size={14} />}>
            Clear {checked} checked item{checked !== 1 ? 's' : ''}
          </Button>
        )}

        {/* Add Item Modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
            <div className="relative w-full sm:max-w-sm bg-white dark:bg-[#1a1a1a] rounded-t-3xl sm:rounded-3xl p-5 z-10 shadow-2xl border border-gray-100 dark:border-white/[0.07]">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Add Item</h3>
              <div className="space-y-3 mb-4">
                <input value={newItem.name} onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))}
                  placeholder="Item name..." autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/50" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={newItem.qty} onChange={e => setNewItem(n => ({ ...n, qty: e.target.value }))}
                    placeholder="Quantity (optional)"
                    className="px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/50" />
                  <select value={newItem.category} onChange={e => setNewItem(n => ({ ...n, category: e.target.value }))}
                    className="px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/50">
                    {categories.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" fullWidth onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button fullWidth style={{ backgroundColor: '#10B981' }} onClick={addItem}>Add Item</Button>
              </div>
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
