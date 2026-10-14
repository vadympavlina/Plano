import { useEffect } from 'react';
import { useSettings } from '@/hooks/useCollections';
import type { ThemePreference } from '@/types';

export function applyTheme(theme: ThemePreference) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem('plano:theme', theme);
  } catch {
    /* ignore */
  }
}

/** Keeps the <html> class in sync with the saved theme preference. */
export function ThemeController() {
  const { theme } = useSettings();
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme]);
  return null;
}
