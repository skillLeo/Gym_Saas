'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ChevronLeft, Sparkles, Activity, TrendingDown, Scale, Camera, Info } from 'lucide-react';
import Link from 'next/link';
import { mockBodyStats } from '@/lib/mockData';

const bodyParts = [
  { id: 'chest', label: 'Chest', progress: 72, color: '#F87404', position: { top: '22%', left: '50%' } },
  { id: 'abs', label: 'Core', progress: 55, color: '#FF5C04', position: { top: '38%', left: '50%' } },
  { id: 'arms', label: 'Arms', progress: 80, color: '#004AAD', position: { top: '30%', left: '32%' } },
  { id: 'legs', label: 'Legs', progress: 60, color: '#7C3AED', position: { top: '62%', left: '50%' } },
  { id: 'back', label: 'Back', progress: 68, color: '#10B981', position: { top: '28%', left: '68%' } },
];

const latest = mockBodyStats[mockBodyStats.length - 1];
const prev = mockBodyStats[0];

export default function BodyVisualizerPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'front' | 'back'>('front');

  const selectedPart = bodyParts.find(b => b.id === selected);

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/ai-trainer">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Body Visualizer</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">AI-powered body composition tracker</p>
          </div>
        </div>

        {/* AI Info Banner */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-[#F87404]/10 to-[#004AAD]/10 border border-[#F87404]/20 rounded-2xl p-4 mb-5">
          <Sparkles size={18} className="text-[#F87404] shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white">AI Body Analysis</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Based on your logged workouts and body stats. Tap muscle groups for details.</div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex bg-gray-100 dark:bg-white/[0.07] p-1 rounded-xl mb-5">
          {(['front', 'back'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${view === v ? 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>
              {v}
            </button>
          ))}
        </div>

        {/* Body Silhouette */}
        <Card className="mb-5">
          <div className="p-5">
            <div className="relative h-80 flex items-center justify-center">
              {/* Silhouette SVG placeholder */}
              <div className="relative w-36 h-72">
                <svg viewBox="0 0 100 250" className="w-full h-full" fill="none">
                  {/* Head */}
                  <ellipse cx="50" cy="20" rx="15" ry="18" fill="#e5e7eb" className="dark:fill-white/20" />
                  {/* Torso */}
                  <path d="M30 38 Q20 55 22 90 L40 90 L40 55 L60 55 L60 90 L78 90 Q80 55 70 38 Z" fill="#d1d5db" className="dark:fill-white/15" />
                  {/* Arms */}
                  <path d="M22 42 L10 85 L18 87 L28 52 Z" fill="#d1d5db" className="dark:fill-white/15" />
                  <path d="M78 42 L90 85 L82 87 L72 52 Z" fill="#d1d5db" className="dark:fill-white/15" />
                  {/* Legs */}
                  <path d="M38 90 L34 155 L44 155 L50 110 L56 155 L66 155 L62 90 Z" fill="#d1d5db" className="dark:fill-white/15" />
                  {/* Lower legs */}
                  <path d="M34 155 L32 220 L42 220 L44 155 Z" fill="#e5e7eb" className="dark:fill-white/20" />
                  <path d="M56 155 L58 220 L68 220 L66 155 Z" fill="#e5e7eb" className="dark:fill-white/20" />
                </svg>

                {/* Muscle group hotspots */}
                {bodyParts.map(part => (
                  <button key={part.id} onClick={() => setSelected(selected === part.id ? null : part.id)}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all"
                    style={{ top: part.position.top, left: part.position.left }}>
                    <div className={`relative flex items-center justify-center transition-all ${selected === part.id ? 'scale-125' : 'hover:scale-110'}`}>
                      <div className="w-7 h-7 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: part.color }}>
                        {Math.round(part.progress)}
                      </div>
                      <div className="absolute -inset-1 rounded-full opacity-30 animate-ping" style={{ backgroundColor: part.color }} />
                    </div>
                  </button>
                ))}
              </div>

              {/* Legend */}
              <div className="absolute right-0 top-0 space-y-2">
                {bodyParts.map(part => (
                  <div key={part.id} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: part.color }} />
                    <span className="text-gray-600 dark:text-gray-400">{part.label}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{part.progress}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Part Detail */}
            {selectedPart && (
              <div className="mt-4 p-4 rounded-2xl border-2 transition-all" style={{ borderColor: selectedPart.color + '40', backgroundColor: selectedPart.color + '0C' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900 dark:text-white">{selectedPart.label} Development</span>
                  <span className="font-bold text-sm" style={{ color: selectedPart.color }}>{selectedPart.progress}%</span>
                </div>
                <ProgressBar value={selectedPart.progress} max={100} color={selectedPart.color} height={6} />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Keep working on {selectedPart.label.toLowerCase()} exercises to reach your goal. You&apos;re making great progress!
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Card padding="sm">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Scale size={15} className="text-[#F87404]" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Current Weight</span>
              </div>
              <div className="font-display text-3xl font-bold text-gray-900 dark:text-white">{latest.weight}</div>
              <div className="text-xs text-gray-400">lbs</div>
              <div className="text-xs text-green-500 mt-1 flex items-center gap-1">
                <TrendingDown size={11} />
                {(prev.weight - latest.weight).toFixed(1)} lbs lost
              </div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={15} className="text-[#7C3AED]" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Body Fat</span>
              </div>
              <div className="font-display text-3xl font-bold text-gray-900 dark:text-white">{latest.bodyFat}%</div>
              <div className="text-xs text-gray-400">body fat</div>
              <div className="text-xs text-green-500 mt-1 flex items-center gap-1">
                <TrendingDown size={11} />
                {(prev.bodyFat - latest.bodyFat).toFixed(1)}% reduced
              </div>
            </div>
          </Card>
        </div>

        {/* Progress Photo CTA */}
        <div className="flex items-center gap-4 bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] rounded-2xl p-4 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#F87404]/10 flex items-center justify-center shrink-0">
            <Camera size={20} className="text-[#F87404]" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-900 dark:text-white text-sm">Add Progress Photo</div>
            <div className="text-xs text-gray-400">Compare your visual transformation over time</div>
          </div>
          <Button size="sm">Upload</Button>
        </div>

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
