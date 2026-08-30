'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Search, Star, Bookmark, Trash2, Eye, Award, Plus, BookOpen, Loader2, Check, X,
} from 'lucide-react';
import { RecipeImage } from '@/components/ui/RecipeImage';
import Link from 'next/link';
import { useConfirm } from '@/components/ui/ConfirmDialog';

type Recipe = {
  id:          number;
  name:        string;
  category:    string;
  image_url:   string | null;
  prep_time:   number;
  cook_time:   number;
  rating:      number | null;
  tags:        string[];
  is_public:   boolean;
  is_featured: boolean;
  saves_count: number;
  status:      string;
  rejection_reason: string | null;
  author:      string | null;
};

export default function AdminRecipesPage() {
  const { confirm, prompt } = useConfirm();
  const [recipes,        setRecipes]        = useState<Recipe[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [query,          setQuery]          = useState('');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [actingId,       setActingId]       = useState<number | null>(null);

  const fetchRecipes = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (query) params.search = query;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      // Not '/recipes' — that returns only approved recipes plus the caller's
      // own, so submissions awaiting review would never appear in the queue.
      const res = await api.get('/admin/recipes', { params });
      const raw = res.data.recipes ?? res.data.data ?? [];
      setRecipes(raw.map((r: Recipe & { saves_count?: number }) => ({
        ...r,
        saves_count: r.saves_count ?? 0,
      })));
    } catch {
      toast.error('Failed to load recipes.');
    }
  }, [query, categoryFilter]);

  useEffect(() => {
    let cancelled = false;
    fetchRecipes().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchRecipes]);

  const categories = ['all', ...Array.from(new Set(recipes.map(r => r.category)))].sort();

  const filtered = statusFilter === 'all' ? recipes
    : statusFilter === 'featured' ? recipes.filter(r => r.is_featured)
    : recipes.filter(r => r.status === statusFilter);

  const toggleFeatured = async (recipe: Recipe) => {
    setActingId(recipe.id);
    try {
      const res = await api.put(`/admin/recipes/${recipe.id}`, { is_featured: !recipe.is_featured });
      setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, is_featured: res.data.recipe.is_featured } : r));
      toast.success(res.data.recipe.is_featured ? 'Recipe featured.' : 'Recipe unfeatured.');
    } catch {
      toast.error('Failed to update this recipe.');
    } finally {
      setActingId(null);
    }
  };

  const approveRecipe = async (recipe: Recipe) => {
    setActingId(recipe.id);
    try {
      const res = await api.post(`/admin/recipes/${recipe.id}/approve`);
      setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, ...res.data.recipe } : r));
      toast.success('Recipe approved.');
    } catch {
      toast.error('Failed to approve this recipe.');
    } finally { setActingId(null); }
  };

  const rejectRecipe = async (recipe: Recipe) => {
    // A rejection with no reason reaches the author as a bare refusal — the same
    // gap the Groups flow had before it was fixed in Phase 3.
    const reason = await prompt({
      title: `Decline "${recipe.name}"?`,
      message: 'The author is told your reason, so say what would need to change.',
      placeholder: 'e.g. the ingredient amounts do not look right',
      confirmLabel: 'Decline recipe',
      multiline: true,
    });
    if (reason === null) return;
    setActingId(recipe.id);
    try {
      const res = await api.post(`/admin/recipes/${recipe.id}/reject`, { reason });
      setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, ...res.data.recipe } : r));
      toast.success('Recipe declined and the author notified.');
    } catch {
      toast.error('Failed to decline this recipe.');
    } finally { setActingId(null); }
  };

  const removeRecipe = async (recipe: Recipe) => {
    if (!(await confirm({ title: `Delete "${recipe.name}"?`, message: 'This cannot be undone.', confirmLabel: 'Delete recipe', destructive: true }))) return;
    setActingId(recipe.id);
    try {
      await api.delete(`/admin/recipes/${recipe.id}`);
      setRecipes(prev => prev.filter(r => r.id !== recipe.id));
      toast.success('Recipe deleted.');
    } catch {
      toast.error('Failed to delete this recipe.');
    } finally {
      setActingId(null);
    }
  };

  const counts = {
    all: recipes.length,
    pending: recipes.filter(r => r.status === 'pending').length,
    approved: recipes.filter(r => r.status === 'approved').length,
    rejected: recipes.filter(r => r.status === 'rejected').length,
    featured: recipes.filter(r => r.is_featured).length,
  };

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto px-4 py-6">

        <PageHeader
          title="Recipe Management"
          subtitle={`${recipes.length} total recipes`}
          back="/admin"
          actions={<Link href="/recipes/create">
            <Button size="sm" icon={<Plus size={15} />}>Add Recipe</Button>
          </Link>}
        />

        <div className="flex gap-3 mb-5 flex-wrap">
          {[
            { label: 'All',      key: 'all',      count: counts.all,      color: '#F87404' },
            { label: 'Awaiting review', key: 'pending',  count: counts.pending,  color: '#F87404' },
            { label: 'In library',     key: 'approved', count: counts.approved, color: '#10B981' },
            { label: 'Declined',       key: 'rejected', count: counts.rejected, color: '#B91C1C' },
            { label: 'Featured',       key: 'featured', count: counts.featured, color: '#004AAD' },
          ].map(({ label, key, count, color }) => (
            <button key={key} onClick={() => setStatusFilter(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-all ${statusFilter === key ? 'text-white' : 'bg-surface-raised border-border-strong text-content-secondary'}`}
              style={statusFilter === key ? { backgroundColor: color, borderColor: color } : {}}>
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === key ? 'bg-white/20' : 'bg-surface-sunken'}`}>{count}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-tertiary" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search recipes..."
              className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border-strong bg-surface-raised text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 text-sm" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="px-4 py-2.5 rounded-md border border-border-strong bg-surface-raised text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 capitalize">
            {categories.map(c => <option key={c} value={c} className="capitalize">{c === 'all' ? 'All Categories' : c}</option>)}
          </select>
        </div>

        <div className="bg-surface-raised rounded-md border border-border-subtle overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-border-subtle bg-gray-50 dark:bg-white/[0.03]">
            <div className="col-span-5 text-xs font-semibold text-content-secondary uppercase tracking-wide">Recipe</div>
            <div className="col-span-2 text-xs font-semibold text-content-secondary uppercase tracking-wide">Category</div>
            <div className="col-span-1 text-xs font-semibold text-content-secondary uppercase tracking-wide">Rating</div>
            <div className="col-span-1 text-xs font-semibold text-content-secondary uppercase tracking-wide">Saves</div>
            <div className="col-span-2 text-xs font-semibold text-content-secondary uppercase tracking-wide">Status</div>
            <div className="col-span-1 text-xs font-semibold text-content-secondary uppercase tracking-wide">Actions</div>
          </div>

          {loading ? (
            <div className="flex justify-center py-14"><Loader2 size={24} className="animate-spin text-accent" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <BookOpen size={32} className="mx-auto text-content-tertiary dark:text-content-secondary mb-3" />
              <p className="text-content-tertiary">No recipes match your filters</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {filtered.map(recipe => (
                <div key={recipe.id} className="md:grid grid-cols-12 gap-3 px-5 py-4 flex items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                  <div className="col-span-5 flex items-center gap-3 mb-2 md:mb-0">
                    {recipe.image_url ? (
                      <RecipeImage src={recipe.image_url} alt={recipe.name} className="w-12 h-12 rounded-md object-cover shrink-0 border border-border-subtle" />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-accent-surface flex items-center justify-center shrink-0">
                        <BookOpen size={16} className="text-accent" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-content-primary truncate">{recipe.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-content-tertiary">{(recipe.prep_time ?? 0) + (recipe.cook_time ?? 0)} min</span>
                        {(recipe.tags ?? []).slice(0, 1).map(tag => (
                          <span key={tag} className="text-xs px-1.5 py-0.5 bg-accent-surface text-accent rounded-md font-medium">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 hidden md:flex items-center text-sm text-content-secondary capitalize">
                    {recipe.category}
                  </div>

                  <div className="col-span-1 hidden md:flex items-center gap-1">
                    <Star size={12} className="text-brand-yellow" fill="#FFC000" />
                    <span className="text-sm text-content-secondary">{recipe.rating ?? '—'}</span>
                  </div>

                  <div className="col-span-1 hidden md:flex items-center gap-1">
                    <Bookmark size={12} className="text-brand-blue-deep" />
                    <span className="text-sm text-content-secondary">{recipe.saves_count ?? 0}</span>
                  </div>

                  <div className="col-span-2 hidden md:flex gap-1.5">
                    {recipe.is_featured && <Badge variant="blue" size="sm">Featured</Badge>}
                    {/* "Public / Private" hid the state that matters — whether
                        this is waiting on you. */}
                    <Badge
                      variant={recipe.status === 'approved' ? 'green'
                        : recipe.status === 'pending' ? 'orange'
                        : recipe.status === 'rejected' ? 'red' : 'gray'}
                      size="sm">
                      {recipe.status === 'approved' ? 'In library'
                        : recipe.status === 'pending' ? 'Awaiting review'
                        : recipe.status === 'rejected' ? 'Declined' : 'Private'}
                    </Badge>
                  </div>

                  <div className="col-span-1 flex gap-1.5 shrink-0">
                    <Link href={`/recipes/${recipe.id}`}>
                      <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-content-tertiary hover:text-brand-blue-deep transition-colors" title="View">
                        <Eye size={13} />
                      </button>
                    </Link>
                    <button onClick={() => toggleFeatured(recipe)} disabled={actingId === recipe.id}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${recipe.is_featured ? 'text-brand-blue-deep bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-blue-50 dark:hover:bg-blue-500/10 text-content-tertiary hover:text-brand-blue-deep'}`}
                      title={recipe.is_featured ? 'Unfeature' : 'Feature'}>
                      {actingId === recipe.id ? <Loader2 size={13} className="animate-spin" /> : <Award size={13} />}
                    </button>
                    {recipe.status === 'pending' && (
                      <>
                        <button onClick={() => approveRecipe(recipe)} disabled={actingId === recipe.id}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 dark:hover:bg-green-500/10 text-content-tertiary hover:text-green-600 transition-colors disabled:opacity-40"
                          title="Approve into the library">
                          {actingId === recipe.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        </button>
                        <button onClick={() => rejectRecipe(recipe)} disabled={actingId === recipe.id}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-content-tertiary hover:text-red-500 transition-colors disabled:opacity-40"
                          title="Decline with a reason">
                          <X size={13} />
                        </button>
                      </>
                    )}
                    <button onClick={() => removeRecipe(recipe)} disabled={actingId === recipe.id}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-content-tertiary hover:text-red-500 transition-colors disabled:opacity-40" title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
