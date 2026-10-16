import { afterEach, describe, expect, it, vi } from 'vitest';
import { b64url, openGrant, sealGrant, verifyFirebaseToken, type Jwk } from './crypto';
import { handle, type Env } from './index';

const enc = new TextEncoder();
const PROJECT = 'plano-test';
const NOW = 1_800_000_000;

async function signer() {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' } as Jwk;
  const sign = async (payload: object, header: object = { alg: 'RS256', kid: 'k1' }) => {
    const head = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(payload)))}`;
    const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, enc.encode(head)));
    return `${head}.${b64url(sig)}`;
  };
  return { sign, keys: async () => [jwk] };
}

const claims = (over: object = {}) => ({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'user1', iat: NOW - 10, exp: NOW + 3000, ...over });

describe('verifyFirebaseToken', () => {
  it('accepts a valid token and returns the uid', async () => {
    const s = await signer();
    expect(await verifyFirebaseToken(await s.sign(claims()), PROJECT, s.keys, NOW)).toBe('user1');
  });
  it('rejects wrong project, expiry, algorithm and signature', async () => {
    const s = await signer();
    const other = await signer();
    await expect(verifyFirebaseToken(await s.sign(claims({ aud: 'x' })), PROJECT, s.keys, NOW)).rejects.toThrow();
    await expect(verifyFirebaseToken(await s.sign(claims({ exp: NOW - 1 })), PROJECT, s.keys, NOW)).rejects.toThrow();
    await expect(verifyFirebaseToken(await s.sign(claims(), { alg: 'none', kid: 'k1' }), PROJECT, s.keys, NOW)).rejects.toThrow();
    await expect(verifyFirebaseToken(await other.sign(claims()), PROJECT, s.keys, NOW)).rejects.toThrow();
    await expect(verifyFirebaseToken('a.b', PROJECT, s.keys, NOW)).rejects.toThrow();
  });
});

describe('sealed grants', () => {
  it('round-trips for the same user and secret only', async () => {
    const g = await sealGrant('refresh-123', 'u1', 'secret');
    expect(g.startsWith('v1.')).toBe(true);
    expect(g).not.toContain('refresh-123');
    expect(await openGrant(g, 'u1', 'secret')).toBe('refresh-123');
    await expect(openGrant(g, 'u2', 'secret')).rejects.toThrow();
    await expect(openGrant(g, 'u1', 'other')).rejects.toThrow();
  });
});

describe('handle', () => {
  const env: Env = { GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'csecret', FIREBASE_PROJECT_ID: PROJECT, ALLOWED_ORIGINS: 'https://app.test' };
  const verify = async (t: string) => {
    if (t !== 'good') throw new Error('bad');
    return 'u1';
  };
  const req = (path: string, body: unknown, init: { origin?: string; auth?: string; method?: string } = {}) =>
    new Request(`https://w.test${path}`, {
      method: init.method ?? 'POST',
      headers: { Origin: init.origin ?? 'https://app.test', Authorization: `Bearer ${init.auth ?? 'good'}`, 'Content-Type': 'application/json' },
      body: init.method === 'OPTIONS' ? undefined : JSON.stringify(body),
    });
  const google = (body: object) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body)));
  afterEach(() => vi.restoreAllMocks());

  it('rejects other origins and missing auth', async () => {
    expect((await handle(req('/token', {}, { origin: 'https://evil.test' }), env, verify)).status).toBe(403);
    expect((await handle(req('/token', { grant: 'x' }, { auth: 'bad' }), env, verify)).status).toBe(401);
    const pre = await handle(req('/token', null, { method: 'OPTIONS' }), env, verify);
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('https://app.test');
  });

  it('exchanges a code into an access token and a sealed grant, then refreshes it', async () => {
    const f = google({ access_token: 'at1', expires_in: 3599, refresh_token: 'rt1' });
    const res = await handle(req('/exchange', { code: 'c1' }), env, verify);
    const out = (await res.json()) as { accessToken: string; grant: string };
    expect(res.status).toBe(200);
    expect(out.accessToken).toBe('at1');
    expect(String(f.mock.calls[0][1]?.body)).toContain('redirect_uri=postmessage');
    expect(await openGrant(out.grant, 'u1', 'csecret')).toBe('rt1');

    const f2 = google({ access_token: 'at2', expires_in: 3599 });
    const res2 = await handle(req('/token', { grant: out.grant }), env, verify);
    expect(await res2.json()).toEqual({ accessToken: 'at2', expiresIn: 3599 });
    expect(String(f2.mock.calls[0][1]?.body)).toContain('refresh_token=rt1');
  });

  it('reports a missing refresh token and revoked grants', async () => {
    google({ access_token: 'at1' });
    expect(await (await handle(req('/exchange', { code: 'c1' }), env, verify)).json()).toEqual({ error: 'no_refresh_token' });
    const grant = await sealGrant('rt1', 'u1', 'csecret');
    vi.restoreAllMocks();
    google({ error: 'invalid_grant' });
    const res = await handle(req('/token', { grant }), env, verify);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_grant' });
    expect((await handle(req('/token', { grant: 'v1.zz.zz' }), env, verify)).status).toBe(400);
  });
});
