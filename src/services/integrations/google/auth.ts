/**
 * Google sign-in for Calendar access via Google Identity Services (token model).
 * The access token lives only in this tab's sessionStorage — it is never written
 * to the database — and expires after about an hour.
 */
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
export const isGoogleConfigured = GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

const STORAGE_KEY = 'plano:gcal-token';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (r: TokenResponse) => void;
            error_callback?: (e: { type: string; message?: string }) => void;
          }): TokenClient;
          revoke(token: string, done?: () => void): void;
        };
      };
    };
  }
}

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    readonly code: 'popup_closed' | 'popup_failed' | 'denied' | 'not_configured' | 'script' | 'unknown',
  ) {
    super(message);
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new GoogleAuthError('Не вдалося завантажити вхід Google. Перевірте з’єднання.', 'script'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

interface StoredToken {
  token: string;
  expiresAt: number;
}

export function getStoredToken(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    // Treat tokens as expired a minute early.
    return t.expiresAt - 60_000 > Date.now() ? t.token : null;
  } catch {
    return null;
  }
}

export function clearStoredToken() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Asks Google for an access token. Must be called from a user gesture (click),
 * otherwise browsers block the popup. With `consent: false`, a person who has
 * already granted access just sees the popup open and close.
 */
export async function requestGoogleToken({ consent }: { consent: boolean }): Promise<string> {
  if (!isGoogleConfigured) throw new GoogleAuthError('Google Client ID не налаштовано.', 'not_configured');
  await loadScript();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (r) => {
        if (!r.access_token) {
          reject(new GoogleAuthError(r.error_description || 'Google не надав доступ.', r.error === 'access_denied' ? 'denied' : 'unknown'));
          return;
        }
        const stored: StoredToken = { token: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 };
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        } catch {
          /* ignore */
        }
        resolve(r.access_token);
      },
      error_callback: (e) => {
        if (e.type === 'popup_closed') reject(new GoogleAuthError('Вікно входу Google закрито.', 'popup_closed'));
        else if (e.type === 'popup_failed_to_open') reject(new GoogleAuthError('Браузер заблокував вікно входу Google. Дозвольте спливні вікна.', 'popup_failed'));
        else reject(new GoogleAuthError(e.message || 'Помилка входу Google.', 'unknown'));
      },
    });
    client.requestAccessToken({ prompt: consent ? 'consent' : '' });
  });
}

export async function revokeGoogleToken() {
  const token = getStoredToken();
  clearStoredToken();
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token);
}
