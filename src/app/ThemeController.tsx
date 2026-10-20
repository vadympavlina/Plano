import { useEffect } from 'react';
import { useSettings } from '@/hooks/useCollections';
import type { ThemePreference } from '@/types';

export function applyTheme(theme: ThemePreference) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  // Status bar / browser chrome follows the app theme, not just the OS one.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.removeAttribute('media');
    m.setAttribute('content', dark ? '#0E1117' : '#F3F5F9');
  });
  try {
    localStorage.setItem('plano:theme', theme);
  } catch {
    /* ignore */
  }
}

/** Keeps the <html> class in sync with the saved theme preference. */
export function ThemeController() {
  const { theme, accent } = useSettings();
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    try {
      localStorage.setItem('plano:accent', accent);
    } catch {
      /* ignore */
    }
  }, [accent]);
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
