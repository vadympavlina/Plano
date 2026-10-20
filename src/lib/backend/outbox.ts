/**
 * Writes not yet confirmed by Firebase, kept in localStorage. Firebase's web SDK
 * holds pending writes only in memory, so without this a change made offline is
 * lost when the app is closed before the network comes back.
 */
export type Op = { id: string; kind: 'set' | 'update' | 'remove'; path: string; value?: unknown };

const KEY = 'plano:outbox';

export function readOutbox(): Op[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}
const save = (ops: Op[]) => {
  try {
    if (ops.length) localStorage.setItem(KEY, JSON.stringify(ops));
    else localStorage.removeItem(KEY);
  } catch {
    /* quota: the write still goes through while the app stays open */
  }
};
export const addOp = (op: Op) => save([...readOutbox(), op]);
export const dropOp = (id: string) => save(readOutbox().filter((o) => o.id !== id));
export const clearOutbox = () => save([]);

/** Applies ops to a plain object tree (`null` / remove deletes), e.g. to show offline edits on cached data. */
export function applyOps(root: Record<string, unknown>, ops: Op[]) {
  const setIn = (path: string, value: unknown) => {
    const keys = path.split('/').filter(Boolean);
    let node = root;
    for (const k of keys.slice(0, -1)) {
      if (typeof node[k] !== 'object' || node[k] === null) node[k] = {};
      node = node[k] as Record<string, unknown>;
    }
    const last = keys[keys.length - 1];
    if (value === null || value === undefined) delete node[last];
    else node[last] = structuredClone(value);
  };
  for (const op of ops) {
    if (op.kind === 'remove') setIn(op.path, null);
    else if (op.kind === 'set') setIn(op.path, op.value);
    else for (const [k, v] of Object.entries(op.value as Record<string, unknown>)) setIn(`${op.path}/${k}`, v);
  }
  return root;
}
