'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, NumericField } from '@/components/ui/Field';
import { Alert, EmptyState } from '@/components/ui/States';
import { Plus, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';

/**
 * Create a food by hand.
 *
 * `POST /food/custom` and `GET /food/custom` already existed and worked, with no
 * screen anywhere in the app to reach them. That mattered more than a missing
 * screen normally would: Nutritionix is not configured, so food search knows a
 * short built-in list and nothing else. Without this page a member simply cannot
 * log a meal the list has never heard of.
 *
 * `/food/search` now returns the member's own custom foods first, so anything
 * created here is findable from the Food Journal's add-food picker immediately.
 */

interface CustomFood {
  id: number;
  name: string;
  brand: string | null;
  serving_qty: string | number;
  serving_unit: string;
  calories: string | number;
  protein_g: string | number;
  carbs_g: string | number;
  fat_g: string | number;
}

const BLANK = {
  name: '', brand: '',
  serving_qty: '1', serving_unit: 'serving',
  calories: '', protein_g: '', carbs_g: '', fat_g: '',
  fiber_g: '', sugar_g: '', sodium_mg: '',
};

export default function CustomFoodPage() {
  const { t } = useI18nStore();
  const [form, setForm] = useState({ ...BLANK });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [mine, setMine] = useState<CustomFood[]>([]);
  const [loading, setLoading] = useState(true);

  const set = (k: keyof typeof BLANK, v: string) => setForm(f => ({ ...f, [k]: v }));

  const loadMine = () =>
    api.get('/food/custom')
      .then(res => setMine(res.data.data?.data ?? res.data.data ?? []))
      .catch(() => { /* an empty list is a fine resting state */ })
      .finally(() => setLoading(false));

  useEffect(() => { loadMine(); }, []);

  // The four macros plus a name are what the server requires; checking here too
  // means the button is honest about being unusable rather than failing on press.
  const ready =
    form.name.trim() !== '' &&
    form.serving_unit.trim() !== '' &&
    [form.serving_qty, form.calories, form.protein_g, form.carbs_g, form.fat_g]
      .every(v => v.trim() !== '' && Number(v) >= 0) &&
    Number(form.serving_qty) > 0;

  const save = async () => {
    if (!ready) return;
    setSaving(true);
    setErrors({});
    try {
      const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
      const { data } = await api.post('/food/custom', {
        name: form.name.trim(),
        brand: form.brand.trim() || undefined,
        serving_qty: Number(form.serving_qty),
        serving_unit: form.serving_unit.trim(),
        calories: Number(form.calories),
        protein_g: Number(form.protein_g),
        carbs_g: Number(form.carbs_g),
        fat_g: Number(form.fat_g),
        fiber_g: num(form.fiber_g),
        sugar_g: num(form.sugar_g),
        sodium_mg: num(form.sodium_mg),
      });
      toast.success(t('customFood.saved', { name: data.data?.name ?? form.name }));
      setForm({ ...BLANK });
      loadMine();
    } catch (err: any) {
      setErrors(err?.response?.data?.errors
        ? Object.fromEntries(Object.entries(err.response.data.errors).map(([k, v]) => [k, (v as string[])[0]]))
        : {});
      toast.error(getErrorMessage(err, t('customFood.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell>
      <PageHeader title={t('customFood.title')} subtitle={t('customFood.subtitle')} back="/food-journal" />

      <div className="px-4 pb-28 flex flex-col gap-4">
        <Alert tone="info" title={t('customFood.whyTitle')}>
          {t('customFood.whyBody')}
        </Alert>

        <Card className="p-4 flex flex-col gap-4">
          <Input
            label={t('customFood.name')}
            placeholder={t('customFood.namePlaceholder')}
            value={form.name}
            onChange={e => set('name', e.target.value)}
            error={errors.name}
            required
          />
          <Input
            label={t('customFood.brand')}
            placeholder={t('customFood.brandPlaceholder')}
            value={form.brand}
            onChange={e => set('brand', e.target.value)}
            error={errors.brand}
          />

          <div className="grid grid-cols-2 gap-3">
            <NumericField
              label={t('customFood.servingQty')}
              value={form.serving_qty}
              onValueChange={v => set('serving_qty', v)}
              min={0} max={10000}
              error={errors.serving_qty}
              required
            />
            <Input
              label={t('customFood.servingUnit')}
              placeholder={t('customFood.servingUnitPlaceholder')}
              value={form.serving_unit}
              onChange={e => set('serving_unit', e.target.value)}
              error={errors.serving_unit}
              required
            />
          </div>

          <p className="text-body-sm font-semibold text-content-secondary -mb-1">
            {t('customFood.perServing')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumericField
              label={t('common.calories')} suffix="kcal"
              value={form.calories} onValueChange={v => set('calories', v)}
              min={0} max={20000} allowDecimal={false} error={errors.calories} required
            />
            <NumericField
              label={t('common.protein')} suffix="g"
              value={form.protein_g} onValueChange={v => set('protein_g', v)}
              min={0} max={2000} error={errors.protein_g} required
            />
            <NumericField
              label={t('common.carbs')} suffix="g"
              value={form.carbs_g} onValueChange={v => set('carbs_g', v)}
              min={0} max={2000} error={errors.carbs_g} required
            />
            <NumericField
              label={t('common.fat')} suffix="g"
              value={form.fat_g} onValueChange={v => set('fat_g', v)}
              min={0} max={2000} error={errors.fat_g} required
            />
            <NumericField
              label={t('customFood.fiber')} suffix="g"
              value={form.fiber_g} onValueChange={v => set('fiber_g', v)}
              min={0} max={2000} error={errors.fiber_g}
            />
            <NumericField
              label={t('customFood.sugar')} suffix="g"
              value={form.sugar_g} onValueChange={v => set('sugar_g', v)}
              min={0} max={2000} error={errors.sugar_g}
            />
            <NumericField
              label={t('customFood.sodium')} suffix="mg"
              value={form.sodium_mg} onValueChange={v => set('sodium_mg', v)}
              min={0} max={100000} allowDecimal={false} error={errors.sodium_mg}
            />
          </div>

          <Button
            onClick={save}
            disabled={!ready || saving}
            loading={saving}
            fullWidth
            icon={<Plus size={16} strokeWidth={2} />}
          >
            {saving ? t('customFood.saving') : t('customFood.save')}
          </Button>
        </Card>

        <div className="flex flex-col gap-2">
          <h2 className="text-body-sm font-semibold text-content-secondary px-1">
            {t('customFood.yours', { count: mine.length })}
          </h2>

          {loading ? (
            <div className="flex justify-center py-8 text-content-tertiary">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : mine.length === 0 ? (
            <EmptyState
              icon="utensils"
              title={t('customFood.emptyTitle')}
              description={t('customFood.emptyBody')}
            />
          ) : (
            <Card className="divide-y divide-border-subtle">
              {mine.map(f => (
                <div key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold text-content-primary truncate">{f.name}</p>
                    <p className="text-caption text-content-tertiary truncate">
                      {f.brand ? f.brand + ' · ' : ''}
                      {Number(f.serving_qty)} {f.serving_unit} ·{' '}
                      {Math.round(Number(f.protein_g))}P / {Math.round(Number(f.carbs_g))}C / {Math.round(Number(f.fat_g))}F
                    </p>
                  </div>
                  <span className="text-body-sm font-bold text-content-primary shrink-0 tabular-nums">
                    {Math.round(Number(f.calories))} kcal
                  </span>
                </div>
              ))}
            </Card>
          )}

          <Link
            href="/food-journal"
            className="text-body-sm text-accent hover:underline text-center py-2"
          >
            {t('customFood.backToJournal')}
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
