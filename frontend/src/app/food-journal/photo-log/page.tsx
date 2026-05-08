'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Camera, ImageIcon, Sparkles, Plus, CheckCircle, Edit3, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const mockPhotoResult = {
  detectedMeal: 'Grilled Chicken & Vegetables',
  confidence: 94,
  image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&h=400&fit=crop',
  items: [
    { name: 'Grilled Chicken Breast', calories: 220, protein: 42, carbs: 0, fat: 5, portion: '5 oz' },
    { name: 'Roasted Broccoli', calories: 55, protein: 4, carbs: 11, fat: 1, portion: '1 cup' },
    { name: 'Sweet Potato', calories: 103, protein: 2, carbs: 24, fat: 0, portion: 'medium' },
  ],
};

const recentPhotos = [
  { image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=200&fit=crop', meal: 'Lunch', calories: 485, items: 4, time: '12:30 PM' },
  { image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=200&h=200&fit=crop', meal: 'Breakfast', calories: 320, items: 3, time: '7:15 AM' },
  { image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=200&h=200&fit=crop', meal: 'Dinner', calories: 620, items: 5, time: 'Yesterday' },
];

export default function PhotoLogPage() {
  const [step, setStep] = useState<'capture' | 'analyzing' | 'result'>('capture');
  const [selectedMeal, setSelectedMeal] = useState('lunch');
  const [added, setAdded] = useState(false);

  const handleCapture = () => {
    setStep('analyzing');
    setTimeout(() => setStep('result'), 3000);
  };

  const handleAdd = () => {
    setAdded(true);
    setTimeout(() => { setAdded(false); setStep('capture'); }, 2000);
  };

  const totalCals = mockPhotoResult.items.reduce((s, i) => s + i.calories, 0);
  const totalProtein = mockPhotoResult.items.reduce((s, i) => s + i.protein, 0);
  const totalCarbs = mockPhotoResult.items.reduce((s, i) => s + i.carbs, 0);
  const totalFat = mockPhotoResult.items.reduce((s, i) => s + i.fat, 0);

  return (
    <DashboardShell>
      <div className="max-w-md mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/food-journal">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#004AAD]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Photo Log</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">AI identifies your meal from a photo</p>
          </div>
        </div>

        {/* AI Badge */}
        <div className="flex items-center gap-2 bg-gradient-to-r from-[#004AAD]/10 to-[#F87404]/10 border border-[#004AAD]/20 rounded-2xl p-4 mb-5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#004AAD] to-[#F87404] flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">AI-Powered Recognition</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Snap a photo and our AI estimates calories and macros automatically</div>
          </div>
        </div>

        {step === 'capture' && (
          <>
            {/* Camera Preview */}
            <div className="relative rounded-3xl overflow-hidden mb-5 bg-gray-900 aspect-square">
              <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&h=500&fit=crop"
                alt="Camera preview" className="w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/60 cursor-pointer hover:bg-white/30 transition-all" onClick={handleCapture}>
                  <Camera size={28} className="text-white" />
                </div>
                <p className="text-white/80 text-sm">Tap to capture your meal</p>
              </div>
              {/* Grid overlay */}
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                backgroundSize: '33.33% 33.33%'
              }} />
            </div>

            <div className="flex gap-3 mb-6">
              <Button onClick={handleCapture} fullWidth size="lg" icon={<Camera size={18} />}>
                Take Photo
              </Button>
              <Button variant="outline" size="lg" icon={<ImageIcon size={18} />}>
                Gallery
              </Button>
            </div>
          </>
        )}

        {step === 'analyzing' && (
          <div className="rounded-3xl overflow-hidden mb-5 bg-gray-900 aspect-square relative">
            <img src={mockPhotoResult.image} alt="Analyzing" className="w-full h-full object-cover opacity-50" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative w-20 h-20 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-[#F87404]/30 animate-ping" />
                <div className="absolute inset-0 rounded-full border-4 border-[#F87404]/60 border-t-[#F87404] animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles size={24} className="text-[#F87404]" />
                </div>
              </div>
              <p className="text-white font-semibold text-lg">Analyzing your meal...</p>
              <p className="text-white/60 text-sm mt-1">AI is identifying food items</p>
              <div className="flex gap-1 mt-4">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-[#F87404] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'result' && (
          <Card className="mb-5">
            <div className="p-5">
              {/* Photo */}
              <div className="relative rounded-2xl overflow-hidden mb-4 aspect-video">
                <img src={mockPhotoResult.image} alt={mockPhotoResult.detectedMeal} className="w-full h-full object-cover" />
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
                  <Sparkles size={12} className="text-[#FFC000]" />
                  <span className="text-white text-xs font-medium">{mockPhotoResult.confidence}% confident</span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{mockPhotoResult.detectedMeal}</h3>
                  <p className="text-xs text-gray-400">{mockPhotoResult.items.length} items detected</p>
                </div>
                <button className="flex items-center gap-1.5 text-xs text-[#F87404] font-medium hover:underline">
                  <Edit3 size={13} /> Edit
                </button>
              </div>

              {/* Nutrition summary */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { label: 'Calories', val: totalCals, unit: '', color: '#F87404' },
                  { label: 'Protein', val: totalProtein, unit: 'g', color: '#F87404' },
                  { label: 'Carbs', val: totalCarbs, unit: 'g', color: '#004AAD' },
                  { label: 'Fat', val: totalFat, unit: 'g', color: '#7C3AED' },
                ].map(({ label, val, unit, color }) => (
                  <div key={label} className="bg-gray-50 dark:bg-white/[0.05] rounded-xl p-2.5 text-center">
                    <div className="font-bold text-sm" style={{ color }}>{val}{unit}</div>
                    <div className="text-xs text-gray-400">{label}</div>
                  </div>
                ))}
              </div>

              {/* Item breakdown */}
              <div className="space-y-2 mb-4">
                {mockPhotoResult.items.map((item) => (
                  <div key={item.name} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/[0.05] last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</div>
                      <div className="text-xs text-gray-400">{item.portion} · P: {item.protein}g · C: {item.carbs}g · F: {item.fat}g</div>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{item.calories} kcal</span>
                  </div>
                ))}
              </div>

              {/* Meal selector */}
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Add to meal</label>
                <div className="grid grid-cols-4 gap-2">
                  {['breakfast', 'lunch', 'dinner', 'snacks'].map(m => (
                    <button key={m} onClick={() => setSelectedMeal(m)}
                      className={`py-2 rounded-xl text-xs font-medium capitalize transition-all ${selectedMeal === m ? 'bg-[#F87404] text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {added ? (
                <div className="flex items-center justify-center gap-2 py-3 bg-green-50 dark:bg-green-500/10 rounded-xl text-green-600 dark:text-green-400 text-sm font-medium">
                  <CheckCircle size={16} />
                  Added to {selectedMeal}!
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={handleAdd} fullWidth icon={<Plus size={16} />} size="md">
                    Log Meal
                  </Button>
                  <Button variant="outline" size="md" icon={<RefreshCw size={15} />} onClick={() => setStep('capture')}>
                    Retake
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Recent Photos */}
        {step === 'capture' && (
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Recent Photo Logs</h3>
            <div className="grid grid-cols-3 gap-3">
              {recentPhotos.map((p) => (
                <div key={p.time} className="relative rounded-2xl overflow-hidden aspect-square cursor-pointer group">
                  <img src={p.image} alt={p.meal} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <div className="text-white text-xs font-semibold">{p.meal}</div>
                    <div className="text-white/70 text-[10px]">{p.calories} kcal</div>
                  </div>
                  <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                    <span className="text-white text-[9px]">{p.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
