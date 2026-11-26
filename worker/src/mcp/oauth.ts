/**
 * Sign-in for the MCP server (OAuth 2.1 with PKCE, dynamic client registration), the way ChatGPT and other clients expect.
 * There is one owner. The consent page asks for the owner's passphrase (the `MCP_OWNER_SECRET` secret); what it hands out
 * are signed tokens (see tokens.ts), so the server keeps no state. Access tokens live an hour, refresh tokens 60 days.
 */
import { pkceOk, sameSecret, sign, verify } from './tokens';

export interface OAuthEnv {
  MCP_OWNER_SECRET: string;
}

const CODE_TTL = 300;
const ACCESS_TTL = 3600;
const REFRESH_TTL = 60 * 86400;
const now = () => Math.floor(Date.now() / 1000);

const SECURITY = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id, MCP-Protocol-Version',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
};
const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...SECURITY, ...cors, ...extra } });
const oauthError = (error: string, description?: string, status = 400) => json(status, { error, error_description: description });

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** redirect_uri: https, or http only for the machine itself (a developer's inspector). */
const allowedRedirect = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' || (x.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(x.hostname));
  } catch {
    return false;
  }
};

export function metadata(origin: string) {
  return {
    resource: {
      resource: `${origin}/mcp`,
      authorization_servers: [origin],
      bearer_methods_supported: ['header'],
      scopes_supported: ['plano'],
      resource_name: 'Plano',
    },
    server: {
      issuer: origin,
      authorization_endpoint: `${origin}/authorize`,
      token_endpoint: `${origin}/token`,
      registration_endpoint: `${origin}/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['plano'],
    },
  };
}

/** Dynamic client registration: the client id carries its redirect addresses, signed. */
export async function register(req: Request, env: OAuthEnv): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { redirect_uris?: unknown; client_name?: unknown } | null;
  const uris = Array.isArray(body?.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === 'string' && allowedRedirect(u)).slice(0, 10)
    : [];
  if (!uris.length) return oauthError('invalid_redirect_uri', 'At least one https redirect_uri is needed');
  const name = typeof body?.client_name === 'string' ? body.client_name.slice(0, 80) : 'MCP client';
  const clientId = await sign({ r: uris, n: name, exp: now() + 5 * 365 * 86400 }, env.MCP_OWNER_SECRET, 'client');
  return json(201, {
    client_id: clientId,
    client_name: name,
    redirect_uris: uris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  });
}

interface AuthParams {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  clientName: string;
}

async function authParams(get: (k: string) => string, env: OAuthEnv): Promise<AuthParams | Response> {
  const client = await verify(get('client_id'), env.MCP_OWNER_SECRET, 'client');
  if (!client) return oauthError('invalid_client', 'Unknown client');
  const redirectUri = get('redirect_uri');
  if (!(client.r as string[]).includes(redirectUri)) return oauthError('invalid_request', 'redirect_uri is not registered');
  if (get('response_type') !== 'code') return oauthError('unsupported_response_type');
  if (get('code_challenge_method') !== 'S256' || !get('code_challenge')) return oauthError('invalid_request', 'PKCE (S256) is required');
  return { clientId: get('client_id'), redirectUri, state: get('state'), challenge: get('code_challenge'), clientName: String(client.n) };
}

const page = (p: AuthParams, error?: string) =>
  new Response(
    `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Plano — дозвіл</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0d0f;color:#f2f2f4;font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}
main{width:min(420px,92vw);background:#fcfbf9;color:#15171c;border-radius:22px;padding:28px}h1{font-size:22px;margin:0 0 6px}p{color:#5d6472;margin:6px 0 16px}
input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #d9d6ce;border-radius:12px;font:inherit}button{margin-top:14px;width:100%;padding:13px;border:0;border-radius:999px;background:#15171c;color:#fff;font:inherit;font-weight:600;cursor:pointer}
.e{color:#b42318;margin:10px 0 0}</style></head><body><main><h1>Plano</h1>
<p><b>${esc(p.clientName)}</b> просить доступ до вашого планера: читати задачі, події, нотатки й звички та створювати й змінювати їх.</p>
<form method="post"><input type="hidden" name="client_id" value="${esc(p.clientId)}"><input type="hidden" name="redirect_uri" value="${esc(p.redirectUri)}"><input type="hidden" name="state" value="${esc(p.state)}"><input type="hidden" name="code_challenge" value="${esc(p.challenge)}"><input type="hidden" name="code_challenge_method" value="S256"><input type="hidden" name="response_type" value="code">
<label for="k">Пароль доступу</label><input id="k" name="passphrase" type="password" autocomplete="current-password" autofocus required>
${error ? `<p class="e" role="alert">${esc(error)}</p>` : ''}<button type="submit">Дозволити</button></form></main></body></html>`,
    {
      status: error ? 401 : 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
        'X-Frame-Options': 'DENY',
        ...SECURITY,
      },
    },
  );

export async function authorize(req: Request, env: OAuthEnv): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const p = await authParams((k) => url.searchParams.get(k) ?? '', env);
    return p instanceof Response ? p : page(p);
  }
  const form = await req.formData().catch(() => null);
  if (!form) return oauthError('invalid_request');
  const get = (k: string) => String(form.get(k) ?? '');
  const p = await authParams(get, env);
  if (p instanceof Response) return p;
  // A wrong guess costs a second: the passphrase has to be long, and guessing it has to be slow.
  if (!(await sameSecret(get('passphrase'), env.MCP_OWNER_SECRET))) {
    await new Promise((r) => setTimeout(r, 1000));
    return page(p, 'Невірний пароль.');
  }
  const code = await sign({ c: p.clientId, u: p.redirectUri, k: p.challenge, exp: now() + CODE_TTL }, env.MCP_OWNER_SECRET, 'code');
  const to = new URL(p.redirectUri);
  to.searchParams.set('code', code);
  if (p.state) to.searchParams.set('state', p.state);
  return new Response(null, { status: 302, headers: { Location: to.toString(), ...SECURITY } });
}

async function issue(env: OAuthEnv, clientId: string) {
  const [access, refresh] = await Promise.all([
    sign({ k: 'access', exp: now() + ACCESS_TTL }, env.MCP_OWNER_SECRET, 'access'),
    sign({ k: 'refresh', c: clientId, exp: now() + REFRESH_TTL }, env.MCP_OWNER_SECRET, 'refresh'),
  ]);
  return json(200, { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL, refresh_token: refresh, scope: 'plano' });
}

export async function token(req: Request, env: OAuthEnv): Promise<Response> {
  const raw = await req.text();
  const body = (req.headers.get('Content-Type') ?? '').includes('json')
    ? ((JSON.parse(raw || '{}') as Record<string, string>) ?? {})
    : Object.fromEntries(new URLSearchParams(raw));
  const get = (k: string) => (typeof body[k] === 'string' ? body[k] : '');
  if (get('grant_type') === 'authorization_code') {
    const code = await verify(get('code'), env.MCP_OWNER_SECRET, 'code');
    if (!code) return oauthError('invalid_grant', 'The code is invalid or has expired');
    if (code.c !== get('client_id') || code.u !== get('redirect_uri')) return oauthError('invalid_grant', 'The code was issued to another client');
    if (!(await pkceOk(get('code_verifier'), String(code.k)))) return oauthError('invalid_grant', 'PKCE check failed');
    return issue(env, get('client_id'));
  }
  if (get('grant_type') === 'refresh_token') {
    const r = await verify(get('refresh_token'), env.MCP_OWNER_SECRET, 'refresh');
    if (!r || r.k !== 'refresh') return oauthError('invalid_grant', 'The refresh token is invalid or has expired');
    return issue(env, String(r.c));
  }
  return oauthError('unsupported_grant_type');
}

/** Is this request signed in? */
export async function authorized(req: Request, env: OAuthEnv): Promise<boolean> {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '');
  if (!m) return false;
  const t = await verify(m[1], env.MCP_OWNER_SECRET, 'access');
  return !!t && t.k === 'access';
}
