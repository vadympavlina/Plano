/** Web Push without libraries: VAPID (RFC 8292) + aes128gcm payload encryption (RFC 8291). */
import { b64url, fromB64url } from './crypto';

const enc = new TextEncoder();
type Bytes = Uint8Array<ArrayBuffer>;

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const concat = (...parts: Uint8Array[]): Bytes => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) out.set(p, (i += p.length) - p.length);
  return out;
};

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, bytes: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

/** Encrypts `payload` for one subscription (single aes128gcm record). */
export async function encryptPayload(sub: PushSubscriptionJSON, payload: string, salt: Bytes = crypto.getRandomValues(new Uint8Array(16))) {
  const uaPublic = fromB64url(sub.keys.p256dh);
  const auth = fromB64url(sub.keys.auth);
  const as = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', as.publicKey)) as ArrayBuffer);
  const ua = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ua }, as.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(payload), new Uint8Array([2]))));
  const header = new Uint8Array(21);
  new DataView(header.buffer).setUint32(16, 4096);
  header.set(salt);
  header[20] = 65;
  return concat(header, asPublic, cipher);
}

/** Public VAPID key (uncompressed point, base64url) from the private JWK. */
export const vapidPublicKey = (jwk: JsonWebKey) => b64url(concat(new Uint8Array([4]), fromB64url(jwk.x!), fromB64url(jwk.y!)));

async function vapidAuth(endpoint: string, jwk: JsonWebKey, subject: string) {
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const part = (o: object) => b64url(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned)));
  return `vapid t=${unsigned}.${b64url(sig)}, k=${vapidPublicKey(jwk)}`;
}

/** Sends one notification. Returns false when the subscription is gone (404/410) and should be dropped. */
export async function sendPush(sub: PushSubscriptionJSON, payload: object, jwk: JsonWebKey, subject: string): Promise<boolean> {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuth(sub.endpoint, jwk, subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '3600',
      Urgency: 'high',
    },
    body: await encryptPayload(sub, JSON.stringify(payload)),
  });
  return res.status !== 404 && res.status !== 410;
}
