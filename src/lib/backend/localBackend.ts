import type { Backend } from './types';

/**
 * Browser-storage backend for the local preview mode (used only when Firebase
 * is not configured). Data never leaves this browser.
 */
const STORAGE_KEY = 'plano:preview:data';

type Tree = Record<string, unknown>;
type Listener = { path: string; cb: (value: unknown) => void };

function split(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function readAt(tree: unknown, parts: string[]): unknown {
  let cur: unknown = tree;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return null;
    cur = (cur as Tree)[p];
  }
  return cur === undefined ? null : cur;
}

function isEmpty(value: unknown) {
  return value == null || (typeof value === 'object' && Object.keys(value as object).length === 0);
}

function writeAt(tree: Tree, parts: string[], value: unknown): Tree {
  if (parts.length === 0) return (value && typeof value === 'object' ? clone(value) : {}) as Tree;
  const [head, ...rest] = parts;
  const next: Tree = { ...tree };
  const childValue = rest.length === 0 ? (value == null ? null : clone(value)) : writeAt((tree[head] as Tree) ?? {}, rest, value);
  if (isEmpty(childValue)) delete next[head];
  else next[head] = childValue;
  return next;
}

function clone<T>(v: T): T {
  return v == null ? v : (JSON.parse(JSON.stringify(v)) as T);
}

let idCounter = 0;
function generateId(): string {
  const time = Date.now().toString(36).padStart(9, '0');
  const rand = Math.random().toString(36).slice(2, 8);
  idCounter = (idCounter + 1) % 1296;
  return `-${time}${idCounter.toString(36).padStart(2, '0')}${rand}`;
}

export function createLocalBackend(): Backend {
  let tree: Tree = {};
  try {
    tree = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Tree;
  } catch {
    tree = {};
  }
  const listeners = new Set<Listener>();

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
    } catch (e) {
      console.error('Plano preview: could not persist data', e);
      throw new Error('Сховище браузера переповнене або недоступне.');
    }
  }

  function notify(changed: string[]) {
    for (const l of listeners) {
      const lp = split(l.path);
      const related = changed.some((c) => {
        const cp = split(c);
        const n = Math.min(lp.length, cp.length);
        for (let i = 0; i < n; i++) if (lp[i] !== cp[i]) return false;
        return true;
      });
      if (related) l.cb(clone(readAt(tree, lp)));
    }
  }

  // Keep multiple tabs in sync.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    try {
      tree = JSON.parse(e.newValue || '{}') as Tree;
      notify(['']);
    } catch {
      /* ignore */
    }
  });

  return {
    kind: 'local',
    subscribe(path, cb) {
      const l: Listener = { path, cb };
      listeners.add(l);
      queueMicrotask(() => {
        if (listeners.has(l)) cb(clone(readAt(tree, split(path))));
      });
      return () => listeners.delete(l);
    },
    async get(path) {
      return clone(readAt(tree, split(path)));
    },
    async set(path, value) {
      tree = writeAt(tree, split(path), value);
      persist();
      notify([path]);
    },
    async update(path, values) {
      const changed: string[] = [];
      for (const [rel, value] of Object.entries(values)) {
        const full = `${path}/${rel}`;
        tree = writeAt(tree, split(full), value);
        changed.push(full);
      }
      persist();
      notify(changed);
    },
    async remove(path) {
      tree = writeAt(tree, split(path), null);
      persist();
      notify([path]);
    },
    newId: generateId,
    onConnectionChange(cb) {
      const handler = () => cb(navigator.onLine);
      handler();
      window.addEventListener('online', handler);
      window.addEventListener('offline', handler);
      return () => {
        window.removeEventListener('online', handler);
        window.removeEventListener('offline', handler);
      };
    },
  };
}

export function clearLocalPreviewData() {
  localStorage.removeItem(STORAGE_KEY);
}
