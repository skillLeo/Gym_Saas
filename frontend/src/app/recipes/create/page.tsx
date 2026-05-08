'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Plus, Trash2, Image, CheckCircle, ChefHat } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Ingredient = { id: string; name: string; amount: string; unit: string };

export default function CreateRecipePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: '', category: 'Breakfast', description: '', prepTime: '', cookTime: '', servings: '4',
    calories: '', protein: '', carbs: '', fat: '',
    tags: [] as string[],
  });
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: '1', name: '', amount: '', unit: 'cup' }
  ]);
  const [instructions, setInstructions] = useState(['']);

  const addIngredient = () => setIngredients(p => [...p, { id: Date.now().toString(), name: '', amount: '', unit: 'cup' }]);
  const removeIngredient = (id: string) => setIngredients(p => p.filter(i => i.id !== id));
  const updateIngredient = (id: string, field: keyof Ingredient, value: string) =>
    setIngredients(p => p.map(i => i.id === id ? { ...i, [field]: value } : i));

  const addStep = () => setInstructions(p => [...p, '']);
  const removeStep = (idx: number) => setInstructions(p => p.filter((_, i) => i !== idx));
  const updateStep = (idx: number, value: string) => setInstructions(p => p.map((s, i) => i === idx ? value : s));

  const toggleTag = (tag: string) => setForm(f => ({
    ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag]
  }));

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 1200));
    setSaving(false);
    setSaved(true);
    setTimeout(() => router.push('/recipes'), 1500);
  };

  const allTags = ['High Protein', 'Low Carb', 'Quick', 'Meal Prep', 'Vegetarian', 'Vegan', 'Gluten-Free'];

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
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Create Recipe</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Share your healthy creation</p>
          </div>
        </div>

        {saved && (
          <div className="flex items-center gap-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl p-4 mb-5">
            <CheckCircle size={18} className="text-green-500" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">Recipe saved! Redirecting...</span>
          </div>
        )}

        {/* Photo Upload */}
        <div className="h-40 bg-gray-100 dark:bg-white/[0.05] rounded-3xl border-2 border-dashed border-gray-300 dark:border-white/10 flex flex-col items-center justify-center mb-5 cursor-pointer hover:border-[#F87404]/50 transition-all">
          <Image size={28} className="text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Add recipe photo</p>
          <p className="text-xs text-gray-400">Tap to upload</p>
        </div>

        {/* Basic Info */}
        <Card className="mb-5">
          <div className="p-5 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2"><ChefHat size={16} className="text-[#F87404]" /> Basic Info</h3>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Recipe Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., High-Protein Chicken Bowl"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Description</label>
              <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of the recipe..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50">
                  {['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Servings</label>
                <input type="number" value={form.servings} onChange={e => setForm(f => ({ ...f, servings: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Prep Time (min)</label>
                <input type="number" value={form.prepTime} onChange={e => setForm(f => ({ ...f, prepTime: e.target.value }))}
                  placeholder="15"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Cook Time (min)</label>
                <input type="number" value={form.cookTime} onChange={e => setForm(f => ({ ...f, cookTime: e.target.value }))}
                  placeholder="25"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Tags</label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <button key={tag} onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${form.tags.includes(tag) ? 'bg-[#F87404] text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'}`}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Ingredients */}
        <Card className="mb-5">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Ingredients</h3>
              <button onClick={addIngredient} className="text-xs text-[#F87404] font-medium hover:underline flex items-center gap-1">
                <Plus size={13} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {ingredients.map((ing) => (
                <div key={ing.id} className="grid grid-cols-12 gap-2">
                  <input value={ing.amount} onChange={e => updateIngredient(ing.id, 'amount', e.target.value)}
                    placeholder="1" className="col-span-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#F87404]/40" />
                  <select value={ing.unit} onChange={e => updateIngredient(ing.id, 'unit', e.target.value)}
                    className="col-span-3 px-2 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#F87404]/40">
                    {['cup', 'tbsp', 'tsp', 'oz', 'g', 'lb', 'piece', 'clove'].map(u => <option key={u}>{u}</option>)}
                  </select>
                  <input value={ing.name} onChange={e => updateIngredient(ing.id, 'name', e.target.value)}
                    placeholder="Ingredient" className="col-span-6 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/40" />
                  <button onClick={() => removeIngredient(ing.id)} className="col-span-1 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Instructions */}
        <Card className="mb-5">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Instructions</h3>
              <button onClick={addStep} className="text-xs text-[#F87404] font-medium hover:underline flex items-center gap-1">
                <Plus size={13} /> Add Step
              </button>
            </div>
            <div className="space-y-3">
              {instructions.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#F87404]/10 text-[#F87404] flex items-center justify-center text-xs font-bold shrink-0 mt-2">{idx + 1}</div>
                  <textarea rows={2} value={step} onChange={e => updateStep(idx, e.target.value)}
                    placeholder={`Step ${idx + 1}...`}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/40 resize-none" />
                  {instructions.length > 1 && (
                    <button onClick={() => removeStep(idx)} className="text-gray-400 hover:text-red-500 transition-colors mt-3">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Nutrition */}
        <Card className="mb-6">
          <div className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Nutrition (per serving)</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'calories', label: 'Calories', placeholder: '450' },
                { key: 'protein', label: 'Protein (g)', placeholder: '35' },
                { key: 'carbs', label: 'Carbs (g)', placeholder: '40' },
                { key: 'fat', label: 'Fat (g)', placeholder: '12' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">{label}</label>
                  <input type="number" value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50" />
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Button onClick={handleSave} fullWidth size="lg" loading={saving} icon={<CheckCircle size={18} />}>
          {saving ? 'Saving...' : 'Publish Recipe'}
        </Button>

        <div className="h-24" />
      </div>
    </DashboardShell>
  );
}
