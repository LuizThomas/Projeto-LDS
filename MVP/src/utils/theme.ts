import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'ifce_iventus_theme';

export function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // ignore storage failures
  }
  return 'light';
}

export function applyThemeToDom(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage failures
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  // Keep synced across multiple component instances (e.g. Navbar + ProfileView + Auth)
  useEffect(() => {
    const onThemeSync = (e: Event) => {
      const custom = e as CustomEvent<ThemeMode>;
      if (custom.detail === 'light' || custom.detail === 'dark') {
        setThemeState(custom.detail);
      }
    };
    window.addEventListener('ifce-theme-change', onThemeSync);
    return () => window.removeEventListener('ifce-theme-change', onThemeSync);
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    applyThemeToDom(next);
    setThemeState(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<ThemeMode>('ifce-theme-change', { detail: next }));
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, isDark: theme === 'dark', setTheme, toggleTheme };
}
