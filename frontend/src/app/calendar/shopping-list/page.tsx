'use client';

import { useState, useEffect } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Plus, Trash2, Check, Sparkles, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type ShoppingItem = { id: number; name: string; quantity: string | null; unit: string | null; category: string | null; checked: boolean };

const CATEGORY_ORDER = ['Produce', 'Dairy', 'Meat', 'Pantry', 'Other'];
const categoryColors: Record<string, string> = {
  Produce: '#10B981', Dairy: '#004AAD', Meat: '#F87404', Pantry: '#7C3AED', Other: '#6B7280',
};

function weekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
}

export default function ShoppingListPage() {
  const { t } = useI18nStore();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [newItem, setNewItem] = useState({ name: '', qty: '', category: t('shopping.produce') });
  const [showAdd, setShowAdd] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api.get('/calendar/shopping-list').then(r => setItems(r.data.items ?? [])).catch(() => toast.error(t('shopping.error.load'))).finally(() => setLoading(false));
  }, []);

  const categories = ['All', ...CATEGORY_ORDER.filter(c => items.some(i => (i.category ?? 'Other') === c))];
  const filtered = items.filter(i => filter === 'All' || (i.category ?? 'Other') === filter);
  const checked = items.filter(i => i.checked).length;

  const toggle = async (id: number) => {
    setItems(p => p.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
    try { await api.post(`/calendar/shopping-list/${id}/toggle`); } catch {
      setItems(p => p.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
      toast.error(t('shopping.error.update'));
    }
  };

  const remove = async (id: number) => {
    setItems(p => p.filter(i => i.id !== id));
    try { await api.delete(`/calendar/shopping-list/${id}`); } catch { toast.error(t('shopping.error.remove')); }
  };

  const clearChecked = async () => {
    setItems(p => p.filter(i => !i.checked));
    try { await api.delete('/calendar/shopping-list/clear-checked'); } catch { toast.error(t('shopping.error.clear')); }
  };

  const addItem = async () => {
    if (!newItem.name.trim()) return;
    try {
      const res = await api.post('/calendar/shopping-list', {
        name: newItem.name.trim(), quantity: newItem.qty || null, category: newItem.category,
      });
      setItems(p => [...p, res.data.item]);
      setNewItem({ name: '', qty: '', category: t('shopping.produce') });
      setShowAdd(false);
    } catch {
      toast.error(t('shopping.error.add'));
    }
  };

  const generateFromMealPlan = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/calendar/shopping-list/generate', { week_start: weekStart() });
      toast.success(res.data.message);
      if (res.data.created > 0) {
        const listRes = await api.get('/calendar/shopping-list');
        setItems(listRes.data.items ?? []);
      }
    } catch {
      toast.error(t('shopping.error.generate'));
    } finally {
      setGenerating(false);
    }
  };

  const groupedFiltered = CATEGORY_ORDER.reduce((acc, cat) => {
    const catItems = filtered.filter(i => (i.category ?? 'Other') === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {} as Record<string, ShoppingItem[]>);

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto px-4 py-6">

        <PageHeader
        title={t('shopping.title')}
        subtitle={t('shopping.checkedOff', { done: checked, total: items.length })}
        back="/calendar"
        actions={<Button size="sm" icon={<Plus size={15} />} onClick={() => setShowAdd(true)}>{t('shopping.addItem')}</Button>}
      />

        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-content-secondary mb-2">
            <span>{t('common.progress')}</span>
            <span>{items.length ? Math.round((checked / items.length) * 100) : 0}%</span>
          </div>
          <div className="h-2 bg-surface-sunken rounded-full overflow-hidden">
            <div className="h-full bg-[#10B981] rounded-full transition-all" style={{ width: `${items.length ? (checked / items.length) * 100 : 0}%` }} />
          </div>
        </div>

        {/* Generate from meal plan */}
        <div className="flex items-center gap-3 bg-accent-surface border border-accent/20 rounded-md p-4 mb-5">
          <Sparkles size={18} className="text-accent shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-content-primary">{t('shopping.autoGenerate')}</div>
            <div className="text-xs text-content-secondary">{t('shopping.autoHint')}</div>
          </div>
          <Button size="sm" variant="outline" onClick={generateFromMealPlan} loading={generating}>{t('common.generate')}</Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[#10B981]" />
          </div>
        ) : (
          <>
            {/* Category Filter */}
            {items.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setFilter(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all ${filter === cat ? 'bg-[#10B981] text-white' : 'bg-surface-raised border border-border-strong text-content-secondary'}`}>
                    {t('shopping.' + cat.toLowerCase())}
                  </button>
                ))}
              </div>
            )}

            {/* Item Groups */}
            {items.length === 0 ? (
              <div className="text-center py-10 text-content-tertiary text-sm">{t('shopping.empty')}</div>
            ) : (
              <div className="space-y-4 mb-5">
                {Object.entries(groupedFiltered).map(([cat, catItems]) => (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors[cat] || '#6B7280' }} />
                      <span className="text-xs font-semibold text-content-secondary uppercase tracking-wide">{t('shopping.' + cat.toLowerCase())}</span>
                      <span className="text-xs text-content-tertiary">({catItems.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {catItems.map(item => (
                        <div key={item.id} className={`flex items-center gap-3 p-3.5 rounded-md border transition-all ${item.checked ? 'bg-gray-50 dark:bg-white/[0.03] border-gray-100 dark:border-white/[0.05] opacity-60' : 'bg-surface-raised border-border-subtle'}`}>
                          <button onClick={() => toggle(item.id)}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${item.checked ? 'bg-[#10B981] border-[#10B981]' : 'border-gray-300 dark:border-gray-600 hover:border-[#10B981]'}`}>
                            {item.checked && <Check size={13} className="text-white" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium ${item.checked ? 'line-through text-content-tertiary' : 'text-content-primary'}`}>
                              {item.name}
                            </span>
                            {item.quantity && <span className="text-xs text-content-tertiary ml-2">{item.quantity} {item.unit}</span>}
                          </div>
                          <button onClick={() => remove(item.id)} className="w-7 h-7 flex items-center justify-center text-content-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors shrink-0">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {checked > 0 && (
              <Button variant="ghost" fullWidth size="sm" onClick={clearChecked} icon={<Check size={14} />}>
                Clear {checked} checked item{checked !== 1 ? 's' : ''}
              </Button>
            )}
          </>
        )}

        {/* Add Item Modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
            <div className="relative w-full sm:max-w-sm bg-surface-raised rounded-t-3xl sm:rounded-md p-5 z-10 border border-border-subtle">
              <h3 className="font-semibold text-content-primary mb-4">{t('shopping.addItem')}</h3>
              <div className="space-y-3 mb-4">
                <input value={newItem.name} onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))}
                  placeholder={t('shopping.itemName')} autoFocus
                  className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]/50" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={newItem.qty} onChange={e => setNewItem(n => ({ ...n, qty: e.target.value }))}
                    placeholder={t('shopping.quantity')}
                    className="px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]/50" />
                  <select value={newItem.category} onChange={e => setNewItem(n => ({ ...n, category: e.target.value }))}
                    className="px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]/50">
                    {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" fullWidth onClick={() => setShowAdd(false)}>{t('common.cancel')}</Button>
                <Button fullWidth style={{ backgroundColor: '#10B981' }} onClick={addItem}>{t('shopping.addItem')}</Button>
              </div>
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
