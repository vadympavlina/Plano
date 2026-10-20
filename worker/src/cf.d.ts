// Minimal types for the Cloudflare runtime bits we use (no extra packages).
declare module 'cloudflare:workers' {
  export class DurableObject<E = unknown> {
    ctx: DurableObjectState;
    env: E;
    constructor(ctx: DurableObjectState, env: E);
  }
}
interface DurableObjectState {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    setAlarm(at: number): Promise<void>;
    deleteAlarm(): Promise<void>;
  };
}
interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(req: Request): Promise<Response> };
}
