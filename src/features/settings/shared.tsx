import { createContext, useContext, type ReactNode } from 'react';
import { Bell, Database, Palette, Plug, SlidersHorizontal, Tags, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export const SECTIONS = [
  { id: 'profile', label: 'Профіль', icon: UserRound },
  { id: 'appearance', label: 'Вигляд', icon: Palette },
  { id: 'preferences', label: 'Параметри', icon: SlidersHorizontal },
  { id: 'categories', label: 'Категорії', icon: Tags },
  { id: 'notifications', label: 'Сповіщення', icon: Bell },
  { id: 'integrations', label: 'Інтеграції', icon: Plug },
  { id: 'data', label: 'Дані', icon: Database },
] as const;
export type SectionId = (typeof SECTIONS)[number]['id'];

export const SUMMARY_LABEL: Record<string, string> = {
  categories: 'Категорії',
  tasks: 'Задачі',
  events: 'Події',
  projects: 'Проєкти',
  habits: 'Звички',
  goals: 'Цілі',
  notes: 'Нотатки',
};

export const panel = 'rounded-[22px] border border-line bg-surface';

/** Current search text; empty means "show everything". */
export const SearchCtx = createContext('');
export const norm = (v: string) => v.toLocaleLowerCase('uk-UA');
export const matches = (q: string, ...parts: (string | undefined)[]) => !q || parts.some((p) => p && norm(p).includes(q));

/** One setting: label (and hint) on the left, control on the right. Hidden when it doesn't match the search. */
export function Row({ label, hint, keywords, children }: { label: ReactNode; hint?: string; keywords?: string; children?: ReactNode }) {
  const q = useContext(SearchCtx);
  if (!matches(q, typeof label === 'string' ? label : '', hint, keywords)) return null;
  return (
    <div className="flex flex-col gap-2.5 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-ink">{label}</div>
        {hint && <p className="mt-0.5 text-[12.5px] text-muted">{hint}</p>}
      </div>
      {children !== undefined && <div className="shrink-0">{children}</div>}
    </div>
  );
}

/** A titled group of rows. `keywords` lists the row labels so the group survives a search for any of them. */
export function Group({
  id,
  title,
  description,
  keywords,
  footer,
  children,
}: {
  id: SectionId;
  title: string;
  description?: string;
  keywords: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const q = useContext(SearchCtx);
  const whole = matches(q, title, description);
  if (!whole && !matches(q, keywords)) return null;
  return (
    <section id={`settings-${id}`} data-section={id} className="mb-7 scroll-mt-6">
      <h2 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-subtle">{title}</h2>
      {description && <p className="-mt-1 mb-2.5 px-1 text-[12.5px] text-muted">{description}</p>}
      {/* A match on the group itself shows all of its rows. */}
      <SearchCtx.Provider value={whole ? '' : q}>
        <div className={cn(panel, 'divide-y divide-line/70')}>{children}</div>
      </SearchCtx.Provider>
      {footer}
    </section>
  );
}
