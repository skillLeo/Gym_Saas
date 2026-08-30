'use client';

import { useState, useRef, useEffect } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { FoodDbNotice, useFoodDbConnected } from '@/components/food/FoodDbNotice';
import {
  Camera, ImageIcon, Sparkles, Plus, CheckCircle, Edit3,
  RefreshCw, Loader2, AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface FoodItem {
  name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number;
  serving_qty: number; serving_unit: string; nutritionix_id: string | null;
}
interface MealSlot { id: number; name: string; sort_order: number }

export default function PhotoLogPage() {
  const { t } = useI18nStore();
  // Hides the 'AI Powered' badge and the 'our AI will calculate the nutrition
  // automatically' line when there is no food database behind them, so the page
  // does not carry a warning and a contradicting promise at the same time.
  const foodDbConnected = useFoodDbConnected();
  const [photoPreview,  setPhotoPreview]  = useState<string | null>(null);
  const [step,          setStep]          = useState<'capture' | 'describe' | 'result'>('capture');
  const [description,   setDescription]  = useState('');
  const [parsing,       setParsing]       = useState(false);
  const [foodItems,     setFoodItems]     = useState<FoodItem[]>([]);
  const [mealSlots,     setMealSlots]     = useState<MealSlot[]>([]);
  const [selectedSlot,  setSelectedSlot]  = useState<number | null>(null);
  const [loggedIds,     setLoggedIds]     = useState<Set<number>>(new Set());
  const [loggingIdx,    setLoggingIdx]    = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/meal-slots').then(res => {
      const slots = res.data.data ?? [];
      setMealSlots(slots);
      if (slots.length) setSelectedSlot(slots[0].id);
    }).catch(() => {});
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
    setStep('describe');
  };

  const parseDescription = async () => {
    if (!description.trim()) { toast.error(t('photoLog.describe')); return; }
    setParsing(true);
    try {
      const res = await api.post('/food/nlp', { query: description });
      setFoodItems(res.data.data ?? []);
      setStep('result');
    } catch (err: any) {
      if (err?.response?.status === 503) {
        toast.error(t('foodLog.notConfigured'));
      } else {
        toast.error(t('photoLog.parseFailed'));
      }
    } finally {
      setParsing(false);
    }
  };

  const logItem = async (item: FoodItem, idx: number) => {
    if (!selectedSlot) { toast.error(t('foodLog.noSlot')); return; }
    setLoggingIdx(idx);
    try {
      await api.post('/food-log/from-api', {
        food_data: {
          name:          item.name,
          calories:      item.calories,
          protein_g:     item.protein_g,
          carbs_g:       item.carbs_g,
          fat_g:         item.fat_g,
          serving_qty:   item.serving_qty,
          serving_unit:  item.serving_unit,
          nutritionix_id: item.nutritionix_id,
        },
        meal_slot_id: selectedSlot,
        logged_date:  new Date().toISOString().slice(0, 10),
        servings:     1,
      });
      setLoggedIds(prev => new Set([...prev, idx]));
      toast.success(`${item.name} logged!`);
    } catch {
      toast.error(t('foodLog.error.log'));
    } finally {
      setLoggingIdx(null);
    }
  };

  const reset = () => {
    setPhotoPreview(null);
    setStep('capture');
    setDescription('');
    setFoodItems([]);
    setLoggedIds(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <DashboardShell>
      <div className="max-w-md mx-auto px-4 py-6">

        {/* Header */}
        <PageHeader
        title={t('photoLog.title')}
        subtitle={t('photoLog.subtitle')}
        back="/food-journal"
      />

      <FoodDbNotice />

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          className="hidden" onChange={handleFileSelect} />

        {/* Step 1: Capture */}
        {step === 'capture' && (
          <>
            <div className="relative rounded-md bg-gray-900 aspect-[4/3] flex flex-col items-center justify-center mb-5 overflow-hidden">
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-3">
                <Camera size={40} className="text-accent" />
              </div>
              <p className="text-white/70 text-sm">{t('photoLog.prompt')}</p>
              {foodDbConnected !== false && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                  <Sparkles size={12} className="text-brand-yellow" />
                  <span className="text-white text-xs font-medium">{t('common.aiPowered')}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 mb-5">
              <button onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-md bg-accent text-white font-semibold hover:bg-accent-hover transition-colors">
                <Camera size={20} /> {t('photoLog.take')}
              </button>
              <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.removeAttribute('capture'); fileInputRef.current.click(); } }}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-md border-2 border-accent/30 text-accent font-semibold hover:border-accent hover:bg-accent/5 transition-all">
                <ImageIcon size={20} /> {t('common.upload')}
              </button>
            </div>

            {foodDbConnected !== false && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-[#004AAD]/10 rounded-md border border-blue-200 dark:border-[#004AAD]/20">
                <AlertCircle size={16} className="text-brand-blue-deep dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-brand-blue-deep dark:text-blue-300 leading-relaxed">
                  {t('photoLog.help')}
                </p>
              </div>
            )}
          </>
        )}

        {/* Step 2: Describe */}
        {step === 'describe' && (
          <>
            {photoPreview && (
              <div className="relative rounded-md overflow-hidden aspect-[4/3] mb-5">
                <img src={photoPreview} alt={t('photoLog.yourMeal')} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <button onClick={reset}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors">
                  <RefreshCw size={16} />
                </button>
                <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <p className="text-white text-xs font-medium flex items-center gap-1.5">
                    <Sparkles size={11} className="text-brand-yellow" /> {t('photoLog.ready')}
                  </p>
                </div>
              </div>
            )}

            <Card className="mb-5">
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Edit3 size={16} className="text-accent" />
                  <p className="font-semibold text-content-primary text-sm">{t('photoLog.whatDoYouSee')}</p>
                </div>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder={t('photoLog.example')}
                  className="w-full px-3 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 resize-none"
                />
                <p className="text-xs text-content-tertiary mt-2">{t('photoLog.describeHint')}</p>
                <button onClick={parseDescription} disabled={parsing || !description.trim()}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-md bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-60">
                  {parsing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {parsing ? t('photoLog.calculating') : t('photoLog.calculate')}
                </button>
              </div>
            </Card>
          </>
        )}

        {/* Step 3: Result */}
        {step === 'result' && (
          <>
            {photoPreview && (
              <div className="relative rounded-md overflow-hidden h-40 mb-5">
                <img src={photoPreview} alt={t('photoLog.yourMeal')} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-white text-xs text-sm font-medium line-clamp-1">{description}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-content-primary text-sm">{foodItems.length} item{foodItems.length !== 1 ? 's' : ''} found</p>
              <div className="flex gap-1 flex-wrap justify-end">
                {mealSlots.map(m => (
                  <button key={m.id} onClick={() => setSelectedSlot(m.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${selectedSlot === m.id ? 'bg-accent text-white' : 'bg-surface-sunken text-content-secondary'}`}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            {foodItems.length === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-500/10 rounded-md border border-yellow-200 dark:border-yellow-500/20 mb-5">
                <AlertCircle size={18} className="text-yellow-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">{t('photoLog.noItems')}</p>
                  <p className="text-xs text-yellow-600/80 dark:text-yellow-400/70 mt-0.5">{t('photoLog.tryDetail')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 mb-5">
                {foodItems.map((item, idx) => (
                  <Card key={idx}>
                    <div className="p-4 flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-content-primary">{item.name}</p>
                        <p className="text-xs text-content-tertiary mt-0.5">{item.serving_qty} {item.serving_unit}</p>
                        <div className="flex gap-3 mt-1.5 text-xs">
                          <span className="text-accent font-bold">{item.calories} kcal</span>
                          <span className="text-content-tertiary">{item.protein_g}g protein</span>
                          <span className="text-content-tertiary">{item.carbs_g}g carbs</span>
                          <span className="text-content-tertiary">{item.fat_g}g fat</span>
                        </div>
                      </div>
                      {loggedIds.has(idx) ? (
                        <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                          <CheckCircle size={18} className="text-green-500" />
                        </div>
                      ) : (
                        <button onClick={() => logItem(item, idx)} disabled={loggingIdx === idx}
                          className="w-9 h-9 rounded-full bg-accent flex items-center justify-center hover:bg-accent-hover transition-colors disabled:opacity-60">
                          {loggingIdx === idx
                            ? <Loader2 size={16} className="text-white animate-spin" />
                            : <Plus size={18} className="text-white" />}
                        </button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setStep('describe'); setFoodItems([]); setLoggedIds(new Set()); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-md border border-border-strong text-sm text-content-secondary hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors">
                <Edit3 size={15} /> {t('photoLog.editDesc')}
              </button>
              <button onClick={reset}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-md border border-border-strong text-sm text-content-secondary hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors">
                <Camera size={15} /> {t('photoLog.new')}
              </button>
            </div>
          </>
        )}

        <div className="h-16" />
      </div>
    </DashboardShell>
  );
}
