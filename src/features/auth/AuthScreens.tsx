import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, KeyRound, Loader2, ShieldAlert, Wrench } from 'lucide-react';
import { AppIcon, Logo } from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { missingFirebaseKeys } from '@/lib/firebase/config';
import { describeAuthError, resetPassword, signInWithEmail } from '@/services/auth';
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
      <p className="pb-6 text-center text-xs text-subtle">Plano · Плануй. Фокусуйся. Досягай.</p>
    </div>
  );
}

export function SplashScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-bg" role="status" aria-label="Завантаження Plano">
      <AppIcon className="h-16 w-16 rounded-[18px]" />
      <Loader2 className="h-4 w-4 animate-spin text-subtle" />
    </div>
  );
}

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'email' | 'reset'>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Введіть пошту й пароль.');
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

  const reset = async () => {
    if (!email.trim()) {
      setError('Спершу введіть пошту, потім натисніть «Забули пароль?».');
      return;
    }
    setBusy('reset');
    setError(null);
    try {
      await resetPassword(email);
      setInfo('Якщо акаунт із цією поштою існує, ми надіслали посилання для скидання пароля.');
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
        <h1 className="text-2xl font-semibold tracking-tight">З поверненням</h1>
        <p className="mt-1.5 text-sm text-muted">Твоє життя. В одному місці.</p>
      </div>
      <div className="card p-6">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Пошта">
            {(p) => (
              <Input {...p} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </Field>
          <Field label="Пароль">
            {(p) => (
              <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
          </Field>
          <Button type="submit" variant="dark" className="w-full" loading={busy === 'email'} disabled={!!busy}>
            Увійти <ArrowRight className="h-4 w-4" />
          </Button>
          <button type="button" className="w-full text-center text-xs text-muted hover:text-ink" onClick={() => void reset()} disabled={!!busy}>
            Забули пароль?
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {info && <p className="mt-4 rounded-lg bg-success/10 px-3 py-2 text-sm text-ink">{info}</p>}
      </div>
      <p className="mt-5 flex items-start justify-center gap-2 text-center text-xs text-subtle">
        <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Приватний простір. Відкрити його може лише дозволений акаунт — публічної реєстрації немає.
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
        <h1 className="text-lg font-semibold">У цього акаунта немає доступу</h1>
        <p className="mt-2 text-sm text-muted">
          Ви увійшли як {email ?? 'цей акаунт'}, але його немає у списку дозволених (allowlist) цього Plano.
        </p>
        <div className="mt-4 rounded-xl bg-surface-2 p-3 text-left text-xs text-muted">
          <p className="mb-1 font-medium text-ink">Якщо це ваш акаунт</p>
          Додайте його у Firebase console → Realtime Database → Data:
          <code className="mt-2 block break-all rounded-lg bg-surface p-2 font-mono text-[11px] text-ink">
            allowlist/{uid}: true
          </code>
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => void signOut()}>
            Вийти
          </Button>
          <Button variant="dark" className="flex-1" onClick={recheck}>
            Перевірити ще раз
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
        <p className="text-sm text-muted">Твоє життя. В одному місці.</p>
      </div>
      <div className="card p-6">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/15 text-warning">
          <Wrench className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold">Підключіть Firebase, щоб почати</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Plano зберігає дані у вашому власному проєкті Firebase. Додайте налаштування веб-застосунку Firebase у змінні середовища й перезберіть проєкт.
          Див. <span className="font-medium text-ink">README → Налаштування Firebase</span>.
        </p>
        {missingFirebaseKeys.length > 0 && (
          <div className="mt-4 rounded-xl bg-surface-2 p-3 text-xs text-muted">
            Бракує:
            <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-ink">
              {missingFirebaseKeys.map((k) => (
                <li key={k}>{ENV_NAMES[k] ?? k}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-5 border-t border-line pt-5">
          <p className="mb-3 text-sm text-muted">
            Хочете спершу роздивитися? Локальний перегляд працює повністю в цьому браузері. Нічого не синхронізується й не вивантажується.
          </p>
          <Button variant="outline" className="w-full" onClick={enterPreview}>
            Відкрити локальний перегляд
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
        <h1 className="text-lg font-semibold">Не вдалося запустити Plano</h1>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <Button variant="dark" className="mt-5 w-full" onClick={() => window.location.reload()}>
          Перезавантажити
        </Button>
      </div>
    </Shell>
  );
}
