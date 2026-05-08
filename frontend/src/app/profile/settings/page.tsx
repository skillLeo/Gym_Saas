'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ChevronLeft, ChevronRight, Bell, Lock, Eye, Moon, Globe, Trash2, LogOut, Shield, CreditCard, PanelLeft, LayoutPanelTop } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLayoutStore } from '@/store/layoutStore';
import toast from 'react-hot-toast';

type ToggleState = { [key: string]: boolean };

export default function SettingsPage() {
  const router = useRouter();
  const [toggles, setToggles] = useState<ToggleState>({
    pushNotifs: true,
    emailNotifs: true,
    workoutReminders: true,
    socialNotifs: true,
    privateProfile: false,
    activityVisible: true,
    dataSharing: false,
  });

  const toggle = (key: string) => setToggles(t => ({ ...t, [key]: !t[key] }));
  const { mode, setMode } = useLayoutStore();

  const Toggle = ({ id }: { id: string }) => (
    <button onClick={() => toggle(id)}
      className={`relative w-11 h-6 rounded-full transition-all ${toggles[id] ? 'bg-[#F87404]' : 'bg-gray-300 dark:bg-gray-600'}`}>
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${toggles[id] ? 'left-5' : 'left-0.5'}`} />
    </button>
  );

  const sections = [
    {
      title: 'Appearance',
      items: [
        { label: 'Dark Mode', desc: 'Toggle dark/light theme', action: <ThemeToggle /> },
        {
          label: 'Navigation Layout',
          desc: mode === 'topnav' ? 'Top navigation bar' : 'Left sidebar',
          action: (
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              <button onClick={() => { setMode('topnav'); toast.success('Switched to Top Nav'); }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${mode === 'topnav' ? 'bg-[#F87404] text-white shadow-sm' : 'text-gray-500'}`}>
                <LayoutPanelTop size={11} /> Top
              </button>
              <button onClick={() => { setMode('sidebar'); toast.success('Switched to Sidebar'); }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${mode === 'sidebar' ? 'bg-[#F87404] text-white shadow-sm' : 'text-gray-500'}`}>
                <PanelLeft size={11} /> Sidebar
              </button>
            </div>
          )
        },
        { label: 'Language', desc: 'English (US)', action: <ChevronRight size={16} className="text-gray-400" /> },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { label: 'Push Notifications', desc: 'Workout reminders & updates', action: <Toggle id="pushNotifs" /> },
        { label: 'Email Notifications', desc: 'Weekly progress reports', action: <Toggle id="emailNotifs" /> },
        { label: 'Workout Reminders', desc: 'Daily workout alerts', action: <Toggle id="workoutReminders" /> },
        { label: 'Social Notifications', desc: 'Likes, comments, follows', action: <Toggle id="socialNotifs" /> },
      ],
    },
    {
      title: 'Privacy',
      items: [
        { label: 'Private Profile', desc: 'Only followers can see your content', action: <Toggle id="privateProfile" /> },
        { label: 'Activity Visible', desc: 'Show your workout activity', action: <Toggle id="activityVisible" /> },
        { label: 'Data Sharing', desc: 'Share anonymous data for research', action: <Toggle id="dataSharing" /> },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Membership', desc: 'Pro Plan · Active', href: '/membership', action: <ChevronRight size={16} className="text-gray-400" /> },
        { label: 'Payment Methods', desc: 'Visa ending in 4242', href: '#', action: <ChevronRight size={16} className="text-gray-400" /> },
        { label: 'Change Password', desc: '', href: '#', action: <ChevronRight size={16} className="text-gray-400" /> },
        { label: 'Two-Factor Auth', desc: 'Enabled', href: '#', action: <ChevronRight size={16} className="text-gray-400" /> },
      ],
    },
  ];

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/profile">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>

        <div className="space-y-5">
          {sections.map(section => (
            <div key={section.title}>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1">{section.title}</p>
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] overflow-hidden divide-y divide-gray-50 dark:divide-white/[0.04]">
                {section.items.map(item => (
                  'href' in item && item.href ? (
                    <Link key={item.label} href={item.href as string}>
                      <div className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</div>
                          {item.desc && <div className="text-xs text-gray-400">{item.desc}</div>}
                        </div>
                        {item.action}
                      </div>
                    </Link>
                  ) : (
                    <div key={item.label} className="flex items-center justify-between px-4 py-3.5">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</div>
                        {item.desc && <div className="text-xs text-gray-400">{item.desc}</div>}
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
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2 px-1">Danger Zone</p>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-red-100 dark:border-red-500/10 overflow-hidden divide-y divide-red-50 dark:divide-red-500/[0.04]">
            <button className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors text-left"
              onClick={() => router.push('/auth/login')}>
              <LogOut size={16} className="text-red-500" />
              <span className="text-sm font-medium text-red-600 dark:text-red-400">Sign Out</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors text-left">
              <Trash2 size={16} className="text-red-500" />
              <span className="text-sm font-medium text-red-600 dark:text-red-400">Delete Account</span>
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          My EXtreme Trainer v1.0.0 ·{' '}
          <a href="#" className="hover:text-[#F87404]">Privacy Policy</a> ·{' '}
          <a href="#" className="hover:text-[#F87404]">Terms of Service</a>
        </p>
        <div className="h-24" />
      </div>
    </DashboardShell>
  );
}
