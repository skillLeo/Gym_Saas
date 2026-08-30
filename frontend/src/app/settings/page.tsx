'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useLayoutStore } from '@/store/layoutStore';
import { useI18nStore, LOCALES } from '@/store/i18nStore';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { LogOut, Bell, Scale, Globe, PanelLeft, LayoutPanelTop, Palette, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

const ACCENT_OPTIONS = ['#F87404', '#0000FF', '#FF0404', '#10B981', '#7C3AED', '#DB2777', '#004AAD', '#FFC000'];

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const { locale, setLocale, t } = useI18nStore();

  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');

  useEffect(() => {
    const stored = localStorage.getItem('units_system') as 'metric' | 'imperial' | null;
    if (stored === 'metric' || stored === 'imperial') setUnits(stored);
  }, []);
  // Seeded from the signed-in user and written back through PUT /auth/user.
  // This was previously local-only state: the switch moved, toasted nothing,
  // and reverted on reload because it was never sent anywhere.
  const [notifications, setNotifications] = useState(user?.email_notifications ?? true);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setNotifications(user.email_notifications ?? true);
  }, [user]);

  const handleNotificationsChange = async (next: boolean) => {
    const previous = notifications;
    setNotifications(next); // optimistic
    setSavingNotifications(true);
    try {
      const api = (await import('@/lib/api')).default;
      const res = await api.put('/auth/user', { email_notifications: next });
      setUser(res.data.data);
      toast.success(next ? t('settings.notifications.on') : t('settings.notifications.off'));
    } catch {
      setNotifications(previous); // visible rollback — never claim a save that failed
      toast.error(t('settings.saveFailed'));
    } finally {
      setSavingNotifications(false);
    }
  };
  const { mode, setMode, accentColor, setAccentColor } = useLayoutStore();
  const { theme, toggleTheme } = useTheme();

  const handleUnitChange = (u: 'metric' | 'imperial') => {
    setUnits(u);
    localStorage.setItem('units_system', u);
    toast.success(t('settings.units.switched', {
      system: u === 'metric' ? t('settings.units.metricLong') : t('settings.units.imperialLong'),
    }));
  };

  const handleLogout = async () => {
    try {
      const api = (await import('@/lib/api')).default;
      await api.post('/auth/logout');
    } catch { /* ignore */ }
    document.cookie = 'auth_token=; path=/; max-age=0';
    logout();
    router.replace('/auth/login');
    toast.success(t('settings.signedOut'));
  };

  const handleDeleteAccount = () => {
    toast(t('settings.deleteHint'), { icon: 'ℹ️' });
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <PageHeader title={t('settings.title')} />

      {/* Preferences */}
      <Card>
        <h3 className="text-sm font-semibold text-content-primary mb-4">{t('settings.preferences')}</h3>
        <div className="space-y-5">

          {/* Units */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-accent-surface flex items-center justify-center">
                <Scale size={15} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-content-primary">{t('settings.units')}</p>
                <p className="text-xs text-content-secondary">{t('settings.units.desc')}</p>
              </div>
            </div>
            <div className="flex gap-1 bg-surface-sunken rounded-md p-1">
              <button
                onClick={() => handleUnitChange('metric')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${units === 'metric' ? 'bg-accent text-white shadow-sm' : 'text-content-secondary hover:text-content-primary dark:hover:text-white'}`}
              >
                {t('settings.metric')}
              </button>
              <button
                onClick={() => handleUnitChange('imperial')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${units === 'imperial' ? 'bg-accent text-white shadow-sm' : 'text-content-secondary hover:text-content-primary dark:hover:text-white'}`}
              >
                {t('settings.imperial')}
              </button>
            </div>
          </div>

          {/* Dark mode */}
          <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-accent-surface flex items-center justify-center">
                <Moon size={15} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-content-primary">{t('settings.darkMode')}</p>
                <p className="text-xs text-content-secondary">{t('settings.darkMode.desc')}</p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('settings.darkMode.toLight') : t('settings.darkMode.toDark')}
              className={`w-11 h-6 rounded-full relative transition-all duration-200 ${theme === 'dark' ? 'bg-accent' : 'bg-gray-200 dark:bg-white/20'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${theme === 'dark' ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {/* Accent color */}
          <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-accent-surface flex items-center justify-center">
                <Palette size={15} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-content-primary">{t('settings.accent')}</p>
                <p className="text-xs text-content-secondary">{t('settings.accent.desc')}</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              {ACCENT_OPTIONS.map(c => (
                <button key={c} type="button" aria-label={t('settings.accent.pick', { color: c })}
                  onClick={() => { setAccentColor(c); toast.success(t('settings.accent.changed')); }}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${accentColor === c ? 'scale-110 border-gray-900 dark:border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Layout preference */}
          <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-accent-surface flex items-center justify-center">
                <PanelLeft size={15} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-content-primary">{t('settings.layout')}</p>
                <p className="text-xs text-content-secondary">{t('settings.layout.desc')}</p>
              </div>
            </div>
            <div className="flex gap-1 bg-surface-sunken rounded-md p-1">
              <button
                onClick={() => { setMode('topnav'); toast.success(t('settings.layout.switchedTop')); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === 'topnav' ? 'bg-accent text-white shadow-sm' : 'text-content-secondary hover:text-content-primary dark:hover:text-white'}`}
              >
                <LayoutPanelTop size={12} /> {t('settings.layout.topnav')}
              </button>
              <button
                onClick={() => { setMode('sidebar'); toast.success(t('settings.layout.switchedSidebar')); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === 'sidebar' ? 'bg-accent text-white shadow-sm' : 'text-content-secondary hover:text-content-primary dark:hover:text-white'}`}
              >
                <PanelLeft size={12} /> {t('settings.layout.sidebar')}
              </button>
            </div>
          </div>

          {/* Email notifications */}
          <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-accent-surface flex items-center justify-center">
                <Bell size={15} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-content-primary">{t('settings.notifications')}</p>
                <p className="text-xs text-content-secondary">{t('settings.notifications.desc')}</p>
              </div>
            </div>
            <button
              onClick={() => handleNotificationsChange(!notifications)}
              disabled={savingNotifications}
              aria-pressed={notifications}
              aria-label={t('settings.notifications.toggle')}
              className={`w-11 h-6 rounded-full relative transition-all duration-200 disabled:opacity-60 ${notifications ? 'bg-accent' : 'bg-gray-200 dark:bg-white/20'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${notifications ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-accent-surface flex items-center justify-center">
                <Globe size={15} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-content-primary">{t('settings.language')}</p>
                <p className="text-xs text-content-secondary">{t('settings.language.desc')}</p>
              </div>
            </div>
            <div className="flex gap-1 bg-surface-sunken rounded-md p-1">
              {/* Region code + endonym rather than a flag emoji (§1.5, §5.4):
                  flags render inconsistently across platforms, are missing on
                  some Windows builds, and equate a language with one country. */}
              {LOCALES.map(loc => (
                <button key={loc.id} type="button" lang={loc.id}
                  aria-pressed={locale === loc.id}
                  aria-label={`${loc.english} — ${loc.label}`}
                  onClick={() => { setLocale(loc.id); toast.success(t('settings.language.changed')); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${locale === loc.id ? 'bg-accent text-white' : 'text-content-secondary hover:text-content-primary dark:hover:text-white'}`}>
                  <span className="font-mono tracking-wide opacity-70">{loc.region}</span>
                  <span className="hidden sm:inline">{loc.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Account info */}
      <Card>
        <h3 className="text-sm font-semibold text-content-primary mb-4">{t('settings.account')}</h3>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-content-secondary">{t('settings.name')}</span>
            <span className="text-content-primary font-medium">{user?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-content-secondary">{t('settings.email')}</span>
            <span className="text-content-primary font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-content-secondary">{t('settings.subscription')}</span>
            <span className="text-content-primary font-medium">{t('subscription.status.' + (user?.subscription_status ?? 'trial'))}</span>
          </div>
          {user?.is_on_trial && (
            <div className="flex justify-between text-sm">
              <span className="text-content-secondary">{t('settings.trialEnds')}</span>
              <span className="text-accent font-medium">{t('settings.trialDaysLeft', { count: user.trial_days_remaining ?? 0 })}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Danger zone */}
      <Card>
        <h3 className="text-sm font-semibold text-red-500 mb-3">{t('settings.danger')}</h3>
        <div className="space-y-3">
          <Button variant="danger" onClick={handleLogout} className="w-full" icon={<LogOut size={15} />}>
            {t('settings.signOutAll')}
          </Button>
          <button onClick={handleDeleteAccount} className="w-full py-2.5 text-sm font-medium text-content-secondary hover:text-red-500 transition-colors border border-border-strong rounded-md">
            {t('settings.requestDeletion')}
          </button>
        </div>
      </Card>
    </div>
  );
}
