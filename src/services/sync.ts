import { useSyncExternalStore } from 'react';

export interface SyncState {
  /** Writes sent but not yet confirmed by the server. */
  pending: number;
  /** Whether the backend reports an active server connection. */
  connected: boolean;
  /** Message of the most recent failed write, cleared by the next success. */
  lastError: string | null;
  lastSavedAt: number | null;
}

export interface WriteFailure {
  label: string;
  error: Error;
  retry: () => void;
}

let state: SyncState = { pending: 0, connected: true, lastError: null, lastSavedAt: null };
const listeners = new Set<() => void>();
const failureListeners = new Set<(f: WriteFailure) => void>();

function emit(next: Partial<SyncState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function setConnected(connected: boolean) {
  if (state.connected !== connected) emit({ connected });
}

export function resetSyncState() {
  emit({ pending: 0, lastError: null, lastSavedAt: null });
}

export function onWriteFailure(cb: (f: WriteFailure) => void) {
  failureListeners.add(cb);
  return () => {
    failureListeners.delete(cb);
  };
}

export function getSyncState() {
  return state;
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export function describeError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  const code = e?.code ?? '';
  const msg = e?.message ?? String(error);
  if (code.includes('PERMISSION_DENIED') || /permission[_ ]denied/i.test(msg)) {
    return 'Доступ заборонено правилами бази даних.';
  }
  if (/network|offline|unavailable/i.test(msg)) return 'Помилка мережі. Перевірте з’єднання.';
  return msg || 'Невідома помилка';
}

/**
 * Runs a write and tracks it in the sync indicator. Failures are surfaced to
 * the UI (toast with a Retry action) and re-thrown to the caller.
 */
export function trackWrite(label: string, run: () => Promise<void>): Promise<void> {
  emit({ pending: state.pending + 1 });
  return run().then(
    () => {
      emit({ pending: Math.max(0, state.pending - 1), lastError: null, lastSavedAt: Date.now() });
    },
    (error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      emit({ pending: Math.max(0, state.pending - 1), lastError: describeError(err) });
      const retry = () => {
        void trackWrite(label, run).catch(() => undefined);
      };
      failureListeners.forEach((l) => l({ label, error: err, retry }));
      throw err;
    },
  );
}

/**
 * For forms: resolves once the write is confirmed, or — when the device is
 * offline — once the write has been queued locally (Firebase sends it when the
 * connection returns; the sync indicator keeps showing it as pending).
 * Rejects if the write fails.
 */
export function settleWrite(write: Promise<unknown>, offlineGraceMs = 1200): Promise<'saved' | 'queued'> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled && !state.connected) {
        settled = true;
        resolve('queued');
      }
    }, offlineGraceMs);
    write.then(
      () => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          resolve('saved');
        }
      },
      (err) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(err);
        }
      },
    );
  });
}
