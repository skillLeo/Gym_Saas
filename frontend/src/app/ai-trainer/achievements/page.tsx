'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { mockAchievements } from '@/lib/mockData';
import { ChevronLeft, Trophy, Lock, Share2, Star, Check } from 'lucide-react';
import Link from 'next/link';
import { useSocialStore } from '@/store/socialStore';

type Achievement = (typeof mockAchievements)[number];

export default function AchievementsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const { shareAchievement } = useSocialStore();

  const earned = mockAchievements.filter(a => a.earned);
  const pending = mockAchievements.filter(a => !a.earned);
  const selectedAch = mockAchievements.find(a => a.id === selected);

  const handleShare = (ach: Achievement, e?: MouseEvent) => {
    e?.stopPropagation();
    shareAchievement({ id: ach.id, title: ach.title, icon: ach.icon, description: ach.description, poster: ach.poster ?? null });
    setSelected(null);
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  };

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/ai-trainer">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#FFC000]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Achievements</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{earned.length}/{mockAchievements.length} earned</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Earned', val: earned.length, icon: Trophy, color: '#FFC000' },
            { label: 'In Progress', val: pending.length, icon: Star, color: '#F87404' },
            { label: 'Total', val: mockAchievements.length, icon: Trophy, color: '#004AAD' },
          ].map(({ label, val, icon: Icon, color }) => (
            <Card key={label} padding="sm">
              <div className="p-4 text-center">
                <Icon size={18} className="mx-auto mb-1" style={{ color }} />
                <div className="font-display font-bold text-gray-900 dark:text-white text-xl">{val}</div>
                <div className="text-xs text-gray-400">{label}</div>
              </div>
            </Card>
          ))}
        </div>

        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Trophy size={16} className="text-[#FFC000]" /> Earned
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {earned.map(ach => (
            <button key={ach.id} onClick={() => setSelected(ach.id)}
              className="relative overflow-hidden rounded-3xl aspect-[3/4] group hover:scale-[1.02] transition-transform">
              {ach.poster ? (
                <>
                  <img src={ach.poster} alt={ach.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#FFC000] to-[#F87404]" />
              )}
              <div className="absolute inset-0 flex flex-col justify-end p-4">
                <div className="text-3xl mb-1">{ach.icon}</div>
                <div className="font-semibold text-white text-sm leading-snug">{ach.title}</div>
                <div className="text-white/70 text-xs mt-0.5">{ach.date}</div>
              </div>
              <div role="button" onClick={e => handleShare(ach, e)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[#F87404] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                <Share2 size={13} className="text-white" />
              </div>
            </button>
          ))}
        </div>

        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Lock size={16} className="text-gray-400" /> In Progress
        </h3>
        <div className="space-y-3">
          {pending.map(ach => (
            <div key={ach.id} className="flex items-center gap-4 p-4 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] opacity-70">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-2xl grayscale">{ach.icon}</div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900 dark:text-white text-sm">{ach.title}</div>
                <div className="text-xs text-gray-400">{ach.description}</div>
              </div>
              <Lock size={16} className="text-gray-400 shrink-0" />
            </div>
          ))}
        </div>

        {selectedAch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
            <div className="relative w-full max-w-sm bg-white dark:bg-[#1a1a1a] rounded-3xl overflow-hidden shadow-2xl z-10">
              {selectedAch.poster && (
                <div className="relative h-56 overflow-hidden">
                  <img src={selectedAch.poster} alt={selectedAch.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/90 dark:to-[#1a1a1a]/90" />
                </div>
              )}
              <div className="p-6 text-center">
                <div className="text-5xl mb-3">{selectedAch.icon}</div>
                <h3 className="font-display text-2xl font-bold text-gray-900 dark:text-white mb-1">{selectedAch.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">{selectedAch.description}</p>
                {selectedAch.date && <p className="text-xs text-[#FFC000] font-medium">Earned {selectedAch.date}</p>}
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setSelected(null)} className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    Close
                  </button>
                  <button onClick={() => handleShare(selectedAch)} className="flex-1 py-3 rounded-2xl bg-[#F87404] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#FF5C04] transition-colors shadow-sm">
                    <Share2 size={15} /> Share to Feed
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium whitespace-nowrap">
            <div className="w-5 h-5 rounded-full bg-green-400 dark:bg-green-500 flex items-center justify-center shrink-0">
              <Check size={12} className="text-white" />
            </div>
            Achievement shared to your feed!
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
