'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { ChevronLeft, Trophy, Lock, Share2, Star, Check, Download } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

type Achievement = {
  id: string;
  icon: string;
  title: string;
  description: string;
  date: string;
  earned: boolean;
  poster: string;
  color: string;
  progress?: number;
  progressLabel?: string;
};

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'a1', icon: '⚖️', title: 'Lost First 5 Pounds', earned: true,
    description: 'Hit your first major weight loss milestone — 5 lbs gone!',
    date: 'May 12, 2026', color: '#F87404',
    poster: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=500&fit=crop',
  },
  {
    id: 'a2', icon: '🔥', title: '7-Day Workout Streak', earned: true,
    description: 'Worked out every single day for a full week. Unstoppable!',
    date: 'May 20, 2026', color: '#FF0404',
    poster: 'https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?w=400&h=500&fit=crop',
  },
  {
    id: 'a3', icon: '🎯', title: 'Calorie Goal — 5 Days Straight', earned: true,
    description: 'Hit your daily calorie target 5 days in a row. Discipline wins!',
    date: 'June 2, 2026', color: '#004AAD',
    poster: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&h=500&fit=crop',
  },
  {
    id: 'a4', icon: '💪', title: 'Personal Record: Bench Press', earned: true,
    description: 'Crushed a new personal best on bench press. New PR set!',
    date: 'June 10, 2026', color: '#7C3AED',
    poster: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=500&fit=crop',
  },
  {
    id: 'a5', icon: '💧', title: 'Hydration Hero', earned: false,
    description: 'Drink 8 glasses of water every day for 7 days straight.',
    color: '#06B6D4', progress: 3, progressLabel: '3 / 7 days',
    poster: '', date: '',
  },
  {
    id: 'a6', icon: '🏃', title: '30-Day Streak', earned: false,
    description: 'Log a workout every day for 30 consecutive days.',
    color: '#10B981', progress: 7, progressLabel: '7 / 30 days',
    poster: '', date: '',
  },
  {
    id: 'a7', icon: '🥗', title: 'Clean Eating Week', earned: false,
    description: 'Score 90+ on your nutrition every day for 7 days.',
    color: '#F87404', progress: 2, progressLabel: '2 / 7 days',
    poster: '', date: '',
  },
];

export default function AchievementsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [sharedToast, setSharedToast] = useState(false);

  const earned  = ACHIEVEMENTS.filter(a => a.earned);
  const pending = ACHIEVEMENTS.filter(a => !a.earned);
  const selectedAch = ACHIEVEMENTS.find(a => a.id === selected);

  const handleShare = (ach: Achievement, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelected(null);
    setSharedToast(true);
    setTimeout(() => setSharedToast(false), 3000);
    toast.success(`"${ach.title}" shared to your feed!`);
  };

  const handleDownload = (ach: Achievement, e?: React.MouseEvent) => {
    e?.stopPropagation();
    toast.success(`Downloading "${ach.title}" poster…`);
  };

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto px-4 py-6 pb-24">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/ai-trainer">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#FFC000]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Achievements</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{earned.length}/{ACHIEVEMENTS.length} earned · Keep pushing!</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Earned',      val: earned.length,       icon: Trophy, color: '#FFC000' },
            { label: 'In Progress', val: pending.length,      icon: Star,   color: '#F87404' },
            { label: 'Total',       val: ACHIEVEMENTS.length, icon: Trophy, color: '#004AAD' },
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

        {/* Earned */}
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Trophy size={16} className="text-[#FFC000]" /> Earned ({earned.length})
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
                <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${ach.color}, #111)` }} />
              )}
              <div className="absolute inset-0 flex flex-col justify-end p-4">
                <div className="text-3xl mb-1">{ach.icon}</div>
                <div className="font-semibold text-white text-sm leading-snug">{ach.title}</div>
                <div className="text-white/70 text-xs mt-0.5">{ach.date}</div>
              </div>
              {/* Hover actions */}
              <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => handleShare(ach, e)}
                  className="w-8 h-8 rounded-full bg-[#F87404] flex items-center justify-center shadow-lg hover:bg-[#FF5C04] transition-colors"
                  title="Share to feed">
                  <Share2 size={13} className="text-white" />
                </button>
                <button onClick={e => handleDownload(ach, e)}
                  className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                  title="Download poster">
                  <Download size={13} className="text-gray-900" />
                </button>
              </div>
            </button>
          ))}
        </div>

        {/* In Progress */}
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Lock size={16} className="text-gray-400" /> In Progress ({pending.length})
        </h3>
        <div className="space-y-3">
          {pending.map(ach => (
            <div key={ach.id} className="flex items-center gap-4 p-4 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07]">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-2xl grayscale shrink-0">{ach.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-white text-sm">{ach.title}</div>
                <div className="text-xs text-gray-400 mt-0.5 mb-2">{ach.description}</div>
                {ach.progress !== undefined && (
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                      <span>Progress</span>
                      <span style={{ color: ach.color }}>{ach.progressLabel}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(ach.progress! / parseInt(ach.progressLabel!.split('/')[1])) * 100}%`, backgroundColor: ach.color }} />
                    </div>
                  </div>
                )}
              </div>
              <Lock size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />
            </div>
          ))}
        </div>

        {/* Detail Modal */}
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
                {selectedAch.date && <p className="text-xs font-medium mb-5" style={{ color: selectedAch.color }}>Earned {selectedAch.date}</p>}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setSelected(null)}
                    className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    Close
                  </button>
                  <button onClick={() => handleDownload(selectedAch)}
                    className="py-3 px-4 rounded-2xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5">
                    <Download size={15} /> Save
                  </button>
                  <button onClick={() => handleShare(selectedAch)}
                    className="flex-1 py-3 rounded-2xl bg-[#F87404] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#FF5C04] transition-colors shadow-sm">
                    <Share2 size={15} /> Share
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Share toast */}
        {sharedToast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium whitespace-nowrap">
            <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center shrink-0">
              <Check size={12} className="text-white" />
            </div>
            Achievement shared to your feed!
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
