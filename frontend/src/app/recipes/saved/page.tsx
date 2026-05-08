'use client';

import { DashboardShell } from '@/components/layout/DashboardShell';
import { mockRecipes } from '@/lib/mockData';
import { ChevronLeft, Bookmark, Clock, Flame } from 'lucide-react';
import Link from 'next/link';

export default function SavedRecipesPage() {
  const saved = mockRecipes.filter(r => r.isSaved);

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/recipes">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Saved Recipes</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{saved.length} recipe{saved.length !== 1 ? 's' : ''} saved</p>
          </div>
        </div>

        {saved.length === 0 ? (
          <div className="text-center py-20">
            <Bookmark size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">No saved recipes yet</p>
            <Link href="/recipes" className="text-sm text-[#F87404] font-medium hover:underline">Browse recipes</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {saved.map(recipe => (
              <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
                <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-white/[0.07] overflow-hidden shadow-sm hover:shadow-md hover:border-[#F87404]/20 transition-all group">
                  <div className="relative aspect-video overflow-hidden">
                    <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
                      <Flame size={12} className="text-[#F87404]" />
                      <span className="text-white text-xs font-medium">{recipe.nutrition.calories} cal</span>
                    </div>
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[#F87404] flex items-center justify-center">
                      <Bookmark size={14} className="text-white" fill="white" />
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{recipe.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Clock size={11} />{recipe.prepTime + recipe.cookTime} min</span>
                      <span>{recipe.category}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
