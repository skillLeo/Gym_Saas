'use client';

import { useState, useRef } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { ChevronLeft, Sparkles, Upload, Camera, Ruler, Target, Wand2, CheckCircle, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const inputCls = "w-full bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-[#F87404] focus:ring-2 focus:ring-[#F87404]/15 transition-all";

const BEFORE_IMG = 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=500&fit=crop&crop=face';
const AFTER_IMG  = 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&h=500&fit=crop&crop=face';

type PhotoSlot = 'before' | 'after';

export default function BodyVisualizerPage() {
  const [photos, setPhotos] = useState<Record<PhotoSlot, string | null>>({ before: null, after: null });
  const [current, setCurrent] = useState({ weight: '185', bodyFat: '22', chest: '42', waist: '34', hips: '40', arms: '14', thighs: '24' });
  const [goal,    setGoal]    = useState({ weight: '170', bodyFat: '15', chest: '44', waist: '30', hips: '38', arms: '16', thighs: '22' });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadSlot, setUploadSlot] = useState<PhotoSlot>('before');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotos(p => ({ ...p, [uploadSlot]: URL.createObjectURL(file) }));
  };

  const openUpload = (slot: PhotoSlot) => { setUploadSlot(slot); fileRef.current?.click(); };

  const generate = async () => {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 2200));
    setGenerating(false);
    setResult(true);
    toast.success('Visualization generated!');
  };

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto px-4 py-6 pb-24">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/ai-trainer">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Body Visualizer</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">See your transformation before it happens</p>
          </div>
        </div>

        {/* AI Banner */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-[#F87404]/10 to-[#004AAD]/10 border border-[#F87404]/20 rounded-2xl p-4 mb-5">
          <Sparkles size={18} className="text-[#F87404] shrink-0" />
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">AI-Powered Transformation Preview</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Upload photos + enter your stats to generate a realistic before/after visualization</div>
          </div>
        </div>

        {/* Photo Upload */}
        <Card className="mb-5">
          <div className="p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-4 flex items-center gap-2">
              <Camera size={15} className="text-[#F87404]" /> Progress Photos
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {(['before', 'after'] as const).map(slot => (
                <div key={slot}>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize mb-2">{slot} Photo</p>
                  {photos[slot] ? (
                    <div className="relative rounded-2xl overflow-hidden aspect-[3/4]">
                      <img src={photos[slot]!} alt={slot} className="w-full h-full object-cover" />
                      <button onClick={() => setPhotos(p => ({ ...p, [slot]: null }))}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => openUpload(slot)}
                      className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/[0.07] flex flex-col items-center justify-center gap-2 hover:border-[#F87404] hover:bg-[#F87404]/5 transition-all">
                      <Upload size={22} className="text-gray-300 dark:text-gray-600" />
                      <span className="text-xs text-gray-400 font-medium">Upload Photo</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
        </Card>

        {/* Current Stats */}
        <Card className="mb-5">
          <div className="p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-4 flex items-center gap-2">
              <Ruler size={15} className="text-[#004AAD]" /> Current Stats
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'weight', label: 'Weight (lbs)' },
                { key: 'bodyFat', label: 'Body Fat (%)' },
                { key: 'chest', label: 'Chest (in)' },
                { key: 'waist', label: 'Waist (in)' },
                { key: 'hips', label: 'Hips (in)' },
                { key: 'arms', label: 'Arms (in)' },
                { key: 'thighs', label: 'Thighs (in)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
                  <input className={inputCls} type="number" value={current[key as keyof typeof current]}
                    onChange={e => setCurrent(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Goal Stats */}
        <Card className="mb-5">
          <div className="p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-4 flex items-center gap-2">
              <Target size={15} className="text-[#10B981]" /> Goal Stats
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'weight', label: 'Goal Weight (lbs)' },
                { key: 'bodyFat', label: 'Goal Body Fat (%)' },
                { key: 'chest', label: 'Goal Chest (in)' },
                { key: 'waist', label: 'Goal Waist (in)' },
                { key: 'hips', label: 'Goal Hips (in)' },
                { key: 'arms', label: 'Goal Arms (in)' },
                { key: 'thighs', label: 'Goal Thighs (in)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
                  <input className={inputCls} type="number" value={goal[key as keyof typeof goal]}
                    onChange={e => setGoal(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Changes summary */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Weight Loss', val: `${parseInt(current.weight) - parseInt(goal.weight)} lbs`, color: '#F87404' },
            { label: 'Fat Reduction', val: `${parseFloat(current.bodyFat) - parseFloat(goal.bodyFat)}%`, color: '#004AAD' },
            { label: 'Waist Loss', val: `${parseInt(current.waist) - parseInt(goal.waist)} in`, color: '#10B981' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] p-3 text-center">
              <div className="font-bold text-lg" style={{ color }}>{val}</div>
              <div className="text-xs text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Generate Button */}
        <button
          onClick={generate}
          disabled={generating}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-[#F87404] to-[#FF5C04] text-white font-bold text-base shadow-xl shadow-[#F87404]/30 hover:shadow-[#F87404]/50 transition-all active:scale-[0.98] disabled:opacity-70 mb-5"
        >
          {generating ? (
            <>
              <div className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              Generating Visualization…
            </>
          ) : (
            <>
              <Wand2 size={20} /> Generate AI Visualization
            </>
          )}
        </button>

        {/* Result */}
        {result && (
          <Card className="overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-white/[0.07] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-[#10B981]" />
                <span className="font-semibold text-gray-900 dark:text-white text-sm">Your Transformation Preview</span>
              </div>
              <span className="text-xs bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full font-semibold">AI Generated</span>
            </div>
            <div className="grid grid-cols-2">
              {[
                { label: 'NOW', img: BEFORE_IMG, color: '#F87404' },
                { label: 'GOAL', img: AFTER_IMG,  color: '#10B981' },
              ].map(({ label, img, color }) => (
                <div key={label} className="relative">
                  <img src={img} alt={label} className="w-full aspect-[3/4] object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <span className="text-xs font-bold tracking-widest px-3 py-1 rounded-full text-white" style={{ backgroundColor: color }}>
                      {label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                This is an AI-estimated visualization based on your stats. Actual results depend on consistency and effort.
              </p>
              <button
                onClick={() => { toast.success('Visualization saved to your profile!'); }}
                className="w-full mt-3 py-2.5 rounded-xl border-2 border-[#F87404] text-[#F87404] text-sm font-semibold hover:bg-[#F87404]/10 transition-all"
              >
                Save to Profile
              </button>
            </div>
          </Card>
        )}

      </div>
    </DashboardShell>
  );
}
