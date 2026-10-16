/**
 * Google sign-in for Calendar access via Google Identity Services (token model).
 * The access token is kept only in this browser's localStorage — it is never
 * written to the database — and expires after about an hour. With the token
 * server (server.ts) the app instead gets a one-time code and the server keeps
 * the access renewable.
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

interface CodeResponse {
  code?: string;
  error?: string;
  error_description?: string;
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
          initCodeClient(config: {
            client_id: string;
            scope: string;
            ux_mode: 'popup';
            select_account?: boolean;
            callback: (r: CodeResponse) => void;
            error_callback?: (e: { type: string; message?: string }) => void;
          }): { requestCode(): void };
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
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function storeToken(token: string, expiresInSeconds: number) {
  const stored: StoredToken = { token, expiresAt: Date.now() + expiresInSeconds * 1000 };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* ignore */
  }
}

function popupError(e: { type: string; message?: string }) {
  if (e.type === 'popup_closed') return new GoogleAuthError('Вікно входу Google закрито.', 'popup_closed');
  if (e.type === 'popup_failed_to_open') return new GoogleAuthError('Браузер заблокував вікно входу Google. Дозвольте спливні вікна.', 'popup_failed');
  return new GoogleAuthError(e.message || 'Помилка входу Google.', 'unknown');
}

/**
 * Asks Google for a one-time authorization code for the token server.
 * Must be called from a click, like requestGoogleToken.
 */
export async function requestGoogleCode(): Promise<string> {
  if (!isGoogleConfigured) throw new GoogleAuthError('Google Client ID не налаштовано.', 'not_configured');
  await loadScript();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initCodeClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      ux_mode: 'popup',
      callback: (r) => {
        if (r.code) resolve(r.code);
        else reject(new GoogleAuthError(r.error_description || 'Google не надав доступ.', r.error === 'access_denied' ? 'denied' : 'unknown'));
      },
      error_callback: (e) => reject(popupError(e)),
    });
    client.requestCode();
  });
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
        storeToken(r.access_token, r.expires_in ?? 3600);
        resolve(r.access_token);
      },
      error_callback: (e) => reject(popupError(e)),
    });
    client.requestAccessToken({ prompt: consent ? 'consent' : '' });
  });
}

export async function revokeGoogleToken() {
  const token = getStoredToken();
  clearStoredToken();
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token);
}
