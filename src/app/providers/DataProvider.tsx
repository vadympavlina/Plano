import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Backend } from '@/lib/backend/types';
import { parseCollection } from '@/lib/validation/parse';
import {
  collectionSchemas,
  habitLogsSchema,
  integrationSchema,
  profileSchema,
  settingsSchema,
} from '@/lib/validation/schemas';
import { DEFAULT_SETTINGS, starterCategories } from '@/lib/defaults';
import { createRepositories, nowIso, type Repositories } from '@/services/repositories';
import { setConnected } from '@/services/sync';
import type { UserData } from '@/types';
import { applyOps, clearOutbox, readOutbox } from '@/lib/backend/outbox';

type NodeKey = keyof UserData;
const NODES: NodeKey[] = [
  'profile',
  'settings',
  'categories',
  'tasks',
  'events',
  'projects',
  'habits',
  'habitLogs',
  'goals',
  'notes',
  'integrations',
];

const EMPTY: UserData = {
  profile: {},
  settings: DEFAULT_SETTINGS,
  categories: {},
  tasks: {},
  events: {},
  projects: {},
  habits: {},
  habitLogs: {},
  goals: {},
  notes: {},
  integrations: {},
};

function parseNode(key: NodeKey, raw: unknown): UserData[NodeKey] {
  const warn = (id: string, e: unknown) => console.warn(`Plano: skipped invalid ${key}/${id}`, e);
  switch (key) {
    case 'profile':
      return profileSchema.safeParse(raw ?? {}).data ?? {};
    case 'settings':
      return { ...DEFAULT_SETTINGS, ...(settingsSchema.partial().safeParse(raw ?? {}).data ?? {}) };
    case 'habitLogs': {
      const parsed = habitLogsSchema.safeParse(raw ?? {});
      return parsed.success ? parsed.data : {};
    }
    case 'integrations':
      return parseCollection(raw, integrationSchema as never, warn);
    default:
      return parseCollection(raw, collectionSchemas[key] as never, warn);
  }
}

interface DataContextValue {
  data: UserData;
  /** True once every node has delivered its first value. */
  ready: boolean;
  error: string | null;
  repos: Repositories;
  uid: string;
  backendKind: Backend['kind'];
}

const DataContext = createContext<DataContextValue | null>(null);

/**
 * Last data seen from the server, per user, so the installed app opens offline
 * (Firebase's web SDK keeps nothing on disk). Cleared on sign-out.
 */
const CACHE_PREFIX = 'plano:cache:';
/** Set on sign-out so a save already scheduled can't bring the data back. */
let cacheBlocked = false;
function readCache(uid: string): Partial<Record<NodeKey, unknown>> | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE_PREFIX + uid) ?? 'null');
  } catch {
    return null;
  }
}
export function clearDataCache() {
  cacheBlocked = true;
  clearOutbox();
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function DataProvider({ backend, uid, children }: { backend: Backend; uid: string; children: ReactNode }) {
  const [data, setData] = useState<UserData>(EMPTY);
  const [loaded, setLoaded] = useState<Set<NodeKey>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // Seeding defaults must look at the server, never at the offline cache.
  const [serverReady, setServerReady] = useState(false);
  const rawNull = useRef<Partial<Record<NodeKey, boolean>>>({});
  const seeded = useRef(false);
  const repos = useMemo(() => createRepositories(backend, uid), [backend, uid]);

  // One realtime listener per node; all are removed on sign-out / user change.
  useEffect(() => {
    setData(EMPTY);
    setLoaded(new Set());
    setServerReady(false);
    setError(null);
    rawNull.current = {};
    seeded.current = false;
    cacheBlocked = false;
    const persist = backend.kind === 'firebase';
    const cache: Partial<Record<NodeKey, unknown>> = (persist && readCache(uid)) || {};
    // Show edits made offline in an earlier session, and send them again.
    const base = `users/${uid}`;
    if (persist) {
      const pending = readOutbox().filter((o) => o.path === base || o.path.startsWith(`${base}/`));
      if (pending.length) Object.assign(cache, (applyOps({ users: { [uid]: cache } }, pending).users as Record<string, typeof cache>)[uid]);
      backend.flushPending?.(base);
    }
    if (NODES.every((k) => k in cache)) {
      setData(Object.fromEntries(NODES.map((k) => [k, parseNode(k, cache[k])])) as unknown as UserData);
      setLoaded(new Set(NODES));
    }
    const fromServer = new Set<NodeKey>();
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubs = NODES.map((key) =>
      backend.subscribe(
        `${base}/${key}`,
        (raw) => {
          rawNull.current[key] = raw == null;
          fromServer.add(key);
          if (fromServer.size === NODES.length) setServerReady(true);
          setData((prev) => ({ ...prev, [key]: parseNode(key, raw) }));
          setLoaded((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
          if (persist) {
            cache[key] = raw ?? null;
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
              if (cacheBlocked) return;
              try {
                localStorage.setItem(CACHE_PREFIX + uid, JSON.stringify(cache));
              } catch {
                /* quota: the app still works online */
              }
            }, 800);
          }
        },
        (err) => {
          console.error(`Plano: failed to load ${key}`, err);
          setError(err.message || 'Не вдалося завантажити дані');
        },
      ),
    );
    const unsubConn = backend.onConnectionChange(setConnected);
    return () => {
      clearTimeout(saveTimer);
      unsubs.forEach((u) => u());
      unsubConn();
      setData(EMPTY);
    };
  }, [backend, uid]);

  const ready = loaded.size === NODES.length;

  // First sign-in: write default settings and starter categories (idempotent).
  useEffect(() => {
    if (!serverReady || seeded.current) return;
    seeded.current = true;
    if (rawNull.current.settings && rawNull.current.categories) {
      const now = nowIso();
      void repos
        .batch('Початкове налаштування Plano', { settings: DEFAULT_SETTINGS, categories: starterCategories(now) })
        .catch(() => undefined);
    }
  }, [serverReady, repos]);

  const value = useMemo(
    () => ({ data, ready, error, repos, uid, backendKind: backend.kind }),
    [data, ready, error, repos, uid, backend.kind],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
