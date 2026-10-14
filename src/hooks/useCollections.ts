import { useMemo } from 'react';
import { useData } from '@/app/providers/DataProvider';
import type { Category, Project } from '@/types';

/** Memoised arrays of the user's records, plus lookup helpers. */
export function useCollections() {
  const { data } = useData();
  return useMemo(() => {
    const categories = Object.values(data.categories).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    const projects = Object.values(data.projects).sort((a, b) => a.name.localeCompare(b.name));
    return {
      tasks: Object.values(data.tasks),
      events: Object.values(data.events),
      projects,
      habits: Object.values(data.habits),
      goals: Object.values(data.goals),
      notes: Object.values(data.notes),
      categories,
      categoryById: (id?: string): Category | undefined => (id ? data.categories[id] : undefined),
      projectById: (id?: string): Project | undefined => (id ? data.projects[id] : undefined),
    };
  }, [data]);
}

export function useSettings() {
  return useData().data.settings;
}
