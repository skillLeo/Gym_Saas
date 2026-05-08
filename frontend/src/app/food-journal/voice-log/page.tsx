'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Mic, MicOff, Volume2, Plus, CheckCircle, Sparkles, Edit3 } from 'lucide-react';
import Link from 'next/link';

const examplePhrases = [
  'I had two scrambled eggs and toast for breakfast',
  'Just ate a grilled chicken salad with olive oil dressing',
  'Had a protein shake with 2 scoops after my workout',
  'One cup of oatmeal with berries and honey',
  'Half a cup of brown rice and 6oz salmon for dinner',
];

const mockVoiceResult = {
  transcript: 'I had two scrambled eggs and a slice of whole wheat toast for breakfast',
  items: [
    { name: 'Scrambled Eggs (2 large)', calories: 156, protein: 13, carbs: 1, fat: 11, portion: '2 eggs' },
    { name: 'Whole Wheat Toast', calories: 69, protein: 2.5, carbs: 13, fat: 1, portion: '1 slice' },
  ],
};

export default function VoiceLogPage() {
  const [state, setListeningState] = useState<'idle' | 'listening' | 'processing' | 'result'>('idle');
  const [pulseSize, setPulseSize] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState('breakfast');
  const [added, setAdded] = useState(false);
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [transcript, setTranscript] = useState(mockVoiceResult.transcript);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === 'listening') {
      interval = setInterval(() => {
        setPulseSize(Math.random() * 60 + 20);
      }, 200);
    } else {
      setPulseSize(0);
    }
    return () => clearInterval(interval);
  }, [state]);

  const startListening = () => {
    setListeningState('listening');
    setTimeout(() => {
      setListeningState('processing');
      setTimeout(() => setListeningState('result'), 2000);
    }, 3500);
  };

  const handleAdd = () => {
    setAdded(true);
    setTimeout(() => { setAdded(false); setListeningState('idle'); }, 2000);
  };

  const totalCals = mockVoiceResult.items.reduce((s, i) => s + i.calories, 0);

  return (
    <DashboardShell>
      <div className="max-w-md mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/food-journal">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#10B981]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Voice Log</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Just say what you ate — AI does the rest</p>
          </div>
        </div>

        {/* Tip */}
        <div className="flex items-start gap-3 bg-[#10B981]/10 border border-[#10B981]/20 rounded-2xl p-4 mb-6">
          <Volume2 size={18} className="text-[#10B981] shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">Speak naturally</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Say something like: "I had a grilled chicken breast with rice and broccoli for lunch"</div>
          </div>
        </div>

        {/* Mic Visualizer */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative flex items-center justify-center mb-6" style={{ width: 180, height: 180 }}>
            {/* Outer pulse rings when listening */}
            {state === 'listening' && (
              <>
                <div className="absolute rounded-full bg-[#10B981]/10 transition-all duration-200"
                  style={{ width: 120 + pulseSize * 0.6, height: 120 + pulseSize * 0.6 }} />
                <div className="absolute rounded-full bg-[#10B981]/15 transition-all duration-300"
                  style={{ width: 100 + pulseSize * 0.4, height: 100 + pulseSize * 0.4 }} />
              </>
            )}

            {/* Main button */}
            <button
              onClick={state === 'idle' ? startListening : undefined}
              className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all ${
                state === 'idle' ? 'bg-[#10B981] hover:bg-[#059669] shadow-green-500/40 cursor-pointer active:scale-95' :
                state === 'listening' ? 'bg-red-500 shadow-red-500/40' :
                'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              {state === 'processing' ? (
                <div className="w-8 h-8 border-3 border-white/40 border-t-white rounded-full animate-spin" />
              ) : state === 'listening' ? (
                <MicOff size={32} className="text-white" />
              ) : (
                <Mic size={32} className="text-white" />
              )}
            </button>

            {/* Wave bars when listening */}
            {state === 'listening' && (
              <div className="absolute -bottom-8 flex items-end gap-0.5">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="w-1 rounded-full bg-[#10B981] transition-all duration-100"
                    style={{ height: Math.max(4, Math.random() * 28 + pulseSize * 0.15) }} />
                ))}
              </div>
            )}
          </div>

          <div className="text-center mt-2">
            {state === 'idle' && (
              <>
                <p className="font-semibold text-gray-900 dark:text-white mb-1">Tap to start</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Press and speak clearly</p>
              </>
            )}
            {state === 'listening' && (
              <>
                <p className="font-semibold text-green-500 mb-1 animate-pulse">Listening...</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Describe what you ate</p>
              </>
            )}
            {state === 'processing' && (
              <>
                <p className="font-semibold text-gray-900 dark:text-white mb-1">Processing...</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">AI is analyzing your meal</p>
              </>
            )}
          </div>
        </div>

        {/* Result */}
        {state === 'result' && (
          <Card className="mb-5">
            <div className="p-5">
              {/* Transcript */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[#F87404]" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">AI Transcript</span>
                  </div>
                  <button onClick={() => setEditingTranscript(!editingTranscript)}
                    className="flex items-center gap-1 text-xs text-[#F87404] font-medium hover:underline">
                    <Edit3 size={12} /> Edit
                  </button>
                </div>
                {editingTranscript ? (
                  <textarea rows={3} value={transcript} onChange={e => setTranscript(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/40 resize-none" />
                ) : (
                  <div className="bg-gray-50 dark:bg-white/[0.05] rounded-xl p-3 text-sm text-gray-700 dark:text-gray-300 italic">
                    &ldquo;{transcript}&rdquo;
                  </div>
                )}
              </div>

              {/* Detected items */}
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Detected Items</h4>
              <div className="space-y-2 mb-4">
                {mockVoiceResult.items.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/[0.04] rounded-xl">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</div>
                      <div className="text-xs text-gray-400">{item.portion} · P: {item.protein}g · C: {item.carbs}g · F: {item.fat}g</div>
                    </div>
                    <span className="text-sm font-bold text-[#F87404]">{item.calories}</span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between p-3 bg-[#F87404]/10 rounded-xl mb-4 border border-[#F87404]/20">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Total Calories</span>
                <span className="font-display text-xl font-bold text-[#F87404]">{totalCals} kcal</span>
              </div>

              {/* Meal selector */}
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Add to meal</label>
                <div className="grid grid-cols-4 gap-2">
                  {['breakfast', 'lunch', 'dinner', 'snacks'].map(m => (
                    <button key={m} onClick={() => setSelectedMeal(m)}
                      className={`py-2 rounded-xl text-xs font-medium capitalize transition-all ${selectedMeal === m ? 'bg-[#10B981] text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'}`}>
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
                    Log to {selectedMeal}
                  </Button>
                  <Button variant="outline" size="md" onClick={() => setListeningState('idle')}>
                    Redo
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Example phrases */}
        {state === 'idle' && (
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Try saying...</h3>
            <div className="space-y-2">
              {examplePhrases.map((phrase) => (
                <button key={phrase} onClick={startListening}
                  className="w-full flex items-start gap-3 p-3 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] hover:border-[#10B981]/30 transition-all text-left">
                  <Mic size={15} className="text-[#10B981] shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 italic">&ldquo;{phrase}&rdquo;</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
