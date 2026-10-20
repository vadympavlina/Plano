/**
 * Minimal storage contract used by the repositories. It mirrors the subset of
 * the Firebase Realtime Database API that Plano needs, so the same code can run
 * against Firebase (production) or browser storage (local preview mode).
 */
export interface Backend {
  readonly kind: 'firebase' | 'local';
  /** Subscribes to the value at `path`. Returns an unsubscribe function. */
  subscribe(path: string, onValue: (value: unknown) => void, onError: (error: Error) => void): () => void;
  /** One-off read. */
  get(path: string): Promise<unknown>;
  set(path: string, value: unknown): Promise<void>;
  /** Multi-location update. Keys are paths relative to `path`; `null` deletes. */
  update(path: string, values: Record<string, unknown>): Promise<void>;
  remove(path: string): Promise<void>;
  /** Generates a new, chronologically sortable unique key. */
  newId(): string;
  /** Subscribes to connection state (true = connected to the server). */
  onConnectionChange(cb: (connected: boolean) => void): () => void;
  /** Re-sends writes saved from an earlier session for paths under `prefix` (Firebase only). */
  flushPending?(prefix: string): void;
}
