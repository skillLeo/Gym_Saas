'use client';

import { useState, useEffect } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { FoodDbNotice } from '@/components/food/FoodDbNotice';
import { Barcode, Search, Plus, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface FoodItem {
  nutritionix_id: string | null;
  name: string;
  brand: string | null;
  serving_qty: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
}

interface MealSlot { id: number; name: string; sort_order: number }

export default function BarcodeScannerPage() {
  const { t } = useI18nStore();
  const [manualCode,   setManualCode]   = useState('');
  const [searching,    setSearching]    = useState(false);
  const [result,       setResult]       = useState<FoodItem | null>(null);
  const [notFound,     setNotFound]     = useState(false);
  const [mealSlots,    setMealSlots]    = useState<MealSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [servings,     setServings]     = useState('1');
  const [logging,      setLogging]      = useState(false);
  const [logged,       setLogged]       = useState(false);

  useEffect(() => {
    api.get('/meal-slots').then(res => {
      const slots = res.data.data ?? [];
      setMealSlots(slots);
      if (slots.length) setSelectedSlot(slots[0].id);
    }).catch(() => {});
  }, []);

  const selectedSlotName = mealSlots.find(m => m.id === selectedSlot)?.name ?? 'meal';

  const search = async () => {
    const code = manualCode.trim();
    if (!code) { toast.error(t('barcode.needNumber')); return; }
    setSearching(true);
    setResult(null);
    setNotFound(false);
    setLogged(false);
    try {
      const res = await api.get(`/food/barcode/${encodeURIComponent(code)}`);
      setResult(res.data.data);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else if (err?.response?.status === 503) {
        toast.error(t('foodLog.notConfigured'));
      } else {
        toast.error(t('barcode.lookupFailed'));
      }
    } finally {
      setSearching(false);
    }
  };

  const logFood = async () => {
    if (!result) return;
    if (!selectedSlot) { toast.error(t('foodLog.noSlot')); return; }
    setLogging(true);
    try {
      await api.post('/food-log/from-api', {
        food_data: {
          name:         result.name,
          calories:     result.calories,
          protein_g:    result.protein_g,
          carbs_g:      result.carbs_g,
          fat_g:        result.fat_g,
          serving_qty:  result.serving_qty,
          serving_unit: result.serving_unit,
          nutritionix_id: result.nutritionix_id,
        },
        meal_slot_id: selectedSlot,
        logged_date:  new Date().toISOString().slice(0, 10),
        servings:     parseFloat(servings) || 1,
      });
      setLogged(true);
      toast.success(`Logged to ${selectedSlotName}!`);
    } catch {
      toast.error(t('foodLog.error.log'));
    } finally {
      setLogging(false);
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-md mx-auto px-4 py-6">

        {/* Header */}
        <PageHeader
        title={t('barcode.title')}
        subtitle={t('barcode.subtitle')}
        back="/food-journal"
      />

      <FoodDbNotice />

        {/* Barcode icon visual */}
        <div className="relative rounded-md overflow-hidden mb-5 bg-gray-900 aspect-[4/3] flex flex-col items-center justify-center gap-3">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
            <Barcode size={40} className="text-accent" />
          </div>
          <p className="text-white/60 text-sm text-center px-6">
            {t('barcode.cameraNote')}<br />
            {t('barcode.manualNote')}
          </p>
          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
            <span className="text-white text-xs font-medium">{t('barcode.source')}</span>
          </div>
        </div>

        {/* Manual entry */}
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
            <input
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder={t('barcode.placeholder')}
              className="w-full pl-9 pr-4 py-3 rounded-md border border-border-strong bg-surface-raised text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 text-sm"
            />
          </div>
          <button onClick={search} disabled={searching || !manualCode.trim()}
            className="px-4 py-3 rounded-md bg-accent text-white font-semibold text-sm disabled:opacity-50 flex items-center gap-2 hover:bg-accent-hover transition-colors">
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {t('barcode.lookUp')}
          </button>
        </div>

        {/* Not found */}
        {notFound && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 rounded-md border border-red-200 dark:border-red-500/20 mb-5">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">{t('barcode.notFound')}</p>
              <p className="text-xs text-red-500/80 mt-0.5">{t('barcode.checkNumber')}</p>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <Card className="mb-5">
            <div className="p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-content-primary text-sm leading-snug">{result.name}</h3>
                {result.brand && <p className="text-xs text-content-tertiary mt-0.5">{result.brand}</p>}
                <p className="text-xs text-content-tertiary mt-0.5">
                  Serving: {result.serving_qty} {result.serving_unit}
                </p>
              </div>

              {/* Nutrition facts */}
              <div className="bg-surface-sunken rounded-md p-4 mb-4">
                <div className="text-center mb-3">
                  <div className="font-display text-3xl font-bold text-accent">{result.calories}</div>
                  <div className="text-xs text-content-tertiary">calories per serving</div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: t('common.protein'), val: result.protein_g, color: '#F87404' },
                    { label: t('common.carbs'),   val: result.carbs_g,   color: '#004AAD' },
                    { label: t('common.fat'),     val: result.fat_g,     color: '#7C3AED' },
                    { label: t('common.fiber'),   val: result.fiber_g ?? 0, color: '#10B981' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="text-center">
                      <div className="font-bold text-sm" style={{ color }}>{val}g</div>
                      <div className="text-xs text-content-tertiary">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Servings */}
              <div className="flex items-center gap-3 mb-4">
                <label className="text-xs font-medium text-content-secondary whitespace-nowrap">{t('common.servings')}</label>
                <input type="number" min="0.1" step="0.5" value={servings}
                  onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setServings(v); }}
                  onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                  className="w-20 px-3 py-2 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 text-center" />
              </div>

              {/* Meal selector */}
              <div className="mb-4">
                <label className="text-xs font-medium text-content-secondary mb-2 block">{t('barcode.addToMeal')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {mealSlots.map(m => (
                    <button key={m.id} onClick={() => setSelectedSlot(m.id)}
                      className={`py-2 rounded-md text-xs font-medium transition-all ${selectedSlot === m.id ? 'bg-accent text-white' : 'bg-surface-sunken text-content-secondary'}`}>
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              {logged ? (
                <div className="flex items-center justify-center gap-2 py-3 bg-green-50 dark:bg-green-500/10 rounded-md text-green-600 dark:text-green-400 text-sm font-medium">
                  <CheckCircle size={16} /> Added to {selectedSlotName}!
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={logFood} disabled={logging}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-md bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-60">
                    {logging ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                    Add to {selectedSlotName}
                  </button>
                  <button onClick={() => { setResult(null); setManualCode(''); setLogged(false); }}
                    className="px-4 py-3 rounded-md border border-border-strong text-sm text-content-secondary hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors">
                    {t('common.clear')}
                  </button>
                </div>
              )}
            </div>
          </Card>
        )}

        <div className="h-16" />
      </div>
    </DashboardShell>
  );
}
