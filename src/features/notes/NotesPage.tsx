import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { NotebookPen, Pin, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/misc';
import { EmptyState } from '@/components/common/States';
import { useCollections } from '@/hooks/useCollections';
import { useCreateNote } from '@/components/layout/CreateMenu';
import { markdownExcerpt } from '@/lib/utils/markdown';
import { cn } from '@/lib/utils/cn';
import { NoteEditor } from './NoteEditor';

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

  return (
    <div className="mx-auto flex w-full max-w-[1400px] gap-4 px-4 sm:px-6 lg:h-[calc(100dvh-72px-2.5rem)] lg:px-8">
      <Card className={cn('flex w-full flex-col overflow-hidden lg:w-[340px] lg:shrink-0', noteId && 'hidden lg:flex')}>
        <div className="space-y-3 border-b border-line p-3">
          <div className="flex items-center justify-between">
            <h2 className="pl-1 text-[17px] font-semibold tracking-tight">Notes</h2>
            <Button size="sm" variant="dark" onClick={() => createNote()}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input className="h-9 pl-9" placeholder="Search notes" aria-label="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {allTags.length > 0 && (
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {['', ...allTags].map((t) => (
                <button
                  key={t || 'all'}
                  type="button"
                  onClick={() => setTag(t)}
                  aria-pressed={tag === t}
                  className={cn('shrink-0 rounded-md px-2 py-1 text-xs font-medium', tag === t ? 'bg-accent text-surface' : 'bg-surface-2 text-muted hover:text-ink')}
                >
                  {t ? `#${t}` : 'All'}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
          {list.length === 0 ? (
            <EmptyState
              compact
              icon={<NotebookPen />}
              title={notes.length ? 'No matching notes' : 'No notes yet'}
              description={notes.length ? undefined : 'Capture ideas, meeting notes and plans.'}
            />
          ) : (
            list.map((n) => {
              const project = projectById(n.projectId);
              return (
                <Link
                  key={n.id}
                  to={`/notes/${n.id}`}
                  className={cn('block rounded-xl px-3 py-2.5 transition-colors', n.id === noteId ? 'bg-surface-2' : 'hover:bg-surface-2/70')}
                >
                  <div className="flex items-center gap-1.5">
                    {n.isPinned && <Pin className="h-3 w-3 shrink-0 text-primary" aria-label="Pinned" />}
                    <p className="truncate text-[13.5px] font-medium">{n.title || 'Untitled note'}</p>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{markdownExcerpt(n.content, 120) || 'Empty note'}</p>
                  <p className="mt-1 text-[11px] text-subtle">
                    {timeAgo(n.updatedAt)}
                    {project && ` · ${project.name}`}
                    {n.tags.length > 0 && ` · ${n.tags.map((t) => `#${t}`).join(' ')}`}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </Card>
      <Card className={cn('min-h-[70dvh] min-w-0 flex-1 overflow-hidden lg:min-h-0', !noteId && 'hidden lg:block')}>
        {current ? (
          <NoteEditor key={current.id} note={current} />
        ) : noteId ? (
          <EmptyState icon={<NotebookPen />} title="Note not found" description="It may have been deleted." action={<Link to="/notes"><Button variant="outline" size="sm">Back to notes</Button></Link>} />
        ) : (
          <EmptyState
            icon={<NotebookPen />}
            title="Select a note"
            description="Or start a new one. Notes save automatically as you type."
            className="h-full"
            action={<Button variant="outline" size="sm" onClick={() => createNote()}><Plus className="h-3.5 w-3.5" /> New note</Button>}
          />
        )}
      </Card>
    </div>
  );
}
