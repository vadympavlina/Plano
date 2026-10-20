/** Weekly encrypted backups of all data, kept on the Plano Worker (last 8). */
import { call, usesTokenServer } from '@/services/integrations/google/server';
import { buildExport } from '@/features/settings/dataTransfer';
import type { UserData } from '@/types';

const LAST = 'plano:backup-at';
const WEEK = 7 * 24 * 3600_000;

export interface BackupMeta {
  at: string;
  size: number;
}

export async function backupNow(data: UserData) {
  const r = await call<{ at: string }>('/backup/put', { data: JSON.stringify(buildExport(data)) });
  localStorage.setItem(LAST, r.at);
  return r.at;
}

/** Makes a backup if this device hasn't made one for a week. */
export function backupIfDue(data: UserData) {
  const last = Date.parse(localStorage.getItem(LAST) ?? '');
  if (!usesTokenServer || (last && Date.now() - last < WEEK)) return;
  void backupNow(data).catch(() => undefined);
}

export const listBackups = () => call<{ backups: BackupMeta[] }>('/backup/list', {}).then((r) => r.backups);
export const fetchBackup = (at: string) => call<{ data: string }>('/backup/get', { at }).then((r) => r.data);
