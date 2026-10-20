import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Backend } from '@/lib/backend/types';
import { parseCollectionShared, type ParseMemo } from '@/lib/validation/parse';
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
import type { Category, Project, UserData } from '@/types';
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

type Memos = Partial<Record<NodeKey, ParseMemo<unknown>>>;

function parseNode(key: NodeKey, raw: unknown, memos: Memos = {}): UserData[NodeKey] {
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
    default: {
      const schema = key === 'integrations' ? integrationSchema : collectionSchemas[key];
      memos[key] = parseCollectionShared(raw, schema as never, memos[key], warn);
      return memos[key]!.result as UserData[NodeKey];
    }
  }
}

interface DataContextValue {
  data: UserData;
  collections: Collections;
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
    const memos: Memos = {};
    // Show edits made offline in an earlier session, and send them again.
    const base = `users/${uid}`;
    if (persist) {
      const pending = readOutbox().filter((o) => o.path === base || o.path.startsWith(`${base}/`));
      if (pending.length) Object.assign(cache, (applyOps({ users: { [uid]: cache } }, pending).users as Record<string, typeof cache>)[uid]);
      backend.flushPending?.(base);
    }
    if (NODES.every((k) => k in cache)) {
      setData(Object.fromEntries(NODES.map((k) => [k, parseNode(k, cache[k], memos)])) as unknown as UserData);
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
          const next = parseNode(key, raw, memos);
          setData((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
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

  const collections = useSharedCollections(data);
  const value = useMemo(
    () => ({ data, collections, ready, error, repos, uid, backendKind: backend.kind }),
    [data, collections, ready, error, repos, uid, backend.kind],
  );
  const dataRef = useRef(data);
  dataRef.current = data;
  const reposValue = useMemo(() => ({ repos, dataRef }), [repos]);
  return (
    <ReposContext.Provider value={reposValue}>
      <DataContext.Provider value={value}>{children}</DataContext.Provider>
    </ReposContext.Provider>
  );
}

/**
 * Arrays of records, built once for the whole app. Each array keeps its identity
 * until its own collection changes, so a habit tick doesn't redo calendar work.
 */
function useSharedCollections(data: UserData) {
  const { tasks, events, projects, habits, goals, notes, categories } = data;
  const taskList = useMemo(() => Object.values(tasks), [tasks]);
  const eventList = useMemo(() => Object.values(events), [events]);
  const habitList = useMemo(() => Object.values(habits), [habits]);
  const goalList = useMemo(() => Object.values(goals), [goals]);
  const noteList = useMemo(() => Object.values(notes), [notes]);
  const projectList = useMemo(() => Object.values(projects).sort((a, b) => a.name.localeCompare(b.name)), [projects]);
  const categoryList = useMemo(() => Object.values(categories).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)), [categories]);
  const categoryById = useCallback((id?: string): Category | undefined => (id ? categories[id] : undefined), [categories]);
  const projectById = useCallback((id?: string): Project | undefined => (id ? projects[id] : undefined), [projects]);
  return useMemo(
    () => ({ tasks: taskList, events: eventList, projects: projectList, habits: habitList, goals: goalList, notes: noteList, categories: categoryList, categoryById, projectById }),
    [taskList, eventList, projectList, habitList, goalList, noteList, categoryList, categoryById, projectById],
  );
}
export type Collections = ReturnType<typeof useSharedCollections>;

const ReposContext = createContext<{ repos: Repositories; dataRef: { readonly current: UserData } } | null>(null);

/** Repositories plus a ref to the latest data; doesn't change when data does. */
export function useRepos() {
  const ctx = useContext(ReposContext);
  if (!ctx) throw new Error('useRepos must be used inside DataProvider');
  return ctx;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
