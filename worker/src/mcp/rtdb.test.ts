import { describe, expect, it } from 'vitest';
import { firebaseDb } from './rtdb';
import { fromB64url } from './tokens';

/** A service account made on the spot: the key pair is real, so the signature of the sign-in request can be checked. */
async function account() {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der)).replace(/(.{64})/g, '$1\n')}\n-----END PRIVATE KEY-----\n`;
  return { pair, json: JSON.stringify({ client_email: 'plano-mcp@demo.iam.gserviceaccount.com', private_key: pem, token_uri: 'https://oauth2.test/token' }) };
}

describe('the database client', () => {
  it('signs in with the service account, reads, and writes several paths at once', async () => {
    const { pair, json } = await account();
    const calls: { url: string; method: string; body?: string }[] = [];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : init?.body ? String(init.body) : undefined });
      if (url === 'https://oauth2.test/token') return Response.json({ access_token: 'tok123', expires_in: 3600 });
      if (init?.method === 'PATCH') return Response.json({});
      return Response.json({ a: { title: 'x' } });
    }) as typeof fetch;

    const db = firebaseDb({ databaseUrl: 'https://demo.firebaseio.com/', account: json, uid: 'owner1' }, fetcher);
    expect(await db.get('tasks')).toEqual({ a: { title: 'x' } });
    await db.update({ 'tasks/b': { title: 'y' }, 'tasks/a': null });
    await db.get('notes');

    // The token was asked for once, with a signed assertion for the database scope.
    const tokenCalls = calls.filter((c) => c.url === 'https://oauth2.test/token');
    expect(tokenCalls).toHaveLength(1);
    const assertion = new URLSearchParams(tokenCalls[0].body).get('assertion')!;
    const [h, c, sig] = assertion.split('.');
    expect(JSON.parse(atob(c.replace(/-/g, '+').replace(/_/g, '/')))).toMatchObject({
      iss: 'plano-mcp@demo.iam.gserviceaccount.com',
      scope: expect.stringContaining('firebase.database'),
    });
    expect(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, fromB64url(sig), new TextEncoder().encode(`${h}.${c}`))).toBe(true);

    // Reads and the write go to the owner's part, with the token.
    expect(calls[1].url).toBe('https://demo.firebaseio.com/users/owner1/tasks.json?access_token=tok123');
    expect(calls[2]).toMatchObject({ method: 'PATCH', url: 'https://demo.firebaseio.com/users/owner1.json?access_token=tok123' });
    expect(JSON.parse(calls[2].body!)).toEqual({ 'tasks/b': { title: 'y' }, 'tasks/a': null });
  });

  it('says so when the database refuses', async () => {
    const { json } = await account();
    const fetcher = (async (input: RequestInfo | URL) =>
      String(input).includes('oauth2') ? Response.json({ access_token: 't', expires_in: 3600 }) : new Response('no', { status: 401 })) as typeof fetch;
    const db = firebaseDb({ databaseUrl: 'https://demo.firebaseio.com', account: json, uid: 'u' }, fetcher);
    await expect(db.get('tasks')).rejects.toThrow(/401[\s\S]*plano-mcp@demo\.iam\.gserviceaccount\.com[\s\S]*project demo/);
    await expect(db.update({ a: 1 })).rejects.toThrow(/401/);
  });

  it('reads a key whose line breaks arrived as backslash-n', async () => {
    const { json } = await account();
    const sa = JSON.parse(json) as { private_key: string };
    const mangled = JSON.stringify({ ...JSON.parse(json), private_key: sa.private_key.replace(/\n/g, '\\n') });
    const fetcher = (async (input: RequestInfo | URL) =>
      String(input).includes('oauth2') ? Response.json({ access_token: 't', expires_in: 3600 }) : Response.json({ ok: 1 })) as typeof fetch;
    const db = firebaseDb({ databaseUrl: 'https://demo.firebaseio.com', account: mangled, uid: 'u' }, fetcher);
    expect(await db.get('x')).toEqual({ ok: 1 });
  });

  it('says what is wrong with a secret that is not a key', async () => {
    const f = (async () => new Response('{}')) as typeof fetch;
    await expect(firebaseDb({ databaseUrl: 'https://d.firebaseio.com', account: 'not json', uid: 'u' }, f).get('x')).rejects.toThrow(/not valid JSON/);
    await expect(firebaseDb({ databaseUrl: 'https://d.firebaseio.com', account: '{"a":1}', uid: 'u' }, f).get('x')).rejects.toThrow(/client_email/);
    await expect(
      firebaseDb({ databaseUrl: 'https://d.firebaseio.com', account: '{"client_email":"a@b","private_key":"@@@"}', uid: 'u' }, f).get('x'),
    ).rejects.toThrow(/could not be read/);
  });

  it('includes what Google said when it refuses', async () => {
    const { json } = await account();
    const f = (async () => new Response('{"error":"invalid_grant","error_description":"Invalid JWT Signature."}', { status: 400 })) as typeof fetch;
    await expect(firebaseDb({ databaseUrl: 'https://d.firebaseio.com', account: json, uid: 'u' }, f).get('x')).rejects.toThrow(/invalid_grant/);
  });

  it('does not accept a refused service account', async () => {
    const { json } = await account();
    const db = firebaseDb(
      { databaseUrl: 'https://demo.firebaseio.com', account: json, uid: 'u' },
      (async () => new Response('{}', { status: 400 })) as typeof fetch,
    );
    await expect(db.get('tasks')).rejects.toThrow(/service account/);
  });
});
