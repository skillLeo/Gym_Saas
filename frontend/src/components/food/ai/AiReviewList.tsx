'use client';

/**
 * The review step: every detected food, editable, before anything is saved.
 *
 * This screen is the feature. The portion figures are a model's estimate from
 * a photograph and the matches are a database's best guess at a label, so the
 * member has to be able to change the food, change the weight, or throw the
 * row away — and see the calories move while they do it.
 *
 * The numbers shown here are a PREVIEW, computed from the same per-100 g USDA
 * figures the server holds. What is actually stored is recalculated server-side
 * from the food record, so nothing a browser could tamper with becomes a
 * number in the journal.
 */

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/States';
import { NumericField, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Controls';
import { Trash2, Plus, Search, Loader2, Info } from 'lucide-react';
import api from '@/lib/api';
import { useI18nStore } from '@/store/i18nStore';
import { rowNutrition, type Draft, type ReviewRow, type UsdaMatch } from '@/lib/aiFoodLog';

interface Props {
  draft: Draft;
  rows: ReviewRow[];
  setRows: React.Dispatch<React.SetStateAction<ReviewRow[]>>;
  slots: { slot_id: number; name: string }[];
  slotId: number | null;
  setSlotId: (id: number) => void;
  loggedDate: string;
  setLoggedDate: (d: string) => void;
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  onStartOver: () => void;
  onLogManually: () => void;
}

export function AiReviewList({
  draft, rows, setRows, slots, slotId, setSlotId,
  loggedDate, setLoggedDate, totals, onStartOver, onLogManually,
}: Props) {
  const { t } = useI18nStore();
  const [adding, setAdding] = useState(false);

  const update = (id: string, patch: Partial<ReviewRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const remove = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const addRow = (food: UsdaMatch) => {
    setRows((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        label: food.name,
        grams: 100,
        confidence: 'high',
        matches: [food],
        chosen: 0,
      },
    ]);
    setAdding(false);
  };

  const noFood = rows.length === 0;

  return (
    <div className="space-y-4">
      {/* Spoken input: show what was heard. "two eggs" misheard as "two legs"
          is otherwise invisible, and the member would see a baffling food list
          with no way to tell why. */}
      {draft.source === 'audio' && draft.transcript ? (
        <div className="rounded-md bg-surface-sunken px-3 py-2">
          <p className="text-caption text-content-tertiary">{t('aiFood.review.heard')}</p>
          <p className="text-body-sm text-content-primary">&ldquo;{draft.transcript}&rdquo;</p>
        </div>
      ) : null}

      {noFood ? (
        <Alert tone="info" title={t('aiFood.review.noFoodTitle')}>
          {draft.message ?? t('aiFood.review.noFoodBody')}
        </Alert>
      ) : (
        <>
          {/* The caution that matters most. A photographed menu, a packet or a
              nutrition label will be read as food that was eaten. */}
          <p className="flex items-start gap-2 text-caption text-content-secondary">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>{t('aiFood.review.checkEachItem')}</span>
          </p>

          {draft.food_database_unavailable && (
            <Alert tone="warning">{t('aiFood.review.foodDbUnavailable')}</Alert>
          )}
        </>
      )}

      {rows.map((row) => (
        <Row
          key={row.id}
          row={row}
          onChange={(patch) => update(row.id, patch)}
          onRemove={() => remove(row.id)}
        />
      ))}

      {adding ? (
        <FoodSearch onPick={addRow} onCancel={() => setAdding(false)} />
      ) : (
        <Button variant="secondary" fullWidth icon={<Plus size={16} />} onClick={() => setAdding(true)}>
          {t('aiFood.review.addItem')}
        </Button>
      )}

      {/* ------------------------------------------------ where it goes */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <Select
          label={t('aiFood.review.meal')}
          value={String(slotId ?? '')}
          onChange={(v) => setSlotId(Number(v))}
          options={slots.map((s) => ({ value: String(s.slot_id), label: s.name }))}
        />
        <Input
          type="date"
          label={t('aiFood.review.date')}
          value={loggedDate}
          onChange={(e) => setLoggedDate(e.target.value)}
        />
      </div>

      {/* ------------------------------------------------------- totals */}
      {!noFood && (
        <div className="rounded-md border border-border-subtle bg-surface-sunken p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-body-sm text-content-secondary">{t('aiFood.review.total')}</span>
            <span className="font-display text-xl font-bold text-content-primary tabular">
              {Math.round(totals.calories)} {t('aiFood.review.kcal')}
            </span>
          </div>
          <div className="mt-1 flex gap-3 text-caption text-content-tertiary tabular">
            <span>{t('aiFood.macro.protein')} {Math.round(totals.protein_g)}g</span>
            <span>{t('aiFood.macro.carbs')} {Math.round(totals.carbs_g)}g</span>
            <span>{t('aiFood.macro.fat')} {Math.round(totals.fat_g)}g</span>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" fullWidth onClick={onStartOver}>
          {t('aiFood.review.startOver')}
        </Button>
        <Button variant="ghost" fullWidth onClick={onLogManually}>
          {t('aiFood.error.logManually')}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ row */

function Row({
  row, onChange, onRemove,
}: { row: ReviewRow; onChange: (patch: Partial<ReviewRow>) => void; onRemove: () => void }) {
  const { t } = useI18nStore();
  const nutrition = rowNutrition(row);
  const chosen = row.manual ?? row.matches[row.chosen];

  return (
    <div className="rounded-md border border-border-subtle bg-surface-raised p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body font-medium text-content-primary truncate">{row.label}</p>
          {/* Plain words, not a percentage or a coloured bar. "Low confidence"
              means nothing to most people; "check this one" is actionable. */}
          {row.confidence === 'low' && (
            <p className="text-caption text-warning">{t('aiFood.review.checkThisOne')}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('aiFood.review.removeItem')}
          className="shrink-0 cursor-pointer rounded-sm p-1.5 text-content-tertiary hover:text-error hover:bg-surface-sunken transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {row.matches.length === 0 && !row.manual ? (
        <Alert tone="warning">{t('aiFood.review.noMatch')}</Alert>
      ) : (
        <Select
          label={t('aiFood.review.whichFood')}
          value={String(row.chosen)}
          onChange={(v) => onChange({ chosen: Number(v), manual: undefined })}
          options={row.matches.map((m, i) => ({
            value: String(i),
            label: m.brand ? `${m.name} (${m.brand})` : m.name,
          }))}
        />
      )}

      <div className="grid grid-cols-2 gap-2.5 items-end">
        <NumericField
          label={t('aiFood.review.weight')}
          value={String(row.grams)}
          onValueChange={(v) => onChange({ grams: Number(v || 0) })}
          min={0}
          max={5000}
          suffix="g"
        />
        <div className="pb-1">
          {nutrition ? (
            <>
              <p className="font-display text-lg font-bold text-content-primary tabular">
                {nutrition.calories} {t('aiFood.review.kcal')}
              </p>
              <p className="text-caption text-content-tertiary tabular">
                {t('aiFood.macro.protein')} {nutrition.protein_g}g · {t('aiFood.macro.carbs')}{' '}
                {nutrition.carbs_g}g · {t('aiFood.macro.fat')} {nutrition.fat_g}g
              </p>
            </>
          ) : (
            <p className="text-caption text-content-tertiary">{t('aiFood.review.pickAFood')}</p>
          )}
        </div>
      </div>

      {chosen?.external_food_id && (
        <p className="text-caption text-content-tertiary">{t('aiFood.review.sourceUsda')}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------- manual search */

function FoodSearch({ onPick, onCancel }: { onPick: (f: UsdaMatch) => void; onCancel: () => void }) {
  const { t } = useI18nStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UsdaMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/food/search?q=${encodeURIComponent(query.trim())}`);
        setResults((res.data?.data ?? []).slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="rounded-md border border-border-subtle bg-surface-raised p-3 space-y-2">
      <Input
        ref={inputRef}
        label={t('aiFood.review.searchFood')}
        placeholder={t('aiFood.review.searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {loading && (
        <div className="flex justify-center py-3">
          <Loader2 size={18} className="animate-spin text-accent" />
        </div>
      )}

      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-caption text-content-tertiary py-2">{t('aiFood.review.searchNoResults')}</p>
      )}

      <div className="space-y-1">
        {results.map((food, i) => (
          <button
            key={`${food.external_food_id ?? food.name}-${i}`}
            type="button"
            onClick={() => onPick(food)}
            className="w-full cursor-pointer rounded-sm px-2 py-2 text-left hover:bg-surface-sunken transition-colors"
          >
            <p className="text-body-sm text-content-primary truncate">{food.name}</p>
            <p className="text-caption text-content-tertiary tabular">
              {Math.round(food.calories)} {t('aiFood.review.kcalPer100')}
              {food.brand ? ` · ${food.brand}` : ''}
            </p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Search size={13} className="text-content-tertiary" />
        <span className="text-caption text-content-tertiary flex-1">
          {t('aiFood.review.searchHint')}
        </span>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
