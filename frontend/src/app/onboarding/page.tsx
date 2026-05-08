'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { calculateDailyCalories, calculateMacros, getAgeFromDOB } from '@/lib/utils';

const GOALS = [
  { value: 'lose_weight',     icon: '🔥', label: 'Lose Weight',     desc: 'Burn fat, slim down' },
  { value: 'maintain_weight', icon: '⚖️', label: 'Maintain Weight', desc: 'Stay at current weight' },
  { value: 'gain_muscle',     icon: '💪', label: 'Gain Muscle',     desc: 'Build strength & size' },
  { value: 'improve_fitness', icon: '❤️', label: 'Improve Fitness', desc: 'More energy, better health' },
  { value: 'eat_healthier',   icon: '🥗', label: 'Eat Healthier',   desc: 'Better nutrition habits' },
];

const ACTIVITY_LEVELS = [
  { value: 'sedentary',         icon: '🪑', label: 'Sedentary',         desc: 'Little to no exercise' },
  { value: 'lightly_active',    icon: '🚶', label: 'Lightly Active',    desc: 'Light exercise 1-3 days/week' },
  { value: 'moderately_active', icon: '🚴', label: 'Moderately Active', desc: 'Moderate exercise 3-5 days/week' },
  { value: 'very_active',       icon: '🏃', label: 'Very Active',       desc: 'Hard exercise 6-7 days/week' },
  { value: 'extra_active',      icon: '🏋️', label: 'Extra Active',      desc: 'Very hard exercise & physical job' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    primary_goal: '', date_of_birth: '', gender: '',
    height_cm: '', current_weight_kg: '', goal_weight_kg: '',
    activity_level: '', daily_calorie_goal: 0,
  });

  const calculatedCalories = (() => {
    if (!form.gender || !form.height_cm || !form.current_weight_kg || !form.date_of_birth || !form.activity_level || !form.primary_goal) return 2000;
    return calculateDailyCalories({
      gender: form.gender, weightKg: parseFloat(form.current_weight_kg),
      heightCm: parseFloat(form.height_cm), ageYears: getAgeFromDOB(form.date_of_birth),
      activityLevel: form.activity_level, primaryGoal: form.primary_goal,
    });
  })();

  useEffect(() => {
    setForm(p => ({ ...p, daily_calorie_goal: calculatedCalories }));
  }, [calculatedCalories]);

  const macros = calculateMacros(form.daily_calorie_goal || calculatedCalories);

  const goNext = () => { setDirection(1); setStep(s => Math.min(4, s + 1)); };
  const goPrev = () => { setDirection(-1); setStep(s => Math.max(1, s - 1)); };

  const canProceed = () => {
    if (step === 1) return !!form.primary_goal;
    if (step === 2) return !!(form.date_of_birth && form.gender && form.height_cm && form.current_weight_kg);
    if (step === 3) return !!form.activity_level;
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = { ...form, height_cm: parseFloat(form.height_cm), current_weight_kg: parseFloat(form.current_weight_kg), goal_weight_kg: form.goal_weight_kg ? parseFloat(form.goal_weight_kg) : undefined, daily_calorie_goal: form.daily_calorie_goal || calculatedCalories };
      const res = await api.post('/onboarding', payload);
      if (user) setUser({ ...user, onboarding_completed: true, daily_calorie_goal: res.data.data.daily_calorie_goal });
      toast.success("You're all set! Let's crush your goals 🚀");
      router.replace('/dashboard');
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {['Goal', 'Stats', 'Activity', 'Review'].map((label, i) => (
              <div key={label} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step > i + 1 ? 'bg-[#3FB950] text-white' : step === i + 1 ? 'bg-[#F87404] text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                <span className={`text-xs mt-1 ${step === i + 1 ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
              </div>
            ))}
          </div>
          <div className="h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#F87404] to-[#F97316] rounded-full transition-all duration-500" style={{ width: `${((step - 1) / 3) * 100}%` }} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 overflow-hidden relative min-h-[420px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div key={step} custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>

              {step === 1 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">What is your main goal?</h2>
                  <p className="text-sm text-gray-500 mb-6">Choose what you want to focus on first.</p>
                  <div className="space-y-3">
                    {GOALS.map(g => (
                      <button key={g.value} onClick={() => setForm(p => ({ ...p, primary_goal: g.value }))}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${form.primary_goal === g.value ? 'border-[#F87404] bg-[#F87404]/10' : 'border-gray-200 bg-white hover:border-gray-400'}`}>
                        <span className="text-2xl">{g.icon}</span>
                        <div>
                          <p className="font-semibold text-gray-900">{g.label}</p>
                          <p className="text-xs text-gray-500">{g.desc}</p>
                        </div>
                        {form.primary_goal === g.value && <span className="ml-auto text-[#F87404]">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Tell us about yourself</h2>
                  <p className="text-sm text-gray-500 mb-6">Used to calculate your personalized calorie goal.</p>
                  <div className="space-y-4">
                    <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))} required />
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-2">Gender</label>
                      <div className="flex gap-3">
                        {['male', 'female', 'other'].map(g => (
                          <button key={g} onClick={() => setForm(p => ({ ...p, gender: g }))}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-all capitalize ${form.gender === g ? 'border-[#F87404] bg-[#F87404]/10 text-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Height (cm)" type="number" placeholder="175" value={form.height_cm} onChange={e => setForm(p => ({ ...p, height_cm: e.target.value }))} min="50" max="300" />
                      <Input label="Current Weight (kg)" type="number" placeholder="80" value={form.current_weight_kg} onChange={e => setForm(p => ({ ...p, current_weight_kg: e.target.value }))} min="10" max="500" />
                    </div>
                    <Input label="Goal Weight (kg, optional)" type="number" placeholder="70" value={form.goal_weight_kg} onChange={e => setForm(p => ({ ...p, goal_weight_kg: e.target.value }))} min="10" max="500" />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">How active are you?</h2>
                  <p className="text-sm text-gray-500 mb-6">Pick the option that best matches your weekly routine.</p>
                  <div className="space-y-3">
                    {ACTIVITY_LEVELS.map(a => (
                      <button key={a.value} onClick={() => setForm(p => ({ ...p, activity_level: a.value }))}
                        className={`w-full flex items-center gap-4 p-3 rounded-xl border-2 transition-all text-left ${form.activity_level === a.value ? 'border-[#F87404] bg-[#F87404]/10' : 'border-gray-200 bg-white hover:border-gray-400'}`}>
                        <span className="text-xl">{a.icon}</span>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{a.label}</p>
                          <p className="text-xs text-gray-500">{a.desc}</p>
                        </div>
                        {form.activity_level === a.value && <span className="ml-auto text-[#F87404]">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Your Daily Targets</h2>
                  <p className="text-sm text-gray-500 mb-6">Calculated from your goals and stats. You can fine-tune anytime.</p>
                  <div className="bg-[#F8F9FA] rounded-xl p-6 mb-6 text-center">
                    <p className="text-5xl font-black text-gradient">{form.daily_calorie_goal || calculatedCalories}</p>
                    <p className="text-sm text-gray-500 mt-1">calories per day</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[{ label: 'Protein', value: macros.protein_g, color: '#F87404' }, { label: 'Carbs', value: macros.carbs_g, color: '#F97316' }, { label: 'Fat', value: macros.fat_g, color: '#FACC15' }].map(m => (
                      <div key={m.label} className="bg-white rounded-xl p-3 text-center border border-gray-200">
                        <p className="text-xl font-bold" style={{ color: m.color }}>{m.value}g</p>
                        <p className="text-xs text-gray-500">{m.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">Adjust calories:</label>
                    <button onClick={() => setForm(p => ({ ...p, daily_calorie_goal: Math.max(1200, (p.daily_calorie_goal || calculatedCalories) - 100) }))} className="w-8 h-8 rounded-full bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-colors">−</button>
                    <span className="text-sm font-bold text-gray-900 min-w-[48px] text-center">{form.daily_calorie_goal || calculatedCalories}</span>
                    <button onClick={() => setForm(p => ({ ...p, daily_calorie_goal: Math.min(5000, (p.daily_calorie_goal || calculatedCalories) + 100) }))} className="w-8 h-8 rounded-full bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-colors">+</button>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex gap-3 mt-4">
          {step > 1 && <Button variant="secondary" onClick={goPrev} className="flex-1">← Back</Button>}
          {step < 4
            ? <Button onClick={goNext} disabled={!canProceed()} className="flex-1">Continue →</Button>
            : <Button onClick={handleSubmit} loading={loading} disabled={!canProceed()} className="flex-1" size="lg">Let's Go! 🚀</Button>
          }
        </div>
      </div>
    </div>
  );
}
