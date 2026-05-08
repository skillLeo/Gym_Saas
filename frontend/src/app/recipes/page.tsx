'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { mockRecipes } from '@/lib/mockData';
import { Search, Bookmark, BookmarkCheck, Clock, Star, ChevronRight, Filter } from 'lucide-react';

const CATEGORIES = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Smoothies'];

export default function RecipesPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [saved, setSaved] = useState<Record<string, boolean>>(
    Object.fromEntries(mockRecipes.map(r => [r.id, r.isSaved]))
  );
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = mockRecipes.filter(r =>
    (category === 'All' || r.category === category) &&
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedRecipe = mockRecipes.find(r => r.id === selected);

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-black text-gray-900">Recipe Library</h1>
            <p className="text-gray-500 text-sm mt-0.5">500+ healthy recipes • Log directly to your food journal</p>
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search recipes..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#F87404] bg-white"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors bg-white">
            <Filter size={15} /> Filter
          </button>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${category === cat ? 'bg-[#F87404] text-white shadow-md shadow-[#F87404]/25' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#F87404]/50'}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Recipe grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(recipe => (
            <div key={recipe.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all cursor-pointer group" onClick={() => setSelected(recipe.id)}>
              <div className="relative overflow-hidden h-44">
                <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <button
                  onClick={e => { e.stopPropagation(); setSaved(prev => ({ ...prev, [recipe.id]: !prev[recipe.id] })); }}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                >
                  {saved[recipe.id]
                    ? <BookmarkCheck size={16} className="text-[#F87404]" />
                    : <Bookmark size={16} className="text-gray-500" />}
                </button>
                <div className="absolute bottom-3 left-3">
                  <span className="text-xs font-semibold bg-[#F87404] text-white px-2.5 py-1 rounded-full">{recipe.category}</span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">{recipe.name}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3">{recipe.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Clock size={11} /> {recipe.prepTime + recipe.cookTime}m</span>
                    <span className="flex items-center gap-1"><Star size={11} className="text-yellow-400" fill="currentColor" /> {recipe.rating}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{recipe.nutrition.calories} kcal</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-base font-medium">No recipes found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </div>
        )}
      </div>

      {/* Recipe detail modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto z-10">
            <div className="relative h-52">
              <img src={selectedRecipe.image} alt={selectedRecipe.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <button onClick={() => setSelected(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">✕</button>
              <div className="absolute bottom-4 left-4 right-4">
                <h2 className="font-bold text-white text-xl">{selectedRecipe.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-white/80 flex items-center gap-1"><Clock size={11} /> {selectedRecipe.prepTime + selectedRecipe.cookTime}m</span>
                  <span className="text-xs text-white/80 flex items-center gap-1"><Star size={11} fill="currentColor" className="text-yellow-400" /> {selectedRecipe.rating} ({selectedRecipe.reviews})</span>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-5">
              {/* Macros */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Calories', value: selectedRecipe.nutrition.calories, color: '#F87404' },
                  { label: 'Protein', value: `${selectedRecipe.nutrition.protein}g`, color: '#004AAD' },
                  { label: 'Carbs', value: `${selectedRecipe.nutrition.carbs}g`, color: '#10B981' },
                  { label: 'Fat', value: `${selectedRecipe.nutrition.fat}g`, color: '#FACC15' },
                ].map(m => (
                  <div key={m.label} className="text-center bg-gray-50 rounded-xl p-2.5">
                    <p className="text-base font-black" style={{ color: m.color }}>{m.value}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
              {/* Ingredients */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Ingredients</h3>
                <div className="space-y-1.5">
                  {selectedRecipe.ingredients.map((ing, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-50">
                      <span className="text-gray-700">{ing.name}</span>
                      <span className="text-gray-400">{ing.amount} {ing.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Instructions */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Instructions</h3>
                <ol className="space-y-2">
                  {selectedRecipe.instructions.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-700">
                      <span className="w-6 h-6 rounded-full bg-[#F87404]/10 text-[#F87404] font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
              <button className="w-full bg-[#F87404] hover:bg-[#e06000] text-white font-bold py-3 rounded-xl text-sm transition-all">
                Log to Food Journal
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
