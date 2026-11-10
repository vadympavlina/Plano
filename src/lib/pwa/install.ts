import { useSyncExternalStore } from 'react';

/** Chrome's deferred install prompt (not in the DOM lib). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: window-controls-overlay)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export type InstallState = 'installed' | 'available' | 'ios' | 'unsupported';

const snapshot = (): InstallState => (installed || isStandalone() ? 'installed' : deferred ? 'available' : isIOS() ? 'ios' : 'unsupported');

/** What the app can do about installing itself right now. */
export function useInstall() {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    () => 'unsupported' as InstallState,
  );
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') installed = true;
    deferred = null;
    emit();
  };
  return { state, install };
}
