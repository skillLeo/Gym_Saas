'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Plus, Trash2, CheckCircle, ChefHat, Loader2, ImageIcon, X, Lock } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';
import { useI18nStore } from '@/store/i18nStore';

type Ingredient = { id: string; name: string; amount: string; unit: string };

const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Smoothies'];
const ALL_TAGS   = ['High Protein', 'Low Carb', 'Quick', 'Meal Prep', 'Vegetarian', 'Vegan', 'Gluten-Free'];

const CATEGORY_KEYS: Record<string, string> = {
  Breakfast: 'recipeCreate.category.breakfast', Lunch: 'recipeCreate.category.lunch',
  Dinner: 'recipeCreate.category.dinner', Snacks: 'recipeCreate.category.snacks',
  Smoothies: 'recipeCreate.category.smoothies',
};
const DIFFICULTY_KEYS: Record<string, string> = {
  Easy: 'recipeCreate.difficultyLevel.easy', Medium: 'recipeCreate.difficultyLevel.medium',
  Hard: 'recipeCreate.difficultyLevel.hard',
};
const TAG_KEYS: Record<string, string> = {
  'High Protein': 'recipeCreate.tag.highProtein', 'Low Carb': 'recipeCreate.tag.lowCarb',
  Quick: 'recipeCreate.tag.quick', 'Meal Prep': 'recipeCreate.tag.mealPrep',
  Vegetarian: 'recipeCreate.tag.vegetarian', Vegan: 'recipeCreate.tag.vegan',
  'Gluten-Free': 'recipeCreate.tag.glutenFree',
};

function CreateRecipeForm() {
  const router = useRouter();
  const { t } = useI18nStore();
  // The same screen doubles as the editor. Members could create a recipe and
  // then never change it — there was no member-facing update route at all, only
  // the admin pair — so a typo in a recipe was permanent.
  const searchParams = useSearchParams();
  const editId  = searchParams?.get('edit') ?? null;
  const isEdit  = Boolean(editId);
  const [loadingRecipe, setLoadingRecipe] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '', category: 'Breakfast', difficulty: 'Easy', description: '',
    prepTime: '', cookTime: '', servings: '1',
    calories: '', protein: '', carbs: '', fat: '',
    tags: [] as string[],
    is_public: true
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', 'recipes');
      const res = await api.post('/uploads/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImageUrl(res.data.image_url);
    } catch {
      toast.error(t('recipeCreate.toast.uploadFailed'));
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: '1', name: '', amount: '', unit: 'cup' }
  ]);
  const [instructions, setInstructions] = useState(['']);

  const addIngredient  = () => setIngredients(p => [...p, { id: Date.now().toString(), name: '', amount: '', unit: 'cup' }]);
  const removeIngredient = (id: string) => setIngredients(p => p.filter(i => i.id !== id));
  const updateIngredient = (id: string, field: keyof Ingredient, value: string) =>
    setIngredients(p => p.map(i => i.id === id ? { ...i, [field]: value } : i));

  useEffect(() => {
    if (!editId) return;
    api.get(`/recipes/${editId}`)
      .then(res => {
        const r = res.data.data;
        setForm({
          name: r.name ?? '', category: r.category ?? 'Breakfast',
          difficulty: r.difficulty ?? 'Easy', description: r.description ?? '',
          prepTime: String(r.prep_time ?? ''), cookTime: String(r.cook_time ?? ''),
          servings: String(r.servings ?? '1'),
          calories: String(r.calories ?? ''), protein: String(r.protein ?? ''),
          carbs: String(r.carbs ?? ''), fat: String(r.fat ?? ''),
          tags: r.tags ?? [], is_public: r.is_public ?? true,
        });
        setImageUrl(r.image_url ?? null);
        if (r.ingredients?.length) {
          setIngredients(r.ingredients.map((i: { name?: string; amount?: string; unit?: string }, idx: number) => ({
            id: String(idx), name: i.name ?? '', amount: i.amount ?? '', unit: i.unit ?? '',
          })));
        }
        if (r.instructions?.length) setInstructions(r.instructions);
      })
      .catch(() => toast.error(t('recipeCreate.toast.saveFailed')))
      .finally(() => setLoadingRecipe(false));
  }, [editId, t]);

  const addStep    = () => setInstructions(p => [...p, '']);
  const removeStep = (idx: number) => setInstructions(p => p.filter((_, i) => i !== idx));
  const updateStep = (idx: number, value: string) => setInstructions(p => p.map((s, i) => i === idx ? value : s));

  const toggleTag = (tag: string) => setForm(f => ({
    ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag]
  }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(t('recipeCreate.toast.nameRequired')); return; }
    setSaving(true);
    try {
      const payload = {
        name:         form.name.trim(),
        image_url:    imageUrl,
        category:     form.category,
        difficulty:   form.difficulty,
        description:  form.description.trim() || null,
        prep_time:    parseInt(form.prepTime) || 0,
        cook_time:    parseInt(form.cookTime) || 0,
        servings:     parseInt(form.servings) || 1,
        calories:     parseInt(form.calories) || 0,
        protein:      parseFloat(form.protein) || 0,
        carbs:        parseFloat(form.carbs) || 0,
        fat:          parseFloat(form.fat) || 0,
        tags:         form.tags,
        ingredients:  ingredients.filter(i => i.name.trim()),
        instructions: instructions.filter(s => s.trim()),
        is_public:    form.is_public
      };
      if (isEdit) await api.put(`/recipes/${editId}`, payload);
      else        await api.post('/recipes', payload);
      setSaved(true);
      toast.success(isEdit ? 'Recipe updated!' : t('recipeCreate.toast.created'));
      setTimeout(() => router.push('/recipes'), 1200);
    } catch (err) {
      toast.error(getErrorMessage(err, t('recipeCreate.toast.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        <PageHeader
        title={isEdit ? 'Edit Recipe' : t('recipeCreate.title')}
        subtitle={isEdit ? 'Change anything and save' : t('recipeCreate.subtitle')}
        back="/recipes"
      />

        {saved && (
          <div className="flex items-center gap-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-md p-4 mb-5">
            <CheckCircle size={18} className="text-green-500" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">{t('recipeCreate.saved')}</span>
          </div>
        )}

        {/* Photo upload */}
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} disabled={uploadingImage} />
        {imageUrl ? (
          <div className="relative h-40 rounded-md overflow-hidden mb-5 group">
            <img src={imageUrl} alt="Recipe" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <button onClick={() => imageInputRef.current?.click()}
                className="px-3 py-1.5 bg-white/90 rounded-lg text-xs font-semibold text-content-primary hover:bg-white transition-colors">{t('recipeCreate.photo.change')}</button>
              <button onClick={() => setImageUrl(null)}
                className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center transition-colors">
                <X size={14} className="text-content-primary" />
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}
            className="w-full h-40 bg-surface-sunken rounded-md border-2 border-dashed border-gray-300 dark:border-white/10 flex flex-col items-center justify-center mb-5 cursor-pointer hover:border-accent/50 transition-all disabled:opacity-60">
            {uploadingImage ? (
              <Loader2 size={28} className="text-accent animate-spin mb-2" />
            ) : (
              <ImageIcon size={28} className="text-content-tertiary dark:text-content-secondary mb-2" />
            )}
            <p className="text-sm font-medium text-content-secondary">{uploadingImage ? t('recipeCreate.photo.uploading') : t('recipeCreate.photo.add')}</p>
            <p className="text-xs text-content-tertiary">{t('recipeCreate.photo.tap')}</p>
          </button>
        )}

        {/* Basic Info */}
        <Card className="mb-5">
          <div className="p-5 space-y-4">
            <h3 className="font-semibold text-content-primary text-sm flex items-center gap-2"><ChefHat size={16} className="text-accent" /> {t('recipeCreate.basicInfo')}</h3>
            <div>
              <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('recipeCreate.name')}</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('recipeCreate.namePlaceholder')}
                className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
            </div>
            <div>
              <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('recipeCreate.description')}</label>
              <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t('recipeCreate.descriptionPlaceholder')}
                className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('recipeCreate.category')}</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                  {CATEGORIES.map(c => <option key={c} value={c}>{t(CATEGORY_KEYS[c])}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('recipeCreate.servings')}</label>
                <input type="number" min={1} max={100} value={form.servings}
                  onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setForm(f => ({ ...f, servings: v })); }}
                  onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                  className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('recipeCreate.difficulty')}</label>
              <div className="grid grid-cols-3 gap-2">
                {['Easy', 'Medium', 'Hard'].map(d => (
                  <button key={d} type="button" onClick={() => setForm(f => ({ ...f, difficulty: d }))}
                    className={`py-2.5 rounded-md text-sm font-medium border-2 transition-all ${form.difficulty === d ? 'border-accent bg-accent-surface text-accent' : 'border-border-strong text-content-secondary'}`}>
                    {t(DIFFICULTY_KEYS[d])}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('recipeCreate.prepTime')}</label>
                <input type="number" min={0} max={1440} value={form.prepTime}
                  onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setForm(f => ({ ...f, prepTime: v })); }}
                  onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                  placeholder="15"
                  className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
              </div>
              <div>
                <label className="text-sm font-medium text-content-secondary mb-1.5 block">{t('recipeCreate.cookTime')}</label>
                <input type="number" min={0} max={1440} value={form.cookTime}
                  onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setForm(f => ({ ...f, cookTime: v })); }}
                  onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                  placeholder="30"
                  className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
              </div>
            </div>
          </div>
        </Card>

        {/* Nutrition */}
        <Card className="mb-5">
          <div className="p-5 space-y-4">
            <h3 className="font-semibold text-content-primary text-sm">{t('recipeCreate.nutrition')}</h3>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['calories', 'recipeCreate.field.calories', 9999],
                ['protein',  'recipeCreate.field.protein', 999],
                ['carbs',    'recipeCreate.field.carbs', 999],
                ['fat',      'recipeCreate.field.fat', 999],
              ] as const).map(([field, labelKey, max]) => (
                <div key={field}>
                  <label className="text-xs font-medium text-content-secondary mb-1 block">{t(labelKey)}</label>
                  <input type="number" min={0} max={max} value={(form as any)[field]}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setForm(f => ({ ...f, [field]: v })); }}
                    onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Tags */}
        <Card className="mb-5">
          <div className="p-5">
            <h3 className="font-semibold text-content-primary text-sm mb-3">{t('recipeCreate.tags')}</h3>
            <div className="flex flex-wrap gap-2">
              {ALL_TAGS.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${form.tags.includes(tag) ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-white/[0.07] text-content-secondary hover:bg-gray-200 dark:hover:bg-white/[0.12]'}`}>
                  {t(TAG_KEYS[tag])}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Ingredients */}
        <Card className="mb-5">
          <div className="p-5 space-y-3">
            <h3 className="font-semibold text-content-primary text-sm">{t('recipeCreate.ingredients')}</h3>
            {ingredients.map((ing, idx) => (
              <div key={ing.id} className="flex flex-col sm:flex-row gap-2">
                <input value={ing.name} onChange={e => updateIngredient(ing.id, 'name', e.target.value)}
                  placeholder={t('recipeCreate.ingredientName')}
                  className="w-full sm:flex-1 sm:min-w-0 px-3 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                <div className="flex gap-2">
                  <input value={ing.amount} onChange={e => updateIngredient(ing.id, 'amount', e.target.value)}
                    placeholder={t('recipeCreate.amount')}
                    className="flex-1 min-w-0 sm:flex-none sm:w-20 px-3 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                  <input value={ing.unit} onChange={e => updateIngredient(ing.id, 'unit', e.target.value)}
                    placeholder={t('recipeCreate.unit')}
                    className="flex-1 min-w-0 sm:flex-none sm:w-16 px-3 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                  {ingredients.length > 1 && (
                    <button onClick={() => removeIngredient(ing.id)} className="shrink-0 p-2 text-content-tertiary hover:text-red-500 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button onClick={addIngredient}
              className="flex items-center gap-2 text-sm text-accent font-semibold hover:text-accent-hover transition-colors">
              <Plus size={16} /> {t('recipeCreate.addIngredient')}
            </button>
          </div>
        </Card>

        {/* Instructions */}
        <Card className="mb-5">
          <div className="p-5 space-y-3">
            <h3 className="font-semibold text-content-primary text-sm">{t('recipeCreate.instructions')}</h3>
            {instructions.map((step, idx) => (
              <div key={idx} className="flex gap-3 items-start">
                <span className="w-7 h-7 rounded-full bg-accent-surface text-accent font-bold text-xs flex items-center justify-center flex-shrink-0 mt-2">{idx + 1}</span>
                <textarea value={step} onChange={e => updateStep(idx, e.target.value)}
                  rows={2} placeholder={t('recipeCreate.step', { n: idx + 1 })}
                  className="flex-1 px-3 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 resize-none" />
                {instructions.length > 1 && (
                  <button onClick={() => removeStep(idx)} className="p-2 text-content-tertiary hover:text-red-500 transition-colors mt-1">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addStep}
              className="flex items-center gap-2 text-sm text-accent font-semibold hover:text-accent-hover transition-colors">
              <Plus size={16} /> {t('recipeCreate.addStep')}
            </button>
          </div>
        </Card>

        {/* Visibility is no longer the author's to set. There used to be a
            public/private switch here, defaulting to public, so a recipe went in
            front of every member the moment it was saved. Saying plainly what
            happens beats a toggle that no longer decides anything. */}
        <Card className="mb-5">
          <div className="p-5 flex items-start gap-3">
            <Lock size={16} className="text-content-tertiary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-content-primary">Private to you</p>
              <p className="text-xs text-content-tertiary mt-0.5">
                Only you can see this recipe. Once saved you can send it for review, and
                it joins the shared library if it is approved.
              </p>
            </div>
          </div>
        </Card>

        <button onClick={handleSave} disabled={saving || saved}
          className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-bold py-4 rounded-md text-sm transition-all flex items-center justify-center gap-2">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <ChefHat size={18} />}
          {saving ? t('recipeCreate.saving') : t('recipeCreate.save')}
        </button>

        <div className="h-10" />
      </div>
    </DashboardShell>
  );
}

/**
 * Same prerender bail-out as /auth/login: useSearchParams() (used here to
 * preload a recipe for editing) must sit inside a Suspense boundary or
 * 'next build' aborts on this route.
 */
export default function CreateRecipePage() {
  return (
    <Suspense fallback={null}>
      <CreateRecipeForm />
    </Suspense>
  );
}
