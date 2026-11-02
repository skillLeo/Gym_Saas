/**
 * Client side of Snap / Say / Type.
 *
 * Types mirror the API exactly. Nothing here invents a number: calories and
 * macros only ever come from a `nutrition_for_estimate` block the server
 * computed from USDA data, or from a food record the member picked.
 */

import api from '@/lib/api';

export interface AiStatus {
  available: boolean;
  reason: string | null;
  message: string | null;
  consent_required: boolean;
  consent_version: string;
  daily_limit: number;
  daily_remaining: number | null;
}

/** Nutrition scaled by the server to the drafted portion. */
export interface NutritionForEstimate {
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
}

export interface UsdaMatch {
  external_food_id: string | null;
  source: string;
  /**
   * Which half of FoodData Central this came from: a curated generic food, or
   * a supermarket product. Shown in the picker because the names alone do not
   * make it obvious, and the two can differ by several hundred calories for
   * what looks like the same food.
   */
  kind: 'generic' | 'brand';
  name: string;
  brand: string | null;
  serving_qty: number;
  serving_unit: string;
  serving_weight_grams: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  nutrition_for_estimate: NutritionForEstimate;
}

export interface DraftItem {
  label: string;
  quantity_estimate: number;
  unit: string;
  grams_estimate: number;
  confidence: 'low' | 'medium' | 'high';
  /**
   * The top match shares fewer than half its words with the drafted label, so
   * it may well be a different food. Decided server-side with the same
   * tokenising that ranks the matches, rather than re-implemented here.
   */
  match_uncertain?: boolean;
  usda_matches: UsdaMatch[];
}

export interface Draft {
  source: 'image' | 'audio' | 'text';
  transcript?: string;
  food_found: boolean;
  items: DraftItem[];
  food_database_unavailable: boolean;
  message?: string;
}

/** A draft row once the member has had a chance to correct it. */
export interface ReviewRow {
  /** Stable across re-renders; the label is not unique. */
  id: string;
  label: string;
  grams: number;
  confidence: DraftItem['confidence'];
  /** Carried from DraftItem.match_uncertain; see the note there. */
  uncertain?: boolean;
  matches: UsdaMatch[];
  /** Index into `matches`, or -1 when nothing is chosen yet. */
  chosen: number;
  /** Set when the member picked a food by hand instead of from the draft. */
  manual?: UsdaMatch;
}

export type AiErrorCode =
  | 'ai_disabled'
  | 'ai_not_configured'
  | 'ai_not_enabled_for_user'
  | 'ai_consent_required'
  | 'ai_limit_reached'
  | 'ai_unavailable'
  | 'ai_invalid_response'
  | 'unreadable_upload'
  | 'offline'
  | 'timeout'
  | 'unknown';

export interface AiError {
  code: AiErrorCode;
  message: string;
  /** Present when the server wants the UI to offer manual logging. */
  fallback?: 'manual';
  reason?: string;
}

/**
 * Shrink a photo before upload.
 *
 * A modern phone camera produces 4-12 MB files; the endpoint refuses anything
 * over 5 MB and a member on mobile data should not be made to upload it in any
 * case. The long edge is capped at 1280 rather than at the server's own limit,
 * so the server can be re-tuned without shipping a new frontend.
 *
 * Re-encoding here also means the EXIF block — including GPS — is dropped
 * before the file ever leaves the phone, not just before it leaves our server.
 */
export async function resizeImage(file: File, maxEdge = 1280, quality = 0.8): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => null);

  // No createImageBitmap (older Safari): send the original and let the server
  // reject it if it is too big. Better than failing before the member has even
  // seen the feature work.
  if (!bitmap) return file;

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );

  if (!blob) return file;

  return new File([blob], 'meal.jpg', { type: 'image/jpeg' });
}

/** Can MediaRecorder capture audio here? Safari and older browsers cannot. */
export function canRecordAudio(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/**
 * Turn any thrown value into something with a code the UI can switch on and a
 * sentence a person can read.
 *
 * `fallbackMessage` is used only when the server did not supply one — the
 * server's wording is preferred because it knows which limit was hit.
 */
export function toAiError(err: unknown, fallbackMessage: string): AiError {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { code: 'offline', message: fallbackMessage, fallback: 'manual' };
  }

  const e = err as {
    code?: string;
    name?: string;
    response?: { data?: { code?: string; error?: string; fallback?: 'manual'; reason?: string } };
  };

  if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') {
    return { code: 'timeout', message: fallbackMessage, fallback: 'manual' };
  }

  const data = e?.response?.data;

  if (data?.code) {
    return {
      code: data.code as AiErrorCode,
      message: data.error ?? fallbackMessage,
      fallback: data.fallback,
      reason: data.reason,
    };
  }

  return { code: 'unknown', message: fallbackMessage, fallback: 'manual' };
}

export async function fetchAiStatus(): Promise<AiStatus | null> {
  try {
    const res = await api.get('/ai/status');

    return (res.data?.data as AiStatus) ?? null;
  } catch {
    // The entry point stays hidden rather than showing a broken control.
    return null;
  }
}

export async function giveConsent(version: string): Promise<void> {
  await api.post('/ai/consent', { version, accepted: true });
}

type AnalyzeInput =
  | { image: File }
  | { audio: Blob; filename: string; durationSeconds?: number }
  | { text: string };

export async function analyze(input: AnalyzeInput, signal: AbortSignal): Promise<Draft> {
  const form = new FormData();

  if ('image' in input) {
    form.append('image', input.image);
  } else if ('audio' in input) {
    form.append('audio', input.audio, input.filename);

    /*
     * How long the browser actually recorded for. Transcription is billed by
     * the minute and webm does not carry its duration anywhere cheap to read,
     * so without this the server has to assume the worst and bill every clip
     * as a full minute.
     *
     * Advisory only. The server checks it against the file size and ignores
     * anything implausible — otherwise under-reporting would be a way to pay
     * less and make more calls before the cap bites.
     */
    if (typeof input.durationSeconds === 'number' && input.durationSeconds > 0) {
      form.append('duration_seconds', input.durationSeconds.toFixed(2));
    }
  } else {
    form.append('text', input.text);
  }

  const res = await api.post('/ai/food-log/analyze', form, {
    signal,
    headers: { 'Content-Type': 'multipart/form-data' },
    // Generous, because the model genuinely takes ten seconds or so on a
    // photo. The UI shows its own message well before this fires.
    timeout: 60000,
  });

  return res.data.data as Draft;
}

export interface ConfirmItem {
  grams?: number;
  servings?: number;
  food_item_id?: number;
  // `kind` is excluded with the rest: it tells the member whether a match is
  // a generic food or a packet, which is a display concern. The food record
  // stored in the journal is identified by external_food_id and food_source.
  food?: Omit<UsdaMatch, 'nutrition_for_estimate' | 'source' | 'kind'>;
}

export async function confirm(payload: {
  meal_slot_id: number;
  logged_date: string;
  items: ConfirmItem[];
}): Promise<{ totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number } }> {
  const res = await api.post('/ai/food-log/confirm', payload);

  return res.data.data;
}

/** The food payload the confirm endpoint wants, from a chosen match. */
export function toConfirmFood(match: UsdaMatch): ConfirmItem['food'] {
  return {
    external_food_id: match.external_food_id,
    name: match.name,
    brand: match.brand,
    serving_qty: match.serving_qty,
    serving_unit: match.serving_unit,
    serving_weight_grams: match.serving_weight_grams,
    calories: match.calories,
    protein_g: match.protein_g,
    carbs_g: match.carbs_g,
    fat_g: match.fat_g,
    fiber_g: match.fiber_g,
    sugar_g: match.sugar_g,
    sodium_mg: match.sodium_mg,
  };
}

/**
 * Nutrition for a row at its current weight.
 *
 * USDA figures are per 100 g, so this scales by grams/100 — the same maths the
 * server does, repeated here only so the totals move as the member drags a
 * stepper. What gets SAVED is recomputed server-side from the food record; this
 * is a preview, never the source of a stored number.
 */
export function rowNutrition(row: ReviewRow): NutritionForEstimate | null {
  const food = row.manual ?? row.matches[row.chosen];
  if (!food) return null;

  const factor = row.grams / 100;
  const at = (v: number | null) => (v === null ? null : Math.round(v * factor * 10) / 10);

  return {
    grams: row.grams,
    calories: Math.round(food.calories * factor * 10) / 10,
    protein_g: Math.round(food.protein_g * factor * 10) / 10,
    carbs_g: Math.round(food.carbs_g * factor * 10) / 10,
    fat_g: Math.round(food.fat_g * factor * 10) / 10,
    fiber_g: at(food.fiber_g),
    sugar_g: at(food.sugar_g),
    sodium_mg: at(food.sodium_mg),
  };
}
