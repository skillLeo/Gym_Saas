'use client';

import { useState, useEffect } from 'react';
import { RecipeImage } from '@/components/ui/RecipeImage';
import { useI18nStore } from '@/store/i18nStore';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Bookmark, Clock, Flame, Loader2, BookmarkCheck, Star } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Recipe {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  category: string;
  prep_time: number;
  cook_time: number;
  calories: number;
  protein: number;
  rating: number;
  is_saved: boolean;
}


export default function SavedRecipesPage() {
  const { t } = useI18nStore();
  const [recipes, setRecipes]   = useState<Recipe[]>([]);
  const [loading, setLoading]   = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    api.get('/recipes/saved')
      .then(res => setRecipes(res.data.data ?? []))
      .catch(() => toast.error(t('savedRecipes.error.load')))
      .finally(() => setLoading(false));
  }, []);

  const unsave = async (recipe: Recipe) => {
    setSavingId(recipe.id);
    try {
      await api.post(`/recipes/${recipe.id}/save`);
      setRecipes(prev => prev.filter(r => r.id !== recipe.id));
      toast.success(t('savedRecipes.removed'));
    } catch {
      toast.error(t('common.failed'));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PageHeader
        title={t('savedRecipes.title')}
        subtitle={loading ? '…' : recipes.length === 1 ? t('savedRecipes.countOne') : t('savedRecipes.count', { n: recipes.length })}
        back="/recipes"
      />

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-accent" />
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-20">
            <Bookmark size={36} className="mx-auto text-content-tertiary dark:text-content-secondary mb-3" />
            <p className="text-content-secondary mb-2">{t('savedRecipes.empty')}</p>
            <Link href="/recipes" className="text-sm text-accent font-medium hover:underline">{t('savedRecipes.browse')}</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recipes.map(recipe => (
              <div key={recipe.id} className="bg-surface-raised rounded-md border border-border-subtle overflow-hidden shadow-sm hover: hover:border-accent/20 transition-all group relative">
                <Link href={`/recipes/${recipe.id}`}>
                  <div className="relative aspect-video overflow-hidden">
                    <RecipeImage src={recipe.image_url} alt={recipe.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
                      <Flame size={11} className="text-orange-400" />
                      <span className="text-white text-xs font-semibold">{t('recipes.kcalTotal', { cal: recipe.calories })}</span>
                    </div>
                    <span className="absolute top-3 left-3 text-[10px] font-bold bg-accent text-white px-2 py-0.5 rounded-full">{recipe.category}</span>
                  </div>
                </Link>

                <button onClick={() => unsave(recipe)} disabled={savingId === recipe.id}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors">
                  {savingId === recipe.id
                    ? <Loader2 size={14} className="animate-spin text-accent" />
                    : <BookmarkCheck size={16} className="text-accent" />}
                </button>

                <Link href={`/recipes/${recipe.id}`}>
                  <div className="p-3.5">
                    <h3 className="font-semibold text-content-primary text-sm truncate">{recipe.name}</h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-content-tertiary">
                      <span className="flex items-center gap-1"><Clock size={11} /> {recipe.prep_time + recipe.cook_time}m</span>
                      {recipe.rating != null && (
                        <span className="flex items-center gap-1"><Star size={11} className="text-yellow-400" fill="currentColor" /> {recipe.rating.toFixed(1)}</span>
                      )}
                      <span className="ml-auto text-xs font-semibold text-brand-blue-deep dark:text-blue-400">{recipe.protein}g protein</span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
        <div className="h-16" />
      </div>
    </DashboardShell>
  );
}
