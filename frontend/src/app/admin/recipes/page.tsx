'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { mockRecipes } from '@/lib/mockData';
import {
  ChevronLeft, Search, Star, Bookmark, Trash2, Eye, CheckCircle,
  Award, Filter, Plus, AlertTriangle, BookOpen
} from 'lucide-react';
import Link from 'next/link';

type RecipeStatus = 'approved' | 'pending' | 'featured' | 'removed';

const initialRecipes = mockRecipes.map((r, i) => ({
  ...r,
  author: ['Marcus Johnson', 'Sarah Williams', 'Team Extreme', 'Derek Thompson'][i % 4],
  authorAvatar: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=80&h=80&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face',
  ][i % 4],
  saves: [124, 87, 212, 56, 143, 98][i % 6],
  status: (['approved', 'featured', 'approved', 'pending', 'approved', 'pending'][i % 6]) as RecipeStatus,
  submittedDate: `2025-0${(i % 3) + 2}-${10 + i}`,
}));

const statusBadge: Record<RecipeStatus, 'green' | 'orange' | 'blue' | 'red'> = {
  approved: 'green',
  featured: 'blue',
  pending: 'orange',
  removed: 'red',
};

export default function AdminRecipesPage() {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = ['all', ...Array.from(new Set(mockRecipes.map(r => r.category)))];

  const filtered = recipes.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
    if (query && !r.name.toLowerCase().includes(query.toLowerCase()) && !r.author.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const setStatus = (id: string, status: RecipeStatus) => {
    setRecipes(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const counts = {
    all: recipes.length,
    pending: recipes.filter(r => r.status === 'pending').length,
    approved: recipes.filter(r => r.status === 'approved').length,
    featured: recipes.filter(r => r.status === 'featured').length,
  };

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Recipe Management</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{recipes.length} total recipes</p>
          </div>
          <Link href="/recipes/create">
            <Button size="sm" icon={<Plus size={15} />}>Add Recipe</Button>
          </Link>
        </div>

        {/* Pending alert */}
        {counts.pending > 0 && (
          <div className="flex items-center gap-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-2xl p-4 mb-5">
            <AlertTriangle size={18} className="text-yellow-500 shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-yellow-700 dark:text-yellow-400 text-sm">{counts.pending} Recipes Awaiting Review</div>
              <div className="text-xs text-yellow-600 dark:text-yellow-500">Community-submitted recipes need approval before going live</div>
            </div>
          </div>
        )}

        {/* Stat chips */}
        <div className="flex gap-3 mb-5 flex-wrap">
          {[
            { label: 'All', key: 'all', count: counts.all, color: '#F87404' },
            { label: 'Pending', key: 'pending', count: counts.pending, color: '#FFC000' },
            { label: 'Approved', key: 'approved', count: counts.approved, color: '#10B981' },
            { label: 'Featured', key: 'featured', count: counts.featured, color: '#004AAD' },
          ].map(({ label, key, count, color }) => (
            <button key={key} onClick={() => setStatusFilter(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${statusFilter === key ? 'text-white shadow-md' : 'bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'}`}
              style={statusFilter === key ? { backgroundColor: color, borderColor: color } : {}}>
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === key ? 'bg-white/20' : 'bg-gray-100 dark:bg-white/10'}`}>{count}</span>
            </button>
          ))}
        </div>

        {/* Search + category filter */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search recipes or author..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F87404]/40 text-sm" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/40 capitalize">
            {categories.map(c => <option key={c} value={c} className="capitalize">{c === 'all' ? 'All Categories' : c}</option>)}
          </select>
        </div>

        {/* Recipe Table */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] overflow-hidden shadow-sm">
          {/* Header row */}
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-gray-100 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.03]">
            <div className="col-span-5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Recipe</div>
            <div className="col-span-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Author</div>
            <div className="col-span-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Rating</div>
            <div className="col-span-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Saves</div>
            <div className="col-span-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</div>
            <div className="col-span-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</div>
          </div>

          <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <BookOpen size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-400">No recipes match your filters</p>
              </div>
            ) : filtered.map(recipe => (
              <div key={recipe.id} className="md:grid grid-cols-12 gap-3 px-5 py-4 flex items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                {/* Recipe info */}
                <div className="col-span-5 flex items-center gap-3 mb-2 md:mb-0">
                  <img src={recipe.image} alt={recipe.name}
                    className="w-12 h-12 rounded-xl object-cover shrink-0 border border-gray-100 dark:border-white/10" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{recipe.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-gray-400">{recipe.category}</span>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <span className="text-xs text-gray-400">{recipe.prepTime + recipe.cookTime} min</span>
                      {recipe.tags.slice(0, 1).map(tag => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 bg-[#F87404]/10 text-[#F87404] rounded-md font-medium">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Author */}
                <div className="col-span-2 hidden md:flex items-center gap-2">
                  <img src={recipe.authorAvatar} alt={recipe.author} className="w-6 h-6 rounded-full object-cover" />
                  <span className="text-sm text-gray-600 dark:text-gray-400 truncate">{recipe.author}</span>
                </div>

                {/* Rating */}
                <div className="col-span-1 hidden md:flex items-center gap-1">
                  <Star size={12} className="text-[#FFC000]" fill="#FFC000" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{recipe.rating}</span>
                </div>

                {/* Saves */}
                <div className="col-span-1 hidden md:flex items-center gap-1">
                  <Bookmark size={12} className="text-[#004AAD]" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{recipe.saves}</span>
                </div>

                {/* Status */}
                <div className="col-span-2 hidden md:block">
                  <Badge variant={statusBadge[recipe.status]} size="sm">{recipe.status}</Badge>
                </div>

                {/* Actions */}
                <div className="col-span-1 flex gap-1.5 shrink-0">
                  <Link href={`/recipes/${recipe.id}`}>
                    <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-[#004AAD] transition-colors" title="View">
                      <Eye size={13} />
                    </button>
                  </Link>
                  {recipe.status === 'pending' && (
                    <button onClick={() => setStatus(recipe.id, 'approved')}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 dark:hover:bg-green-500/10 text-gray-400 hover:text-green-500 transition-colors" title="Approve">
                      <CheckCircle size={13} />
                    </button>
                  )}
                  {recipe.status !== 'featured' && recipe.status !== 'removed' && (
                    <button onClick={() => setStatus(recipe.id, 'featured')}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-400 hover:text-[#004AAD] transition-colors" title="Feature">
                      <Award size={13} /> 
                    </button>
                  )}
                  <button onClick={() => setStatus(recipe.id, 'removed')}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors" title="Remove">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
