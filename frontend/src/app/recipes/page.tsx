'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { allMockRecipes } from '@/lib/mockData';
import { Search, Bookmark, BookmarkCheck, Clock, Star, Plus, ChefHat, Heart, Zap, Leaf, Package, CalendarDays, CheckCircle, X } from 'lucide-react';

const CATEGORIES = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Smoothies'];
const TAGS = ['High Protein', 'Low Carb', 'Quick', 'Vegetarian', 'Meal Prep'] as const;
const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SLOTS = ['Breakfast','Lunch','Dinner'] as const;

const TAG_ICONS: Record<string, React.ReactNode> = {
  'High Protein': <Zap size={11} />,
  'Low Carb':     <Leaf size={11} />,
  'Quick':        <Clock size={11} />,
  'Vegetarian':   <Heart size={11} />,
  'Meal Prep':    <Package size={11} />,
};

export default function RecipesPage() {
  const [search,    setSearch]    = useState('');
  const [category,  setCategory]  = useState('All');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [saved,     setSaved]     = useState<Record<string, boolean>>(
    Object.fromEntries(allMockRecipes.map(r => [r.id, r.isSaved]))
  );
  const [selected,     setSelected]     = useState<string | null>(null);
  const [loggedIds,    setLoggedIds]     = useState<Record<string, boolean>>({});
  const [mealAddedIds, setMealAddedIds] = useState<Record<string, boolean>>({});
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [mealDay,  setMealDay]  = useState('Mon');
  const [mealSlot, setMealSlot] = useState<typeof SLOTS[number]>('Lunch');

  const filtered = allMockRecipes.filter(r => {
    const matchCat = category === 'All' || r.category === category;
    const matchTag = !activeTag || (r.tags && r.tags.includes(activeTag));
    const matchQ   = r.name.toLowerCase().includes(search.toLowerCase()) ||
                     r.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchTag && matchQ;
  });

  const selectedRecipe = allMockRecipes.find(r => r.id === selected);

  function confirmMealPlan() {
    if (!selected) return;
    setMealAddedIds(prev => ({ ...prev, [selected]: true }));
    setShowMealPicker(false);
  }

  function closeModal() {
    setSelected(null);
    setShowMealPicker(false);
  }

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto space-y-5 pb-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-black text-gray-900">Recipe Library</h1>
            <p className="text-gray-500 text-sm mt-0.5">{allMockRecipes.length} healthy recipes • Log directly to your food journal</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/recipes/saved"
              className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors bg-white font-medium">
              <Bookmark size={15} className="text-[#F87404]" /> Saved
            </Link>
            <Link href="/recipes/create"
              className="flex items-center gap-2 bg-[#F87404] hover:bg-[#e06000] text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-[#F87404]/25">
              <Plus size={16} /> Create
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search recipes, ingredients..."
            className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#F87404] bg-white shadow-sm"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${category === cat ? 'bg-[#F87404] text-white shadow-md shadow-[#F87404]/25' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#F87404]/50'}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Tag filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TAGS.map(tag => (
            <button key={tag} onClick={() => setActiveTag(t => t === tag ? null : tag)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${activeTag === tag ? 'bg-[#004AAD] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#004AAD]/40'}`}>
              {TAG_ICONS[tag]} {tag}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 font-medium">{filtered.length} recipe{filtered.length !== 1 ? 's' : ''} found</p>

        {/* Recipe grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(recipe => (
            <div key={recipe.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all cursor-pointer group"
              onClick={() => { setSelected(recipe.id); setShowMealPicker(false); }}>
              <div className="relative overflow-hidden h-44">
                <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                <button
                  onClick={e => { e.stopPropagation(); setSaved(prev => ({ ...prev, [recipe.id]: !prev[recipe.id] })); }}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors">
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
                {recipe.tags && recipe.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap mb-3">
                    {recipe.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#004AAD]/8 text-[#004AAD]">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Clock size={11} /> {recipe.prepTime + recipe.cookTime}m</span>
                    <span className="flex items-center gap-1"><Star size={11} className="text-yellow-400" fill="currentColor" /> {recipe.rating}</span>
                  </div>
                  <span className="font-bold text-gray-900">{recipe.nutrition.calories} kcal</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <ChefHat size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm font-semibold text-gray-700">No recipes found</p>
            <p className="text-xs text-gray-400 mt-1">Try a different search, category, or tag</p>
          </div>
        )}
      </div>

      {/* ── Recipe detail modal ── */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto z-10">

            {/* Hero image */}
            <div className="relative h-52 shrink-0">
              <img src={selectedRecipe.image} alt={selectedRecipe.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <button onClick={closeModal}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white text-sm font-bold">
                ✕
              </button>
              <div className="absolute bottom-4 left-4 right-4">
                <h2 className="font-bold text-white text-xl">{selectedRecipe.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-white/80 flex items-center gap-1"><Clock size={11} /> {selectedRecipe.prepTime + selectedRecipe.cookTime}m</span>
                  <span className="text-xs text-white/80 flex items-center gap-1"><Star size={11} fill="currentColor" className="text-yellow-400" /> {selectedRecipe.rating} ({selectedRecipe.reviews})</span>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Tags */}
              {selectedRecipe.tags && (
                <div className="flex gap-2 flex-wrap">
                  {selectedRecipe.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-[#004AAD]/8 text-[#004AAD]">
                      {TAG_ICONS[tag]} {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Macros */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Calories', value: selectedRecipe.nutrition.calories, color: '#F87404' },
                  { label: 'Protein',  value: `${selectedRecipe.nutrition.protein}g`,  color: '#004AAD' },
                  { label: 'Carbs',    value: `${selectedRecipe.nutrition.carbs}g`,    color: '#10B981' },
                  { label: 'Fat',      value: `${selectedRecipe.nutrition.fat}g`,      color: '#FACC15' },
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
                <div className="space-y-1">
                  {selectedRecipe.ingredients.map((ing, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
                      <span className="text-gray-700">{ing.name}</span>
                      <span className="text-gray-400 text-xs">{ing.amount} {ing.unit}</span>
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

              {/* Log to Food Journal */}
              {loggedIds[selectedRecipe.id] ? (
                <div className="flex items-center justify-center gap-2 py-3 bg-green-50 rounded-2xl text-green-600 text-sm font-semibold">
                  <CheckCircle size={16} /> Added to Food Journal!
                </div>
              ) : (
                <button
                  onClick={() => setLoggedIds(prev => ({ ...prev, [selectedRecipe.id]: true }))}
                  className="w-full bg-[#F87404] hover:bg-[#e06000] text-white font-bold py-3 rounded-xl text-sm transition-all">
                  Log to Food Journal
                </button>
              )}

              {/* Add to Meal Plan */}
              {mealAddedIds[selectedRecipe.id] ? (
                <div className="flex items-center justify-center gap-2 py-3 bg-blue-50 rounded-2xl text-[#004AAD] text-sm font-semibold">
                  <CalendarDays size={16} /> Added to Meal Plan!
                </div>
              ) : !showMealPicker ? (
                <button
                  onClick={() => setShowMealPicker(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-[#004AAD]/30 hover:border-[#004AAD] rounded-xl text-[#004AAD] text-sm font-semibold transition-all hover:bg-[#004AAD]/5">
                  <CalendarDays size={16} /> Add to Meal Plan
                </button>
              ) : (
                <div className="border-2 border-[#004AAD]/20 rounded-2xl p-4 space-y-3 bg-[#004AAD]/3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-800">Pick a day &amp; meal</p>
                    <button onClick={() => setShowMealPicker(false)} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </div>

                  {/* Day picker */}
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS.map(d => (
                      <button key={d} onClick={() => setMealDay(d)}
                        className={`py-2 rounded-lg text-xs font-bold transition-all ${mealDay === d ? 'bg-[#004AAD] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {d}
                      </button>
                    ))}
                  </div>

                  {/* Slot picker */}
                  <div className="grid grid-cols-3 gap-2">
                    {SLOTS.map(slot => (
                      <button key={slot} onClick={() => setMealSlot(slot)}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all ${mealSlot === slot ? 'bg-[#F87404] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {slot}
                      </button>
                    ))}
                  </div>

                  {/* Preview */}
                  <div className="bg-white rounded-xl px-3 py-2 text-xs text-gray-600 flex items-center gap-2">
                    <CalendarDays size={13} className="text-[#004AAD]" />
                    <span><b>{mealDay}</b> · {mealSlot} · <span className="text-[#F87404] font-bold">{selectedRecipe.nutrition.calories} cal</span></span>
                  </div>

                  <button onClick={confirmMealPlan}
                    className="w-full bg-[#004AAD] hover:bg-[#003899] text-white font-bold py-3 rounded-xl text-sm transition-all">
                    Confirm
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setSaved(prev => ({ ...prev, [selectedRecipe.id]: !prev[selectedRecipe.id] }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 border rounded-xl text-sm font-semibold transition-all ${saved[selectedRecipe.id] ? 'border-[#F87404] bg-[#F87404]/10 text-[#F87404]' : 'border-gray-200 text-gray-500 hover:border-[#F87404]/50'}`}>
                  {saved[selectedRecipe.id] ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                  {saved[selectedRecipe.id] ? 'Saved' : 'Save Recipe'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
