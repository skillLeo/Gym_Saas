'use client';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as Tabs from '@radix-ui/react-tabs';
import { format, parseISO } from 'date-fns';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Camera } from 'lucide-react';

const ACTIVITY_OPTS = [
  { value: 'sedentary', label: 'Sedentary' }, { value: 'lightly_active', label: 'Lightly Active' },
  { value: 'moderately_active', label: 'Moderately Active' }, { value: 'very_active', label: 'Very Active' },
  { value: 'extra_active', label: 'Extra Active' },
];

const GOAL_OPTS = [
  { value: 'lose_weight', label: 'Lose Weight' }, { value: 'maintain_weight', label: 'Maintain Weight' },
  { value: 'gain_muscle', label: 'Gain Muscle' }, { value: 'improve_fitness', label: 'Improve Fitness' },
  { value: 'eat_healthier', label: 'Eat Healthier' },
];

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profileForm, setProfileForm] = useState({ name: '', bio: '', date_of_birth: '', gender: '' });
  const [goalsForm, setGoalsForm] = useState({ height_cm: '', current_weight_kg: '', goal_weight_kg: '', activity_level: '', primary_goal: '', daily_calorie_goal: '', daily_water_goal_glasses: '8' });
  const [pwForm, setPwForm] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    setProfileForm({ name: user.name ?? '', bio: user.bio ?? '', date_of_birth: user.date_of_birth ?? '', gender: user.gender ?? '' });
    setGoalsForm({ height_cm: user.height_cm?.toString() ?? '', current_weight_kg: user.current_weight_kg?.toString() ?? '', goal_weight_kg: user.goal_weight_kg?.toString() ?? '', activity_level: user.activity_level ?? '', primary_goal: user.primary_goal ?? '', daily_calorie_goal: user.daily_calorie_goal?.toString() ?? '', daily_water_goal_glasses: user.daily_water_goal_glasses?.toString() ?? '8' });
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: (data: any) => api.put('/auth/user', data),
    onSuccess: (res) => { setUser(res.data.data); toast.success('Profile updated!'); },
    onError: (err: any) => { setErrors(err.response?.data?.errors ?? {}); toast.error('Update failed.'); },
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => { const fd = new FormData(); fd.append('avatar', file); return api.post('/auth/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
    onSuccess: (res) => { if (user) setUser({ ...user, avatar_url: res.data.data.avatar_url }); toast.success('Avatar updated!'); },
    onError: () => toast.error('Avatar upload failed.'),
  });

  const changePassword = useMutation({
    mutationFn: (data: any) => api.post('/auth/change-password', data),
    onSuccess: () => { toast.success('Password changed!'); setPwForm({ current_password: '', password: '', password_confirmation: '' }); },
    onError: (err: any) => { setErrors(err.response?.data?.errors ?? {}); toast.error(err.response?.data?.error || 'Failed.'); },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: profile card */}
        <Card className="text-center flex flex-col items-center py-6">
          <div className="relative mb-4">
            <Avatar src={user?.avatar_url} name={user?.name ?? '?'} size="xl" />
            <button onClick={() => fileRef.current?.click()} className="absolute bottom-0 right-0 w-8 h-8 bg-[#F87404] rounded-full flex items-center justify-center hover:bg-[#e06000] transition-colors shadow-lg">
              <Camera size={14} className="text-white" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar.mutate(f); }} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">{user?.name}</h2>
          <p className="text-sm text-gray-500">{user?.email}</p>
          <Badge variant={user?.subscription_status === 'trial' ? 'trial' : user?.subscription_status === 'active' ? 'active' : 'expired'} className="mt-2">
            {user?.subscription_status === 'trial' ? `${user.trial_days_remaining}d trial left` : user?.subscription_status}
          </Badge>
          <p className="text-xs text-gray-400 mt-3">Member since {user?.member_since ? format(parseISO(user.member_since), 'MMMM yyyy') : '—'}</p>
        </Card>

        {/* Right: tabs */}
        <div className="lg:col-span-2">
          <Tabs.Root defaultValue="profile">
            <Tabs.List className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-4">
              {['profile', 'goals', 'account'].map(t => (
                <Tabs.Trigger key={t} value={t} className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all capitalize data-[state=active]:bg-[#F87404] data-[state=active]:text-white text-gray-500 hover:text-gray-900">{t}</Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content value="profile">
              <Card>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Personal Information</h3>
                <div className="space-y-4">
                  <Input label="Full Name" value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} error={errors.name} />
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1.5">Bio</label>
                    <textarea value={profileForm.bio} onChange={e => setProfileForm(p => ({ ...p, bio: e.target.value }))} rows={3} placeholder="Tell the community about yourself..." className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-[#484F58] outline-none focus:border-[#F87404] resize-none" />
                  </div>
                  <Input label="Date of Birth" type="date" value={profileForm.date_of_birth} onChange={e => setProfileForm(p => ({ ...p, date_of_birth: e.target.value }))} />
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">Gender</label>
                    <div className="flex gap-2">
                      {['male', 'female', 'other'].map(g => (
                        <button key={g} onClick={() => setProfileForm(p => ({ ...p, gender: g }))} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 capitalize transition-all ${profileForm.gender === g ? 'border-[#F87404] bg-[#F87404]/10 text-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>{g}</button>
                      ))}
                    </div>
                  </div>
                  <Button onClick={() => updateProfile.mutate(profileForm)} loading={updateProfile.isPending} className="w-full">Save Changes</Button>
                </div>
              </Card>
            </Tabs.Content>

            <Tabs.Content value="goals">
              <Card>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Fitness Goals & Stats</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Height (cm)" type="number" value={goalsForm.height_cm} onChange={e => setGoalsForm(p => ({ ...p, height_cm: e.target.value }))} />
                    <Input label="Current Weight (kg)" type="number" value={goalsForm.current_weight_kg} onChange={e => setGoalsForm(p => ({ ...p, current_weight_kg: e.target.value }))} />
                  </div>
                  <Input label="Goal Weight (kg)" type="number" value={goalsForm.goal_weight_kg} onChange={e => setGoalsForm(p => ({ ...p, goal_weight_kg: e.target.value }))} />
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">Activity Level</label>
                    <select value={goalsForm.activity_level} onChange={e => setGoalsForm(p => ({ ...p, activity_level: e.target.value }))} className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#F87404]">
                      <option value="">Select...</option>
                      {ACTIVITY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">Primary Goal</label>
                    <select value={goalsForm.primary_goal} onChange={e => setGoalsForm(p => ({ ...p, primary_goal: e.target.value }))} className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#F87404]">
                      <option value="">Select...</option>
                      {GOAL_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <Input label="Daily Calorie Goal (kcal)" type="number" value={goalsForm.daily_calorie_goal} onChange={e => setGoalsForm(p => ({ ...p, daily_calorie_goal: e.target.value }))} hint="Leave blank to auto-calculate" />
                  <Input label="Daily Water Goal (glasses)" type="number" value={goalsForm.daily_water_goal_glasses} onChange={e => setGoalsForm(p => ({ ...p, daily_water_goal_glasses: e.target.value }))} min="1" max="20" />
                  <Button onClick={() => updateProfile.mutate({ ...goalsForm, height_cm: parseFloat(goalsForm.height_cm) || undefined, current_weight_kg: parseFloat(goalsForm.current_weight_kg) || undefined, goal_weight_kg: parseFloat(goalsForm.goal_weight_kg) || undefined, daily_calorie_goal: parseInt(goalsForm.daily_calorie_goal) || undefined, daily_water_goal_glasses: parseInt(goalsForm.daily_water_goal_glasses) || 8 })} loading={updateProfile.isPending} className="w-full">Save Goals</Button>
                </div>
              </Card>
            </Tabs.Content>

            <Tabs.Content value="account">
              <Card>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Change Password</h3>
                <div className="space-y-4">
                  <Input label="Current Password" type="password" value={pwForm.current_password} onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} error={errors.current_password} />
                  <Input label="New Password" type="password" value={pwForm.password} onChange={e => setPwForm(p => ({ ...p, password: e.target.value }))} error={errors.password} hint="Minimum 8 characters" />
                  <Input label="Confirm New Password" type="password" value={pwForm.password_confirmation} onChange={e => setPwForm(p => ({ ...p, password_confirmation: e.target.value }))} />
                  <Button onClick={() => changePassword.mutate(pwForm)} loading={changePassword.isPending} className="w-full">Change Password</Button>
                </div>
              </Card>
            </Tabs.Content>
          </Tabs.Root>
        </div>
      </div>
    </div>
  );
}
