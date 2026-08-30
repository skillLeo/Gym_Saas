'use client';

import { useState, useRef, useEffect } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Camera, CheckCircle, Loader2, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';

const GOALS = ['lose_weight', 'gain_muscle', 'maintain_weight', 'improve_fitness', 'eat_healthier'];
const GOAL_LABEL_KEYS: Record<string, string> = {
  lose_weight: 'goal.loseWeight', gain_muscle: 'goal.buildMuscle',
  maintain_weight: 'goal.maintainWeight', improve_fitness: 'goal.improveFitness',
  eat_healthier: 'goal.eatHealthier',
};

type AlternateNameType = 'maiden' | 'previous' | 'alternate';
type AlternateName = { name: string; type: AlternateNameType };

const ALT_NAME_TYPE_KEYS: Record<AlternateNameType, string> = {
  maiden: 'profileEdit.maiden', previous: 'profileEdit.previous',
  alternate: 'profileEdit.alternate',
};

export default function EditProfilePage() {
  const { t } = useI18nStore();
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '', username: '', bio: '', primary_goal: '', nickname: ''
  });
  const [altNames, setAltNames] = useState<AlternateName[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      name:         user.name ?? '',
      username:     (user as any).username ?? '',
      bio:          user.bio ?? '',
      primary_goal: user.primary_goal ?? '',
      nickname:     user.nickname ?? '',
    });
    setAltNames(user.alternate_names ?? []);
  }, [user]);

  const addAltName = () => setAltNames(prev => [...prev, { name: '', type: 'alternate' }]);
  const removeAltName = (i: number) => setAltNames(prev => prev.filter((_, idx) => idx !== i));
  const updateAltName = (i: number, patch: Partial<AlternateName>) =>
    setAltNames(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(t('profileEdit.nameRequired')); return; }
    setSaving(true);
    try {
      const res = await api.put('/auth/user', {
        name:            form.name,
        username:        form.username || undefined,
        bio:             form.bio,
        primary_goal:    form.primary_goal || undefined,
        nickname:        form.nickname.trim() || null,
        alternate_names: altNames.filter(a => a.name.trim() !== ''),
      });
      setUser(res.data.data);
      setSaved(true);
      toast.success(t('profileEdit.saved'));
      setTimeout(() => router.push('/profile'), 1200);
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('profileEdit.error.save')));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/auth/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (user) setUser({ ...user, avatar_url: res.data.data.avatar_url });
      toast.success(t('profileEdit.avatarUpdated'));
    } catch {
      toast.error(t('profileEdit.avatarFailed'));
    } finally {
      setAvatarUploading(false);
    }
  };

  const avatarUrl = user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'U')}&background=F87404&color=fff&size=200`;

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-6">

        <PageHeader title={t('profileEdit.title')} back="/profile" />

        {saved && (
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-md p-4 mb-5">
            <CheckCircle size={16} className="text-green-500" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">{t('profileEdit.savedRedirect')}</span>
          </div>
        )}

        {/* Avatar */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <img src={avatarUrl} alt={user?.name ?? 'Avatar'}
              className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-[#1a1a1a]" />
            <button onClick={() => fileRef.current?.click()}
              disabled={avatarUploading}
              className="absolute bottom-0 right-0 w-8 h-8 bg-accent rounded-full flex items-center justify-center hover:bg-accent-hover transition-colors disabled:opacity-70">
              {avatarUploading
                ? <Loader2 size={14} className="text-white animate-spin" />
                : <Camera size={14} className="text-white" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <p className="text-xs text-content-tertiary mt-2">{t('profileEdit.avatarHint')}</p>
        </div>

        <div className="space-y-4">
          {[
            { key: 'name',     label: t('profileEdit.displayName'), placeholder: t('profileEdit.yourName'),  type: 'text' },
            { key: 'username', label: t('profileEdit.username'),      placeholder: 'username',       type: 'text', prefix: '@' },
          ].map(({ key, label, placeholder, type, prefix }) => (
            <div key={key}>
              <label className="text-sm font-medium text-content-secondary mb-1.5 block">{label}</label>
              <div className="relative">
                {prefix && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-content-tertiary text-sm">{prefix}</span>}
                <input
                  type={type}
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className={`w-full ${prefix ? 'pl-7' : 'pl-4'} pr-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40`}
                />
              </div>
            </div>
          ))}

          <div>
            <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('profileEdit.bio')}</label>
            <textarea rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder={t('profileEdit.bioPlaceholder')}
              className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 resize-none" />
          </div>

          <div>
            <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('profileEdit.nickname')}</label>
            <input
              type="text"
              value={form.nickname}
              onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
              placeholder={t('profileEdit.nicknameHint')}
              maxLength={60}
              className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            />
            <p className="text-xs text-content-tertiary mt-1">{t('profileEdit.nicknameNote')}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-content-secondary block">{t('profileEdit.otherNames')}</label>
              <button type="button" onClick={addAltName}
                className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover transition-colors">
                <Plus size={13} /> {t('profileEdit.add')}
              </button>
            </div>
            <p className="text-xs text-content-tertiary mb-2">
              {t('profileEdit.otherNamesHint')}
            </p>
            {altNames.length > 0 && (
              <div className="space-y-2">
                {altNames.map((alt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={alt.name}
                      onChange={e => updateAltName(i, { name: e.target.value })}
                      placeholder={t('profileEdit.nameField')}
                      maxLength={120}
                      className="flex-1 min-w-0 px-3 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    />
                    <select
                      value={alt.type}
                      onChange={e => updateAltName(i, { type: e.target.value as AlternateNameType })}
                      className="px-2 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      {(Object.keys(ALT_NAME_TYPE_KEYS) as AlternateNameType[]).map(kind => (
                        <option key={kind} value={kind}>{t(ALT_NAME_TYPE_KEYS[kind])}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => removeAltName(i)}
                      className="w-10 h-10 shrink-0 flex items-center justify-center rounded-md text-content-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-content-secondary mb-2 block">{t('profileEdit.primaryGoal')}</label>
            <div className="grid grid-cols-3 gap-2">
              {GOALS.map(g => (
                <button key={g} onClick={() => setForm(f => ({ ...f, primary_goal: g }))}
                  className={`py-2.5 rounded-md text-xs font-medium text-center transition-all ${form.primary_goal === g ? 'bg-accent text-white' : 'bg-surface-sunken text-content-secondary hover:bg-accent/20'}`}>
                  {t(GOAL_LABEL_KEYS[g])}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/profile" className="flex-1">
              <Button variant="ghost" fullWidth>{t('common.cancel')}</Button>
            </Link>
            <Button fullWidth loading={saving} onClick={handleSave}>{t('profileEdit.saveChanges')}</Button>
          </div>
        </div>
        <div className="h-20" />
      </div>
    </>
  );
}
