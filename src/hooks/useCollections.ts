import { useData } from '@/app/providers/DataProvider';

/** Arrays of the user's records plus lookup helpers (shared, see DataProvider). */
export function useCollections() {
  return useData().collections;
}

export function useSettings() {
  return useData().data.settings;
}
