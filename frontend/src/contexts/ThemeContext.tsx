'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type Preference = Theme | 'system';

interface ThemeContextValue {
  /** The resolved theme actually on screen. Always 'light' or 'dark'. */
  theme: Theme;
  /** What the user chose. 'system' means follow the OS. */
  preference: Preference;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  setPreference: (p: Preference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  preference: 'system',
  toggleTheme: () => {},
  setTheme: () => {},
  setPreference: () => {},
});

const STORAGE_KEY = 'met-theme';

/**
 * Stamps an explicit class on <html> so the manual choice beats the OS
 * preference in BOTH directions. globals.css declares :root.dark / :root.light
 * after the prefers-color-scheme media query at equal specificity, so whichever
 * class is present wins. Without an explicit '.light', a user on an OS set to
 * dark could never choose light.
 */
function applyTheme(resolved: Theme) {
  const el = document.documentElement;
  el.classList.toggle('dark', resolved === 'dark');
  el.classList.toggle('light', resolved === 'light');
}

function systemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<Preference>('system');
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    let stored: Preference | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY) as Preference | null;
    } catch {
      /* private mode / storage disabled — fall back to system */
    }
    const pref: Preference = stored ?? 'system';
    const resolved: Theme = pref === 'system' ? systemTheme() : pref;
    setPreferenceState(pref);
    setThemeState(resolved);
    applyTheme(resolved);
  }, []);

  // Follow the OS live, but only while the user is on 'system'.
  useEffect(() => {
    if (preference !== 'system' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const resolved = mq.matches ? 'dark' : 'light';
      setThemeState(resolved);
      applyTheme(resolved);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = (p: Preference) => {
    const resolved: Theme = p === 'system' ? systemTheme() : p;
    setPreferenceState(p);
    setThemeState(resolved);
    applyTheme(resolved);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* non-fatal: theme just won't persist */
    }
  };

  const setTheme = (t: Theme) => setPreference(t);
  const toggleTheme = () => setPreference(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, preference, toggleTheme, setTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
