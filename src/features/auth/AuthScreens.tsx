import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, KeyRound, Loader2, ShieldAlert, Wrench } from 'lucide-react';
import { AppIcon, Logo } from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { authMethods, missingFirebaseKeys } from '@/lib/firebase/config';
import { describeAuthError, resetPassword, signInWithEmail, signInWithGoogle } from '@/services/auth';
import { useAuth } from '@/app/providers/AuthProvider';

const ENV_NAMES: Record<string, string> = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  databaseURL: 'VITE_FIREBASE_DATABASE_URL',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  appId: 'VITE_FIREBASE_APP_ID',
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-safe pt-safe">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
      <p className="pb-6 text-center text-xs text-subtle">Plano · Plan. Focus. Achieve.</p>
    </div>
  );
}

export function SplashScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-bg" role="status" aria-label="Loading Plano">
      <AppIcon className="h-16 w-16 rounded-[18px]" />
      <Loader2 className="h-4 w-4 animate-spin text-subtle" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'email' | 'google' | 'reset'>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy('email');
    setError(null);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setError(describeAuthError(err));
      setBusy(null);
    }
  };

  const google = async () => {
    setBusy('google');
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(describeAuthError(err));
      setBusy(null);
    }
  };

  const reset = async () => {
    if (!email.trim()) {
      setError('Enter your email first, then press “Forgot password”.');
      return;
    }
    setBusy('reset');
    setError(null);
    try {
      await resetPassword(email);
      setInfo('If an account exists for this email, a reset link has been sent.');
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Shell>
      <div className="mb-8 flex flex-col items-center text-center">
        <AppIcon className="mb-5 h-14 w-14 rounded-2xl" />
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted">Your life. In one place.</p>
      </div>
      <div className="card p-6">
        {authMethods.includes('email') && (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Email">
              {(p) => (
                <Input {...p} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              )}
            </Field>
            <Field label="Password">
              {(p) => (
                <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              )}
            </Field>
            <Button type="submit" variant="dark" className="w-full" loading={busy === 'email'} disabled={!!busy}>
              Sign in <ArrowRight className="h-4 w-4" />
            </Button>
            <button type="button" className="w-full text-center text-xs text-muted hover:text-ink" onClick={() => void reset()} disabled={!!busy}>
              Forgot password?
            </button>
          </form>
        )}
        {authMethods.includes('email') && authMethods.includes('google') && (
          <div className="my-5 flex items-center gap-3 text-xs text-subtle">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
        )}
        {authMethods.includes('google') && (
          <Button variant="outline" className="w-full" onClick={() => void google()} loading={busy === 'google'} disabled={!!busy}>
            {busy !== 'google' && <GoogleIcon />} Continue with Google
          </Button>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {info && <p className="mt-4 rounded-lg bg-success/10 px-3 py-2 text-sm text-ink">{info}</p>}
      </div>
      <p className="mt-5 flex items-start justify-center gap-2 text-center text-xs text-subtle">
        <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Private workspace. Only the allowed account can open it — there is no public sign-up.
      </p>
    </Shell>
  );
}

export function AccessDeniedScreen({ email, uid }: { email: string | null; uid: string }) {
  const { signOut, recheck } = useAuth();
  return (
    <Shell>
      <div className="card p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold">This account has no access</h1>
        <p className="mt-2 text-sm text-muted">
          {email ?? 'This account'} is signed in, but it is not on this Plano workspace’s allowlist.
        </p>
        <div className="mt-4 rounded-xl bg-surface-2 p-3 text-left text-xs text-muted">
          <p className="mb-1 font-medium text-ink">If this is your account</p>
          Add it in Firebase console → Realtime Database → Data:
          <code className="mt-2 block break-all rounded-lg bg-surface p-2 font-mono text-[11px] text-ink">
            allowlist/{uid}: true
          </code>
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => void signOut()}>
            Sign out
          </Button>
          <Button variant="dark" className="flex-1" onClick={recheck}>
            Check again
          </Button>
        </div>
      </div>
    </Shell>
  );
}

export function SetupScreen() {
  const { enterPreview } = useAuth();
  return (
    <Shell>
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo className="mb-2 text-ink" />
        <p className="text-sm text-muted">Your life. In one place.</p>
      </div>
      <div className="card p-6">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/15 text-warning">
          <Wrench className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold">Connect Firebase to start</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Plano stores your data in your own Firebase project. Add the Firebase web app settings as environment variables and rebuild.
          See <span className="font-medium text-ink">README → Firebase setup</span>.
        </p>
        {missingFirebaseKeys.length > 0 && (
          <div className="mt-4 rounded-xl bg-surface-2 p-3 text-xs text-muted">
            Missing:
            <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-ink">
              {missingFirebaseKeys.map((k) => (
                <li key={k}>{ENV_NAMES[k] ?? k}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-5 border-t border-line pt-5">
          <p className="mb-3 text-sm text-muted">
            Want to look around first? The local preview runs fully in this browser. Nothing is synced or uploaded.
          </p>
          <Button variant="outline" className="w-full" onClick={enterPreview}>
            Open local preview
          </Button>
        </div>
      </div>
    </Shell>
  );
}

export function AuthErrorScreen({ message }: { message: string }) {
  return (
    <Shell>
      <div className="card p-6 text-center">
        <h1 className="text-lg font-semibold">Could not start Plano</h1>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <Button variant="dark" className="mt-5 w-full" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </Shell>
  );
}
