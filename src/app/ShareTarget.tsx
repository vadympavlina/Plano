import { useEffect } from 'react';
import { useUI } from '@/app/providers/UIProvider';

/**
 * «Поділитися → Plano» (the manifest's share_target): the shared text, link or title arrives as
 * ?title=…&text=…&url=… before the hash. It opens quick add with that text, then clears the address.
 */
export function ShareTarget() {
  const { openQuickAdd } = useUI();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const parts = ['title', 'text', 'url'].map((k) => q.get(k)?.trim()).filter((v): v is string => !!v);
    if (!parts.length) return;
    // Android often repeats the link inside the text: keep each piece once.
    const text = [...new Set(parts)].join(' ').slice(0, 500);
    const clean = window.location.pathname + window.location.hash;
    window.history.replaceState(null, '', clean);
    openQuickAdd({ text, kind: 'task' });
  }, [openQuickAdd]);
  return null;
}
