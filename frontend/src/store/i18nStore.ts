import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';

export type Locale = 'en' | 'es' | 'fr';

/**
 * Locale registry (§5.4).
 *
 * Adding a language means adding a JSON file and one entry here — nothing else
 * in the app changes.
 *
 * `region` replaces the flag emoji the previous version used. Flags render
 * differently on every platform, are missing entirely on some Windows builds,
 * and conflate language with nationality (French is not only spoken in France).
 * Per §1.5 they are UI, not user content.
 */
export const LOCALES: { id: Locale; label: string; english: string; region: string }[] = [
  { id: 'en', label: 'English',  english: 'English', region: 'EN' },
  { id: 'es', label: 'Español',  english: 'Spanish', region: 'ES' },
  { id: 'fr', label: 'Français', english: 'French',  region: 'FR' },
];

type Dictionary = Record<string, string>;

const DICTIONARIES: Record<Locale, Dictionary> = {
  en: en as Dictionary,
  es: es as Dictionary,
  fr: fr as Dictionary,
};

/**
 * Last-resort rendering for a key with no translation anywhere.
 *
 * The brief is explicit that a raw key like `nav.dashboard` must never reach
 * the screen. This turns the final segment into readable words, so a missing
 * entry degrades to "Dashboard" rather than leaking the key. A safety net, not
 * a substitute for translating — `missingKeys()` reports what still needs doing.
 */
export function humanizeKey(key: string): string {
  const last = key.split('.').pop() ?? key;

  return last
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Resolve a key through locale → English → humanised key.
 *
 * `params` substitutes `{name}`-style placeholders, so a translated string can
 * carry values without callers concatenating around it — concatenation does not
 * survive translation into languages with different word order.
 */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const raw = DICTIONARIES[locale]?.[key] ?? DICTIONARIES.en[key] ?? humanizeKey(key);

  if (!params) return raw;

  return Object.entries(params).reduce(
    (out, [k, v]) => out.split(`{${k}}`).join(String(v)),
    raw,
  );
}

/** Keys present in English but missing from a locale — for tooling and tests. */
export function missingKeys(locale: Locale): string[] {
  const target = DICTIONARIES[locale] ?? {};

  return Object.keys(DICTIONARIES.en).filter((k) => !(k in target));
}

/** BCP-47 tag for Intl. Kept beside the registry so the two cannot drift. */
export function intlTag(locale: Locale): string {
  const tags: Record<Locale, string> = { en: 'en-GB', es: 'es-ES', fr: 'fr-FR' };

  return tags[locale] ?? 'en-GB';
}

interface I18nState {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: 'en',
      setLocale: (locale) => {
        set({ locale });
        // Keep the document language in step: screen readers and the browser's
        // own hyphenation both read it.
        if (typeof document !== 'undefined') {
          document.documentElement.lang = locale;
        }
      },
      t: (key, params) => translate(get().locale, key, params),
    }),
    // skipHydration + an explicit rehydrate() call from AppShell's mount
    // effect (same pattern as useLayoutStore): guarantees the client's first
    // render always starts at the 'en' default, matching what a statically
    // prerendered page's server render produced. Without this, a persisted
    // non-English locale can hydrate before React's first paint, so `t()`
    // returns a different string than the server rendered — a hydration
    // mismatch (React #418) that self-heals but flashes wrong text and logs
    // an error. Confirmed reproducible on /profile; fixed at the store level
    // so every consumer is safe, not just the ones caught by a test.
    {
      name: 'i18n-locale',
      skipHydration: true,
      // `setLocale` sets document.documentElement.lang, but that only runs when
      // someone clicks the switcher. On every later page load the root layout's
      // static `<html lang="en">` was left in place, so a Spanish or French
      // member browsed a page whose text was translated while the document
      // still claimed to be English — screen readers then read Spanish with
      // English pronunciation, and the browser's hyphenation and
      // translate-this-page prompt both use the wrong language. Re-applying it
      // on rehydrate covers every entry point, since rehydrate() is what every
      // shell calls on mount.
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== 'undefined') {
          document.documentElement.lang = state.locale;
        }
      },
    },
  ),
);
