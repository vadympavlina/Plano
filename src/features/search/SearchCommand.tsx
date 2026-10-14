import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CalendarDays, CheckSquare, CornerDownLeft, FolderKanban, Heart, NotebookPen, Search, Target } from 'lucide-react';
import { useCollections } from '@/hooks/useCollections';
import { useUI } from '@/app/providers/UIProvider';
import { markdownExcerpt } from '@/lib/utils/markdown';
import { formatDateKey } from '@/lib/date';
import { NAV_ITEMS } from '@/components/layout/nav';
import { cn } from '@/lib/utils/cn';
import { Kbd } from '@/components/ui/misc';

interface Result {
  id: string;
  group: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  run: () => void;
}

const norm = (s: string | undefined) => (s ?? '').toLowerCase();

export default function SearchCommand({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const { tasks, events, projects, notes, goals, habits } = useCollections();
  const { openTask, openEvent } = useUI();
  const navigate = useNavigate();

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const go = (fn: () => void) => () => {
      onClose();
      fn();
    };
    if (!q) {
      return NAV_ITEMS.map((n) => ({
        id: `nav-${n.to}`,
        group: 'Go to',
        icon: <n.icon />,
        title: n.label,
        run: go(() => navigate(n.to)),
      }));
    }
    const out: Result[] = [];
    const take = <T,>(list: T[], match: (x: T) => boolean, map: (x: T) => Result, limit = 6) => {
      let n = 0;
      for (const x of list) {
        if (n >= limit) break;
        if (match(x)) {
          out.push(map(x));
          n++;
        }
      }
    };
    take(
      tasks,
      (t) => norm(t.title).includes(q) || norm(t.description).includes(q) || t.tags.some((g) => norm(g).includes(q)),
      (t) => ({
        id: `t-${t.id}`,
        group: 'Tasks',
        icon: <CheckSquare />,
        title: t.title,
        subtitle: [t.status === 'completed' ? 'Completed' : null, t.dueDate ? formatDateKey(t.dueDate, 'MMM d') : null].filter(Boolean).join(' · '),
        run: go(() => openTask(t.id)),
      }),
    );
    take(
      events,
      (e) => norm(e.title).includes(q) || norm(e.location).includes(q) || norm(e.description).includes(q),
      (e) => ({
        id: `e-${e.id}`,
        group: 'Events',
        icon: <CalendarDays />,
        title: e.title,
        subtitle: `${formatDateKey(e.date, 'EEE, MMM d')}${e.startTime ? ` · ${e.startTime}` : ''}${e.recurrence ? ' · repeats' : ''}`,
        run: go(() => {
          navigate(`/calendar?date=${e.date}`);
          openEvent(e.id, e.date);
        }),
      }),
    );
    take(
      projects,
      (p) => norm(p.name).includes(q) || norm(p.description).includes(q),
      (p) => ({ id: `p-${p.id}`, group: 'Projects', icon: <FolderKanban />, title: p.name, run: go(() => navigate(`/projects/${p.id}`)) }),
    );
    take(
      notes,
      (n) => norm(n.title).includes(q) || norm(n.content).includes(q) || n.tags.some((g) => norm(g).includes(q)),
      (n) => ({
        id: `n-${n.id}`,
        group: 'Notes',
        icon: <NotebookPen />,
        title: n.title || 'Untitled note',
        subtitle: markdownExcerpt(n.content, 70),
        run: go(() => navigate(`/notes/${n.id}`)),
      }),
    );
    take(
      goals,
      (g) => norm(g.title).includes(q),
      (g) => ({ id: `g-${g.id}`, group: 'Goals', icon: <Target />, title: g.title, run: go(() => navigate('/goals')) }),
    );
    take(
      habits,
      (h) => norm(h.name).includes(q),
      (h) => ({ id: `h-${h.id}`, group: 'Habits', icon: <Heart />, title: h.name, run: go(() => navigate('/habits')) }),
    );
    return out;
  }, [query, tasks, events, projects, notes, goals, habits, navigate, openTask, openEvent, onClose]);

  const clamped = Math.min(active, Math.max(0, results.length - 1));
  let lastGroup = '';

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0b0f17]/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[max(env(safe-area-inset-top),12px)] z-50 flex max-h-[min(560px,80dvh)] w-[calc(100%-24px)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-card border border-line bg-surface shadow-pop data-[state=open]:animate-scale-in sm:top-[12vh]"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              results[clamped]?.run();
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search tasks, events, projects, notes, goals and habits</DialogPrimitive.Description>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="h-4 w-4 shrink-0 text-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder="Search tasks, events, projects, notes…"
              aria-label="Search"
              role="combobox"
              aria-expanded
              aria-controls="search-results"
              aria-activedescendant={results[clamped] ? `sr-${results[clamped].id}` : undefined}
              className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-subtle"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div id="search-results" role="listbox" className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
            {results.length === 0 && <p className="px-3 py-10 text-center text-sm text-muted">No results for “{query}”.</p>}
            {results.map((r, i) => {
              const header = r.group !== lastGroup ? r.group : null;
              lastGroup = r.group;
              return (
                <div key={r.id}>
                  {header && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-subtle">{header}</p>}
                  <button
                    id={`sr-${r.id}`}
                    role="option"
                    aria-selected={i === clamped}
                    type="button"
                    onMouseMove={() => setActive(i)}
                    onClick={r.run}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-muted',
                      i === clamped && 'bg-surface-2',
                    )}
                  >
                    {r.icon}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{r.title}</span>
                      {r.subtitle && <span className="block truncate text-xs text-muted">{r.subtitle}</span>}
                    </span>
                    {i === clamped && <CornerDownLeft className="!h-3.5 !w-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
