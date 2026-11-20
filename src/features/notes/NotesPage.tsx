import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText, NotebookPen, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { colorOf } from '@/lib/utils/colors';
import { EmptyState } from '@/components/common/States';
import { useCollections } from '@/hooks/useCollections';
import { useCreateNote } from '@/components/layout/CreateMenu';
import { markdownExcerpt } from '@/lib/utils/markdown';
import { Progressive } from '@/components/common/Progressive';
import { LineIcon } from '@/components/common/CategoryMark';
import { cn } from '@/lib/utils/cn';
import type { Note } from '@/types';
import { NoteEditor } from './NoteEditor';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** The heading a note falls under: today, this week, this month or earlier. */
function group(iso: string) {
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
  if (days <= 0) return 'Сьогодні';
  if (days === 1) return 'Вчора';
  if (days < 7) return 'Цього тижня';
  if (days < 31) return 'Цього місяця';
  return 'Раніше';
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'щойно';
  if (diff < 3600) return `${Math.floor(diff / 60)} хв тому`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} год тому`;
  return d.toLocaleDateString('uk-UA', { month: 'short', day: 'numeric' });
}

export default function NotesPage() {
  const { noteId } = useParams();
  const { notes, projectById } = useCollections();
  const createNote = useCreateNote();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');

  const allTags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter(
        (n) =>
          (!tag || n.tags.includes(tag)) &&
          (!q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q))),
      )
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [notes, query, tag]);
  const current = noteId ? notes.find((n) => n.id === noteId) : undefined;

  const pinned = list.filter((n) => n.isPinned);
  // The rest, split by when they were touched, with a heading before each group.
  const rest = useMemo(() => {
    const out: (Note | { heading: string })[] = [];
    let last = '';
    for (const n of list.filter((x) => !x.isPinned)) {
      const g = group(n.updatedAt);
      if (g !== last) out.push({ heading: g });
      last = g;
      out.push(n);
    }
    return out;
  }, [list]);

  const item = (n: Note) => {
    const project = projectById(n.projectId);
    const dot = n.cover ? colorOf(n.cover) : project ? colorOf(project.color) : undefined;
    const active = n.id === noteId;
    return (
      <Link
        key={n.id}
        to={`/notes/${n.id}`}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors [contain-intrinsic-size:auto_58px] [content-visibility:auto]',
          // Phones: each note is a small card, with a longer preview and its tags.
          'max-lg:mb-2 max-lg:gap-3 max-lg:rounded-2xl max-lg:border max-lg:border-line/70 max-lg:bg-surface max-lg:p-3.5 max-lg:[contain-intrinsic-size:auto_104px] max-lg:active:bg-surface-2',
          active ? 'bg-surface-2' : 'hover:bg-surface-2/60',
        )}
      >
        {n.icon ? (
          <span
            className="mt-0.5 flex w-4 shrink-0 justify-center max-lg:h-9 max-lg:w-9 max-lg:items-center max-lg:rounded-xl max-lg:bg-surface-2"
            style={{ color: dot }}
          >
            <LineIcon icon={n.icon} fallback={FileText} className="h-4 w-4 max-lg:h-[18px] max-lg:w-[18px]" />
          </span>
        ) : (
          <span className="mt-[7px] flex w-4 shrink-0 justify-center max-lg:mt-0 max-lg:h-9 max-lg:w-9 max-lg:items-center max-lg:rounded-xl max-lg:bg-surface-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot ?? 'rgb(var(--line))' }} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold max-lg:text-[15.5px]">{n.title || 'Без назви'}</span>
          <span className="block truncate text-[12px] text-muted max-lg:line-clamp-2 max-lg:whitespace-normal max-lg:text-[13.5px] max-lg:leading-snug">
            {markdownExcerpt(n.content, 160) || 'Порожня нотатка'}
          </span>
          {n.tags.length > 0 && (
            <span className="mt-1.5 flex gap-1.5 overflow-hidden lg:hidden">
              {n.tags.slice(0, 3).map((t) => (
                <span key={t} className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] text-muted">
                  #{t}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className="shrink-0 pt-0.5 text-[12px] text-subtle">{timeAgo(n.updatedAt)}</span>
      </Link>
    );
  };

  return (
    <div className="flex w-full gap-5 px-2 pb-6 lg:h-(--page-h) lg:pb-0">
      <nav aria-label="Нотатки" className={cn('flex w-full flex-col lg:w-[300px] lg:shrink-0', noteId && 'hidden lg:flex')}>
        <div className="mb-3 flex items-center justify-between px-1">
          <h1 className="text-[28px] font-extrabold leading-none tracking-tight">Нотатки</h1>
          <Button size="icon-sm" variant="dark" aria-label="Нова нотатка" title="Нова нотатка" onClick={() => createNote()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Input
          type="search"
          icon={<Search />}
          className="mb-2 h-9"
          placeholder="Пошук нотаток…"
          aria-label="Пошук нотаток"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onValueChange={setQuery}
        />
        {allTags.length > 0 && (
          <div className="no-scrollbar mb-1 flex gap-1.5 overflow-x-auto pb-1">
            {['', ...allTags].map((t) => (
              <button
                key={t || 'all'}
                type="button"
                onClick={() => setTag(t)}
                aria-pressed={tag === t}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-2.5 text-xs font-medium sm:py-1.5',
                  tag === t ? 'bg-accent text-surface' : 'bg-surface-2 text-muted hover:text-ink',
                )}
              >
                {t ? `#${t}` : 'Усі'}
              </button>
            ))}
          </div>
        )}
        <div className="scrollbar-thin -mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-4">
          {list.length === 0 ? (
            <EmptyState
              compact
              icon={<NotebookPen />}
              title={notes.length ? 'Нічого не знайдено' : 'Нотаток поки немає'}
              description={notes.length ? undefined : 'Записуйте ідеї, нотатки зустрічей і плани.'}
            />
          ) : (
            <>
              {pinned.length > 0 && <p className="px-3 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-subtle">Закріплені</p>}
              {pinned.map(item)}
              <Progressive items={rest} estimate={104}>
                {(n) =>
                  'heading' in n ? (
                    <p key={n.heading} className="px-3 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-subtle">
                      {n.heading}
                    </p>
                  ) : (
                    item(n)
                  )
                }
              </Progressive>
            </>
          )}
        </div>
      </nav>
      <div className={cn('min-h-[70dvh] min-w-0 flex-1 overflow-hidden rounded-[20px] border border-line bg-surface lg:min-h-0', !noteId && 'hidden lg:block')}>
        {current ? (
          <NoteEditor key={current.id} note={current} />
        ) : noteId ? (
          <EmptyState
            icon={<NotebookPen />}
            title="Нотатку не знайдено"
            description="Можливо, її видалили."
            action={
              <Link to="/notes">
                <Button variant="outline" size="sm">
                  До нотаток
                </Button>
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<NotebookPen />}
            title="Оберіть нотатку"
            description="Або створіть нову. Нотатки зберігаються автоматично під час набору."
            className="h-full"
            action={
              <Button variant="outline" size="sm" onClick={() => createNote()}>
                <Plus className="h-3.5 w-3.5" /> Нова нотатка
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
