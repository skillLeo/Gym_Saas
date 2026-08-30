'use client';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as Tabs from '@radix-ui/react-tabs';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Camera, Monitor, Share2, Pencil, Settings} from 'lucide-react';
import { AchievementsPanel } from '@/components/achievements/AchievementsPanel';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { useI18nStore, translate, type Locale } from '@/store/i18nStore';

const ACTIVITY_OPTS = [
  { value: 'sedentary', labelKey: 'profile.activity.sedentary' }, { value: 'lightly_active', labelKey: 'profile.activity.lightlyActive' },
  { value: 'moderately_active', labelKey: 'profile.activity.moderatelyActive' }, { value: 'very_active', labelKey: 'profile.activity.veryActive' },
  { value: 'extra_active', labelKey: 'profile.activity.extraActive' },
];

const GOAL_OPTS = [
  { value: 'lose_weight', labelKey: 'profile.goal.loseWeight' }, { value: 'maintain_weight', labelKey: 'profile.goal.maintainWeight' },
  { value: 'gain_muscle', labelKey: 'profile.goal.gainMuscle' }, { value: 'improve_fitness', labelKey: 'profile.goal.improveFitness' },
  { value: 'eat_healthier', labelKey: 'profile.goal.eatHealthier' },
];

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const { t, locale } = useI18nStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profileForm, setProfileForm] = useState({ name: '', bio: '', date_of_birth: '', gender: '' });

  // Digital Billboard state. Seeded with the literal English default, not
  // t(...): this page is statically prerendered, so the build-time render
  // always sees locale 'en' — calling t() here would return the *client's*
  // persisted locale on first hydration instead, a text mismatch (React #418).
  const [bbText, setBbText]   = useState('Stay hard. Stay hungry. Team Extreme.');

  // Once mounted (client-only, after hydration is already reconciled), swap
  // the seed to the real locale — but only while it still matches an untouched
  // default in any language, so a user who already started editing never gets
  // overwritten mid-edit.
  useEffect(() => {
    const seeds = (['en', 'es', 'fr'] as Locale[]).map((l) => translate(l, 'profile.billboard.defaultMessage'));
    setBbText((cur) => (seeds.includes(cur) ? t('profile.billboard.defaultMessage') : cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);
  const [bbFont,  setBbFont]  = useState('serif');
  const [bbColor, setBbColor] = useState('#FFFFFF');
  const [bbBg,    setBbBg]    = useState('#F87404');
  const [bbShared, setBbShared] = useState(false);
  const [bbSharing, setBbSharing] = useState(false);
  const [bbSaving, setBbSaving] = useState(false);

  // Rehydrate a previously saved billboard so it survives reload/login.
  useEffect(() => {
    const saved = user?.billboard;
    if (!saved) return;
    if (saved.text) setBbText(saved.text);
    if (saved.font) setBbFont(saved.font);
    if (saved.color) setBbColor(saved.color);
    if (saved.background) setBbBg(saved.background);
  }, [user?.billboard]);

  const saveBillboard = async () => {
    setBbSaving(true);
    try {
      const res = await api.put('/auth/user', {
        billboard: { text: bbText, font: bbFont, color: bbColor, background: bbBg },
      });
      setUser(res.data.data);
      setBbShared(false);
      toast.success(t('profile.toast.billboardSaved'));
    } catch (err) {
      toast.error(getErrorMessage(err, t('profile.toast.updateFailed')));
    } finally {
      setBbSaving(false);
    }
  };

  const BB_FONTS  = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'];
  const BB_COLORS = ['#FFFFFF', '#000000', '#F87404', '#FF0404', '#FFC000', '#004AAD', '#10B981'];
  const BB_BGS    = ['#F87404', '#0000FF', '#004AAD', '#1a1a1a', '#FF0404', '#10B981', '#7C3AED', '#FFC000'];
  const [goalsForm, setGoalsForm] = useState({ height_cm: '', current_weight_kg: '', goal_weight_kg: '', activity_level: '', primary_goal: '', daily_calorie_goal: '', daily_water_goal_glasses: '8' });
  const [pwForm, setPwForm] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    setProfileForm({ name: user.name ?? '', bio: user.bio ?? '', date_of_birth: user.date_of_birth ?? '', gender: user.gender ?? '' });
    setGoalsForm({ height_cm: user.height_cm?.toString() ?? '', current_weight_kg: user.current_weight_kg?.toString() ?? '', goal_weight_kg: user.goal_weight_kg?.toString() ?? '', activity_level: user.activity_level ?? '', primary_goal: user.primary_goal ?? '', daily_calorie_goal: user.daily_calorie_goal?.toString() ?? '', daily_water_goal_glasses: user.daily_water_goal_glasses?.toString() ?? '8' });
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.put('/auth/user', data);
      return res.data.data;
    },
    onSuccess: (data) => {
      setUser(data);
      toast.success(t('profile.toast.profileUpdated'));
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, t('profile.toast.updateFailed')));
    }
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data.data.avatar_url;
    },
    onSuccess: (url: string) => {
      if (user) setUser({ ...user, avatar_url: url });
      toast.success(t('profile.toast.avatarUpdated'));
    },
    onError: () => toast.error(t('profile.toast.avatarFailed'))
  });

  const changePassword = useMutation({
    mutationFn: async (data: any) => {
      // Validation errors belong on the field that caused them, not in a toast
      // floating at the top of the screen — the mismatch is in the confirm box,
      // so that is where it is reported. Cleared on every attempt so a stale
      // message never sits under a field the user has since corrected.
      setErrors({});
      if (data.password !== data.password_confirmation) {
        setErrors({ password_confirmation: t('profile.toast.passwordMismatch') });
        throw new Error('Mismatch');
      }
      await api.post('/auth/change-password', data);
    },
    onSuccess: () => {
      toast.success(t('profile.toast.passwordChanged'));
      setPwForm({ current_password: '', password: '', password_confirmation: '' });
    },
    onError: (err: any) => {
      // The mismatch case already rendered itself under the confirm field.
      if (err.message === 'Mismatch') return;
      // A wrong current password is also a field problem, not a page problem.
      if (err?.response?.status === 422) {
        setErrors({ current_password: getErrorMessage(err, t('profile.toast.passwordChangeFailed')) });
        return;
      }
      toast.error(getErrorMessage(err, t('profile.toast.passwordChangeFailed')));
    }
  });

  const CANVAS_FONTS: Record<string, string> = {
    serif: 'Georgia, serif', 'sans-serif': 'Arial, sans-serif',
    monospace: '"Courier New", monospace', cursive: 'cursive', fantasy: 'fantasy'
  };

  const shareBillboardAsPost = async () => {
    setBbSharing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      ctx.fillStyle = bbBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = bbColor;
      ctx.font = `bold 42px ${CANVAS_FONTS[bbFont] ?? 'sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Wrap text to fit canvas width
      const words = (bbText || t('profile.billboard.placeholder')).split(' ');
      const lines: string[] = [];
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > canvas.width - 100 && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);

      const lineHeight = 56;
      const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((l, i) => ctx.fillText(l, canvas.width / 2, startY + i * lineHeight));

      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Failed to render image');

      const formData = new FormData();
      formData.append('image', blob, 'billboard.jpg');
      formData.append('folder', 'posts');
      const uploadRes = await api.post('/uploads/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

      await api.post('/social/posts', {
        content: bbText || t('profile.billboard.shareCaption'),
        image_url: uploadRes.data.image_url,
        post_type: 'achievement'
      });

      setBbShared(true);
      toast.success(t('profile.toast.billboardShared'));
    } catch {
      toast.error(t('profile.toast.billboardShareFailed'));
    } finally {
      setBbSharing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <PageHeader
        title={t('profile.title')}
        actions={
          <>
            <Link
              href="/profile/edit"
              aria-label={t('profile.editAria')}
              className="h-11 w-11 rounded-sm flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition-colors"
            >
              <Pencil size={20} strokeWidth={1.75} />
            </Link>
            <Link
              href="/profile/settings"
              aria-label={t('profile.settingsAria')}
              className="h-11 w-11 rounded-sm flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition-colors"
            >
              <Settings size={20} strokeWidth={1.75} />
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: profile card */}
        <Card className="text-center flex flex-col items-center py-6">
          <div className="relative mb-4">
            <Avatar src={user?.avatar_url} name={user?.name ?? '?'} size="xl" />
            <button onClick={() => fileRef.current?.click()} className="absolute bottom-0 right-0 w-8 h-8 bg-accent rounded-full flex items-center justify-center hover:bg-accent-hover transition-colors">
              <Camera size={14} className="text-white" />
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={e => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 2 * 1024 * 1024) { toast.error(t('profile.toast.imageTooLarge')); return; }
              uploadAvatar.mutate(f);
            }} />
          </div>
          <h2 className="text-lg font-bold text-content-primary">{user?.name}</h2>
          {/* The edit form tells members a nickname is "shown alongside your
              name", but nothing rendered it anywhere — only the search half of
              that promise was true. */}
          {user?.nickname && (
            <p className="text-sm text-content-secondary">“{user.nickname}”</p>
          )}
          <p className="text-sm text-content-secondary">{user?.email}</p>
          <Badge variant={user?.subscription_status === 'trial' ? 'trial' : user?.subscription_status === 'active' ? 'active' : 'expired'} className="mt-2">
            {user?.subscription_status === 'trial'
              ? t('profile.trialLeft', { days: user.trial_days_remaining })
              : user?.subscription_status
                ? t('subscription.status.' + user.subscription_status)
                : ''}
          </Badge>
          <p className="text-xs text-content-tertiary mt-3">{t('profile.memberSince', { date: user?.member_since ? formatDate(parseISO(user.member_since), locale, { month: 'long', year: 'numeric' }) : '—' })}</p>
        </Card>

        {/* Right: tabs */}
        <div className="lg:col-span-2">
          <Tabs.Root defaultValue="profile">
            <Tabs.List className="flex gap-1 bg-surface-raised border border-border-strong rounded-md p-1 mb-4">
              {(['profile', 'goals', 'billboard', 'account'] as const).map(tabId => (
                <Tabs.Trigger key={tabId} value={tabId} className="flex-1 py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-accent data-[state=active]:text-white text-content-secondary hover:text-content-primary dark:hover:text-white">
                  {tabId === 'billboard' ? t('profile.tab.billboard')
                    : tabId === 'account' ? t('settings.account')
                    : t(`profile.tab.${tabId}`)}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content value="profile">
              {/* Achievements lead the profile: a month-long streak is the most
                  significant thing on this screen and should not sit below a
                  form. Renders nothing when there is nothing real to show. */}
              <div className="mb-5">
                <AchievementsPanel />
              </div>

              <Card>
                <h3 className="text-sm font-semibold text-content-primary mb-4">{t('profile.personalInfo')}</h3>
                <div className="space-y-4">
                  <Input label={t('profile.fullName')} value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} error={errors.name} />
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-1.5">{t('profile.bio')}</label>
                    <textarea value={profileForm.bio} onChange={e => setProfileForm(p => ({ ...p, bio: e.target.value }))} rows={3} placeholder={t('profile.bioPlaceholder')} className="w-full bg-surface-sunken border border-border-strong rounded-md px-4 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors resize-none" />
                  </div>
                  <Input label={t('profile.dob')} type="date" value={profileForm.date_of_birth} onChange={e => setProfileForm(p => ({ ...p, date_of_birth: e.target.value }))} />
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-2">{t('profile.gender')}</label>
                    <div className="flex gap-2">
                      {(['male', 'female', 'other'] as const).map(g => (
                        <button key={g} onClick={() => setProfileForm(p => ({ ...p, gender: g }))} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 capitalize transition-all ${profileForm.gender === g ? 'border-accent bg-accent-surface text-content-primary' : 'border-border-strong text-content-secondary hover:border-content-tertiary'}`}>{t(`profile.gender.${g}`)}</button>
                      ))}
                    </div>
                  </div>
                  <Button onClick={() => updateProfile.mutate(profileForm)} loading={updateProfile.isPending} className="w-full">{t('profile.saveChanges')}</Button>
                </div>
              </Card>
            </Tabs.Content>

            <Tabs.Content value="goals">
              <Card>
                <h3 className="text-sm font-semibold text-content-primary mb-4">{t('profile.fitnessGoalsStats')}</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Input label={t('profile.height')} type="number" min={50} max={300} value={goalsForm.height_cm}
                      onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setGoalsForm(p => ({ ...p, height_cm: v })); }}
                      onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} />
                    <Input label={t('profile.currentWeight')} type="number" min={10} max={500} value={goalsForm.current_weight_kg}
                      onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setGoalsForm(p => ({ ...p, current_weight_kg: v })); }}
                      onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} />
                  </div>
                  <Input label={t('profile.goalWeight')} type="number" min={10} max={500} value={goalsForm.goal_weight_kg}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setGoalsForm(p => ({ ...p, goal_weight_kg: v })); }}
                    onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} />
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-2">{t('profile.activityLevel')}</label>
                    <select value={goalsForm.activity_level} onChange={e => setGoalsForm(p => ({ ...p, activity_level: e.target.value }))} className="w-full bg-surface-sunken border border-border-strong rounded-md px-4 py-2.5 text-sm text-content-primary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors">
                      <option value="">{t('profile.selectPlaceholder')}</option>
                      {ACTIVITY_OPTS.map(o => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-2">{t('profile.primaryGoal')}</label>
                    <select value={goalsForm.primary_goal} onChange={e => setGoalsForm(p => ({ ...p, primary_goal: e.target.value }))} className="w-full bg-surface-sunken border border-border-strong rounded-md px-4 py-2.5 text-sm text-content-primary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors">
                      <option value="">{t('profile.selectPlaceholder')}</option>
                      {GOAL_OPTS.map(o => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
                    </select>
                  </div>
                  <Input label={t('profile.dailyCalorieGoal')} type="number" min={1000} max={10000} value={goalsForm.daily_calorie_goal}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setGoalsForm(p => ({ ...p, daily_calorie_goal: v })); }}
                    onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                    hint={t('profile.autoCalcHint')} />
                  <Input label={t('profile.dailyWaterGoal')} type="number" min={1} max={20} value={goalsForm.daily_water_goal_glasses}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setGoalsForm(p => ({ ...p, daily_water_goal_glasses: v })); }}
                    onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} />
                  <Button onClick={() => updateProfile.mutate({ ...goalsForm, height_cm: parseFloat(goalsForm.height_cm) || undefined, current_weight_kg: parseFloat(goalsForm.current_weight_kg) || undefined, goal_weight_kg: parseFloat(goalsForm.goal_weight_kg) || undefined, daily_calorie_goal: parseInt(goalsForm.daily_calorie_goal) || undefined, daily_water_goal_glasses: parseInt(goalsForm.daily_water_goal_glasses) || 8 })} loading={updateProfile.isPending} className="w-full">{t('profile.saveGoals')}</Button>
                </div>
              </Card>
            </Tabs.Content>

            <Tabs.Content value="billboard">
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <Monitor size={17} className="text-accent" />
                  <h3 className="text-sm font-semibold text-content-primary">{t('profile.billboard.heading')}</h3>
                  <span className="ml-auto text-xs text-content-tertiary bg-surface-sunken px-2 py-1 rounded-full">{t('profile.billboard.badge')}</span>
                </div>

                {/* Live preview */}
                <div className="rounded-md overflow-hidden mb-5"
                  style={{ backgroundColor: bbBg, minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                  <p className="text-center text-xl font-bold leading-snug break-words max-w-full"
                    style={{ fontFamily: bbFont, color: bbColor }}>
                    {bbText || t('profile.billboard.placeholder')}
                  </p>
                </div>

                {/* Message text */}
                <div className="mb-4">
                  <label className="text-xs font-semibold text-content-secondary uppercase tracking-wide mb-1.5 block">{t('profile.billboard.message')}</label>
                  <textarea value={bbText} onChange={e => setBbText(e.target.value)} rows={2} maxLength={120}
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 resize-none" />
                  <p className="text-[10px] text-content-tertiary mt-0.5 text-right">{bbText.length}/120</p>
                </div>

                {/* Font */}
                <div className="mb-4">
                  <label className="text-xs font-semibold text-content-secondary uppercase tracking-wide mb-1.5 block">{t('profile.billboard.fontStyle')}</label>
                  <div className="flex gap-2 flex-wrap">
                    {BB_FONTS.map(f => (
                      <button key={f} onClick={() => setBbFont(f)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${bbFont === f ? 'border-accent bg-accent-surface text-accent' : 'border-border-strong text-content-secondary hover:border-accent/40'}`}
                        style={{ fontFamily: f }}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text color */}
                <div className="mb-4">
                  <label className="text-xs font-semibold text-content-secondary uppercase tracking-wide mb-1.5 block">{t('profile.billboard.textColor')}</label>
                  <div className="flex gap-2">
                    {BB_COLORS.map(c => (
                      <button key={c} onClick={() => setBbColor(c)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${bbColor === c ? 'border-accent scale-110' : 'border-gray-200 dark:border-white/20'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>

                {/* Background */}
                <div className="mb-5">
                  <label className="text-xs font-semibold text-content-secondary uppercase tracking-wide mb-1.5 block">{t('profile.billboard.background')}</label>
                  <div className="flex gap-2 flex-wrap">
                    {BB_BGS.map(c => (
                      <button key={c} onClick={() => setBbBg(c)}
                        className={`w-8 h-8 rounded-md border-2 transition-all ${bbBg === c ? 'border-accent scale-110' : 'border-gray-200 dark:border-white/20'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  {/* This used to fire a success toast and save nothing — the
                      billboard reverted to its default on every reload. It now
                      persists through PUT /auth/user like any other profile
                      field. */}
                  <Button fullWidth loading={bbSaving} onClick={saveBillboard}>
                    {t('profile.billboard.saveToProfile')}
                  </Button>
                  <button onClick={shareBillboardAsPost} disabled={bbSharing}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-md border border-[#004AAD]/40 text-brand-blue-deep dark:text-brand-blue-deep text-sm font-semibold hover:bg-[#004AAD]/5 transition-colors whitespace-nowrap disabled:opacity-60">
                    <Share2 size={14} /> {bbSharing ? t('profile.billboard.sharing') : t('profile.billboard.shareAsPost')}
                  </button>
                </div>
                {bbShared && <p className="text-xs text-green-500 dark:text-green-400 mt-2 text-center">{t('profile.billboard.posted')}</p>}
              </Card>
            </Tabs.Content>

            <Tabs.Content value="account">
              <Card>
                <h3 className="text-sm font-semibold text-content-primary mb-4">{t('profile.changePassword.heading')}</h3>
                <div className="space-y-4">
                  <Input label={t('profile.changePassword.current')} type="password" value={pwForm.current_password} onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} error={errors.current_password} />
                  <Input label={t('profile.changePassword.new')} type="password" value={pwForm.password} onChange={e => setPwForm(p => ({ ...p, password: e.target.value }))} error={errors.password} hint={t('profile.changePassword.minChars')} />
                  <Input label={t('profile.changePassword.confirm')} type="password" value={pwForm.password_confirmation} onChange={e => setPwForm(p => ({ ...p, password_confirmation: e.target.value }))} error={errors.password_confirmation} />
                  <Button onClick={() => changePassword.mutate(pwForm)} loading={changePassword.isPending} className="w-full">{t('profile.changePassword.heading')}</Button>
                </div>
              </Card>
            </Tabs.Content>
          </Tabs.Root>
        </div>
      </div>
    </div>
  );
}
