import { intlTag, type Locale } from '@/store/i18nStore';

/**
 * Locale-aware formatting (§5.4).
 *
 * The brief requires dates, numbers and units to localise, not only strings —
 * a Spanish UI showing `1,234.5 kg` and `08/01/2026` is only half translated,
 * and that date is genuinely ambiguous between locales.
 *
 * Everything here goes through `Intl`, which already knows each locale's
 * separators, ordering and unit names. Formatters are cached because
 * constructing one is comparatively expensive and these run inside lists.
 */

const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

function cached<T extends Intl.DateTimeFormat | Intl.NumberFormat>(key: string, make: () => T): T {
  const hit = cache.get(key);
  if (hit) return hit as T;

  const made = make();
  cache.set(key, made);

  return made;
}

const toDate = (value: Date | string | number): Date =>
  value instanceof Date ? value : new Date(value);

export function formatDate(
  value: Date | string | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' },
): string {
  const tag = intlTag(locale);

  return cached(`d:${tag}:${JSON.stringify(options)}`,
    () => new Intl.DateTimeFormat(tag, options)).format(toDate(value));
}

export function formatTime(
  value: Date | string | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
): string {
  return formatDate(value, locale, options);
}

export function formatNumber(
  value: number,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
): string {
  const tag = intlTag(locale);

  return cached(`n:${tag}:${JSON.stringify(options)}`,
    () => new Intl.NumberFormat(tag, options)).format(value);
}

export function formatCurrency(cents: number, locale: Locale, currency = 'USD'): string {
  return formatNumber(cents / 100, locale, {
    style: 'currency',
    currency,
    // Whole amounts read better without trailing zeros; anything with cents
    // keeps them. Matches the pricing page's existing behaviour.
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Relative time — "3 days ago", "hace 3 días", "il y a 3 jours".
 *
 * Hand-rolled "Xd ago" strings cannot be translated at all, because the plural
 * rules differ per language. `Intl.RelativeTimeFormat` knows them.
 */
export function formatRelative(value: Date | string | number, locale: Locale): string {
  const then = toDate(value).getTime();
  const seconds = Math.round((then - Date.now()) / 1000);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000], ['month', 2592000], ['week', 604800],
    ['day', 86400], ['hour', 3600], ['minute', 60],
  ];

  const rtf = new Intl.RelativeTimeFormat(intlTag(locale), { numeric: 'auto' });

  for (const [unit, secondsIn] of units) {
    if (Math.abs(seconds) >= secondsIn) {
      return rtf.format(Math.round(seconds / secondsIn), unit);
    }
  }

  return rtf.format(seconds, 'second');
}

/**
 * Measurements, honouring both the locale and the member's unit preference.
 *
 * `Intl.NumberFormat` with `style: 'unit'` produces the correct unit name and
 * placement per locale, which differs — some locales space the number and unit,
 * some do not.
 */
export function formatWeight(kg: number, locale: Locale, imperial = false): string {
  return imperial
    ? formatNumber(kg * 2.20462, locale, { style: 'unit', unit: 'pound', maximumFractionDigits: 1 })
    : formatNumber(kg, locale, { style: 'unit', unit: 'kilogram', maximumFractionDigits: 1 });
}

export function formatHeight(cm: number, locale: Locale, imperial = false): string {
  if (!imperial) {
    return formatNumber(cm, locale, { style: 'unit', unit: 'centimeter', maximumFractionDigits: 0 });
  }

  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);

  return `${formatNumber(feet, locale, { style: 'unit', unit: 'foot' })} ${formatNumber(inches, locale, { style: 'unit', unit: 'inch' })}`;
}

export function formatDistance(km: number, locale: Locale, imperial = false): string {
  return imperial
    ? formatNumber(km * 0.621371, locale, { style: 'unit', unit: 'mile', maximumFractionDigits: 1 })
    : formatNumber(km, locale, { style: 'unit', unit: 'kilometer', maximumFractionDigits: 1 });
}

/**
 * Weekday and month names for calendar furniture.
 *
 * The calendar grid used three hardcoded English arrays (`['Sun','Mon',…]`,
 * `['Sunday',…]`, `['January',…]`). Those cannot translate, so a Spanish member
 * still read "Sun Mon Tue" above the grid and "August 2026" above that. Intl
 * knows every locale's names; these derive them from a fixed reference week and
 * year, and are cached because they render on every calendar repaint.
 *
 * Both are indexed the way `Date.getDay()` and `Date.getMonth()` return —
 * weekdays start at Sunday, months at January — so existing call sites are a
 * straight swap.
 */
const nameCache = new Map<string, string[]>();

export function weekdayNames(locale: Locale, width: 'short' | 'long' = 'short'): string[] {
  const key = `w:${intlTag(locale)}:${width}`;
  const hit = nameCache.get(key);
  if (hit) return hit;

  // 2023-01-01 was a Sunday, so day N of that week is weekday N.
  const names = Array.from({ length: 7 }, (_, i) =>
    formatDate(new Date(Date.UTC(2023, 0, 1 + i)), locale, { weekday: width, timeZone: 'UTC' }));

  nameCache.set(key, names);

  return names;
}

export function monthNames(locale: Locale, width: 'short' | 'long' = 'long'): string[] {
  const key = `m:${intlTag(locale)}:${width}`;
  const hit = nameCache.get(key);
  if (hit) return hit;

  const names = Array.from({ length: 12 }, (_, i) =>
    formatDate(new Date(Date.UTC(2023, i, 15)), locale, { month: width, timeZone: 'UTC' }));

  nameCache.set(key, names);

  return names;
}
