import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bold, Check, Eye, Heading2, Italic, Link2, List, ListChecks, Loader2, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { confirm } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { useActions } from '@/hooks/useActions';
import { useCollections } from '@/hooks/useCollections';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { renderMarkdown } from '@/lib/utils/markdown';
import { cn } from '@/lib/utils/cn';
import type { Note } from '@/types';

type SaveState = 'saved' | 'pending' | 'saving' | 'error';

/**
 * Note editor with reliable autosave: edits are debounced, and any pending
 * change is flushed when the editor unmounts (switching notes / pages), when
 * the tab is hidden and before the page unloads.
 */
export function NoteEditor({ note }: { note: Note }) {
  const actions = useActions();
  const { projects } = useCollections();
  const navigate = useNavigate();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tagsText, setTagsText] = useState(note.tags.join(', '));
  const [preview, setPreview] = useState(false);
  const [state, setState] = useState<SaveState>('saved');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const saved = useRef({ title: note.title, content: note.content, tags: note.tags.join(', ') });

  const save = useDebouncedCallback((next: { title: string; content: string; tags: string }) => {
    const tags = [...new Set(next.tags.split(',').map((t) => t.trim()).filter(Boolean))];
    setState('saving');
    saved.current = next;
    actions.notes.update(note.id, { title: next.title, content: next.content, tags }).then(
      () => setState((s) => (s === 'saving' ? 'saved' : s)),
      () => setState('error'),
    );
  }, 700);

  const change = (patch: Partial<{ title: string; content: string; tags: string }>) => {
    const next = { title, content, tags: tagsText, ...patch };
    if (patch.title !== undefined) setTitle(patch.title);
    if (patch.content !== undefined) setContent(patch.content);
    if (patch.tags !== undefined) setTagsText(patch.tags);
    setState('pending');
    save.run(next);
  };

  // Flush when hidden / closing.
  useEffect(() => {
    const flush = () => save.flush();
    const onHide = () => document.visibilityState === 'hidden' && flush();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (save.isPending()) {
        flush();
        e.preventDefault();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [save]);

  // Accept changes made elsewhere (another device) when there are no local edits.
  useEffect(() => {
    if (save.isPending() || state === 'saving') return;
    const tags = note.tags.join(', ');
    if (note.title !== saved.current.title || note.content !== saved.current.content || tags !== saved.current.tags) {
      saved.current = { title: note.title, content: note.content, tags };
      setTitle(note.title);
      setContent(note.content);
      setTagsText(tags);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.title, note.content, note.tags]);

  const wrap = (before: string, after = before, placeholder = 'text') => {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = content.slice(s, e) || placeholder;
    const next = content.slice(0, s) + before + selected + after + content.slice(e);
    change({ content: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  };

  const linePrefix = (prefix: string) => {
    const el = textRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const lineStart = content.lastIndexOf('\n', s - 1) + 1;
    const next = content.slice(0, lineStart) + prefix + content.slice(lineStart);
    change({ content: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + prefix.length, s + prefix.length);
    });
  };

  const html = useMemo(() => (preview ? renderMarkdown(content) : ''), [preview, content]);

  const remove = async () => {
    const ok = await confirm({ title: 'Delete note?', description: `“${title || 'Untitled note'}” will be permanently deleted.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    save.cancel();
    try {
      await actions.notes.remove(note.id);
      toast.success('Note deleted');
      navigate('/notes');
    } catch {
      /* toast from sync layer */
    }
  };

  const tools = [
    { icon: Bold, label: 'Bold', run: () => wrap('**') },
    { icon: Italic, label: 'Italic', run: () => wrap('*') },
    { icon: Heading2, label: 'Heading', run: () => linePrefix('## ') },
    { icon: List, label: 'Bullet list', run: () => linePrefix('- ') },
    { icon: ListChecks, label: 'Checklist', run: () => linePrefix('- [ ] ') },
    { icon: Link2, label: 'Link', run: () => wrap('[', '](https://)', 'link') },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Back to notes" onClick={() => { save.flush(); navigate('/notes'); }}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {!preview &&
          tools.map(({ icon: Icon, label, run }) => (
            <Button key={label} variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={run}>
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
          {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {preview ? 'Edit' : 'Preview'}
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 flex items-center gap-1 text-xs text-muted" role="status">
            {state === 'saving' || state === 'pending' ? <Loader2 className="h-3 w-3 animate-spin" /> : state === 'saved' ? <Check className="h-3 w-3 text-success" /> : null}
            {state === 'pending' ? 'Editing…' : state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : <span className="text-danger">Not saved</span>}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
            onClick={() => void actions.notes.update(note.id, { isPinned: !note.isPinned }).catch(() => undefined)}
          >
            {note.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Delete note" onClick={() => void remove()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8">
        <input
          value={title}
          onChange={(e) => change({ title: e.target.value })}
          placeholder="Untitled note"
          aria-label="Note title"
          maxLength={300}
          className="w-full bg-transparent text-[22px] font-semibold tracking-tight text-ink outline-none placeholder:text-subtle"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <input
            value={tagsText}
            onChange={(e) => change({ tags: e.target.value })}
            placeholder="Tags, comma separated"
            aria-label="Tags"
            className="h-8 min-w-[180px] flex-1 rounded-lg border border-line bg-surface px-2.5 text-xs outline-none focus:border-primary"
          />
          <Select
            aria-label="Project"
            className="h-8 w-auto text-xs"
            value={note.projectId ?? ''}
            onChange={(e) => void actions.notes.update(note.id, { projectId: e.target.value || undefined }).catch(() => undefined)}
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
        {preview ? (
          <div className={cn('prose-note mt-5 text-[15px] text-ink', !content && 'text-muted')} dangerouslySetInnerHTML={{ __html: html || '<p>Nothing to preview yet.</p>' }} />
        ) : (
          <textarea
            ref={textRef}
            value={content}
            onChange={(e) => change({ content: e.target.value })}
            onBlur={() => save.flush()}
            placeholder={'Start writing…\n\nMarkdown works: **bold**, *italic*, ## heading, - list, - [ ] checklist'}
            aria-label="Note content"
            className="mt-5 min-h-[55vh] w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink outline-none placeholder:text-subtle"
          />
        )}
      </div>
    </div>
  );
}
