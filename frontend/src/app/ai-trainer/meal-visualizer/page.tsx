'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RingChart } from '@/components/ui/RingChart';
import { ChevronLeft, Sparkles, Wand2, Apple, TrendingUp, CheckCircle, AlertCircle, Info, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { mockFoodLog } from '@/lib/mockData';

const MOCK_FOOD_IMAGES = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop',
];

const MEAL_STYLES = [
  { id: 'realistic',  label: 'Realistic',   emoji: '📸' },
  { id: 'artistic',   label: 'Artistic',    emoji: '🎨' },
  { id: 'macro',      label: 'Macro Shot',  emoji: '🔍' },
];

const MEAL_EXAMPLES = [
  'Grilled chicken breast with brown rice and broccoli',
  '2 scrambled eggs with avocado toast and a banana',
  'Salmon fillet with quinoa and asparagus',
  'Greek yogurt parfait with granola and mixed berries',
];

const mealScores = [
  { meal: 'Breakfast', score: 88, feedback: 'Great protein intake! Consider reducing juice sugar.', color: '#F87404' },
  { meal: 'Lunch',     score: 95, feedback: 'Excellent macro balance — this is a perfect fitness meal!', color: '#10B981' },
  { meal: 'Snacks',    score: 72, feedback: 'Good choices. Try swapping yogurt for cottage cheese for more protein.', color: '#004AAD' },
];

const aiRecommendations = [
  { icon: '💪', title: 'Boost protein by 20g',  desc: 'Add a protein shake or extra chicken breast at dinner', priority: 'high' },
  { icon: '🥦', title: 'More fiber needed',     desc: 'Add leafy greens or berries to your next meal',         priority: 'medium' },
  { icon: '💧', title: '3 more glasses of water', desc: "You're at 5/8 glasses — stay hydrated!",              priority: 'low' },
];

export default function MealVisualizerPage() {
  const [description, setDescription] = useState('');
  const [style, setStyle] = useState('realistic');
  const [generating, setGenerating] = useState(false);
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const [imageIdx, setImageIdx] = useState(0);
  const [expanded, setExpanded] = useState<string | null>('Breakfast');

  const { consumed, dailyGoal } = mockFoodLog;
  const overallScore = Math.round(mealScores.reduce((s, m) => s + m.score, 0) / mealScores.length);
  const caloriesLeft = dailyGoal.calories - consumed.calories;

  const generate = async () => {
    if (!description.trim()) { toast.error('Describe your meal first!'); return; }
    setGenerating(true);
    setGeneratedImg(null);
    await new Promise(r => setTimeout(r, 2000));
    const idx = Math.floor(Math.random() * MOCK_FOOD_IMAGES.length);
    setImageIdx(idx);
    setGeneratedImg(MOCK_FOOD_IMAGES[idx]);
    setGenerating(false);
    toast.success('Meal image generated!');
  };

  const regenerate = async () => {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 1200));
    const next = (imageIdx + 1) % MOCK_FOOD_IMAGES.length;
    setImageIdx(next);
    setGeneratedImg(MOCK_FOOD_IMAGES[next]);
    setGenerating(false);
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
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Meal Visualizer</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">AI image generator + nutrition analysis</p>
          </div>
        </div>

        {/* Generate Image Section */}
        <Card className="mb-5 overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-[#F87404]" />
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Generate Meal Image</h2>
            </div>

            {/* Text input */}
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe your meal… e.g. Grilled chicken breast with brown rice and steamed broccoli"
              rows={3}
              className="w-full bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-[#F87404] focus:ring-2 focus:ring-[#F87404]/15 transition-all resize-none mb-3"
            />

            {/* Quick examples */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {MEAL_EXAMPLES.map(ex => (
                <button key={ex} onClick={() => setDescription(ex)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/[0.07] text-gray-600 dark:text-gray-400 hover:bg-[#F87404]/10 hover:text-[#F87404] transition-colors truncate max-w-[180px]">
                  {ex}
                </button>
              ))}
            </div>

            {/* Style selector */}
            <div className="flex gap-2 mb-4">
              {MEAL_STYLES.map(s => (
                <button key={s.id} onClick={() => setStyle(s.id)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${style === s.id ? 'border-[#F87404] bg-[#F87404]/10 text-[#F87404]' : 'border-gray-100 dark:border-white/[0.07] text-gray-500 dark:text-gray-400 hover:border-gray-200'}`}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>

            {/* Generate button */}
            <button
              onClick={generate}
              disabled={generating || !description.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-[#F87404] to-[#FF5C04] text-white font-bold shadow-lg shadow-[#F87404]/25 hover:shadow-[#F87404]/40 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {generating ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Generating…</>
              ) : (
                <><Wand2 size={17} /> Generate Meal Image</>
              )}
            </button>
          </div>

          {/* Generated result */}
          {generatedImg && (
            <div className="border-t border-gray-100 dark:border-white/[0.07]">
              <div className="relative overflow-hidden">
                <img src={generatedImg} alt="Generated meal" className="w-full h-56 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute top-3 left-3">
                  <span className="text-xs font-bold bg-[#F87404] text-white px-2.5 py-1 rounded-full">AI Generated</span>
                </div>
                <div className="absolute bottom-3 right-3">
                  <button onClick={regenerate} disabled={generating}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-white/90 backdrop-blur-sm text-gray-900 px-3 py-1.5 rounded-full hover:bg-white transition-colors disabled:opacity-60">
                    <RefreshCw size={12} /> Regenerate
                  </button>
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">"{description}"</p>
                <p className="text-[11px] text-gray-400 mt-1">Style: {MEAL_STYLES.find(s => s.id === style)?.label} · AI-generated image for visualization only</p>
              </div>
            </div>
          )}
        </Card>

        {/* Nutrition Score */}
        <Card className="mb-5 overflow-hidden">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Today&apos;s Nutrition Score</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-display text-5xl font-bold text-[#F87404]">{overallScore}</span>
                  <span className="text-gray-400 text-lg">/100</span>
                </div>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${overallScore >= 80 ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'}`}>
                  {overallScore >= 80 ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                  {overallScore >= 90 ? 'Excellent!' : overallScore >= 80 ? 'Great job!' : 'Could be better'}
                </div>
              </div>
              <RingChart value={overallScore} max={100} size={90} strokeWidth={9} color="#F87404" label={`${overallScore}%`} sublabel="score" />
            </div>
          </div>
          <div className="border-t border-gray-100 dark:border-white/[0.07] p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Today&apos;s Macros</p>
            <div className="space-y-2.5">
              {[
                { label: 'Protein', current: consumed.protein, goal: dailyGoal.protein, color: '#F87404', unit: 'g' },
                { label: 'Carbs',   current: consumed.carbs,   goal: dailyGoal.carbs,   color: '#004AAD', unit: 'g' },
                { label: 'Fat',     current: consumed.fat,     goal: dailyGoal.fat,     color: '#7C3AED', unit: 'g' },
              ].map(({ label, current, goal, color, unit }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 dark:text-gray-400">{label}</span>
                    <span style={{ color }}><strong>{current}</strong>/{goal}{unit}</span>
                  </div>
                  <ProgressBar value={Math.min((current / goal) * 100, 100)} max={100} color={color} height={5} />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Calorie Status */}
        <div className={`flex items-center gap-3 rounded-2xl p-4 mb-5 border ${caloriesLeft > 0 ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${caloriesLeft > 0 ? 'bg-green-100 dark:bg-green-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
            <Apple size={18} className={caloriesLeft > 0 ? 'text-green-600' : 'text-red-500'} />
          </div>
          <div>
            <div className={`font-semibold text-sm ${caloriesLeft > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {caloriesLeft > 0 ? `${caloriesLeft} kcal remaining today` : `${Math.abs(caloriesLeft)} kcal over daily goal`}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{consumed.calories} / {dailyGoal.calories} kcal consumed</div>
          </div>
        </div>

        {/* Meal Scores */}
        <div className="mb-5">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3 flex items-center gap-2">
            <Sparkles size={15} className="text-[#F87404]" /> Meal-by-Meal Analysis
          </h3>
          <div className="space-y-3">
            {mealScores.map(({ meal, score, feedback, color }) => (
              <div key={meal} className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] overflow-hidden">
                <button className="w-full flex items-center justify-between p-4" onClick={() => setExpanded(expanded === meal ? null : meal)}>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">{meal}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-sm font-bold w-6 text-right" style={{ color }}>{score}</span>
                  </div>
                </button>
                {expanded === meal && (
                  <div className="px-4 pb-4 border-t border-gray-50 dark:border-white/[0.04] pt-3">
                    <div className="flex items-start gap-2">
                      <Info size={14} className="shrink-0 mt-0.5" style={{ color }} />
                      <p className="text-xs text-gray-600 dark:text-gray-400">{feedback}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3 flex items-center gap-2">
            <TrendingUp size={15} className="text-[#004AAD]" /> AI Recommendations
          </h3>
          <div className="space-y-2">
            {aiRecommendations.map(({ icon, title, desc, priority }) => (
              <div key={title} className="flex items-start gap-3 p-4 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07]">
                <div className="text-xl shrink-0">{icon}</div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white text-sm">{title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${priority === 'high' ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' : priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' : 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'}`}>
                  {priority}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
