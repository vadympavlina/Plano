/** Small WebCrypto helpers: base64url, Firebase ID token verification and sealed refresh tokens. */

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- Firebase ID tokens ---------- */

export interface Jwk extends JsonWebKey {
  kid?: string;
}

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let keyCache: { keys: Jwk[]; until: number } | null = null;

export async function firebaseKeys(): Promise<Jwk[]> {
  if (keyCache && keyCache.until > Date.now()) return keyCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error('jwks');
  const keys = ((await res.json()) as { keys: Jwk[] }).keys;
  keyCache = { keys, until: Date.now() + 60 * 60_000 };
  return keys;
}

export class AuthError extends Error {}

/** Verifies a Firebase Auth ID token for `projectId` and returns the user id. */
export async function verifyFirebaseToken(
  token: string,
  projectId: string,
  getKeys: () => Promise<Jwk[]> = firebaseKeys,
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('malformed');
  let header: { alg?: string; kid?: string };
  let payload: { aud?: string; iss?: string; exp?: number; iat?: number; sub?: string };
  try {
    header = JSON.parse(dec.decode(fromB64url(parts[0])));
    payload = JSON.parse(dec.decode(fromB64url(parts[1])));
  } catch {
    throw new AuthError('malformed');
  }
  if (header.alg !== 'RS256' || !header.kid) throw new AuthError('alg');
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw new AuthError('audience');
  if (typeof payload.exp !== 'number' || payload.exp <= now) throw new AuthError('expired');
  if (typeof payload.iat !== 'number' || payload.iat > now + 300) throw new AuthError('iat');
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) throw new AuthError('sub');
  const jwk = (await getKeys()).find((k) => k.kid === header.kid);
  if (!jwk) throw new AuthError('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromB64url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new AuthError('signature');
  return payload.sub;
}

/* ---------- Sealed refresh tokens ---------- */

// The key is derived from the OAuth client secret, so it never has to be stored separately.
async function grantKey(secret: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('plano-gcal-grant'), info: enc.encode('v1') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypts a refresh token for one user; the result is useless without the server secret or for another uid. */
export async function sealGrant(refreshToken: string, uid: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(uid) }, await grantKey(secret), enc.encode(refreshToken));
  return `v1.${b64url(iv)}.${b64url(new Uint8Array(ct))}`;
}

export async function openGrant(grant: string, uid: string, secret: string): Promise<string> {
  const [v, iv, ct] = grant.split('.');
  if (v !== 'v1' || !iv || !ct) throw new Error('grant');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(iv), additionalData: enc.encode(uid) }, await grantKey(secret), fromB64url(ct));
  return dec.decode(pt);
}
