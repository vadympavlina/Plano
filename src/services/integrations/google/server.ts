/**
 * Client for the Plano token server (worker/). With it, Google access lasts until
 * it is revoked: the server keeps nothing, the app keeps an encrypted grant that
 * only the server can turn into short-lived access tokens.
 */
import { getFirebaseAuth } from '@/lib/firebase/config';

export const TOKEN_SERVER_URL: string = (import.meta.env.VITE_GCAL_TOKEN_URL ?? '').replace(/\/+$/, '');
export const usesTokenServer = /^https?:\/\//.test(TOKEN_SERVER_URL);

export class TokenServerError extends Error {
  constructor(
    message: string,
    /** `invalid_grant`: access was revoked or expired — the person has to connect again. */
    readonly code: 'invalid_grant' | 'no_refresh_token' | 'unauthenticated' | 'network' | 'server',
  ) {
    super(message);
  }
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new TokenServerError('Увійдіть у Plano, щоб синхронізувати Google Calendar.', 'unauthenticated');
  const idToken = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch(`${TOKEN_SERVER_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new TokenServerError('Немає зв’язку з сервером синхронізації Google.', 'network');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.ok) return data;
  if (data.error === 'invalid_grant') throw new TokenServerError('Доступ до Google Calendar скасовано. Підключіть його знову.', 'invalid_grant');
  if (data.error === 'no_refresh_token')
    throw new TokenServerError('Google не видав постійний доступ. Натисніть «Підключити» ще раз — Google попросить дозвіл знову.', 'no_refresh_token');
  if (res.status === 401) throw new TokenServerError('Сесія Plano застаріла. Оновіть сторінку.', 'unauthenticated');
  throw new TokenServerError('Сервер синхронізації Google тимчасово недоступний.', 'server');
}

export interface ExchangeResult {
  accessToken: string;
  expiresIn: number;
  /** Encrypted refresh token, safe to store with the user's data. */
  grant: string;
}

export const exchangeCode = (code: string) => call<ExchangeResult>('/exchange', { code });
export const refreshAccess = (grant: string) => call<{ accessToken: string; expiresIn: number }>('/token', { grant });
export const revokeGrant = (grant: string) => call<{ ok: boolean }>('/revoke', { grant });
