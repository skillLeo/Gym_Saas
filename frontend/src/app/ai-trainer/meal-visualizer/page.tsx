'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RingChart } from '@/components/ui/RingChart';
import { ChevronLeft, Sparkles, Apple, TrendingUp, CheckCircle, AlertCircle, Info } from 'lucide-react';
import Link from 'next/link';
import { mockFoodLog } from '@/lib/mockData';

const mealScores = [
  { meal: 'Breakfast', score: 88, feedback: 'Great protein intake! Consider reducing juice sugar.', color: '#F87404' },
  { meal: 'Lunch', score: 95, feedback: 'Excellent macro balance — this is a perfect fitness meal!', color: '#10B981' },
  { meal: 'Snacks', score: 72, feedback: 'Good choices. Try swapping yogurt for cottage cheese for more protein.', color: '#004AAD' },
];

const aiRecommendations = [
  { icon: '💪', title: 'Boost protein by 20g', desc: 'Add a protein shake or extra chicken breast at dinner', priority: 'high' },
  { icon: '🥦', title: 'More fiber needed', desc: 'Add leafy greens or berries to your next meal', priority: 'medium' },
  { icon: '💧', title: '3 more glasses of water', desc: "You're at 5/8 glasses — stay hydrated!", priority: 'low' },
];

export default function MealVisualizerPage() {
  const [expanded, setExpanded] = useState<string | null>('Breakfast');
  const { consumed, dailyGoal } = mockFoodLog;

  const overallScore = Math.round(mealScores.reduce((s, m) => s + m.score, 0) / mealScores.length);
  const caloriesLeft = dailyGoal.calories - consumed.calories;

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
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Meal Visualizer</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">AI analysis of today&apos;s nutrition</p>
          </div>
        </div>

        {/* Overall Score */}
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
              <RingChart
                value={overallScore}
                max={100}
                size={90}
                strokeWidth={9}
                color="#F87404"
                label={`${overallScore}%`}
                sublabel="score"
              />
            </div>
          </div>

          {/* Macro Breakdown */}
          <div className="border-t border-gray-100 dark:border-white/[0.07] p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Today&apos;s Macros</p>
            <div className="space-y-2.5">
              {[
                { label: 'Protein', current: consumed.protein, goal: dailyGoal.protein, color: '#F87404', unit: 'g' },
                { label: 'Carbs', current: consumed.carbs, goal: dailyGoal.carbs, color: '#004AAD', unit: 'g' },
                { label: 'Fat', current: consumed.fat, goal: dailyGoal.fat, color: '#7C3AED', unit: 'g' },
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
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {consumed.calories} / {dailyGoal.calories} kcal consumed
            </div>
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
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
                      <Apple size={16} style={{ color }} />
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">{meal}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
                      </div>
                      <span className="text-sm font-bold" style={{ color }}>{score}</span>
                    </div>
                  </div>
                </button>
                {expanded === meal && (
                  <div className="px-4 pb-4 border-t border-gray-50 dark:border-white/[0.04]">
                    <div className="flex items-start gap-2 pt-3">
                      <Info size={14} className="shrink-0 mt-0.5" style={{ color }} />
                      <p className="text-xs text-gray-600 dark:text-gray-400">{feedback}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3 flex items-center gap-2">
            <TrendingUp size={15} className="text-[#004AAD]" /> Recommendations
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

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
