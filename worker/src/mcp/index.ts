/**
 * Plano as an MCP server: an AI assistant (ChatGPT, Claude…) signs in once as the owner and then reads and changes the
 * planner through tools. Routes: /mcp (the protocol), /oauth/authorize, /oauth/token, /oauth/register and the /.well-known documents
 * (the sign-in). Off until the secrets are set (see docs/mcp.md).
 */
import { authorize, authorized, cors, metadata, register, token } from './oauth';
import { firebaseDb, type Db } from './rtdb';
import { handleMessage } from './server';

export interface McpEnv {
  FIREBASE_DATABASE_URL?: string;
  FIREBASE_SERVICE_ACCOUNT?: string;
  MCP_OWNER_SECRET?: string;
  MCP_OWNER_UID?: string;
  MCP_TIMEZONE?: string;
}

// «/token», «/revoke» and «/exchange» belong to the Google token server: the sign-in lives under /oauth/.
const PATHS = new Set([
  '/mcp',
  '/oauth/authorize',
  '/oauth/token',
  '/oauth/register',
  '/.well-known/oauth-authorization-server',
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-protected-resource/mcp',
]);
const MAX_BODY = 1_000_000;

export interface McpDeps {
  db?: Db;
  now?: () => Date;
}

const jsonResponse = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors, ...extra } });

/** The response for a request that belongs to the MCP server, or null when it is not one (and so not ours). */
export async function handleMcp(req: Request, env: McpEnv, deps: McpDeps = {}): Promise<Response | null> {
  const url = new URL(req.url);
  if (!PATHS.has(url.pathname)) return null;
  const { MCP_OWNER_SECRET: secret, MCP_OWNER_UID: uid, FIREBASE_DATABASE_URL: databaseUrl, FIREBASE_SERVICE_ACCOUNT: account } = env;
  // Off until everything it needs is set; a secret that is too short would make the passphrase guessable.
  // It says what is missing (names only, never values), so a wrong setup is easy to find.
  const missing = [
    !account && 'FIREBASE_SERVICE_ACCOUNT',
    !uid && 'MCP_OWNER_UID',
    !secret ? 'MCP_OWNER_SECRET' : secret.length < 16 && 'MCP_OWNER_SECRET (shorter than 16 characters)',
    !databaseUrl && 'FIREBASE_DATABASE_URL',
  ].filter(Boolean);
  if (missing.length || !secret || !uid || !databaseUrl || !account) return jsonResponse(503, { error: 'mcp_not_configured', missing });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Max-Age': '86400' } });
  const origin = url.origin;
  const oauth = { MCP_OWNER_SECRET: secret };

  switch (url.pathname) {
    case '/.well-known/oauth-protected-resource':
    case '/.well-known/oauth-protected-resource/mcp':
      return jsonResponse(200, metadata(origin).resource);
    case '/.well-known/oauth-authorization-server':
      return jsonResponse(200, metadata(origin).server);
    case '/oauth/register':
      return req.method === 'POST' ? register(req, oauth) : jsonResponse(405, { error: 'method_not_allowed' }, { Allow: 'POST' });
    case '/oauth/authorize':
      return req.method === 'GET' || req.method === 'POST' ? authorize(req, oauth) : jsonResponse(405, { error: 'method_not_allowed' }, { Allow: 'GET, POST' });
    case '/oauth/token':
      return req.method === 'POST' ? token(req, oauth) : jsonResponse(405, { error: 'method_not_allowed' }, { Allow: 'POST' });
  }

  // /mcp
  if (!(await authorized(req, oauth))) {
    return jsonResponse(401, { error: 'unauthorized' }, { 'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"` });
  }
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' }, { Allow: 'POST' });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return jsonResponse(413, { error: 'too_large' });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonResponse(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  const ctx = {
    db: deps.db ?? firebaseDb({ databaseUrl, account, uid }),
    tz: env.MCP_TIMEZONE || 'Europe/Kyiv',
    now: deps.now ?? (() => new Date()),
  };
  const messages = Array.isArray(body) ? body : [body];
  const answers = (await Promise.all(messages.map((m) => handleMessage(m as never, ctx)))).filter((a) => a !== null);
  // Only notifications came in: nothing to say.
  if (!answers.length) return new Response(null, { status: 202, headers: cors });
  return jsonResponse(200, Array.isArray(body) ? answers : answers[0]);
}
