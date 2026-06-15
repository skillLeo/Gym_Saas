'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useLayoutStore } from '@/store/layoutStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LogOut, Bell, Scale, Globe, PanelLeft, LayoutPanelTop } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();

  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');

  useEffect(() => {
    const stored = localStorage.getItem('units_system') as 'metric' | 'imperial' | null;
    if (stored === 'metric' || stored === 'imperial') setUnits(stored);
  }, []);
  const [notifications, setNotifications] = useState(true);
  const [saving, setSaving] = useState(false);
  const { mode, setMode } = useLayoutStore();

  const handleUnitChange = (u: 'metric' | 'imperial') => {
    setUnits(u);
    localStorage.setItem('units_system', u);
    toast.success(`Switched to ${u === 'metric' ? 'Metric (kg, cm)' : 'Imperial (lbs, ft)'}`);
  };

  const handleLogout = () => {
    document.cookie = 'auth_token=; path=/; max-age=0';
    logout();
    router.replace('/auth/login');
    toast.success('Signed out successfully.');
  };

  const handleDeleteAccount = () => {
    toast('Contact support to delete your account.', { icon: 'ℹ️' });
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      {/* Preferences */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Preferences</h3>
        <div className="space-y-5">

          {/* Units */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#F87404]/10 flex items-center justify-center">
                <Scale size={15} className="text-[#F87404]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Units System</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Metric (kg, cm) or Imperial (lbs, ft)</p>
              </div>
            </div>
            <div className="flex gap-1 bg-gray-100 dark:bg-white/10 rounded-xl p-1">
              <button
                onClick={() => handleUnitChange('metric')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${units === 'metric' ? 'bg-[#F87404] text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                Metric
              </button>
              <button
                onClick={() => handleUnitChange('imperial')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${units === 'imperial' ? 'bg-[#F87404] text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                Imperial
              </button>
            </div>
          </div>

          {/* Layout preference */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#F87404]/10 flex items-center justify-center">
                <PanelLeft size={15} className="text-[#F87404]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Navigation Layout</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Top bar or left sidebar</p>
              </div>
            </div>
            <div className="flex gap-1 bg-gray-100 dark:bg-white/10 rounded-xl p-1">
              <button
                onClick={() => { setMode('topnav'); toast.success('Switched to Top Navigation'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === 'topnav' ? 'bg-[#F87404] text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                <LayoutPanelTop size={12} /> Top Nav
              </button>
              <button
                onClick={() => { setMode('sidebar'); toast.success('Switched to Sidebar'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === 'sidebar' ? 'bg-[#F87404] text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                <PanelLeft size={12} /> Sidebar
              </button>
            </div>
          </div>

          {/* Email notifications */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#F87404]/10 flex items-center justify-center">
                <Bell size={15} className="text-[#F87404]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Email Notifications</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Trial reminders and platform updates</p>
              </div>
            </div>
            <button
              onClick={() => setNotifications(v => !v)}
              className={`w-11 h-6 rounded-full relative transition-all duration-200 ${notifications ? 'bg-[#F87404]' : 'bg-gray-200 dark:bg-white/20'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${notifications ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#F87404]/10 flex items-center justify-center">
                <Globe size={15} className="text-[#F87404]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Language</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">App display language</p>
              </div>
            </div>
            <select className="text-sm border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-gray-900 dark:text-gray-100 outline-none focus:border-[#F87404] bg-white dark:bg-gray-800">
              <option>English</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Account info */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Account</h3>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Name</span>
            <span className="text-gray-900 dark:text-white font-medium">{user?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Email</span>
            <span className="text-gray-900 dark:text-white font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Subscription</span>
            <span className="text-gray-900 dark:text-white font-medium capitalize">{user?.subscription_status ?? 'trial'}</span>
          </div>
          {user?.is_on_trial && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Trial ends</span>
              <span className="text-[#F87404] font-medium">{user.trial_days_remaining} days left</span>
            </div>
          )}
        </div>
      </Card>

      {/* Danger zone */}
      <Card>
        <h3 className="text-sm font-semibold text-red-500 mb-3">Danger Zone</h3>
        <div className="space-y-3">
          <Button variant="danger" onClick={handleLogout} className="w-full" icon={<LogOut size={15} />}>
            Sign Out of All Devices
          </Button>
          <button onClick={handleDeleteAccount} className="w-full py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors border border-gray-200 dark:border-white/10 rounded-xl">
            Request Account Deletion
          </button>
        </div>
      </Card>
    </div>
  );
}
