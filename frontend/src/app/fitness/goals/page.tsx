'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Target, Plus, CheckCircle, Trash2, Trophy, Zap, Calendar, Scale, Loader2 } from 'lucide-react';
import { Icon, type IconName } from '@/components/ui/Icon';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';
import { useI18nStore } from '@/store/i18nStore';

function getBmiCategory(bmi: number): { labelKey: string; color: string; bg: string } {
  if (bmi < 18.5) return { labelKey: 'goals.bmi.underweight', color: '#004AAD', bg: '#EFF6FF' };
  if (bmi < 25)   return { labelKey: 'goals.bmi.normalWeight', color: '#10B981', bg: '#ECFDF5' };
  if (bmi < 30)   return { labelKey: 'goals.bmi.overweight',   color: '#F87404', bg: '#FFF7ED' };
  return              { labelKey: 'goals.bmi.obese',           color: '#FF0404', bg: '#FEF2F2' };
}

/** Blocks the two keys that defeat `type="number"`'s own validation: `-` and `e` (scientific notation). */
function blockNegativeExponent(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === '-' || e.key === 'e') e.preventDefault();
}

/** Only digits and at most one decimal point — same pattern used by every other guarded numeric field in this app. */
function isValidNumericInput(v: string): boolean {
  return v === '' || /^\d*\.?\d*$/.test(v);
}

/** Clamps a numeric string field to `[min, max]` on blur. Leaves an empty field empty rather than forcing a value. */
function clampOnBlur(v: string, min: number, max: number): string {
  if (v === '') return v;
  const n = parseFloat(v);
  if (isNaN(n)) return '';
  return String(Math.min(max, Math.max(min, n)));
}

interface Goal {
  id: number; title: string; category: string; goal_type?: string;
  current_value: number; target_value: number; unit: string;
  deadline: string | null; color: string; icon_name: string;
  completed: boolean; lower_is_better: boolean;
}

const CATEGORY_OPTIONS = ['All', 'Strength', 'Cardio', 'Weight', 'Consistency', 'Flexibility'];

/**
 * Icons are Lucide names stored in `fitness_goals.icon_name` (§1.5). The legacy
 * `emoji` column has been dropped — emoji are never used as UI.
 */
const ICON_BY_CATEGORY: Record<string, IconName> = {
  Strength: 'dumbbell', Cardio: 'footprints', Weight: 'scale',
  Consistency: 'flame', Flexibility: 'brain',
};

const QUICK_GOAL_PRESETS: {
  goal_type: string; titleKey: string; category: string; unit: string;
  icon_name: IconName; lower_is_better: boolean;
}[] = [
  { goal_type: 'weight',            titleKey: 'goals.preset.targetWeight',    category: 'Weight',      unit: 'lbs',      icon_name: 'scale',         lower_is_better: true  },
  { goal_type: 'body_fat',          titleKey: 'goals.preset.targetBodyFat',   category: 'Weight',      unit: '%',        icon_name: 'trending-down', lower_is_better: true  },
  { goal_type: 'calorie',           titleKey: 'goals.preset.dailyCalorie',    category: 'Consistency', unit: 'kcal',     icon_name: 'flame',         lower_is_better: false },
  { goal_type: 'workout_frequency', titleKey: 'goals.preset.weeklyWorkout',   category: 'Consistency', unit: 'workouts', icon_name: 'dumbbell',      lower_is_better: false },
  { goal_type: 'steps',             titleKey: 'goals.preset.dailySteps',      category: 'Cardio',      unit: 'steps',    icon_name: 'footprints',    lower_is_better: false },
];

export default function FitnessGoalsPage() {
  const { t } = useI18nStore();
  const categoryLabel = (cat: string) => t(`goals.category.${cat.toLowerCase()}`);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newGoal, setNewGoal] = useState({
    title: '', category: 'Strength', goal_type: 'custom', target_value: '',
    current_value: '', unit: 'lbs', deadline: '', lower_is_better: false,
  });

  const openQuickGoal = (preset: typeof QUICK_GOAL_PRESETS[number]) => {
    setNewGoal({
      title: t(preset.titleKey), category: preset.category, goal_type: preset.goal_type,
      target_value: '', current_value: '', unit: preset.unit, deadline: '', lower_is_better: preset.lower_is_better,
    });
    setShowAdd(true);
  };

  // BMI calculator state
  const [bmiUnit,   setBmiUnit]   = useState<'imperial' | 'metric'>('imperial');
  const [bmiHeight, setBmiHeight] = useState({ ft: '', in: '', cm: '' });
  const [bmiWeight, setBmiWeight] = useState({ lbs: '', kg: '' });
  const [bmiResult, setBmiResult] = useState<number | null>(null);

  const loadGoals = async () => {
    try {
      const res = await api.get('/fitness-goals');
      setGoals(res.data.data ?? []);
    } catch {
      toast.error(t('goals.toast.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadGoals(); }, []);

  const calcBmi = () => {
    let heightM = 0, weightKg = 0;
    if (bmiUnit === 'imperial') {
      const totalIn = (parseFloat(bmiHeight.ft) || 0) * 12 + (parseFloat(bmiHeight.in) || 0);
      heightM  = totalIn * 0.0254;
      weightKg = (parseFloat(bmiWeight.lbs) || 0) * 0.453592;
    } else {
      heightM  = (parseFloat(bmiHeight.cm) || 0) / 100;
      weightKg = parseFloat(bmiWeight.kg) || 0;
    }
    if (heightM > 0 && weightKg > 0) {
      setBmiResult(Math.round((weightKg / (heightM * heightM)) * 10) / 10);
    }
  };

  const addGoal = async () => {
    if (!newGoal.title.trim()) { toast.error(t('goals.toast.titleRequired')); return; }
    if (!newGoal.target_value) { toast.error(t('goals.toast.targetRequired')); return; }
    setSaving(true);
    try {
      await api.post('/fitness-goals', {
        title:           newGoal.title,
        category:        newGoal.category,
        goal_type:       newGoal.goal_type,
        target_value:    parseFloat(newGoal.target_value),
        current_value:   parseFloat(newGoal.current_value) || 0,
        unit:            newGoal.unit,
        deadline:        newGoal.deadline || null,
        icon_name:       QUICK_GOAL_PRESETS.find(p => p.goal_type === newGoal.goal_type)?.icon_name
                           ?? ICON_BY_CATEGORY[newGoal.category] ?? 'target',
        color:           '#F87404',
        lower_is_better: newGoal.lower_is_better,
      });
      toast.success(t('goals.toast.added'));
      setShowAdd(false);
      setNewGoal({ title: '', category: 'Strength', goal_type: 'custom', target_value: '', current_value: '', unit: 'lbs', deadline: '', lower_is_better: false });
      await loadGoals();
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('goals.toast.addFailed')));
    } finally {
      setSaving(false);
    }
  };

  const toggleComplete = async (goal: Goal) => {
    setTogglingId(goal.id);
    try {
      await api.put(`/fitness-goals/${goal.id}`, { completed: !goal.completed });
      setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, completed: !g.completed } : g));
    } catch {
      toast.error(t('goals.toast.updateFailed'));
    } finally {
      setTogglingId(null);
    }
  };

  const deleteGoal = async (id: number) => {
    setDeletingId(id);
    try {
      await api.delete(`/fitness-goals/${id}`);
      setGoals(prev => prev.filter(g => g.id !== id));
      toast.success(t('goals.toast.deleted'));
    } catch {
      toast.error(t('goals.toast.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const getProgress = (g: Goal) => {
    if (g.lower_is_better) {
      const baseline = g.current_value * 1.2;
      if (baseline <= g.target_value) return 100;
      return Math.min(((baseline - g.current_value) / (baseline - g.target_value)) * 100, 100);
    }
    return Math.min((g.current_value / Math.max(g.target_value, 1)) * 100, 100);
  };

  const filtered  = goals.filter(g => filter === 'All' || g.category === filter);
  const completed = goals.filter(g => g.completed).length;

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <PageHeader
        title={t('goals.title')}
        subtitle={t('goals.subtitle', { completed, total: goals.length })}
        back="/fitness"
        actions={<Button size="sm" icon={<Plus size={15} />} onClick={() => setShowAdd(true)}>{t('goals.addGoal')}</Button>}
      />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: t('goals.stat.total'), val: goals.length, icon: Target, color: '#F87404' },
            { label: t('goals.stat.completed'),   val: completed,    icon: Trophy, color: '#FFC000' },
            { label: t('goals.stat.inProgress'), val: goals.length - completed, icon: Zap, color: '#004AAD' },
          ].map(({ label, val, icon: Icon, color }) => (
            <Card key={label} padding="sm">
              <div className="p-4 text-center">
                <Icon size={18} className="mx-auto mb-1.5" style={{ color }} />
                <div className="font-display font-bold text-content-primary text-xl">{val}</div>
                <div className="text-xs text-content-tertiary">{label}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Quick Add — typed goals */}
        <Card className="mb-5">
          <div className="p-5">
            <h3 className="font-semibold text-content-primary text-sm mb-3">{t('goals.quickAdd.heading')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_GOAL_PRESETS.map(preset => (
                <button key={preset.goal_type} onClick={() => openQuickGoal(preset)}
                  className="flex items-center gap-2 p-3 rounded-md border border-border-strong hover:border-accent/40 hover:bg-accent/5 transition-all text-left">
                  <Icon name={preset.icon_name} size="md" className="text-accent shrink-0" />
                  <span className="text-xs font-medium text-content-secondary leading-tight">{t(preset.titleKey)}</span>
                </button>
              ))}
              <button onClick={() => { setNewGoal({ title: '', category: 'Strength', goal_type: 'custom', target_value: '', current_value: '', unit: 'lbs', deadline: '', lower_is_better: false }); setShowAdd(true); }}
                className="flex items-center gap-2 p-3 rounded-md border border-dashed border-gray-300 dark:border-white/20 hover:border-accent/40 hover:bg-accent/5 transition-all text-left">
                <Icon name="notebook-pen" size="md" className="text-accent shrink-0" />
                <span className="text-xs font-medium text-content-secondary leading-tight">{t('goals.quickAdd.custom')}</span>
              </button>
            </div>
          </div>
        </Card>

        {/* BMI Calculator (client-side only) */}
        <Card className="mb-5">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-accent-surface flex items-center justify-center">
                  <Scale size={16} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-content-primary text-sm">{t('goals.bmi.heading')}</h3>
                  <p className="text-xs text-content-tertiary">{t('goals.bmi.subheading')}</p>
                </div>
              </div>
              <div className="flex bg-surface-sunken rounded-md p-0.5">
                {(['imperial', 'metric'] as const).map(u => (
                  <button key={u} onClick={() => { setBmiUnit(u); setBmiResult(null); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${bmiUnit === u ? 'bg-surface-raised text-content-primary shadow-sm' : 'text-content-secondary'}`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {bmiUnit === 'imperial' ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-content-secondary mb-1 block uppercase tracking-wide">{t('goals.bmi.height')}</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input type="number" placeholder="5" value={bmiHeight.ft}
                          onChange={e => { if (isValidNumericInput(e.target.value)) setBmiHeight(h => ({ ...h, ft: e.target.value })); }}
                          onKeyDown={blockNegativeExponent}
                          onBlur={e => setBmiHeight(h => ({ ...h, ft: clampOnBlur(e.target.value, 1, 8) }))}
                          className="w-full pl-3 pr-7 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-content-tertiary">ft</span>
                      </div>
                      <div className="relative flex-1">
                        <input type="number" placeholder="10" value={bmiHeight.in}
                          onChange={e => { if (isValidNumericInput(e.target.value)) setBmiHeight(h => ({ ...h, in: e.target.value })); }}
                          onKeyDown={blockNegativeExponent}
                          onBlur={e => setBmiHeight(h => ({ ...h, in: clampOnBlur(e.target.value, 0, 11) }))}
                          className="w-full pl-3 pr-6 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-content-tertiary">in</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-content-secondary mb-1 block uppercase tracking-wide">{t('goals.bmi.weight')}</label>
                    <div className="relative">
                      <input type="number" placeholder="180" value={bmiWeight.lbs}
                        onChange={e => { if (isValidNumericInput(e.target.value)) setBmiWeight(w => ({ ...w, lbs: e.target.value })); }}
                        onKeyDown={blockNegativeExponent}
                        onBlur={e => setBmiWeight(w => ({ ...w, lbs: clampOnBlur(e.target.value, 1, 1000) }))}
                        className="w-full pl-3 pr-9 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content-tertiary">lbs</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-content-secondary mb-1 block uppercase tracking-wide">{t('goals.bmi.height')}</label>
                    <div className="relative">
                      <input type="number" placeholder="178" value={bmiHeight.cm}
                        onChange={e => { if (isValidNumericInput(e.target.value)) setBmiHeight(h => ({ ...h, cm: e.target.value })); }}
                        onKeyDown={blockNegativeExponent}
                        onBlur={e => setBmiHeight(h => ({ ...h, cm: clampOnBlur(e.target.value, 1, 300) }))}
                        className="w-full pl-3 pr-9 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content-tertiary">cm</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-content-secondary mb-1 block uppercase tracking-wide">{t('goals.bmi.weight')}</label>
                    <div className="relative">
                      <input type="number" placeholder="82" value={bmiWeight.kg}
                        onChange={e => { if (isValidNumericInput(e.target.value)) setBmiWeight(w => ({ ...w, kg: e.target.value })); }}
                        onKeyDown={blockNegativeExponent}
                        onBlur={e => setBmiWeight(w => ({ ...w, kg: clampOnBlur(e.target.value, 1, 500) }))}
                        className="w-full pl-3 pr-8 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content-tertiary">kg</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button onClick={calcBmi}
              className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white font-bold text-sm rounded-md transition-colors mb-3">
              {t('goals.bmi.calculate')}
            </button>

            {bmiResult !== null && (() => {
              const cat = getBmiCategory(bmiResult);
              const pct = Math.min(((bmiResult - 10) / (45 - 10)) * 100, 100);
              return (
                <div className="rounded-md p-4 border" style={{ backgroundColor: cat.bg, borderColor: cat.color + '30' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold text-content-secondary uppercase tracking-wide">{t('goals.bmi.yourBmi')}</p>
                      <p className="text-3xl font-black leading-none mt-0.5" style={{ color: cat.color }}>{bmiResult}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block text-xs font-bold px-3 py-1 rounded-full text-white" style={{ backgroundColor: cat.color }}>
                        {t(cat.labelKey)}
                      </span>
                      <p className="text-[10px] text-content-tertiary mt-1.5">{t('goals.bmi.scaleNote')}</p>
                    </div>
                  </div>
                  <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #004AAD 0%, #10B981 30%, #F87404 60%, #FF0404 100%)' }}>
                    <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 transition-all" style={{ left: `calc(${pct}% - 6px)`, borderColor: cat.color }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-content-tertiary mt-1">
                    <span>{t('goals.bmi.rangeUnder')}</span><span>{t('goals.bmi.rangeNormal')}</span><span>{t('goals.bmi.rangeOver')}</span><span>{t('goals.bmi.obese')}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </Card>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {CATEGORY_OPTIONS.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-all ${filter === cat ? 'bg-accent text-white shadow-orange-500/20' : 'bg-surface-raised border border-border-strong text-content-secondary'}`}>
              {categoryLabel(cat)}
            </button>
          ))}
        </div>

        {/* Goals List */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={22} className="animate-spin text-accent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <Target size={32} className="mx-auto mb-2 text-content-tertiary dark:text-content-secondary" />
            <p className="text-sm text-content-tertiary">{t('goals.empty')}</p>
          </div>
        ) : (
          <div className="space-y-4 mb-5">
            {filtered.map((goal) => {
              const progress = getProgress(goal);
              const daysLeft = goal.deadline
                ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000)
                : null;

              return (
                <Card key={goal.id} className={goal.completed ? 'opacity-70' : ''}>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <span className="h-9 w-9 shrink-0 rounded-sm bg-accent-surface text-accent flex items-center justify-center">
                          <Icon name={goal.icon_name || 'target'} size="md" />
                        </span>
                        <div>
                          <div className={`font-semibold text-sm ${goal.completed ? 'line-through text-content-tertiary' : 'text-content-primary'}`}>
                            {goal.title}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: goal.color + '20', color: goal.color }}>
                              {categoryLabel(goal.category)}
                            </span>
                            {!goal.completed && daysLeft !== null && daysLeft > 0 && (
                              <span className="text-xs text-content-tertiary flex items-center gap-1">
                                <Calendar size={10} />{t('goals.daysLeft', { days: daysLeft })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => toggleComplete(goal)} disabled={togglingId === goal.id}
                          className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${goal.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600 hover:border-green-500'}`}>
                          {togglingId === goal.id
                            ? <Loader2 size={12} className="animate-spin text-content-tertiary" />
                            : goal.completed && <CheckCircle size={14} className="text-white" />}
                        </button>
                        <button onClick={() => deleteGoal(goal.id)} disabled={deletingId === goal.id}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-content-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                          {deletingId === goal.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-end justify-between mb-2">
                      <span className="text-xs text-content-secondary">
                        {goal.lower_is_better
                          ? `${goal.current_value} → ${goal.target_value} ${goal.unit}`
                          : `${goal.current_value} / ${goal.target_value} ${goal.unit}`}
                      </span>
                      <span className="text-xs font-bold" style={{ color: goal.color }}>{Math.round(progress)}%</span>
                    </div>
                    <ProgressBar value={progress} max={100} color={goal.completed ? '#10B981' : goal.color} height={6} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add Goal Modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
            <div className="relative w-full sm:max-w-md bg-surface-raised rounded-t-3xl sm:rounded-md p-6 z-10 border border-border-subtle">
              <h3 className="font-display text-xl font-bold text-content-primary mb-5">{t('goals.modal.addTitle')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('goals.modal.goalTitle')}</label>
                  <input value={newGoal.title} onChange={e => setNewGoal(g => ({ ...g, title: e.target.value }))}
                    placeholder={t('goals.modal.goalTitlePlaceholder')}
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('goals.modal.category')}</label>
                  <div className="flex flex-wrap gap-2">
                    {['Strength', 'Cardio', 'Weight', 'Consistency', 'Flexibility'].map(cat => (
                      <button key={cat} onClick={() => setNewGoal(g => ({ ...g, category: cat }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${newGoal.category === cat ? 'bg-accent text-white' : 'bg-surface-sunken text-content-secondary'}`}>
                        {categoryLabel(cat)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('goals.modal.targetValue')}</label>
                    <input type="number" min={0} value={newGoal.target_value}
                      onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setNewGoal(g => ({ ...g, target_value: v })); }}
                      onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                      placeholder="300"
                      className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('goals.modal.unit')}</label>
                    <input value={newGoal.unit} onChange={e => setNewGoal(g => ({ ...g, unit: e.target.value }))}
                      placeholder="lbs"
                      className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('goals.modal.currentValue')}</label>
                  <input type="number" min={0} value={newGoal.current_value}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setNewGoal(g => ({ ...g, current_value: v })); }}
                    onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                    placeholder="0"
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                </div>
                <div>
                  <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('goals.modal.targetDate')}</label>
                  <input type="date" value={newGoal.deadline} onChange={e => setNewGoal(g => ({ ...g, deadline: e.target.value }))}
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                </div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div onClick={() => setNewGoal(g => ({ ...g, lower_is_better: !g.lower_is_better }))}
                    className={`w-9 h-5 rounded-full transition-colors ${newGoal.lower_is_better ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform mt-0.5 ${newGoal.lower_is_better ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm text-content-secondary">{t('goals.modal.lowerIsBetter')}</span>
                </label>
                <div className="flex gap-3">
                  <Button variant="ghost" fullWidth onClick={() => setShowAdd(false)}>{t('goals.modal.cancel')}</Button>
                  <Button fullWidth onClick={addGoal} loading={saving}>{t('goals.addGoal')}</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
