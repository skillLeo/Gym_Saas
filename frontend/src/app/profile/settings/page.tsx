'use client';

import { useState } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { PageHeader } from '@/components/ui/PageHeader';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Switch } from '@/components/ui/Controls';
import { ChevronRight, Trash2, LogOut, PanelLeft, LayoutPanelTop } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLayoutStore } from '@/store/layoutStore';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type ToggleState = { [key: string]: boolean };

export default function SettingsPage() {
  const { t } = useI18nStore();
  const router = useRouter();
  const [toggles, setToggles] = useState<ToggleState>({
    pushNotifs: true,
    emailNotifs: true,
    workoutReminders: true,
    socialNotifs: true,
    privateProfile: false,
    activityVisible: true,
    dataSharing: false
  });

  const toggle = (key: string) => setToggles(t => ({ ...t, [key]: !t[key] }));
  const { mode, setMode, accentColor, setAccentColor } = useLayoutStore();
  const ACCENT_OPTIONS = ['#F87404', '#0000FF', '#FF0404', '#10B981', '#7C3AED', '#DB2777', '#004AAD', '#FFC000'];
  const { user, logout } = useAuthStore();

  const handleSignOut = async () => {
    try {
      await api.post('/auth/logout');
    } catch { /* revoke best-effort */ }
    logout();
    document.cookie = 'auth_token=; path=/; max-age=0';
    router.replace('/auth/login');
  };

  /**
   * NOTE: these toggles are LOCAL STATE ONLY — nothing here is persisted to the
   * API, so every switch silently resets on reload. Notification and privacy
   * preferences need real columns and endpoints; that work belongs to Phase 8
   * (§4.4 scheduled notifications) and Phase 9 (§5.7 notification
   * personalisation). Flagged in BUILD_PROGRESS.md rather than half-built here.
   *
   * The previous inline `Toggle` component was defined during render, so React
   * remounted every switch on each keystroke of state
   * (react-hooks/static-components). Replaced with the module-scope `Switch`
   * primitive.
   */

  const sections = [
    {
      title: t('accSettings.appearance'),
      items: [
        { label: t('accSettings.darkMode'), desc: t('accSettings.darkHint'), action: <ThemeToggle /> },
        {
          label: t('accSettings.navLayout'),
          desc: mode === 'topnav' ? t('accSettings.topNav') : t('accSettings.leftSidebar'),
          action: (
            <div className="flex gap-1 bg-gray-100 rounded-md p-1">
              <button onClick={() => { setMode('topnav'); toast.success(t('accSettings.switchedTop')); }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${mode === 'topnav' ? 'bg-accent text-white shadow-sm' : 'text-content-secondary'}`}>
                <LayoutPanelTop size={11} /> {t('accSettings.top')}
              </button>
              <button onClick={() => { setMode('sidebar'); toast.success(t('accSettings.switchedSidebar')); }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${mode === 'sidebar' ? 'bg-accent text-white shadow-sm' : 'text-content-secondary'}`}>
                <PanelLeft size={11} /> {t('accSettings.sidebar')}
              </button>
            </div>
          )
        },
        {
          label: t('accSettings.accent'),
          desc: t('accSettings.accentHint'),
          action: (
            <div className="flex gap-1.5">
              {ACCENT_OPTIONS.map(c => (
                <button key={c} onClick={() => { setAccentColor(c); toast.success(t('accSettings.accentUpdated')); }}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${accentColor === c ? 'scale-110 border-gray-900 dark:border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          )
        },
        { label: t('accSettings.language'), desc: t('accSettings.languageValue'), action: <ChevronRight size={16} className="text-content-tertiary" /> },
      ]
    },
    {
      title: t('accSettings.notifications'),
      items: [
        { label: t('accSettings.push'), desc: t('accSettings.pushHint'), action: <Switch checked={toggles.pushNotifs} onChange={() => toggle('pushNotifs')} /> },
        { label: t('accSettings.email'), desc: t('accSettings.emailHint'), action: <Switch checked={toggles.emailNotifs} onChange={() => toggle('emailNotifs')} /> },
        { label: t('accSettings.reminders'), desc: t('accSettings.remindersHint'), action: <Switch checked={toggles.workoutReminders} onChange={() => toggle('workoutReminders')} /> },
        { label: t('accSettings.social'), desc: t('accSettings.socialHint'), action: <Switch checked={toggles.socialNotifs} onChange={() => toggle('socialNotifs')} /> },
      ]
    },
    {
      title: t('accSettings.privacy'),
      items: [
        { label: t('accSettings.privateProfile'), desc: t('accSettings.privateHint'), action: <Switch checked={toggles.privateProfile} onChange={() => toggle('privateProfile')} /> },
        { label: t('accSettings.activityVisible'), desc: t('accSettings.activityHint'), action: <Switch checked={toggles.activityVisible} onChange={() => toggle('activityVisible')} /> },
        { label: t('accSettings.dataSharing'), desc: t('accSettings.dataHint'), action: <Switch checked={toggles.dataSharing} onChange={() => toggle('dataSharing')} /> },
      ]
    },
    {
      // Removed fabricated account facts: "Pro Plan · Active" (shown regardless
      // of the real subscription), "Visa ending in 4242" (no payment system
      // exists until Phase 8) and "Two-Factor Auth · Enabled" (2FA is not
      // built — claiming it is enabled is a false security statement).
      // Membership now reads the user's actual status; the rest are hidden
      // until the features exist.
      title: t('accSettings.account'),
      items: [
        {
          label: t('accSettings.membership'),
          desc: user?.is_on_trial
            ? `Free trial · ${user.trial_days_remaining} days left`
            : user?.subscription_status === 'active'
              ? t('accSettings.activeSub')
              : t('accSettings.noSub'),
          href: '/membership',
          action: <ChevronRight size={16} className="text-content-tertiary" />
        },
        { label: t('accSettings.changePassword'), desc: '', href: '/auth/forgot-password', action: <ChevronRight size={16} className="text-content-tertiary" /> },
      ]
    },
  ];

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-6">

        <PageHeader title={t('accSettings.title')} back="/profile" />

        <div className="mb-5 flex items-center justify-between bg-surface-raised rounded-md border border-border-subtle px-4 py-3.5">
          <div>
            <p className="text-sm font-medium text-content-primary">{t('accSettings.accentPreview')}</p>
            <p className="text-xs text-content-tertiary">{t('accSettings.accentAppliedShort')}</p>
          </div>
          <button className="px-4 py-2 rounded-md text-white text-xs font-bold transition-colors" style={{ backgroundColor: 'var(--accent)' }}>
            {t('accSettings.sampleButton')}
          </button>
        </div>

        <div className="space-y-5">
          {sections.map(section => (
            <div key={section.title}>
              <p className="text-xs font-semibold text-content-secondary uppercase tracking-wide mb-2 px-1">{section.title}</p>
              <div className="bg-surface-raised rounded-md border border-border-subtle overflow-hidden divide-y divide-gray-50 dark:divide-white/[0.04]">
                {section.items.map(item => (
                  'href' in item && item.href ? (
                    <Link key={item.label} href={item.href as string}>
                      <div className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer">
                        <div>
                          <div className="text-sm font-medium text-content-primary">{item.label}</div>
                          {item.desc && <div className="text-xs text-content-tertiary">{item.desc}</div>}
                        </div>
                        {item.action}
                      </div>
                    </Link>
                  ) : (
                    <div key={item.label} className="flex items-center justify-between px-4 py-3.5">
                      <div>
                        <div className="text-sm font-medium text-content-primary">{item.label}</div>
                        {item.desc && <div className="text-xs text-content-tertiary">{item.desc}</div>}
                      </div>
                      {item.action}
                    </div>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Danger Zone */}
        <div className="mt-6">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2 px-1">{t('accSettings.dangerZone')}</p>
          <div className="bg-surface-raised rounded-md border border-red-100 dark:border-red-500/10 overflow-hidden divide-y divide-red-50 dark:divide-red-500/[0.04]">
            <button className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors text-left"
              onClick={handleSignOut}>
              <LogOut size={16} className="text-red-500" />
              <span className="text-sm font-medium text-red-600 dark:text-red-400">{t('accSettings.signOut')}</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors text-left">
              <Trash2 size={16} className="text-red-500" />
              <span className="text-sm font-medium text-red-600 dark:text-red-400">{t('accSettings.deleteAccount')}</span>
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-content-tertiary mt-6">
          My EXtreme Trainer v1.0.0 ·{' '}
          <a href="#" className="hover:text-accent">{t('accSettings.privacyPolicy')}</a> ·{' '}
          <a href="#" className="hover:text-accent">{t('accSettings.terms')}</a>
        </p>
        <div className="h-24" />
      </div>
    </>
  );
}
