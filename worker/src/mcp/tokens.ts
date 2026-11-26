/**
 * Stateless signed tokens for the MCP server's sign-in (OAuth 2.1): authorization codes, access and refresh tokens, and
 * the client ids handed out at registration are all `v1.<payload>.<signature>` (HMAC-SHA-256 with a key derived from the
 * owner's secret). Nothing is stored; changing the secret ends every session at once.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64url = (bytes: ArrayBuffer | Uint8Array) => {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const fromB64url = (s: string) => {
  const b = atob(
    s
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(s.length / 4) * 4, '='),
  );
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

const keyOf = (secret: string, purpose: string) =>
  crypto.subtle.importKey('raw', enc.encode(`plano-mcp|${purpose}|${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export type Payload = Record<string, unknown> & { exp: number };

/** `v1.<payload>.<signature>`; `exp` is in seconds. */
export async function sign(payload: Payload, secret: string, purpose = 'token'): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const mac = await crypto.subtle.sign('HMAC', await keyOf(secret, purpose), enc.encode(`v1.${body}`));
  return `v1.${body}.${b64url(mac)}`;
}

/** The payload when the signature is ours and the token has not expired, else null. */
export async function verify(token: string, secret: string, purpose = 'token', now = Math.floor(Date.now() / 1000)): Promise<Payload | null> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await keyOf(secret, purpose), fromB64url(parts[2]), enc.encode(`v1.${parts[1]}`));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(fromB64url(parts[1]))) as Payload;
    return typeof payload.exp === 'number' && payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}

/** Compares two strings without leaking where they differ (both are hashed first, so the lengths do not matter). */
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([a, b].map(async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))));
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** PKCE: S256(verifier) must equal the challenge given when the code was asked for. */
export async function pkceOk(verifier: string, challenge: string): Promise<boolean> {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  return sameSecret(b64url(await crypto.subtle.digest('SHA-256', enc.encode(verifier))), challenge);
}
