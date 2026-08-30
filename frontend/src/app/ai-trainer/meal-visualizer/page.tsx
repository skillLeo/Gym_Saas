'use client';

import { useState, useEffect } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RingChart } from '@/components/ui/RingChart';
import { Sparkles, Wand2, Apple, TrendingUp, CheckCircle, AlertCircle, Info, RefreshCw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

const MEAL_IMAGES = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop',
];

// Keys, not labels — module scope runs before the component mounts.
const MEAL_STYLES = [
  { id: 'realistic', labelKey: 'mealViz.realistic', emoji: '📸' },
  { id: 'artistic',  labelKey: 'mealViz.artistic',  emoji: '🎨' },
  { id: 'macro',     labelKey: 'mealViz.macroShot', emoji: '🔍' },
];

// Keys, resolved at render — module scope cannot call t().
const MEAL_EXAMPLE_KEYS = [
  'mealViz.example1', 'mealViz.example2', 'mealViz.example3', 'mealViz.example4',
];

export default function MealVisualizerPage() {
  const { t } = useI18nStore();
  const [description,   setDescription]   = useState('');
  const [style,         setStyle]         = useState('realistic');
  const [generating,    setGenerating]    = useState(false);
  const [generatedImg,  setGeneratedImg]  = useState<string | null>(null);
  const [imageIdx,      setImageIdx]      = useState(0);
  const [expanded,      setExpanded]      = useState<string | null>('Breakfast');
  const [loading,       setLoading]       = useState(true);
  const [consumed,      setConsumed]      = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [dailyGoal,     setDailyGoal]     = useState({ calories: 2000, protein: 150, carbs: 200, fat: 65 });

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    api.get(`/food-log?date=${today}`).then(res => {
      const entries: Array<{ calories: number; protein_g: number; carbs_g: number; fat_g: number }> = res.data.entries ?? [];
      const totals = entries.reduce((acc, e) => ({
        calories: acc.calories + (e.calories ?? 0),
        protein:  acc.protein  + (e.protein_g ?? 0),
        carbs:    acc.carbs    + (e.carbs_g ?? 0),
        fat:      acc.fat      + (e.fat_g ?? 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
      setConsumed({ calories: Math.round(totals.calories), protein: Math.round(totals.protein), carbs: Math.round(totals.carbs), fat: Math.round(totals.fat) });
      if (res.data.goal) {
        setDailyGoal({
          calories: res.data.goal.daily_calories ?? 2000,
          protein:  res.data.goal.protein_g     ?? 150,
          carbs:    res.data.goal.carbs_g       ?? 200,
          fat:      res.data.goal.fat_g         ?? 65,
        });
      }
    }).catch(() => {
      /* use defaults */
    }).finally(() => setLoading(false));
  }, []);

  const caloriesLeft  = dailyGoal.calories - consumed.calories;
  const overallScore  = Math.min(100, Math.round((consumed.calories / Math.max(dailyGoal.calories, 1)) * 100));
  const nutritionGrade = overallScore >= 80 ? t('mealViz.excellent') : overallScore >= 60 ? t('mealViz.goodProgress') : t('mealViz.keepLogging');

  const mealScores = [
    { meal: t('mealViz.proteinIntake'), score: Math.min(100, Math.round((consumed.protein / Math.max(dailyGoal.protein, 1)) * 100)), feedback: consumed.protein >= dailyGoal.protein ? t('mealViz.recProtein') : `Need ${Math.round(dailyGoal.protein - consumed.protein)}g more protein to hit your goal.`, color: '#F87404' },
    { meal: t('mealViz.carbBalance'),   score: Math.min(100, Math.round((consumed.carbs / Math.max(dailyGoal.carbs, 1)) * 100)),    feedback: consumed.carbs >= dailyGoal.carbs ? t('mealViz.recCarbsOk') : `Add ${Math.round(dailyGoal.carbs - consumed.carbs)}g more carbs from whole grains or fruits.`, color: '#10B981' },
    { meal: t('mealViz.fatBalance'),    score: Math.min(100, Math.round((consumed.fat / Math.max(dailyGoal.fat, 1)) * 100)),         feedback: consumed.fat >= dailyGoal.fat ? t('mealViz.recFatOk') : `Healthy fats like avocado or nuts can help close the ${Math.round(dailyGoal.fat - consumed.fat)}g gap.`, color: '#004AAD' },
  ];

  const aiRecommendations = [
    ...(consumed.protein < dailyGoal.protein ? [{ icon: '💪', title: t('mealViz.boostProtein', { n: Math.round(dailyGoal.protein - consumed.protein) }), desc: t('mealViz.recAddProtein'), priority: t('priority.high') }] : []),
    ...(consumed.carbs < dailyGoal.carbs * 0.5 ? [{ icon: '🥦', title: t('mealViz.moreCarbs'), desc: t('mealViz.recAddCarbs'), priority: t('priority.medium') }] : []),
    { icon: '💧', title: t('mealViz.recHydrate'), desc: t('mealViz.recWater'), priority: t('priority.low') },
    ...(consumed.calories < dailyGoal.calories * 0.8 ? [{ icon: '🍽️', title: t('mealViz.logMore'), desc: t('mealViz.recUnderEating'), priority: t('priority.medium') }] : []),
  ].slice(0, 3);

  const generate = async () => {
    if (!description.trim()) { toast.error(t('mealViz.describeFirst')); return; }
    setGenerating(true);
    setGeneratedImg(null);
    await new Promise(r => setTimeout(r, 2000));
    const idx = Math.floor(Math.random() * MEAL_IMAGES.length);
    setImageIdx(idx);
    setGeneratedImg(MEAL_IMAGES[idx]);
    setGenerating(false);
    toast.success(t('mealViz.generated'));
  };

  const regenerate = async () => {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 1200));
    const next = (imageIdx + 1) % MEAL_IMAGES.length;
    setImageIdx(next);
    setGeneratedImg(MEAL_IMAGES[next]);
    setGenerating(false);
  };

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto px-4 py-6 pb-24">

        <PageHeader
        title={t('mealViz.title')}
        subtitle={t('mealViz.subtitle')}
        back="/ai-trainer"
      />

        {/* Generate Image */}
        <Card className="mb-5 overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-accent" />
              <h2 className="font-semibold text-content-primary text-sm">{t('mealViz.generate')}</h2>
            </div>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe your meal… e.g. Grilled chicken breast with brown rice and steamed broccoli"
              rows={3}
              className="w-full bg-surface-sunken border border-border-strong rounded-md px-4 py-3 text-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 transition-all resize-none mb-3"
            />
            <div className="flex flex-wrap gap-1.5 mb-4">
              {MEAL_EXAMPLE_KEYS.map(exKey => (
                <button key={exKey} onClick={() => setDescription(t(exKey))}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/[0.07] text-content-secondary hover:bg-accent-surface hover:text-accent transition-colors truncate max-w-[180px]">
                  {t(exKey)}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              {MEAL_STYLES.map(s => (
                <button key={s.id} onClick={() => setStyle(s.id)}
                  className={`flex-1 py-2 rounded-md text-xs font-semibold border-2 transition-all ${style === s.id ? 'border-accent bg-accent-surface text-accent' : 'border-border-subtle text-content-secondary'}`}>
                  {s.emoji} {t(s.labelKey)}
                </button>
              ))}
            </div>
            <button onClick={generate} disabled={generating || !description.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-md bg-gradient-to-r from-[#F87404] to-[#FF5C04] text-white font-bold hover: transition-all active:scale-[0.98] disabled:opacity-60">
              {generating ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> {t('mealViz.generating')}</>
              ) : (
                <><Wand2 size={17} /> {t('mealViz.generate')}</>
              )}
            </button>
          </div>
          {generatedImg && (
            <div className="border-t border-border-subtle">
              <div className="relative overflow-hidden">
                <img src={generatedImg} alt={t('mealViz.generatedMeal')} className="w-full h-56 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute top-3 left-3">
                  <span className="text-xs font-bold bg-accent text-white px-2.5 py-1 rounded-full">{t('common.aiGenerated')}</span>
                </div>
                <div className="absolute bottom-3 right-3">
                  <button onClick={regenerate} disabled={generating}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-white/90 backdrop-blur-sm text-content-primary px-3 py-1.5 rounded-full hover:bg-white transition-colors disabled:opacity-60">
                    <RefreshCw size={12} /> {t('mealViz.regenerate')}
                  </button>
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs text-content-secondary italic">"{description}"</p>
                <p className="text-[11px] text-content-tertiary mt-1">Style: {t(MEAL_STYLES.find(s => s.id === style)?.labelKey ?? 'mealViz.realistic')} · AI-generated image for visualization only</p>
              </div>
            </div>
          )}
        </Card>

        {/* Nutrition Score */}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-accent" /></div>
        ) : (
          <>
            <Card className="mb-5 overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-content-secondary mb-1">{t('common.todayProgress')}</p>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="font-display text-5xl font-bold text-accent">{overallScore}</span>
                      <span className="text-content-tertiary text-lg">/100</span>
                    </div>
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${overallScore >= 80 ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'}`}>
                      {overallScore >= 80 ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                      {nutritionGrade}
                    </div>
                  </div>
                  <RingChart value={overallScore} max={100} size={90} strokeWidth={9} color="#F87404" label={`${overallScore}%`} sublabel={t('mealViz.doneLabel')} />
                </div>
              </div>
              <div className="border-t border-border-subtle p-4">
                <p className="text-xs font-medium text-content-secondary mb-3">{t('mealViz.todayMacrosLabel')}</p>
                <div className="space-y-2.5">
                  {[
                    { label: t('common.protein'), current: consumed.protein, goal: dailyGoal.protein, color: '#F87404', unit: 'g' },
                    { label: t('common.carbs'),   current: consumed.carbs,   goal: dailyGoal.carbs,   color: '#004AAD', unit: 'g' },
                    { label: t('common.fat'),     current: consumed.fat,     goal: dailyGoal.fat,     color: '#7C3AED', unit: 'g' },
                  ].map(({ label, current, goal, color, unit }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-content-secondary">{label}</span>
                        <span style={{ color }}><strong>{current}</strong>/{goal}{unit}</span>
                      </div>
                      <ProgressBar value={Math.min((current / Math.max(goal, 1)) * 100, 100)} max={100} color={color} height={5} />
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Calorie Status */}
            <div className={`flex items-center gap-3 rounded-md p-4 mb-5 border ${caloriesLeft > 0 ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'}`}>
              <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${caloriesLeft > 0 ? 'bg-green-100 dark:bg-green-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
                <Apple size={18} className={caloriesLeft > 0 ? 'text-green-600' : 'text-red-500'} />
              </div>
              <div>
                <div className={`font-semibold text-sm ${caloriesLeft > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {caloriesLeft > 0 ? t('mealViz.kcalRemaining', { n: caloriesLeft }) : t('mealViz.kcalOver', { n: Math.abs(caloriesLeft) })}
                </div>
                <div className="text-xs text-content-secondary">{t('mealViz.consumed', { eaten: consumed.calories, goal: dailyGoal.calories })}</div>
              </div>
            </div>

            {/* Macro Analysis */}
            <div className="mb-5">
              <h3 className="font-semibold text-content-primary text-sm mb-3 flex items-center gap-2">
                <Sparkles size={15} className="text-accent" /> {t('mealViz.macroAnalysis')}
              </h3>
              <div className="space-y-3">
                {mealScores.map(({ meal, score, feedback, color }) => (
                  <div key={meal} className="bg-surface-raised rounded-md border border-border-subtle overflow-hidden">
                    <button className="w-full flex items-center justify-between p-4" onClick={() => setExpanded(expanded === meal ? null : meal)}>
                      <span className="font-semibold text-content-primary text-sm">{meal}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-sm font-bold w-8 text-right" style={{ color }}>{score}%</span>
                      </div>
                    </button>
                    {expanded === meal && (
                      <div className="px-4 pb-4 border-t border-gray-50 dark:border-white/[0.04] pt-3">
                        <div className="flex items-start gap-2">
                          <Info size={14} className="shrink-0 mt-0.5" style={{ color }} />
                          <p className="text-xs text-content-secondary">{feedback}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            {aiRecommendations.length > 0 && (
              <div>
                <h3 className="font-semibold text-content-primary text-sm mb-3 flex items-center gap-2">
                  <TrendingUp size={15} className="text-brand-blue-deep" /> {t('mealViz.recommendations')}
                </h3>
                <div className="space-y-2">
                  {aiRecommendations.map(({ icon, title, desc, priority }) => (
                    <div key={title} className="flex items-start gap-3 p-4 bg-surface-raised rounded-md border border-border-subtle">
                      <div className="text-xl shrink-0">{icon}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-content-primary text-sm">{title}</div>
                        <div className="text-xs text-content-secondary mt-0.5">{desc}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${priority === 'high' ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' : priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' : 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'}`}>
                        {priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
