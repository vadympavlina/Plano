import { TOKEN_SERVER_URL } from '@/services/integrations/google/server';
import type { Outages } from './logic';

/** The Worker reads the company's page and serves it as JSON. The e2e build uses a stand-in address that the tests intercept. */
export const POWER_URL: string = TOKEN_SERVER_URL || (import.meta.env.MODE === 'e2e' ? 'https://worker.test' : '');
export const powerReachable = POWER_URL !== '';

export async function fetchOutages(): Promise<Outages> {
  const res = await fetch(`${POWER_URL}/outages`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as Partial<Outages>;
  if (!data || !Array.isArray(data.days) || !Array.isArray(data.queues)) throw new Error('unexpected answer');
  return data as Outages;
}
