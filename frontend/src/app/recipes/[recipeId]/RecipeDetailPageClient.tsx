'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { mockRecipes } from '@/lib/mockData';
import {
  ChevronLeft, Bookmark, BookmarkCheck, Share2, Clock, Users, Star,
  Flame, CheckCircle, Plus, ChefHat, ShoppingCart
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const difficultyLabel = ['', 'Easy', 'Medium', 'Hard'];

export default function RecipeDetailPage() {
  const params = useParams();
  const recipeId = params?.recipeId as string;
  const recipe = mockRecipes.find(r => r.id === recipeId) || mockRecipes[0];

  const [saved, setSaved] = useState(recipe.isSaved);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'instructions' | 'nutrition'>('ingredients');
  const [servings, setServings] = useState(recipe.servings);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [addedToLog, setAddedToLog] = useState(false);

  const scaleRatio = servings / recipe.servings;
  const toggleStep = (i: number) => setCompletedSteps(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto">

        {/* Hero Image */}
        <div className="relative h-64 sm:h-80 overflow-hidden">
          <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

          {/* Top nav */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <Link href="/recipes">
              <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-black/60 transition-colors">
                <ChevronLeft size={18} className="text-white" />
              </button>
            </Link>
            <div className="flex gap-2">
              <button onClick={() => setSaved(!saved)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-black/60 transition-colors">
                {saved ? <BookmarkCheck size={18} className="text-[#F87404]" /> : <Bookmark size={18} className="text-white" />}
              </button>
              <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-black/60 transition-colors">
                <Share2 size={18} className="text-white" />
              </button>
            </div>
          </div>

          {/* Category + difficulty */}
          <div className="absolute bottom-4 left-4">
            <span className="inline-block bg-[#F87404] text-white text-xs font-bold px-3 py-1 rounded-full mb-2">{recipe.category}</span>
            <h1 className="font-display text-2xl font-bold text-white leading-tight max-w-xs">{recipe.name}</h1>
          </div>
        </div>

        <div className="px-4 py-5">
          {/* Meta row */}
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
              <Star size={14} className="text-[#FFC000]" /> <strong className="text-gray-900 dark:text-white">{recipe.rating}</strong> ({recipe.reviews})
            </span>
            <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
              <Clock size={14} className="text-[#F87404]" /> {recipe.prepTime + recipe.cookTime} min
            </span>
            <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
              <ChefHat size={14} className="text-[#004AAD]" /> {difficultyLabel[recipe.difficulty]}
            </span>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">{recipe.description}</p>

          {/* Servings adjuster */}
          <div className="flex items-center justify-between bg-gray-50 dark:bg-white/[0.05] rounded-2xl px-4 py-3 mb-5">
            <span className="text-sm font-medium text-gray-900 dark:text-white">Servings</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setServings(Math.max(1, servings - 1))}
                className="w-8 h-8 rounded-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-gray-300 font-bold hover:border-[#F87404]/40 transition-colors">−</button>
              <span className="font-display font-bold text-xl text-[#F87404] w-6 text-center">{servings}</span>
              <button onClick={() => setServings(servings + 1)}
                className="w-8 h-8 rounded-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-gray-300 font-bold hover:border-[#F87404]/40 transition-colors">+</button>
            </div>
          </div>

          {/* CTA */}
          {addedToLog ? (
            <div className="flex items-center justify-center gap-2 py-3 bg-green-50 dark:bg-green-500/10 rounded-2xl text-green-600 dark:text-green-400 text-sm font-medium mb-5">
              <CheckCircle size={16} /> Added to Food Journal!
            </div>
          ) : (
            <div className="flex gap-3 mb-5">
              <Button onClick={() => setAddedToLog(true)} fullWidth icon={<Plus size={16} />} size="md">
                Log to Food Journal
              </Button>
              <button className="w-11 h-11 flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] hover:border-[#F87404]/40 transition-colors shrink-0">
                <ShoppingCart size={17} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          )}

          {/* Tab switcher */}
          <div className="flex bg-gray-100 dark:bg-white/[0.07] p-1 rounded-xl mb-5">
            {(['ingredients', 'instructions', 'nutrition'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all ${activeTab === tab ? 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* Ingredients */}
          {activeTab === 'ingredients' && (
            <div className="space-y-2">
              {recipe.ingredients.map((ing, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-white/[0.06] last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F87404] shrink-0" />
                  <span className="flex-1 text-sm text-gray-900 dark:text-white">{ing.name}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {scaleRatio !== 1 ? `${(parseFloat(ing.amount) * scaleRatio).toFixed(1)}` : ing.amount} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Instructions */}
          {activeTab === 'instructions' && (
            <div className="space-y-3">
              {recipe.instructions.map((step, i) => (
                <button key={i} onClick={() => toggleStep(i)}
                  className={`w-full flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all ${completedSteps.has(i) ? 'border-green-500/30 bg-green-50/50 dark:bg-green-500/5' : 'border-gray-100 dark:border-white/[0.07] bg-white dark:bg-[#1a1a1a]'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${completedSteps.has(i) ? 'bg-green-500 text-white' : 'bg-[#F87404]/10 text-[#F87404]'}`}>
                    {completedSteps.has(i) ? <CheckCircle size={14} /> : i + 1}
                  </div>
                  <p className={`text-sm leading-relaxed ${completedSteps.has(i) ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {step}
                  </p>
                </button>
              ))}
              {completedSteps.size === recipe.instructions.length && (
                <div className="text-center py-4">
                  <div className="text-3xl mb-2">🎉</div>
                  <p className="font-semibold text-gray-900 dark:text-white">Recipe complete!</p>
                </div>
              )}
            </div>
          )}

          {/* Nutrition */}
          {activeTab === 'nutrition' && (
            <div>
              <div className="bg-gray-50 dark:bg-white/[0.05] rounded-2xl p-4 mb-4 text-center">
                <div className="font-display text-4xl font-bold text-[#F87404]">
                  {Math.round(recipe.nutrition.calories * scaleRatio / servings)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">calories per serving</div>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Protein', val: recipe.nutrition.protein, goal: 50, color: '#F87404' },
                  { label: 'Carbohydrates', val: recipe.nutrition.carbs, goal: 65, color: '#004AAD' },
                  { label: 'Fat', val: recipe.nutrition.fat, goal: 25, color: '#7C3AED' },
                  { label: 'Fiber', val: recipe.nutrition.fiber, goal: 25, color: '#10B981' },
                ].map(({ label, val, goal, color }) => {
                  const scaled = Math.round(val * scaleRatio / servings);
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-gray-700 dark:text-gray-300">{label}</span>
                        <span className="font-semibold" style={{ color }}>{scaled}g</span>
                      </div>
                      <ProgressBar value={Math.min((scaled / goal) * 100, 100)} max={100} color={color} height={5} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
