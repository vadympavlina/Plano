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
import { NoteEditor } from './NoteEditor';

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
      .filter((n) => (!tag || n.tags.includes(tag)) && (!q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q))))
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [notes, query, tag]);
  const current = noteId ? notes.find((n) => n.id === noteId) : undefined;

  const pinned = list.filter((n) => n.isPinned);
  const rest = list.filter((n) => !n.isPinned);

  const item = (n: (typeof list)[number]) => {
    const project = projectById(n.projectId);
    const dot = n.cover ? colorOf(n.cover) : project ? colorOf(project.color) : undefined;
    const active = n.id === noteId;
    return (
      <Link
        key={n.id}
        to={`/notes/${n.id}`}
        aria-current={active ? 'page' : undefined}
        className={cn('flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors [contain-intrinsic-size:auto_58px] [content-visibility:auto]', active ? 'bg-surface shadow-soft ring-1 ring-line' : 'hover:bg-surface/70')}
      >
        {n.icon ? (
          <span className="mt-0.5 flex w-4 shrink-0 justify-center" style={{ color: dot }}>
            <LineIcon icon={n.icon} fallback={FileText} className="h-4 w-4" />
          </span>
        ) : (
          <span className="mt-[7px] flex w-4 shrink-0 justify-center">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot ?? 'rgb(var(--line))' }} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold">{n.title || 'Без назви'}</span>
          <span className="block truncate text-[12px] text-muted">{markdownExcerpt(n.content, 90) || 'Порожня нотатка'}</span>
        </span>
        <span className="shrink-0 pt-0.5 text-[11px] text-subtle">{timeAgo(n.updatedAt)}</span>
      </Link>
    );
  };

  return (
    <div className="flex w-full gap-5 px-4 pb-6 sm:px-6 lg:h-[calc(100dvh-72px-2.5rem)] lg:px-6 lg:pb-0">
      <nav aria-label="Нотатки" className={cn('flex w-full flex-col lg:w-[300px] lg:shrink-0', noteId && 'hidden lg:flex')}>
        <div className="mb-3 flex items-center justify-between px-1">
          <h1 className="text-[22px] font-bold tracking-tight">Нотатки</h1>
          <Button size="icon-sm" variant="dark" aria-label="Нова нотатка" title="Нова нотатка" onClick={() => createNote()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input className="h-9 pl-9" placeholder="Пошук нотаток" aria-label="Пошук нотаток" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {allTags.length > 0 && (
          <div className="no-scrollbar mb-1 flex gap-1.5 overflow-x-auto pb-1">
            {['', ...allTags].map((t) => (
              <button
                key={t || 'all'}
                type="button"
                onClick={() => setTag(t)}
                aria-pressed={tag === t}
                className={cn('shrink-0 rounded-md px-2 py-1 text-xs font-medium', tag === t ? 'bg-accent text-surface' : 'bg-surface text-muted ring-1 ring-line/70 hover:text-ink')}
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
              {pinned.length > 0 && <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">Закріплені</p>}
              {pinned.map(item)}
              {rest.length > 0 && pinned.length > 0 && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">Останні</p>}
              <Progressive items={rest}>{item}</Progressive>
            </>
          )}
        </div>
      </nav>
      <div
        className={cn(
          'min-h-[70dvh] min-w-0 flex-1 overflow-hidden rounded-[20px] border border-line/60 bg-surface shadow-soft lg:min-h-0',
          !noteId && 'hidden lg:block',
        )}
      >
        {current ? (
          <NoteEditor key={current.id} note={current} />
        ) : noteId ? (
          <EmptyState icon={<NotebookPen />} title="Нотатку не знайдено" description="Можливо, її видалили." action={<Link to="/notes"><Button variant="outline" size="sm">До нотаток</Button></Link>} />
        ) : (
          <EmptyState
            icon={<NotebookPen />}
            title="Оберіть нотатку"
            description="Або створіть нову. Нотатки зберігаються автоматично під час набору."
            className="h-full"
            action={<Button variant="outline" size="sm" onClick={() => createNote()}><Plus className="h-3.5 w-3.5" /> Нова нотатка</Button>}
          />
        )}
      </div>
    </div>
  );
}
