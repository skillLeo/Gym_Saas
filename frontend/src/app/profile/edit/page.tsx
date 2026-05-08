'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Camera, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mockMembers } from '@/lib/mockData';

const me = mockMembers[0];

export default function EditProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: me.name, username: me.username, bio: me.bio,
    goal: me.goal, email: 'kelvin@teamextreme.com',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => router.push('/profile'), 1200);
  };

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/profile">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Edit Profile</h1>
        </div>

        {saved && (
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl p-4 mb-5">
            <CheckCircle size={16} className="text-green-500" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">Profile saved!</span>
          </div>
        )}

        {/* Cover + Avatar */}
        <div className="relative mb-6">
          <div className="h-32 rounded-2xl overflow-hidden relative">
            <img src={me.coverPhoto} alt="Cover" className="w-full h-full object-cover" />
            <button className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Camera size={20} className="text-white" />
            </button>
          </div>
          <div className="absolute bottom-0 left-4 transform translate-y-1/2">
            <div className="relative">
              <img src={me.avatar} alt={me.name} className="w-16 h-16 rounded-full border-3 border-white dark:border-[#0d0d0d] object-cover" />
              <button className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Camera size={14} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-4">
          {[
            { key: 'displayName', label: 'Display Name', placeholder: 'Your name' },
            { key: 'username', label: 'Username', placeholder: 'username', prefix: '@' },
            { key: 'email', label: 'Email Address', placeholder: 'email@example.com', type: 'email' },
          ].map(({ key, label, placeholder, prefix, type }) => (
            <div key={key}>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">{label}</label>
              <div className="relative">
                {prefix && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
                <input
                  type={type || 'text'}
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className={`w-full ${prefix ? 'pl-7' : 'pl-4'} pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50`}
                />
              </div>
            </div>
          ))}

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Bio</label>
            <textarea rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="Tell the community about yourself..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 resize-none" />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Primary Goal</label>
            <div className="grid grid-cols-3 gap-2">
              {['Lose Weight', 'Build Muscle', 'Improve Stamina', 'Eat Healthier', 'Hit a Goal', 'General Fitness'].map(g => (
                <button key={g} onClick={() => setForm(f => ({ ...f, goal: g }))}
                  className={`py-2.5 rounded-xl text-xs font-medium text-center transition-all ${form.goal === g ? 'bg-[#F87404] text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/profile" className="flex-1">
              <Button variant="ghost" fullWidth>Cancel</Button>
            </Link>
            <Button fullWidth loading={saving} onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
