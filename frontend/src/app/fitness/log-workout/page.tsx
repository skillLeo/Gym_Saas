'use client';

import { useState } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Plus, Trash2, Timer, Flame, Dumbbell, Activity, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { getErrorMessage } from '@/lib/errors';

type ExerciseSet = { reps: string; weight: string; done: boolean };
type Exercise = { id: string; name: string; sets: ExerciseSet[] };

const exerciseLibraryByGroup: Record<string, string[]> = {
  Chest: ['Bench Press', 'Incline Press', 'Decline Press', 'Dumbbell Fly', 'Cable Fly', 'Push-ups', 'Chest Dip'],
  Back: ['Deadlift', 'Pull-ups', 'Barbell Row', 'Lat Pulldown', 'Seated Cable Row', 'T-Bar Row', 'Face Pull'],
  Legs: ['Squat', 'Leg Press', 'Romanian Deadlift', 'Lunges', 'Leg Curl', 'Leg Extension', 'Calf Raises', 'Hip Thrust'],
  Shoulders: ['Shoulder Press', 'Lateral Raise', 'Front Raise', 'Arnold Press', 'Rear Delt Fly', 'Upright Row', 'Shrugs'],
  Arms: ['Bicep Curl', 'Hammer Curl', 'Preacher Curl', 'Tricep Pushdown', 'Skull Crushers', 'Overhead Tricep Extension', 'Dips'],
  Core: ['Plank', 'Crunches', 'Hanging Leg Raise', 'Russian Twist', 'Cable Crunch', 'Ab Wheel Rollout', 'Mountain Climbers'],
};

// `id` is the value sent to and stored by the API and must stay canonical
// English; only `labelKey` is translated, and only at render time — module
// scope runs before any component mounts, so t() cannot be called here.
const workoutTypes = [
  { id: 'Strength',    labelKey: 'workout.type.strength',    icon: Dumbbell, color: '#F87404' },
  { id: 'Cardio',      labelKey: 'workout.type.cardio',      icon: Activity, color: '#004AAD' },
  { id: 'HIIT',        labelKey: 'workout.type.hiit',        icon: Flame,    color: '#FF5C04' },
  { id: 'Yoga',        labelKey: 'workout.type.yoga',        icon: Timer,    color: '#7C3AED' },
  { id: 'Pilates',     labelKey: 'workout.type.pilates',     icon: Timer,    color: '#EC4899' },
  { id: 'Flexibility', labelKey: 'workout.type.flexibility', icon: Timer,    color: '#10B981' },
];

export default function LogWorkoutPage() {
  const { t } = useI18nStore();
  const router = useRouter();
  const [workoutName, setWorkoutName] = useState('');
  const [workoutType, setWorkoutType] = useState('Strength');
  const [duration, setDuration] = useState('');
  const [calories, setCalories] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([
    { id: '1', name: 'Bench Press', sets: [{ reps: '10', weight: '135', done: false }] }
  ]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState('');
  const [distance, setDistance] = useState('');

  // Shared guards so no numeric field in this form can ever hold a negative value
  const blockNegativeKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-' || e.key === 'e') e.preventDefault();
  };
  const nonNegativeSetter = (setter: (v: string) => void) => (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) setter(value);
  };
  const setDurationSafe = nonNegativeSetter(setDuration);
  const setCaloriesSafe = nonNegativeSetter(setCalories);
  const setDistanceSafe = nonNegativeSetter(setDistance);

  const addExercise = (name: string) => {
    setExercises(prev => [...prev, { id: Date.now().toString(), name, sets: [{ reps: '', weight: '', done: false }] }]);
    setShowExercisePicker(false);
    setExerciseSearch('');
  };

  const addSet = (exerciseId: string) => {
    setExercises(prev => prev.map(e => e.id === exerciseId ? { ...e, sets: [...e.sets, { reps: '', weight: '', done: false }] } : e));
  };

  const updateSet = (exerciseId: string, setIdx: number, field: keyof ExerciseSet, value: string | boolean) => {
    if ((field === 'reps' || field === 'weight') && typeof value === 'string') {
      // Block negative numbers outright; reps can't practically go below 1
      if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
      if (field === 'reps' && value !== '' && parseFloat(value) < 1) return;
    }
    setExercises(prev => prev.map(e =>
      e.id === exerciseId ? { ...e, sets: e.sets.map((s, i) => i === setIdx ? { ...s, [field]: value } : s) } : e
    ));
  };

  const removeExercise = (id: string) => setExercises(prev => prev.filter(e => e.id !== id));

  const handleSave = async () => {
    if (!duration && !calories) {
      toast.error(t('logWorkout.needValue'));
      return;
    }
    setSaving(true);
    const exerciseNotes = exercises.length > 0
      ? exercises.map(e => `${e.name} (${e.sets.length} sets)`).join(', ')
      : '';
    const fullNotes = [notes, exerciseNotes].filter(Boolean).join('\n');
    try {
      await api.post('/fitness-logs', {
        exercise_name:    workoutName.trim() || `${workoutType} Session`,
        category:         workoutType,
        duration_minutes: duration ? parseInt(duration) : null,
        calories_burned:  calories ? parseInt(calories) : null,
        logged_date:      format(new Date(), 'yyyy-MM-dd'),
        notes:            fullNotes || null,
        distance_miles:   workoutType === 'Cardio' && distance ? parseFloat(distance) : null,
        exercises:        showExercises
          ? exercises.map(e => ({ name: e.name, sets: e.sets.map(s => ({ reps: s.reps ? parseInt(s.reps) : 0, weight: s.weight ? parseFloat(s.weight) : 0, done: s.done })) }))
          : null,
      });
      setSaved(true);
      toast.success(t('logWorkout.savedShort'));
      setTimeout(() => router.push('/fitness'), 1500);
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('logWorkout.error.save')));
    } finally {
      setSaving(false);
    }
  };

  const filteredLib = exerciseSearch
    ? Object.values(exerciseLibraryByGroup).flat().filter(e => e.toLowerCase().includes(exerciseSearch.toLowerCase()))
    : null;

  const showExercises = workoutType === 'Strength' || workoutType === 'HIIT';

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <PageHeader
        title={t('logWorkout.title')}
        subtitle={t('logWorkout.subtitle')}
        back="/fitness"
      />

        {saved && (
          <div className="flex items-center gap-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-md p-4 mb-5">
            <CheckCircle size={20} className="text-green-500 shrink-0" />
            <div>
              <div className="font-semibold text-green-700 dark:text-green-400 text-sm">{t('logWorkout.saved')}</div>
              <div className="text-xs text-green-600 dark:text-green-500">{t('logWorkout.redirecting')}</div>
            </div>
          </div>
        )}

        {/* Workout Details */}
        <Card className="mb-5">
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1.5">{t('logWorkout.name')}</label>
              <input value={workoutName} onChange={e => setWorkoutName(e.target.value)}
                placeholder={t('logWorkout.namePlaceholder')}
                className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-content-secondary mb-2">{t('logWorkout.type')}</label>
              <div className="grid grid-cols-3 gap-2">
                {workoutTypes.map(({ id, labelKey, icon: Icon, color }) => (
                  <button key={id} onClick={() => setWorkoutType(id)}
                    className={`flex flex-col items-center gap-1.5 py-2.5 rounded-md border-2 transition-all ${workoutType === id ? 'text-white border-transparent' : 'border-border-strong text-content-secondary'}`}
                    style={{ backgroundColor: workoutType === id ? color : undefined }}>
                    <Icon size={16} />
                    <span className="text-xs font-medium">{t(labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1.5">
                  <Timer size={13} className="inline mr-1 text-content-tertiary" />{t('common.durationMin')}
                </label>
                <input type="number" min={1} step={1} value={duration}
                  onChange={e => setDurationSafe(e.target.value)}
                  onKeyDown={blockNegativeKey}
                  placeholder="45"
                  className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1.5">
                  <Flame size={13} className="inline mr-1 text-content-tertiary" />{t('logWorkout.caloriesBurned')}
                </label>
                <input type="number" min={0} step={1} value={calories}
                  onChange={e => setCaloriesSafe(e.target.value)}
                  onKeyDown={blockNegativeKey}
                  placeholder="350"
                  className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 text-sm" />
              </div>
            </div>
          </div>
        </Card>

        {/* Exercises (Strength / HIIT only) */}
        {showExercises ? (
          <div className="space-y-4 mb-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-content-primary">{t('logWorkout.exercises')}</h3>
              <span className="text-xs text-content-tertiary">{exercises.length === 1 ? t('logWorkout.exerciseCountOne') : t('logWorkout.exerciseCount', { count: exercises.length })}</span>
            </div>

            {exercises.map((exercise) => (
              <Card key={exercise.id}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Dumbbell size={16} className="text-accent" />
                      <span className="font-semibold text-content-primary text-sm">{exercise.name}</span>
                    </div>
                    <button onClick={() => removeExercise(exercise.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-content-tertiary hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-xs font-medium text-content-tertiary mb-2 px-1">
                    <span>{t('logWorkout.set')}</span><span>{t('logWorkout.reps')}</span><span>{t('common.weightLbs')}</span><span>{t('common.done')}</span>
                  </div>

                  {exercise.sets.map((set, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-2 mb-2 items-center">
                      <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.07] flex items-center justify-center text-xs font-bold text-content-secondary">{idx + 1}</div>
                      <input type="number" min={1} step={1} value={set.reps}
                        onChange={e => updateSet(exercise.id, idx, 'reps', e.target.value)}
                        onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        placeholder="10"
                        className="px-3 py-2 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                      <input type="number" min={0} step={0.5} value={set.weight}
                        onChange={e => updateSet(exercise.id, idx, 'weight', e.target.value)}
                        onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        placeholder="135"
                        className="px-3 py-2 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                      <button onClick={() => updateSet(exercise.id, idx, 'done', !set.done)}
                        className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all mx-auto ${set.done ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'}`}>
                        {set.done && <CheckCircle size={14} className="text-white" />}
                      </button>
                    </div>
                  ))}

                  <button onClick={() => addSet(exercise.id)} className="mt-2 flex items-center gap-1.5 text-xs text-accent font-medium hover:underline">
                    <Plus size={13} /> {t('logWorkout.addSet')}
                  </button>
                </div>
              </Card>
            ))}

            {showExercisePicker ? (
              <Card>
                <div className="p-4">
                  <input value={exerciseSearch} onChange={e => setExerciseSearch(e.target.value)}
                    autoFocus placeholder={t('logWorkout.search')}
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 text-sm mb-3" />
                  <div className="max-h-56 overflow-y-auto space-y-3">
                    {filteredLib && filteredLib.length > 0 ? (
                      filteredLib.map(name => (
                        <button key={name} onClick={() => addExercise(name)}
                          className="w-full text-left px-3 py-2.5 rounded-md hover:bg-accent-surface text-content-primary text-sm transition-colors hover:text-accent">
                          {name}
                        </button>
                      ))
                    ) : (
                      Object.entries(exerciseLibraryByGroup).map(([group, exList]) => (
                        <div key={group}>
                          <p className="text-[10px] font-bold text-content-tertiary uppercase tracking-widest px-1 mb-1">{group}</p>
                          {exList.map(name => (
                            <button key={name} onClick={() => addExercise(name)}
                              className="w-full text-left px-3 py-2 rounded-md hover:bg-accent-surface text-gray-800 dark:text-gray-200 text-sm transition-colors hover:text-accent">
                              {name}
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                  <button onClick={() => { setShowExercisePicker(false); setExerciseSearch(''); }} className="mt-2 text-xs text-content-tertiary hover:text-content-secondary w-full text-center">{t('common.cancel')}</button>
                </div>
              </Card>
            ) : (
              <button onClick={() => setShowExercisePicker(true)}
                className="w-full py-3 rounded-md border-2 border-dashed border-border-strong hover:border-accent/40 transition-all flex items-center justify-center gap-2 text-sm font-medium text-content-secondary hover:text-accent">
                <Plus size={16} /> {t('logWorkout.addExercise')}
              </button>
            )}
          </div>
        ) : workoutType === 'Cardio' ? (
          <Card className="mb-5">
            <div className="p-5">
              <h3 className="font-semibold text-content-primary mb-3 text-sm">{t('logWorkout.cardioDetails')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1.5">{t('logWorkout.distance')}</label>
                  <input type="number" step="0.01" min={0} placeholder="0" value={distance}
                    onChange={e => setDistanceSafe(e.target.value)}
                    onKeyDown={blockNegativeKey}
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Notes */}
        <Card className="mb-6">
          <div className="p-5">
            <label className="block text-sm font-medium text-content-secondary mb-1.5">{t('logWorkout.notes')}</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={t('logWorkout.notesPlaceholder')}
              className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 text-sm resize-none" />
          </div>
        </Card>

        <Button onClick={handleSave} fullWidth size="lg" loading={saving} icon={<CheckCircle size={18} />}>
          {saving ? t('common.saving') : t('logWorkout.save')}
        </Button>

        <div className="h-24" />
      </div>
    </DashboardShell>
  );
}
