import type { Backend } from '@/lib/backend/types';
import { stripUndefined } from '@/lib/validation/parse';
import { trackWrite } from '@/services/sync';
import type {
  Category,
  CalendarEvent,
  Goal,
  Habit,
  IntegrationState,
  Note,
  Profile,
  Project,
  Settings,
  Task,
  UserData,
} from '@/types';

export const nowIso = () => new Date().toISOString();

type Entity = { id: string; createdAt: string; updatedAt: string };
export type NewEntity<T extends Entity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

/** Top-level `undefined` in a patch means "remove this field" (null in Firebase). */
function toPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v === undefined ? null : stripUndefined(v);
  }
  return out;
}

export interface CollectionRepo<T extends Entity> {
  readonly path: string;
  newId(): string;
  /** Creates the record and returns its id together with the pending write. */
  create(data: NewEntity<T>): { id: string; write: Promise<void> };
  update(id: string, patch: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<void>;
  remove(id: string): Promise<void>;
  /** Writes a full record (used for idempotent writes with deterministic ids). */
  put(record: T): Promise<void>;
}

function collectionRepo<T extends Entity>(backend: Backend, base: string, name: string, label: string): CollectionRepo<T> {
  const path = `${base}/${name}`;
  return {
    path,
    newId: () => backend.newId(),
    create(data) {
      const id = data.id ?? backend.newId();
      const ts = nowIso();
      const record = stripUndefined({ ...data, id, createdAt: ts, updatedAt: ts });
      const write = trackWrite(`Create ${label}`, () => backend.set(`${path}/${id}`, record));
      return { id, write };
    },
    update(id, patch) {
      return trackWrite(`Update ${label}`, () =>
        backend.update(`${path}/${id}`, toPatch({ ...patch, updatedAt: nowIso() })),
      );
    },
    remove(id) {
      return trackWrite(`Delete ${label}`, () => backend.remove(`${path}/${id}`));
    },
    put(record) {
      return trackWrite(`Save ${label}`, () => backend.set(`${path}/${record.id}`, stripUndefined(record)));
    },
  };
}

export function createRepositories(backend: Backend, uid: string) {
  const base = `users/${uid}`;
  return {
    base,
    backend,
    categories: collectionRepo<Category>(backend, base, 'categories', 'category'),
    tasks: collectionRepo<Task>(backend, base, 'tasks', 'task'),
    events: collectionRepo<CalendarEvent>(backend, base, 'events', 'event'),
    projects: collectionRepo<Project>(backend, base, 'projects', 'project'),
    habits: collectionRepo<Habit>(backend, base, 'habits', 'habit'),
    goals: collectionRepo<Goal>(backend, base, 'goals', 'goal'),
    notes: collectionRepo<Note>(backend, base, 'notes', 'note'),
    habitLogs: {
      set(habitId: string, date: string, value: number) {
        const path = `${base}/habitLogs/${habitId}/${date}`;
        return trackWrite('Update habit', () => (value > 0 ? backend.set(path, value) : backend.remove(path)));
      },
      removeHabit(habitId: string) {
        return trackWrite('Delete habit history', () => backend.remove(`${base}/habitLogs/${habitId}`));
      },
    },
    settings: {
      update(patch: Partial<Settings>) {
        return trackWrite('Save settings', () => backend.update(`${base}/settings`, toPatch(patch)));
      },
    },
    profile: {
      update(patch: Partial<Profile>) {
        return trackWrite('Save profile', () => backend.update(`${base}/profile`, toPatch({ ...patch, updatedAt: nowIso() })));
      },
    },
    integrations: {
      set(key: string, value: IntegrationState) {
        return trackWrite('Save integration', () => backend.set(`${base}/integrations/${key}`, stripUndefined(value)));
      },
    },
    /** Applies several writes atomically (multi-path update relative to the user root). */
    batch(label: string, values: Record<string, unknown>) {
      return trackWrite(label, () => backend.update(base, toPatch(values)));
    },
    /** Replaces all user data (import). */
    replaceAll(data: Partial<UserData>) {
      return trackWrite('Import data', () => backend.set(base, stripUndefined(data)));
    },
    removeAll() {
      return trackWrite('Delete all data', () => backend.remove(base));
    },
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
