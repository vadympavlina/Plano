/**
 * Plano's data in Firebase Realtime Database, read and written with a service account (the server acts for one owner:
 * everything is under `users/<uid>/`). Writes go through one multi-path PATCH, so a change that touches several records
 * (a recurring task and its next copy) lands whole or not at all.
 */
const enc = new TextEncoder();
const b64 = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const bytes64url = (u: ArrayBuffer) => b64(String.fromCharCode(...new Uint8Array(u)));

/** A failure talking to Google or the database. Its text holds a status and Google's own short reason, never a key or a value. */
export class DbError extends Error {}

const reason = async (res: Response) => {
  const text = (await res.text().catch(() => '')).replace(/access_token=[^&"\s]+/g, 'access_token=…').slice(0, 300);
  return text ? `: ${text}` : '';
};

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export interface Db {
  /** A node under the owner (`tasks`, `habitLogs/<id>`…), null when it is empty. */
  get<T = unknown>(path: string): Promise<T | null>;
  /** Several writes at once: paths relative to the owner; null deletes. */
  update(values: Record<string, unknown>): Promise<void>;
  newId(): string;
}

const ALPHABET = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
/** A Firebase-style push id: sortable by time, unique enough without asking the server. */
export function pushId(now = Date.now(), random = crypto.getRandomValues(new Uint8Array(12))): string {
  let t = now;
  let head = '';
  for (let i = 0; i < 8; i++) {
    head = ALPHABET[t % 64] + head;
    t = Math.floor(t / 64);
  }
  return head + Array.from(random, (b) => ALPHABET[b % 64]).join('');
}

export function firebaseDb(opts: { databaseUrl: string; account: string; uid: string }, fetcher: typeof fetch = fetch): Db {
  // Read when first needed, so that a wrongly pasted key is reported as such (not as a crash).
  const account = (): ServiceAccount => {
    let sa: Partial<ServiceAccount>;
    try {
      sa = JSON.parse(opts.account) as Partial<ServiceAccount>;
    } catch {
      throw new DbError('The FIREBASE_SERVICE_ACCOUNT secret is not valid JSON: paste the whole key file');
    }
    if (!sa.client_email || !sa.private_key)
      throw new DbError('The FIREBASE_SERVICE_ACCOUNT secret has no client_email or private_key: it is not a service account key');
    return sa as ServiceAccount;
  };
  const base = opts.databaseUrl.replace(/\/+$/, '');
  /** For a refusal (401/403): which account asked and where the database is, so the cause (another project, a missing role) can be seen. */
  const hint = () => {
    let email = 'unknown';
    try {
      email = account().client_email;
    } catch {
      /* reported elsewhere */
    }
    const project = (() => {
      try {
        return new URL(base).hostname.split('.')[0].replace(/-default-rtdb$/, '');
      } catch {
        return '?';
      }
    })();
    return ` The service account is ${email}; the database belongs to the project ${project}: the account must be created in that project (or be given the role «Firebase Realtime Database Admin» there).`;
  };
  let token: { value: string; exp: number } | undefined;

  async function accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (token && token.exp - 120 > now) return token.value;
    const sa = account();
    let key: CryptoKey;
    const header = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64(
      JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
        aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    );
    try {
      // The key's line breaks may arrive as real ones or as a backslash and an n (a key pasted through a form).
      const der = Uint8Array.from(
        atob(
          sa.private_key
            .replace(/-----[A-Z ]+-----/g, '')
            .replace(/\\n/g, '')
            .replace(/\s+/g, ''),
        ),
        (c) => c.charCodeAt(0),
      );
      key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    } catch {
      throw new DbError('The private_key in FIREBASE_SERVICE_ACCOUNT could not be read');
    }
    const sig = bytes64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${header}.${claims}`)));
    const res = await fetcher(sa.token_uri ?? 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${sig}` }),
    });
    const raw = await res.text();
    const body = (() => {
      try {
        return JSON.parse(raw) as { access_token?: string; expires_in?: number };
      } catch {
        return {} as { access_token?: string; expires_in?: number };
      }
    })();
    if (!res.ok || !body.access_token)
      throw new DbError(`The Firebase service account was refused (${res.status})${raw ? `: ${raw.replace(/\s+/g, ' ').slice(0, 300)}` : ''}`);
    token = { value: body.access_token, exp: now + (body.expires_in ?? 3600) };
    return token.value;
  }

  const url = (path: string, access: string) => `${base}/users/${opts.uid}${path ? `/${path}` : ''}.json?access_token=${encodeURIComponent(access)}`;

  return {
    newId: () => pushId(),
    async get<T>(path: string) {
      const res = await fetcher(url(path, await accessToken()));
      if (!res.ok) throw new DbError(`Database read failed (${res.status})${await reason(res)}${res.status === 401 || res.status === 403 ? hint() : ''}`);
      return (await res.json()) as T | null;
    },
    async update(values) {
      const res = await fetcher(url('', await accessToken()), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new DbError(`Database write failed (${res.status})${await reason(res)}${res.status === 401 || res.status === 403 ? hint() : ''}`);
    },
  };
}
