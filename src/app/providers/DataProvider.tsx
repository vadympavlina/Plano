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

export function DataProvider({ backend, uid, children }: { backend: Backend; uid: string; children: ReactNode }) {
  const [data, setData] = useState<UserData>(EMPTY);
  const [loaded, setLoaded] = useState<Set<NodeKey>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const rawNull = useRef<Partial<Record<NodeKey, boolean>>>({});
  const seeded = useRef(false);
  const repos = useMemo(() => createRepositories(backend, uid), [backend, uid]);

  // One realtime listener per node; all are removed on sign-out / user change.
  useEffect(() => {
    setData(EMPTY);
    setLoaded(new Set());
    setError(null);
    rawNull.current = {};
    seeded.current = false;
    const base = `users/${uid}`;
    const unsubs = NODES.map((key) =>
      backend.subscribe(
        `${base}/${key}`,
        (raw) => {
          rawNull.current[key] = raw == null;
          setData((prev) => ({ ...prev, [key]: parseNode(key, raw) }));
          setLoaded((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
        },
        (err) => {
          console.error(`Plano: failed to load ${key}`, err);
          setError(err.message || 'Не вдалося завантажити дані');
        },
      ),
    );
    const unsubConn = backend.onConnectionChange(setConnected);
    return () => {
      unsubs.forEach((u) => u());
      unsubConn();
      setData(EMPTY);
    };
  }, [backend, uid]);

  const ready = loaded.size === NODES.length;

  // First sign-in: write default settings and starter categories (idempotent).
  useEffect(() => {
    if (!ready || seeded.current) return;
    seeded.current = true;
    if (rawNull.current.settings && rawNull.current.categories) {
      const now = nowIso();
      void repos
        .batch('Початкове налаштування Plano', { settings: DEFAULT_SETTINGS, categories: starterCategories(now) })
        .catch(() => undefined);
    }
  }, [ready, repos]);

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
