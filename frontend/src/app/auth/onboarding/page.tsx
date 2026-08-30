'use client';

import { useState, useRef } from 'react';
import { ArrowRight, ArrowLeft, Camera, Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { NumericField } from '@/components/ui/Field';
import { Select } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

/**
 * Copy note: this flow previously promised that "your AI trainer will
 * personalize everything" and advertised a "10K+ Members" community. AI is
 * Phase 11 and not built, and the member count was invented — both removed.
 * The API payload and step logic are unchanged.
 */
const GOALS: { id: string; apiId: string; icon: IconName; title: string; desc: string }[] = [
  { id: 'lose',    apiId: 'lose_weight',    icon: 'scale',      title: 'Lose weight',     desc: 'Reduce body fat' },
  { id: 'muscle',  apiId: 'gain_muscle',    icon: 'dumbbell',   title: 'Build muscle',    desc: 'Gain strength and mass' },
  { id: 'stamina', apiId: 'improve_fitness', icon: 'footprints', title: 'Improve stamina', desc: 'Run farther, last longer' },
  { id: 'eat',     apiId: 'eat_healthier',  icon: 'salad',      title: 'Eat better',      desc: 'Build nutrition habits' },
  { id: 'run',     apiId: 'improve_fitness', icon: 'target',     title: 'Hit a target',    desc: 'A specific goal in mind' },
  { id: 'general', apiId: 'improve_fitness', icon: 'activity',   title: 'General fitness', desc: 'Overall health' },
];

const ACTIVITY_LEVELS = [
  { id: 'sedentary', apiId: 'sedentary',         label: 'Sedentary',         desc: 'Little or no exercise' },
  { id: 'light',     apiId: 'lightly_active',    label: 'Lightly active',    desc: '1–3 days a week' },
  { id: 'moderate',  apiId: 'moderately_active', label: 'Moderately active', desc: '3–5 days a week' },
  { id: 'very',      apiId: 'very_active',       label: 'Very active',       desc: '6–7 days a week' },
];

const STEPS = ['Profile', 'Goals', 'Stats', 'Done'];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [stats, setStats] = useState({
    weight: '', height: '', age: '', gender: 'male', activity: 'moderate', calories: '2000',
  });
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const toggleGoal = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  /**
   * What each step needs before it can be left.
   *
   * Neither step used to require anything. A member could press straight
   * through and `finish()` would quietly substitute invented values — 80 kg,
   * 175 cm, age 30, goal "general" — which then drove their calorie and macro
   * targets. Making up a person's body stats and presenting them back as their
   * profile is worse than asking again.
   */
  const stepComplete = (n: number): boolean => {
    if (n === 2) return selected.length > 0;
    if (n === 3) {
      const filled = (v: string) => v.trim() !== '' && Number(v) > 0;
      return filled(stats.weight) && filled(stats.height) && filled(stats.age);
    }
    return true;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (user) setUser({ ...user, avatar_url: res.data.data.avatar_url });
      toast.success('Photo updated.');
    } catch {
      toast.error('Could not upload that photo. Try a JPG or PNG under 2 MB.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  /**
   * Saves the profile. Returns whether the save actually succeeded, so the
   * caller can decide whether the member has earned the "You're set up" screen.
   */
  const finish = async (): Promise<boolean> => {
    setLoading(true);
    try {
      const primaryGoalId = selected[0] || 'general';
      const goalObj = GOALS.find((g) => g.id === primaryGoalId) || GOALS[GOALS.length - 1];
      const activityObj = ACTIVITY_LEVELS.find((a) => a.id === stats.activity) || ACTIVITY_LEVELS[2];

      const weightKg = stats.weight ? parseFloat(stats.weight) / 2.20462 : 80;
      const heightCm = stats.height ? parseFloat(stats.height) * 2.54 : 175;
      const age = parseInt(stats.age) || 30;
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - age);

      await api.post('/onboarding', {
        primary_goal: goalObj.apiId,
        date_of_birth: dob.toISOString().split('T')[0],
        gender: stats.gender,
        height_cm: Math.round(heightCm),
        current_weight_kg: parseFloat(weightKg.toFixed(1)),
        activity_level: activityObj.apiId,
        daily_calorie_goal: parseInt(stats.calories),
      });

      if (user) {
        setUser({
          ...user,
          onboarding_completed: true,
          daily_calorie_goal: parseInt(stats.calories),
        });
      }

      toast.success('Profile saved.');
      setLoading(false);
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save your profile. Please try again.'));
      setLoading(false);
      return false;
    }
  };

  return (
    <div className="min-h-dvh bg-surface-base flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg flex flex-col gap-6">
        <div className="flex items-center justify-center gap-2.5">
          <span className="h-10 w-10 rounded-sm bg-accent text-white font-display text-body flex items-center justify-center">
            MX
          </span>
          <span className="font-display text-h3 text-content-primary">My EXtreme Trainer</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2" role="list" aria-label="Progress">
          {STEPS.map((s, i) => {
            const done = i + 1 < step;
            const current = i + 1 === step;
            return (
              <div key={s} className="flex items-center gap-2 flex-1" role="listitem">
                <div
                  aria-current={current ? 'step' : undefined}
                  className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-caption font-bold transition-colors ${
                    done
                      ? 'bg-success text-white'
                      : current
                        ? 'bg-accent text-white'
                        : 'bg-surface-sunken text-content-tertiary'
                  }`}
                >
                  {done ? <Check size={15} strokeWidth={2.5} /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 rounded-full ${done ? 'bg-success' : 'bg-border-subtle'}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-surface-raised border border-border-subtle rounded-md p-5 sm:p-6">
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h1 className="font-display text-h1 text-content-primary">Set up your profile</h1>
                <p className="text-body-sm text-content-secondary">
                  Add a photo now or skip — you can change it any time.
                </p>
              </div>

              <div className="flex flex-col items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="h-24 w-24 rounded-full bg-surface-sunken border border-dashed border-border-strong flex items-center justify-center overflow-hidden hover:border-accent transition-colors"
                >
                  {uploadingPhoto ? (
                    <Loader2 size={22} strokeWidth={2} className="text-accent animate-spin" />
                  ) : user?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={26} strokeWidth={1.75} className="text-content-tertiary" />
                  )}
                </button>
                <p className="text-caption text-content-tertiary">
                  {user?.avatar_url ? 'Tap to change' : 'Tap to add a photo'}
                </p>
              </div>

              <div className="rounded-md bg-accent-surface border border-accent/20 p-3">
                <p className="text-body font-semibold text-content-primary">
                  Welcome, {user?.name || 'there'}
                </p>
                <p className="text-body-sm text-content-secondary mt-0.5">
                  The next two steps set your calorie and macro targets.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h1 className="font-display text-h1 text-content-primary">What are you working on?</h1>
                <p className="text-body-sm text-content-secondary">
                  Pick your main goal. The first one you choose is used to set your targets.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {GOALS.map(({ id, icon, title, desc }) => {
                  const active = selected.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleGoal(id)}
                      aria-pressed={active}
                      className={`flex flex-col items-start gap-1.5 p-3 rounded-md border text-left transition-colors ${
                        active
                          ? 'border-accent bg-accent-surface'
                          : 'border-border-subtle hover:border-border-strong'
                      }`}
                    >
                      <span
                        className={`h-9 w-9 rounded-sm flex items-center justify-center ${
                          active ? 'bg-accent text-white' : 'bg-surface-sunken text-content-tertiary'
                        }`}
                      >
                        <Icon name={icon} size="md" />
                      </span>
                      <span className="text-body font-semibold text-content-primary">{title}</span>
                      <span className="text-caption text-content-secondary">{desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h1 className="font-display text-h1 text-content-primary">Your current stats</h1>
                <p className="text-body-sm text-content-secondary">
                  Used to calculate your daily calorie and macro targets.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <NumericField
                  label="Weight"
                  suffix="lbs"
                  placeholder="185"
                  value={stats.weight}
                  onValueChange={(v) => setStats((s) => ({ ...s, weight: v }))}
                  min={0}
                  max={1000}
                />
                <NumericField
                  label="Height"
                  suffix="in"
                  placeholder="72"
                  value={stats.height}
                  onValueChange={(v) => setStats((s) => ({ ...s, height: v }))}
                  min={0}
                  max={120}
                />
                <NumericField
                  label="Age"
                  placeholder="30"
                  value={stats.age}
                  onValueChange={(v) => setStats((s) => ({ ...s, age: v }))}
                  min={0}
                  max={120}
                  allowDecimal={false}
                />
                <Select
                  label="Gender"
                  value={stats.gender}
                  onChange={(v) => setStats((s) => ({ ...s, gender: v }))}
                  options={[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-body-sm font-medium text-content-secondary">Activity level</span>
                <div className="flex flex-col gap-2">
                  {ACTIVITY_LEVELS.map(({ id, label, desc }) => {
                    const active = stats.activity === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setStats((s) => ({ ...s, activity: id }))}
                        aria-pressed={active}
                        className={`w-full flex items-center gap-3 p-3 rounded-md border text-left transition-colors ${
                          active ? 'border-accent bg-accent-surface' : 'border-border-subtle'
                        }`}
                      >
                        <span
                          className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                            active ? 'border-accent bg-accent' : 'border-border-strong'
                          }`}
                        >
                          {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="flex-1">
                          <span className="block text-body text-content-primary">{label}</span>
                          <span className="block text-caption text-content-secondary">{desc}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border border-border-subtle p-3">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-body-sm font-medium text-content-secondary">
                    Daily calorie goal
                  </span>
                  <span className="text-h3 font-semibold text-accent tabular">
                    {Number(stats.calories).toLocaleString()} kcal
                  </span>
                </div>
                <input
                  type="range"
                  min="1200"
                  max="4000"
                  step="50"
                  value={stats.calories}
                  onChange={(e) => setStats((s) => ({ ...s, calories: e.target.value }))}
                  aria-label="Daily calorie goal"
                  className="w-full accent-[var(--accent)]"
                />
                <div className="flex justify-between text-caption text-content-tertiary mt-1 tabular">
                  <span>1,200</span>
                  <span>4,000</span>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center text-center gap-5 py-2">
              <div className="h-14 w-14 rounded-full bg-success-surface text-success flex items-center justify-center">
                <Check size={28} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col gap-1.5">
                <h1 className="font-display text-h1 text-content-primary">You&rsquo;re set up</h1>
                <p className="text-body text-content-secondary text-pretty">
                  Your 30-day trial has started. Log your first meal or workout and your dashboard
                  fills in from there.
                </p>
              </div>
              {/* By the time this screen is reached the profile is already
                  saved, so this only navigates. It used to be the thing that
                  performed the save — meaning "You're set up" was on screen
                  before anything had been written, and closing the tab there
                  lost the lot. */}
              <Button
                onClick={() => router.push('/dashboard')}
                size="lg"
                fullWidth
                iconRight={<ArrowRight size={16} strokeWidth={2} />}
              >
                Go to dashboard
              </Button>
            </div>
          )}

          {step < 4 && (
            <div className="flex gap-3 mt-6">
              {step > 1 && (
                <Button
                  variant="ghost"
                  onClick={() => setStep((s) => s - 1)}
                  icon={<ArrowLeft size={16} strokeWidth={2} />}
                >
                  Back
                </Button>
              )}
              {/* Step 3 saves and only then advances. Previously it advanced
                  unconditionally, so the "You're set up" screen appeared while
                  nothing had been written and `onboarding_completed` was still
                  false — sending the member back through onboarding on their
                  next login. */}
              <Button
                onClick={async () => {
                  if (!stepComplete(step)) return;
                  if (step === 3) {
                    const saved = await finish();
                    if (!saved) return;
                  }
                  setStep((s) => s + 1);
                }}
                fullWidth
                disabled={!stepComplete(step) || loading}
                loading={step === 3 && loading}
                iconRight={<ArrowRight size={16} strokeWidth={2} />}
              >
                {step === 3 ? (loading ? 'Saving…' : 'Finish setup') : 'Continue'}
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-caption text-content-tertiary">
          Step {step} of {STEPS.length} — {STEPS[step - 1]}
        </p>
      </div>
    </div>
  );
}
