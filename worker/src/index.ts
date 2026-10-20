/**
 * Plano ↔ Google Calendar token server.
 *
 * Google only hands out long-lived (refresh) tokens to a server that holds the
 * OAuth client secret. This Worker exchanges the one-time code from the
 * sign-in popup, gives the app back a short-lived access token plus the refresh
 * token *encrypted* for that user (the app stores it with its data), and later
 * turns that sealed grant into fresh access tokens. Nothing is stored here.
 *
 * Every call needs the caller's Firebase ID token (Authorization: Bearer …).
 */
import { AuthError, openGrant, sealGrant, verifyFirebaseToken } from './crypto';
import { vapidPublicKey } from './push';
export { Reminders } from './reminders';

export interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGINS: string;
  /** Private VAPID key (JWK JSON), created once by the deploy workflow. */
  VAPID_JWK?: string;
  REMINDERS?: DurableObjectNamespace;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

async function googleToken(env: Env, params: Record<string, string>): Promise<GoogleTokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...params }),
  });
  return (await res.json().catch(() => ({ error: 'bad_response' }))) as GoogleTokenResponse;
}

function revoke(token: string) {
  return fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => undefined);
}

export async function handle(req: Request, env: Env, verify = verifyFirebaseToken): Promise<Response> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).includes(origin);
  const cors: Record<string, string> = allowed
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      }
    : {};
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (!allowed) return json(403, { error: 'origin' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const path = new URL(req.url).pathname;
  if (req.method === 'GET' && path === '/push/key') {
    return env.VAPID_JWK ? json(200, { key: vapidPublicKey(JSON.parse(env.VAPID_JWK)) }) : json(503, { error: 'not_configured' });
  }
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!env.GOOGLE_CLIENT_SECRET) return json(500, { error: 'not_configured' });

  let uid: string;
  try {
    const bearer = req.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!bearer) throw new AuthError('missing');
    uid = await verify(bearer, env.FIREBASE_PROJECT_ID);
  } catch {
    return json(401, { error: 'unauthenticated' });
  }

  // Reminders live in the user's own Durable Object.
  if (path.startsWith('/push/')) {
    if (!env.REMINDERS) return json(503, { error: 'not_configured' });
    const res = await env.REMINDERS.get(env.REMINDERS.idFromName(uid)).fetch(new Request(`https://do${path}`, { method: 'POST', body: req.body }));
    return json(res.status, await res.json());
  }

  let body: { code?: unknown; grant?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'bad_request' });
  }
  const str = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length < 4096 ? v : null);

  switch (path) {
    case '/exchange': {
      const code = str(body.code);
      if (!code) return json(400, { error: 'bad_request' });
      const t = await googleToken(env, { grant_type: 'authorization_code', code, redirect_uri: 'postmessage' });
      if (!t.access_token) return json(400, { error: t.error ?? 'exchange_failed', message: t.error_description });
      if (!t.refresh_token) {
        // Google only issues a refresh token on a fresh consent. Drop this grant so the next try asks again.
        await revoke(t.access_token);
        return json(400, { error: 'no_refresh_token' });
      }
      return json(200, { accessToken: t.access_token, expiresIn: t.expires_in ?? 3600, grant: await sealGrant(t.refresh_token, uid, env.GOOGLE_CLIENT_SECRET) });
    }
    case '/token': {
      const grant = str(body.grant);
      if (!grant) return json(400, { error: 'bad_request' });
      let refreshToken: string;
      try {
        refreshToken = await openGrant(grant, uid, env.GOOGLE_CLIENT_SECRET);
      } catch {
        return json(400, { error: 'invalid_grant' });
      }
      const t = await googleToken(env, { grant_type: 'refresh_token', refresh_token: refreshToken });
      if (!t.access_token) return json(t.error === 'invalid_grant' ? 400 : 502, { error: t.error ?? 'refresh_failed' });
      return json(200, { accessToken: t.access_token, expiresIn: t.expires_in ?? 3600 });
    }
    case '/revoke': {
      const grant = str(body.grant);
      if (grant) {
        const refreshToken = await openGrant(grant, uid, env.GOOGLE_CLIENT_SECRET).catch(() => null);
        if (refreshToken) await revoke(refreshToken);
      }
      return json(200, { ok: true });
    }
    default:
      return json(404, { error: 'not_found' });
  }
}

export default { fetch: (req: Request, env: Env) => handle(req, env) };
