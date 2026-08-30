'use client';

import { useState, useEffect, useRef } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { FoodDbNotice, useFoodDbConnected } from '@/components/food/FoodDbNotice';
import {
  Mic, MicOff, Plus, CheckCircle, Sparkles, Edit3, Loader2, AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// Keys rather than sentences: module scope runs before the component mounts,
// so these are translated at render time.
const examplePhraseKeys = [
  'voiceLog.example0',
  'voiceLog.example1',
  'voiceLog.example2',
  'voiceLog.example3',
  'voiceLog.example4',
];

interface FoodItem {
  name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number;
  serving_qty: number; serving_unit: string; nutritionix_id: string | null;
}
interface MealSlot { id: number; name: string; sort_order: number }

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function VoiceLogPage() {
  const { t } = useI18nStore();
  // See photo-log: no food database means no 'AI Powered' claim.
  const foodDbConnected = useFoodDbConnected();
  const [state,          setState]          = useState<'idle' | 'listening' | 'processing' | 'result' | 'error'>('idle');
  const [pulseSize,      setPulseSize]      = useState(0);
  const [mealSlots,      setMealSlots]      = useState<MealSlot[]>([]);
  const [selectedSlot,   setSelectedSlot]   = useState<number | null>(null);
  const [transcript,     setTranscript]     = useState('');
  const [editMode,       setEditMode]       = useState(false);
  const [foodItems,      setFoodItems]      = useState<FoodItem[]>([]);
  const [loggedIds,      setLoggedIds]      = useState<Set<number>>(new Set());
  const [loggingIdx,     setLoggingIdx]     = useState<number | null>(null);
  const [hasSpeechAPI,   setHasSpeechAPI]   = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setHasSpeechAPI(false); return; }
    const recog = new SR();
    recog.lang = 'en-US';
    recog.continuous = false;
    recog.interimResults = false;
    recog.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      parseNLP(text);
    };
    recog.onerror = () => {
      setState('error');
      toast.error(t('voiceLog.micError'));
    };
    recog.onend = () => {
      if (state === 'listening') setState('processing');
    };
    recognitionRef.current = recog;
  }, []);

  useEffect(() => {
    api.get('/meal-slots').then(res => {
      const slots = res.data.data ?? [];
      setMealSlots(slots);
      if (slots.length) setSelectedSlot(slots[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === 'listening') {
      interval = setInterval(() => setPulseSize(s => (s + 1) % 3), 600);
    } else {
      setPulseSize(0);
    }
    return () => clearInterval(interval);
  }, [state]);

  const startListening = () => {
    setTranscript('');
    setFoodItems([]);
    setLoggedIds(new Set());
    setState('listening');
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch { /* already started */ }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setState('processing');
  };

  const parseNLP = async (text: string) => {
    setState('processing');
    try {
      const res = await api.post('/food/nlp', { query: text });
      setFoodItems(res.data.data ?? []);
      setState('result');
    } catch (err: any) {
      if (err?.response?.status === 503) {
        toast.error(t('foodLog.notConfigured'));
      } else {
        toast.error(t('voiceLog.parseFailed'));
      }
      setState('error');
    }
  };

  const parseManual = () => {
    if (!transcript.trim()) { toast.error(t('voiceLog.needText')); return; }
    setEditMode(false);
    parseNLP(transcript);
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

  return (
    <DashboardShell>
      <div className="max-w-md mx-auto px-4 py-6">

        {/* Header */}
        <PageHeader
        title={t('voiceLog.title')}
        subtitle={t('voiceLog.subtitle')}
        back="/food-journal"
      />

      <FoodDbNotice />

        {/* Mic visual */}
        <div className="relative rounded-md bg-gray-900 aspect-[4/3] flex flex-col items-center justify-center mb-5 overflow-hidden">
          {/* Pulse rings */}
          {state === 'listening' && (
            <>
              {[80, 120, 160].map((size, i) => (
                <div key={i} className={`absolute rounded-full border border-accent/30 transition-all duration-500 ${pulseSize >= i ? 'opacity-100' : 'opacity-0'}`}
                  style={{ width: size, height: size }} />
              ))}
            </>
          )}

          <button
            onClick={state === 'idle' || state === 'error' ? startListening : state === 'listening' ? stopListening : undefined}
            disabled={state === 'processing'}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all z-10 ${
              state === 'listening'
                ? 'bg-red-500 shadow-red-500/40 scale-110'
                : state === 'processing'
                  ? 'bg-accent/40'
                  : 'bg-accent hover:scale-105'
            }`}>
            {state === 'processing'
              ? <Loader2 size={32} className="text-white animate-spin" />
              : state === 'listening'
                ? <MicOff size={32} className="text-white" />
                : <Mic size={32} className="text-white" />}
          </button>

          <p className="text-white/60 text-sm mt-4 z-10">
            {state === 'idle'     && (hasSpeechAPI ? t('voiceLog.tapMic') : t('voiceLog.typeBelow'))}
            {state === 'listening' && t('voiceLog.listening')}
            {state === 'processing' && t('voiceLog.parsing')}
            {state === 'result'   && t('voiceLog.done')}
            {state === 'error'    && t('voiceLog.tryAgain')}
          </p>

          {!hasSpeechAPI && (
            <div className="absolute top-4 left-4 right-4 bg-yellow-500/20 border border-yellow-500/30 rounded-md px-3 py-2 text-center">
              <p className="text-yellow-300 text-xs">{t('voiceLog.unsupported')}</p>
            </div>
          )}

          {foodDbConnected !== false && (
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
              <Sparkles size={12} className="text-brand-yellow" />
              <span className="text-white text-xs font-medium">{t('common.aiPowered')}</span>
            </div>
          )}
        </div>

        {/* Text input / transcript */}
        <Card className="mb-5">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-content-primary">
                {state === 'result' ? t('voiceLog.transcript') : t('voiceLog.orType')}
              </p>
              {transcript && state === 'result' && (
                <button onClick={() => setEditMode(e => !e)}
                  className="flex items-center gap-1 text-xs text-accent hover:underline">
                  <Edit3 size={12} /> {t('common.edit')}
                </button>
              )}
            </div>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              readOnly={state === 'result' && !editMode}
              rows={3}
              placeholder={t('voiceLog.placeholder')}
              className={`w-full px-3 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 resize-none ${state === 'result' && !editMode ? 'opacity-60' : ''}`}
            />
            {(state === 'idle' || state === 'error' || (state === 'result' && editMode)) && (
              <button onClick={parseManual}
                className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-md bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors">
                <Sparkles size={15} /> {t('voiceLog.parse')}
              </button>
            )}
          </div>
        </Card>

        {/* Example phrases */}
        {state === 'idle' && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-content-secondary uppercase tracking-widest mb-3">{t('voiceLog.examples')}</p>
            <div className="space-y-2">
              {examplePhraseKeys.map((phraseKey, i) => (
                <button key={i} onClick={() => setTranscript(t(phraseKey))}
                  className="w-full text-left px-4 py-3 rounded-md bg-surface-raised border border-border-subtle hover:border-accent/30 transition-all text-sm text-content-secondary hover:text-content-primary dark:hover:text-white">
                  "{t(phraseKey)}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Parsed food items */}
        {state === 'result' && foodItems.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-content-primary text-sm">{foodItems.length} item{foodItems.length !== 1 ? 's' : ''} detected</p>
              <div className="flex gap-1 flex-wrap justify-end">
                {mealSlots.map(m => (
                  <button key={m.id} onClick={() => setSelectedSlot(m.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${selectedSlot === m.id ? 'bg-accent text-white' : 'bg-surface-sunken text-content-secondary'}`}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
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
            <button onClick={() => { setState('idle'); setTranscript(''); setFoodItems([]); setLoggedIds(new Set()); }}
              className="w-full mt-4 py-2.5 rounded-md border border-border-strong text-sm text-content-secondary hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors">
              {t('voiceLog.logAnother')}
            </button>
          </div>
        )}

        {state === 'result' && foodItems.length === 0 && (
          <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-500/10 rounded-md border border-yellow-200 dark:border-yellow-500/20">
            <AlertCircle size={18} className="text-yellow-500 shrink-0" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">{t('voiceLog.noItems')}</p>
          </div>
        )}

        <div className="h-16" />
      </div>
    </DashboardShell>
  );
}
