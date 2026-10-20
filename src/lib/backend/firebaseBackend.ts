import { child, get, onValue, push, ref, remove, set, update } from 'firebase/database';
import { getFirebaseDb } from '@/lib/firebase/config';
import type { Backend } from './types';
import { addOp, dropOp, readOutbox, type Op } from './outbox';

export function createFirebaseBackend(): Backend {
  const db = getFirebaseDb();
  const send = (op: Op) => {
    const r = ref(db, op.path);
    // Confirmed or rejected by the server (e.g. permission): either way it's done.
    return (op.kind === 'set' ? set(r, op.value) : op.kind === 'update' ? update(r, op.value as Record<string, unknown>) : remove(r)).then(
      () => dropOp(op.id),
      (err) => {
        dropOp(op.id);
        throw err;
      },
    );
  };
  // Every write is remembered until the server confirms it.
  const write = (kind: Op['kind'], path: string, value?: unknown) => {
    const op: Op = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, kind, path, value };
    addOp(op);
    return send(op);
  };
  return {
    kind: 'firebase',
    subscribe(path, cb, onError) {
      return onValue(ref(db, path), (snap) => cb(snap.val()), (err) => onError(err));
    },
    async get(path) {
      const snap = await get(ref(db, path));
      return snap.val();
    },
    set: (path, value) => write('set', path, value),
    update: (path, values) => write('update', path, values),
    remove: (path) => write('remove', path),
    flushPending(prefix) {
      // Sends writes left over from a previous session (closed while offline).
      for (const op of readOutbox()) if (op.path.startsWith(prefix)) void send(op).catch(() => undefined);
    },
    newId() {
      const key = push(child(ref(db), 'ids')).key;
      if (!key) throw new Error('Не вдалося згенерувати id');
      return key;
    },
    onConnectionChange(cb) {
      return onValue(ref(db, '.info/connected'), (snap) => cb(snap.val() === true));
    },
  };
}
