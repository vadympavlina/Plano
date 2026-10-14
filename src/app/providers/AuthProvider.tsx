import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import type { Backend } from '@/lib/backend/types';
import { checkAccess, signOutFirebase, watchAuth, type AppUser } from '@/services/auth';
import { resetSyncState } from '@/services/sync';

export type AuthState =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'signedOut' }
  | { status: 'denied'; user: AppUser }
  | { status: 'error'; message: string }
  | { status: 'signedIn'; user: AppUser; backend: Backend; mode: 'firebase' | 'preview' };

interface AuthContextValue {
  state: AuthState;
  signOut: () => Promise<void>;
  enterPreview: () => void;
  recheck: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const PREVIEW_FLAG = 'plano:preview-mode';

const PREVIEW_USER: AppUser = { uid: 'preview', email: null, displayName: null, photoURL: null };

function previewEnabled() {
  try {
    return localStorage.getItem(PREVIEW_FLAG) === '1';
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      if (previewEnabled()) {
        void import('@/lib/backend/localBackend').then(({ createLocalBackend }) =>
          setState({ status: 'signedIn', user: PREVIEW_USER, backend: createLocalBackend(), mode: 'preview' }),
        );
      } else setState({ status: 'unconfigured' });
      return;
    }

    let cancelled = false;
    let backend: Backend | null = null;
    const unsub = watchAuth(async (user) => {
      if (cancelled) return;
      if (!user) {
        resetSyncState();
        setState({ status: 'signedOut' });
        return;
      }
      setState({ status: 'loading' });
      try {
        if (!backend) {
          const { createFirebaseBackend } = await import('@/lib/backend/firebaseBackend');
          backend = createFirebaseBackend();
        }
        const allowed = await checkAccess(backend, user.uid);
        if (cancelled) return;
        setState(allowed ? { status: 'signedIn', user, backend, mode: 'firebase' } : { status: 'denied', user });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: (e as Error).message });
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [nonce]);

  const signOut = useCallback(async () => {
    resetSyncState();
    if (state.status === 'signedIn' && state.mode === 'preview') {
      localStorage.removeItem(PREVIEW_FLAG);
      setState({ status: 'unconfigured' });
      return;
    }
    await signOutFirebase();
  }, [state]);

  const enterPreview = useCallback(() => {
    localStorage.setItem(PREVIEW_FLAG, '1');
    setNonce((n) => n + 1);
  }, []);

  const recheck = useCallback(() => setNonce((n) => n + 1), []);

  const value = useMemo(() => ({ state, signOut, enterPreview, recheck }), [state, signOut, enterPreview, recheck]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
