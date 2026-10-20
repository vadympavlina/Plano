import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderKanban, Bold, Check, Clock, Eye, FileText, Hash, Heading2, ImageIcon, Italic, Link2, List, ListChecks, Loader2, Pencil, Pin, PinOff, Smile, Target, Trash2 } from 'lucide-react';
import { CoverPicker, coverGradient } from '@/components/common/Pickers';
import { LineIcon, LineIconPicker } from '@/components/common/CategoryMark';
import { useUI } from '@/app/providers/UIProvider';
import { colorOf } from '@/lib/utils/colors';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { TagInput } from '@/components/ui/tag-input';
import { projectOptions } from '@/components/common/options';
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
  const { projects, tasks, goals } = useCollections();
  const { openTask } = useUI();
  const navigate = useNavigate();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tagsText, setTagsText] = useState(note.tags.join(', '));
  // Notes with content open in reading mode; clicking the text switches to editing.
  const [preview, setPreview] = useState(() => note.content.trim().length > 0);
  const [state, setState] = useState<SaveState>('saved');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
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

  const wrap = (before: string, after = before, placeholder = 'текст') => {
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
    const ok = await confirm({ title: 'Видалити нотатку?', description: `«${title || 'Без назви'}» буде видалено назавжди.`, confirmLabel: 'Видалити', danger: true });
    if (!ok) return;
    save.cancel();
    try {
      await actions.notes.remove(note.id);
      toast.success('Нотатку видалено');
      navigate('/notes');
    } catch {
      /* toast from sync layer */
    }
  };

  const tools = [
    { icon: Bold, label: 'Жирний', run: () => wrap('**') },
    { icon: Italic, label: 'Курсив', run: () => wrap('*') },
    { icon: Heading2, label: 'Заголовок', run: () => linePrefix('## ') },
    { icon: List, label: 'Список', run: () => linePrefix('- ') },
    { icon: ListChecks, label: 'Чекліст', run: () => linePrefix('- [ ] ') },
    { icon: Link2, label: 'Посилання', run: () => wrap('[', '](https://)', 'посилання') },
  ];

  const headings = useMemo(
    () =>
      content
        .split('\n')
        .map((l) => /^(#{1,3})\s+(.*)$/.exec(l))
        .filter((m): m is RegExpExecArray => !!m)
        .map((m) => ({ level: m[1].length, text: m[2].replace(/[*_`]/g, '') })),
    [content],
  );
  const coverColor = note.cover ? colorOf(note.cover) : undefined;
  const setIcon = (icon: string | undefined) => void actions.notes.update(note.id, { icon }).catch(() => undefined);
  const updatedAt = new Date(note.updatedAt);
  const projectId = note.projectId;
  const relatedTasks = projectId ? tasks.filter((t) => t.projectId === projectId && (t.status === 'todo' || t.status === 'in_progress')).slice(0, 5) : [];
  const relatedGoals = projectId ? goals.filter((g) => g.projectIds.includes(projectId) && g.status === 'active').slice(0, 3) : [];

  const jumpTo = (index: number) => {
    const go = () => {
      const el = previewRef.current?.querySelectorAll('h1, h2, h3')[index];
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    if (!preview) {
      setPreview(true);
      requestAnimationFrame(() => requestAnimationFrame(go));
    } else go();
  };

  const startEditing = () => {
    setPreview(false);
    requestAnimationFrame(() => textRef.current?.focus());
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Slim top bar */}
        <div className="flex items-center gap-1 px-3 py-2 sm:px-4">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="До нотаток" onClick={() => { save.flush(); navigate('/notes'); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="flex items-center gap-1 text-xs text-muted" role="status">
            {state === 'saving' || state === 'pending' ? <Loader2 className="h-3 w-3 animate-spin" /> : state === 'saved' ? <Check className="h-3 w-3 text-success" /> : null}
            {state === 'pending' ? 'Редагування…' : state === 'saving' ? 'Збереження…' : state === 'saved' ? 'Збережено' : <span className="text-danger">Не збережено</span>}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => (preview ? startEditing() : setPreview(true))} aria-pressed={!preview}>
              {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {preview ? 'Редагувати' : 'Перегляд'}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={note.isPinned ? 'Відкріпити' : 'Закріпити'}
              title={note.isPinned ? 'Відкріпити' : 'Закріпити'}
              onClick={() => void actions.notes.update(note.id, { isPinned: !note.isPinned }).catch(() => undefined)}
            >
              {note.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Видалити нотатку" title="Видалити" onClick={() => void remove()}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[760px] px-5 pb-16 sm:px-10">
            {/* Cover + icon */}
            {coverColor ? (
              <div className="group relative mb-2 mt-2 h-24 rounded-2xl sm:h-28" style={{ background: coverGradient(note.cover!) }}>
                <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <CoverPicker value={note.cover} onChange={(cover) => void actions.notes.update(note.id, { cover }).catch(() => undefined)} />
                </div>
              </div>
            ) : null}
            <div className={cn('group/head flex items-end gap-2', coverColor && note.icon ? '-mt-12 ml-3' : 'mt-4')}>
              {note.icon && (
                <LineIconPicker label="Іконка нотатки" value={note.icon} color={coverColor ?? colorOf('slate')} onChange={setIcon}>
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface shadow-pop ring-1 ring-line/60" style={{ color: coverColor }}>
                    <LineIcon icon={note.icon} fallback={FileText} className="h-7 w-7" />
                  </span>
                </LineIconPicker>
              )}
              <div className={cn('flex gap-1 pb-1 text-[12.5px] text-subtle opacity-0 transition-opacity group-hover/head:opacity-100 focus-within:opacity-100', !note.icon && !coverColor && 'opacity-100 sm:opacity-0')}>
                {!note.icon && (
                  <LineIconPicker label="Іконка нотатки" value={undefined} color={coverColor ?? colorOf('slate')} onChange={setIcon}>
                    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-surface-2 hover:text-ink">
                      <Smile className="h-3.5 w-3.5" /> Іконка
                    </span>
                  </LineIconPicker>
                )}
                {!coverColor && (
                  <CoverPicker value={undefined} onChange={(cover) => void actions.notes.update(note.id, { cover }).catch(() => undefined)}>
                    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-surface-2 hover:text-ink">
                      <ImageIcon className="h-3.5 w-3.5" /> Обкладинка
                    </span>
                  </CoverPicker>
                )}
              </div>
            </div>

            <input
              value={title}
              onChange={(e) => change({ title: e.target.value })}
              placeholder="Без назви"
              aria-label="Назва нотатки"
              maxLength={300}
              className="mt-3 w-full bg-transparent text-[28px] font-bold leading-tight tracking-tight text-ink outline-none placeholder:text-subtle focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-[34px]"
            />

            {/* Properties */}
            <div className="mt-4 grid grid-cols-[110px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-[13.5px]">
              <span className="flex items-center gap-2 text-muted">
                <FolderKanban className="h-4 w-4" /> Проєкт
              </span>
              <div>
                <Select
                  variant="ghost"
                  className="-ml-2"
                  aria-label="Проєкт"
                  value={note.projectId ?? ''}
                  onChange={(v) => void actions.notes.update(note.id, { projectId: v || undefined }).catch(() => undefined)}
                  options={projectOptions(projects, note.projectId)}
                />
              </div>
              <span className="flex items-center gap-2 self-start pt-2 text-muted">
                <Hash className="h-4 w-4" /> Теги
              </span>
              <TagInput
                className="min-w-0"
                value={tagsText.split(',').map((t) => t.trim()).filter(Boolean)}
                onChange={(tags) => change({ tags: tags.join(', ') })}
                placeholder="Додати тег"
              />
              <span className="flex items-center gap-2 text-muted">
                <Clock className="h-4 w-4" /> Змінено
              </span>
              <span className="text-muted">
                {updatedAt.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}, {updatedAt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="my-6 h-px bg-line" />

            {!preview && (
              <div className="sticky top-0 z-10 -mx-2 mb-3 flex flex-wrap items-center gap-0.5 rounded-xl bg-surface/95 px-1 py-1 backdrop-blur">
                {tools.map(({ icon: Icon, label, run }) => (
                  <Button key={label} variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={run}>
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            )}

            {preview ? (
              <div
                ref={previewRef}
                role="button"
                tabIndex={0}
                title="Натисніть, щоб редагувати"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a')) return;
                  startEditing();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    startEditing();
                  }
                }}
                className={cn('prose-note min-h-[40vh] cursor-text text-[15.5px] leading-[1.75] text-ink outline-none', !content && 'text-muted')}
                dangerouslySetInnerHTML={{ __html: html || '<p>Поки порожньо. Натисніть, щоб почати писати.</p>' }}
              />
            ) : (
              <textarea
                ref={textRef}
                value={content}
                onChange={(e) => change({ content: e.target.value })}
                onBlur={() => save.flush()}
                placeholder={'Почніть писати…\n\nПрацює Markdown: **жирний**, *курсив*, ## заголовок, - список, - [ ] чекліст'}
                aria-label="Текст нотатки"
                className="min-h-[55vh] w-full resize-none bg-transparent text-[15.5px] leading-[1.75] text-ink outline-none placeholder:text-subtle"
              />
            )}
          </div>
        </div>
      </div>

      {/* Outline and related items */}
      {(headings.length > 0 || relatedTasks.length > 0 || relatedGoals.length > 0) && (
        <aside className="scrollbar-thin hidden w-[220px] shrink-0 overflow-y-auto border-l border-line p-5 text-[13px] xl:block">
          {headings.length > 0 && (
            <>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">Зміст</p>
              {headings.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => jumpTo(i)}
                  className={cn('block w-full truncate py-1 text-left transition-colors hover:text-ink', h.level === 1 ? 'font-medium text-ink' : 'text-muted', h.level === 3 && 'pl-3')}
                >
                  {h.text}
                </button>
              ))}
            </>
          )}
          {(relatedTasks.length > 0 || relatedGoals.length > 0) && (
            <>
              <p className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle first:mt-0">Пов’язане</p>
              {relatedTasks.map((t) => (
                <button key={t.id} type="button" onClick={() => openTask(t.id)} className="flex w-full items-center gap-2 py-1 text-left text-muted hover:text-ink">
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-subtle" />
                  <span className="truncate">{t.title}</span>
                </button>
              ))}
              {relatedGoals.map((g) => (
                <Link key={g.id} to="/goals" className="flex items-center gap-2 py-1 text-muted hover:text-ink">
                  <Target className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{g.title}</span>
                </Link>
              ))}
            </>
          )}
        </aside>
      )}
    </div>
  );
}
