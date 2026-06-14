'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Plus, Trash2, Timer, Flame, Dumbbell, Activity, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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


const workoutTypes = [
  { id: 'strength', label: 'Strength', icon: Dumbbell, color: '#F87404' },
  { id: 'cardio', label: 'Cardio', icon: Activity, color: '#004AAD' },
  { id: 'hiit', label: 'HIIT', icon: Flame, color: '#FF5C04' },
  { id: 'yoga', label: 'Yoga', icon: Timer, color: '#7C3AED' },
  { id: 'pilates', label: 'Pilates', icon: Timer, color: '#EC4899' },
  { id: 'flexibility', label: 'Stretch', icon: Timer, color: '#10B981' },
];

export default function LogWorkoutPage() {
  const router = useRouter();
  const [workoutName, setWorkoutName] = useState('');
  const [workoutType, setWorkoutType] = useState('strength');
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

  const addExercise = (name: string) => {
    setExercises(prev => [...prev, {
      id: Date.now().toString(),
      name,
      sets: [{ reps: '', weight: '', done: false }]
    }]);
    setShowExercisePicker(false);
    setExerciseSearch('');
  };

  const addSet = (exerciseId: string) => {
    setExercises(prev => prev.map(e =>
      e.id === exerciseId ? { ...e, sets: [...e.sets, { reps: '', weight: '', done: false }] } : e
    ));
  };

  const updateSet = (exerciseId: string, setIdx: number, field: keyof ExerciseSet, value: string | boolean) => {
    setExercises(prev => prev.map(e =>
      e.id === exerciseId ? {
        ...e,
        sets: e.sets.map((s, i) => i === setIdx ? { ...s, [field]: value } : s)
      } : e
    ));
  };

  const removeExercise = (id: string) => setExercises(prev => prev.filter(e => e.id !== id));

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 1200));
    setSaving(false);
    setSaved(true);
    setTimeout(() => router.push('/fitness'), 1500);
  };

  const filteredLib = exerciseSearch
    ? Object.values(exerciseLibraryByGroup).flat().filter((e: string) => e.toLowerCase().includes(exerciseSearch.toLowerCase()))
    : null;

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/fitness">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Log Workout</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Record your training session</p>
          </div>
        </div>

        {saved && (
          <div className="flex items-center gap-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl p-4 mb-5">
            <CheckCircle size={20} className="text-green-500 shrink-0" />
            <div>
              <div className="font-semibold text-green-700 dark:text-green-400 text-sm">Workout Saved!</div>
              <div className="text-xs text-green-600 dark:text-green-500">Redirecting to fitness tracker...</div>
            </div>
          </div>
        )}

        {/* Workout Details */}
        <Card className="mb-5">
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Workout Name</label>
              <input value={workoutName} onChange={e => setWorkoutName(e.target.value)}
                placeholder="e.g., Chest & Triceps Day"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Workout Type</label>
              <div className="grid grid-cols-3 gap-2">
                {workoutTypes.map(({ id, label, icon: Icon, color }) => (
                  <button key={id} onClick={() => setWorkoutType(id)}
                    className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border-2 transition-all ${workoutType === id ? 'text-white border-transparent' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'}`}
                    style={{ backgroundColor: workoutType === id ? color : undefined }}>
                    <Icon size={16} />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <Timer size={13} className="inline mr-1 text-gray-400" />Duration (min)
                </label>
                <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                  placeholder="45"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <Flame size={13} className="inline mr-1 text-gray-400" />Calories Burned
                </label>
                <input type="number" value={calories} onChange={e => setCalories(e.target.value)}
                  placeholder="350"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 text-sm" />
              </div>
            </div>
          </div>
        </Card>

        {/* Exercises */}
        {workoutType === 'strength' || workoutType === 'hiit' ? (
          <div className="space-y-4 mb-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Exercises</h3>
              <span className="text-xs text-gray-400">{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>
            </div>

            {exercises.map((exercise) => (
              <Card key={exercise.id}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Dumbbell size={16} className="text-[#F87404]" />
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">{exercise.name}</span>
                    </div>
                    <button onClick={() => removeExercise(exercise.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Set headers */}
                  <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-400 mb-2 px-1">
                    <span>Set</span>
                    <span>Reps</span>
                    <span>Weight (lbs)</span>
                    <span>Done</span>
                  </div>

                  {exercise.sets.map((set, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-2 mb-2 items-center">
                      <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.07] flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400">
                        {idx + 1}
                      </div>
                      <input type="number" value={set.reps} onChange={e => updateSet(exercise.id, idx, 'reps', e.target.value)}
                        placeholder="10"
                        className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#F87404]/40" />
                      <input type="number" value={set.weight} onChange={e => updateSet(exercise.id, idx, 'weight', e.target.value)}
                        placeholder="135"
                        className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#F87404]/40" />
                      <button onClick={() => updateSet(exercise.id, idx, 'done', !set.done)}
                        className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all mx-auto ${set.done ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'}`}>
                        {set.done && <CheckCircle size={14} className="text-white" />}
                      </button>
                    </div>
                  ))}

                  <button onClick={() => addSet(exercise.id)}
                    className="mt-2 flex items-center gap-1.5 text-xs text-[#F87404] font-medium hover:underline">
                    <Plus size={13} /> Add Set
                  </button>
                </div>
              </Card>
            ))}

            {/* Add Exercise */}
            {showExercisePicker ? (
              <Card>
                <div className="p-4">
                  <input value={exerciseSearch} onChange={e => setExerciseSearch(e.target.value)}
                    autoFocus placeholder="Search exercises..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 text-sm mb-3" />
                  <div className="max-h-56 overflow-y-auto space-y-3">
                    {filteredLib && filteredLib.length > 0 ? (
                      filteredLib.map((name: string) => (
                        <button key={name} onClick={() => addExercise(name)}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#F87404]/10 text-gray-900 dark:text-white text-sm transition-colors hover:text-[#F87404]">
                          {name}
                        </button>
                      ))
                    ) : (
                      Object.entries(exerciseLibraryByGroup).map(([group, exercises]) => (
                        <div key={group}>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-1">{group}</p>
                          {exercises.map((name: string) => (
                            <button key={name} onClick={() => addExercise(name)}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F87404]/10 text-gray-800 dark:text-gray-200 text-sm transition-colors hover:text-[#F87404]">
                              {name}
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                  <button onClick={() => { setShowExercisePicker(false); setExerciseSearch(''); }} className="mt-2 text-xs text-gray-400 hover:text-gray-600 w-full text-center">Cancel</button>
                </div>
              </Card>
            ) : (
              <button onClick={() => setShowExercisePicker(true)}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 hover:border-[#F87404]/40 transition-all flex items-center justify-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#F87404]">
                <Plus size={16} /> Add Exercise
              </button>
            )}
          </div>
        ) : (
          <Card className="mb-5">
            <div className="p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Cardio Details</h3>
              <div className="grid grid-cols-2 gap-3">
                {['Distance (miles)', 'Avg Heart Rate', 'Pace (min/mi)', 'Elevation (ft)'].map(label => (
                  <div key={label}>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
                    <input type="number" placeholder="0"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Notes */}
        <Card className="mb-6">
          <div className="p-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes (optional)</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="How did the workout feel? Any PRs? Notes for next time..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 text-sm resize-none" />
          </div>
        </Card>

        <Button onClick={handleSave} fullWidth size="lg" loading={saving} icon={<CheckCircle size={18} />}>
          {saving ? 'Saving...' : 'Save Workout'}
        </Button>

        <div className="h-24" />
      </div>
    </DashboardShell>
  );
}
