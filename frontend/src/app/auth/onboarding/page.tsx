'use client';

import { useState } from 'react';
import { ArrowRight, ArrowLeft, Camera, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

const goals = [
  { id: 'lose', emoji: '⚖️', title: 'Lose Weight', desc: 'Shed body fat and slim down' },
  { id: 'muscle', emoji: '💪', title: 'Build Muscle', desc: 'Gain strength and mass' },
  { id: 'stamina', emoji: '🏃', title: 'Improve Stamina', desc: 'Run farther, last longer' },
  { id: 'eat', emoji: '🥗', title: 'Eat Healthier', desc: 'Better nutrition habits' },
  { id: 'run', emoji: '🎯', title: 'Hit a Goal', desc: 'Specific target in mind' },
  { id: 'general', emoji: '✨', title: 'General Fitness', desc: 'Overall wellness' },
];

const activityLevels = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise' },
  { id: 'light', label: 'Lightly Active', desc: '1–3 days/week' },
  { id: 'moderate', label: 'Moderately Active', desc: '3–5 days/week' },
  { id: 'very', label: 'Very Active', desc: '6–7 days/week' },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [stats, setStats] = useState({ weight: '', height: '', age: '', gender: 'male', activity: 'moderate', calories: '2000' });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggleGoal = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const next = () => { if (step < 4) setStep(s => s + 1); };
  const back = () => { if (step > 1) setStep(s => s - 1); };

  const finish = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    router.push('/dashboard');
  };

  const steps = ['Profile', 'Your Goals', 'Your Stats', 'Ready!'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#F87404] flex items-center justify-center text-white font-display font-bold shadow-lg">MX</div>
          <span className="font-display text-gray-900 dark:text-white text-lg font-semibold">My EXtreme Trainer</span>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all shrink-0 ${i + 1 < step ? 'bg-green-500 text-white' : i + 1 === step ? 'bg-[#F87404] text-white shadow-md shadow-orange-500/30' : 'bg-gray-200 dark:bg-white/10 text-gray-400'}`}>
                {i + 1 < step ? <CheckCircle size={16} /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 rounded-full transition-all ${i + 1 < step ? 'bg-green-500' : 'bg-gray-200 dark:bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-white/[0.07] p-7 shadow-lg">

          {/* Step 1: Profile */}
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="font-display text-2xl font-bold text-gray-900 dark:text-white mb-1">Set Up Your Profile</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Add a photo and tell us about yourself</p>

              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center border-4 border-dashed border-[#F87404]/40 cursor-pointer hover:border-[#F87404] transition-all group">
                    <Camera size={28} className="text-gray-400 group-hover:text-[#F87404] transition-colors" />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">Tap to upload profile photo</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Display Name</label>
                  <input type="text" defaultValue="Kelvin Silas" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Bio <span className="text-gray-400">(optional)</span></label>
                  <textarea rows={3} placeholder="Tell the community about yourself..." className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 text-sm resize-none" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Goals */}
          {step === 2 && (
            <div className="animate-fade-in">
              <h2 className="font-display text-2xl font-bold text-gray-900 dark:text-white mb-1">What Are Your Goals?</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Select all that apply — your AI trainer will personalize your experience</p>
              <div className="grid grid-cols-2 gap-3">
                {goals.map(({ id, emoji, title, desc }) => (
                  <button key={id} onClick={() => toggleGoal(id)}
                    className={`flex flex-col items-start p-4 rounded-2xl border-2 text-left transition-all ${selected.includes(id) ? 'border-[#F87404] bg-[#F87404]/8 dark:bg-[#F87404]/10' : 'border-gray-200 dark:border-white/10 hover:border-[#F87404]/40'}`}>
                    <span className="text-2xl mb-2">{emoji}</span>
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{title}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</span>
                    {selected.includes(id) && <CheckCircle size={16} className="text-[#F87404] mt-2" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Stats */}
          {step === 3 && (
            <div className="animate-fade-in">
              <h2 className="font-display text-2xl font-bold text-gray-900 dark:text-white mb-1">Your Current Stats</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Used to personalize your calorie and nutrition goals</p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Current Weight (lbs)</label>
                    <input type="number" placeholder="185" value={stats.weight} onChange={e => setStats(s => ({ ...s, weight: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Height (inches)</label>
                    <input type="number" placeholder='72 (6&apos;0")' value={stats.height} onChange={e => setStats(s => ({ ...s, height: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Age</label>
                    <input type="number" placeholder="38" value={stats.age} onChange={e => setStats(s => ({ ...s, age: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Gender</label>
                    <select value={stats.gender} onChange={e => setStats(s => ({ ...s, gender: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 text-sm">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Activity Level</label>
                  <div className="space-y-2">
                    {activityLevels.map(({ id, label, desc }) => (
                      <button key={id} onClick={() => setStats(s => ({ ...s, activity: id }))}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${stats.activity === id ? 'border-[#F87404] bg-[#F87404]/8 dark:bg-[#F87404]/10' : 'border-gray-200 dark:border-white/10'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${stats.activity === id ? 'border-[#F87404] bg-[#F87404]' : 'border-gray-300 dark:border-gray-600'}`}>
                          {stats.activity === id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#F87404]/10 border border-[#F87404]/20 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Suggested Daily Calories</span>
                    <span className="text-[#F87404] font-bold">{stats.calories} kcal</span>
                  </div>
                  <input type="range" min="1200" max="4000" step="50" value={stats.calories}
                    onChange={e => setStats(s => ({ ...s, calories: e.target.value }))}
                    className="w-full accent-[#F87404]" />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1,200</span><span>4,000</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="animate-fade-in text-center py-4">
              <div className="text-6xl mb-4 animate-bounce-like">🎉</div>
              <h2 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-2">You&apos;re All Set!</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Your 30-day free trial has started. Let&apos;s crush your goals together!</p>

              <div className="grid grid-cols-3 gap-3 mb-8">
                {[{ emoji: '🔥', label: '30 Days Free', sub: 'Full Access' }, { emoji: '🤖', label: 'AI Trainer', sub: 'Ready to Help' }, { emoji: '👥', label: 'Community', sub: '10K+ Members' }].map(({ emoji, label, sub }) => (
                  <div key={label} className="bg-gray-50 dark:bg-white/[0.05] rounded-2xl p-3 text-center">
                    <div className="text-2xl mb-1">{emoji}</div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">{label}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">{sub}</div>
                  </div>
                ))}
              </div>

              <Button onClick={finish} size="lg" fullWidth loading={loading} iconRight={<ArrowRight size={18} />}>
                Go to My Dashboard
              </Button>
            </div>
          )}

          {/* Navigation */}
          {step < 4 && (
            <div className="flex gap-3 mt-6">
              {step > 1 && (
                <Button variant="ghost" onClick={back} icon={<ArrowLeft size={16} />} size="md">
                  Back
                </Button>
              )}
              <Button onClick={next} size="md" fullWidth iconRight={<ArrowRight size={16} />}>
                {step === 3 ? 'Finish Setup' : 'Continue'}
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Step {step} of {steps.length} — {steps[step - 1]}
        </p>
      </div>
    </div>
  );
}
