import { child, get, onValue, push, ref, remove, set, update } from 'firebase/database';
import { getFirebaseDb } from '@/lib/firebase/config';
import type { Backend } from './types';

export function createFirebaseBackend(): Backend {
  const db = getFirebaseDb();
  return {
    kind: 'firebase',
    subscribe(path, cb, onError) {
      return onValue(ref(db, path), (snap) => cb(snap.val()), (err) => onError(err));
    },
    async get(path) {
      const snap = await get(ref(db, path));
      return snap.val();
    },
    set: (path, value) => set(ref(db, path), value),
    update: (path, values) => update(ref(db, path), values),
    remove: (path) => remove(ref(db, path)),
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
