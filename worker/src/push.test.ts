import { describe, expect, it } from 'vitest';
import { b64url, fromB64url } from './crypto';
import { encryptPayload, vapidPublicKey } from './push';

const enc = new TextEncoder();
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) {
  const k = await crypto.subtle.importKey('raw', ikm as Uint8Array<ArrayBuffer>, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, info: info as Uint8Array<ArrayBuffer> }, k, n * 8));
}
const cat = (...p: Uint8Array[]) => Uint8Array.from(p.flatMap((x) => [...x]));

describe('web push encryption', () => {
  it('produces an aes128gcm record the browser can decrypt (RFC 8291)', async () => {
    const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    const uaPublic = new Uint8Array((await crypto.subtle.exportKey('raw', ua.publicKey)) as ArrayBuffer);
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const body = await encryptPayload({ endpoint: 'https://push.test/x', keys: { p256dh: b64url(uaPublic), auth: b64url(auth) } }, '{"title":"Привіт"}');

    const salt = body.slice(0, 16);
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    expect(body[20]).toBe(65);
    const asPublic = body.slice(21, 86);
    const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
    const ikm = await hkdf(auth, shared, cat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
    const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
    const key = await crypto.subtle.importKey('raw', cek as Uint8Array<ArrayBuffer>, 'AES-GCM', false, ['decrypt']);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce as Uint8Array<ArrayBuffer> }, key, body.slice(86)));
    expect(plain.at(-1)).toBe(2);
    expect(new TextDecoder().decode(plain.slice(0, -1))).toBe('{"title":"Привіт"}');
  });

  it('derives the public VAPID key from the private JWK', async () => {
    const k = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])) as CryptoKeyPair;
    const raw = new Uint8Array((await crypto.subtle.exportKey('raw', k.publicKey)) as ArrayBuffer);
    expect(fromB64url(vapidPublicKey(await crypto.subtle.exportKey('jwk', k.privateKey)))).toEqual(raw);
  });
});
