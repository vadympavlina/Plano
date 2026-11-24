import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderKanban, Check, Clock, FileText, Hash, ImageIcon, Loader2, Code2, Pencil, Pin, PinOff, Smile, Target, Trash2 } from 'lucide-react';
import { CoverPicker } from '@/components/common/Pickers';
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
import { continueList } from '@/lib/utils/markdown';
import { BlockEditor } from './editor/BlockEditor';
import { cn } from '@/lib/utils/cn';
import type { Editor } from '@tiptap/core';
import type { ColorKey, Note } from '@/types';

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
  // The text is edited as live blocks; «Markdown» shows (and edits) the raw text instead.
  const [source, setSource] = useState(false);
  const [state, setState] = useState<SaveState>('saved');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const saved = useRef({ title: note.title, content: note.content, tags: note.tags.join(', ') });

  const save = useDebouncedCallback((next: { title: string; content: string; tags: string }) => {
    const tags = [
      ...new Set(
        next.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ];
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

  // The text box grows with the text (the page scrolls, not the box).
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [content, source]);

  // Enter at the end of a list line starts the next item; on an empty item it ends the list.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    if (el.selectionStart !== el.selectionEnd) return;
    const pos = el.selectionStart;
    const lineStart = content.lastIndexOf('\n', pos - 1) + 1;
    const lineEnd = content.indexOf('\n', pos);
    if ((lineEnd === -1 ? content.length : lineEnd) !== pos) return; // only at the end of the line
    const cont = continueList(content.slice(lineStart, pos));
    if (!cont) return;
    e.preventDefault();
    const next = cont.empty ? content.slice(0, lineStart) + content.slice(pos) : content.slice(0, pos) + '\n' + cont.prefix + content.slice(pos);
    const caret = cont.empty ? lineStart : pos + 1 + cont.prefix.length;
    // Put the text and the caret in the box right now (React then finds the same value and leaves the caret alone).
    el.value = next;
    el.setSelectionRange(caret, caret);
    change({ content: next });
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Видалити нотатку?',
      description: `«${title || 'Без назви'}» буде видалено назавжди.`,
      confirmLabel: 'Видалити',
      danger: true,
    });
    if (!ok) return;
    save.cancel();
    try {
      await actions.notes.remove(note.id);
      toast.success('Нотатку видалено');
      void navigate('/notes');
    } catch {
      /* toast from sync layer */
    }
  };

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
      const dom = editorRef.current?.view.dom;
      dom?.querySelectorAll('h1, h2, h3')[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    if (source) {
      setSource(false);
      requestAnimationFrame(() => requestAnimationFrame(go));
    } else go();
  };

  // ---- the head of the note: cover, icon, title and properties, in the look chosen in the settings ----
  const solid = coverColor ?? colorOf('slate');
  // An opaque tint of the colour (mixed with the page, so nothing shows through).
  const soft = (pct: number) => `color-mix(in srgb, ${solid} ${pct}%, rgb(var(--surface)))`;
  const setCover = (cover: ColorKey | undefined) => void actions.notes.update(note.id, { cover }).catch(() => undefined);

  const tile = (size: string, glyph: string, extra?: string, style?: CSSProperties) =>
    note.icon ? (
      <LineIconPicker label="Іконка нотатки" value={note.icon} color={solid} onChange={setIcon}>
        <span className={cn('flex shrink-0 items-center justify-center rounded-2xl', size, extra)} style={{ color: solid, background: soft(16), ...style }}>
          <LineIcon icon={note.icon} fallback={FileText} className={glyph} />
        </span>
      </LineIconPicker>
    ) : null;

  // The title box is as tall as its text: measured again when the web font arrives and when the box changes width.
  const titleRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    void document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    return () => ro.disconnect();
  }, [title]);

  const titleInput = (className?: string, style?: CSSProperties) => (
    <textarea
      rows={1}
      autoComplete="off"
      value={title}
      onChange={(e) => change({ title: e.target.value.replace(/\n/g, ' ') })}
      onKeyDown={(e) => {
        // A title is one line of text that wraps; Enter moves on to the text.
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault();
          if (source) textRef.current?.focus();
          else editorRef.current?.commands.focus('start');
        }
      }}
      ref={titleRef}
      placeholder="Без назви"
      aria-label="Назва нотатки"
      maxLength={300}
      style={style}
      className={cn(
        'block w-full min-w-0 resize-none overflow-hidden bg-transparent text-[28px] font-bold leading-tight tracking-tight text-ink outline-hidden placeholder:text-subtle focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-[34px]',
        className,
      )}
    />
  );

  // «Іконка» / «Обкладинка»: what is missing can be added.
  const adders = (
    <div
      className={cn(
        'flex gap-1 text-[12.5px] text-subtle transition-opacity [@media(hover:none)]:opacity-100',
        !note.icon && !coverColor
          ? 'opacity-100 sm:opacity-0 sm:group-hover/head:opacity-100'
          : 'opacity-0 group-hover/head:opacity-100 focus-within:opacity-100',
      )}
    >
      {!note.icon && (
        <LineIconPicker label="Іконка нотатки" value={undefined} color={solid} onChange={setIcon}>
          <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-surface-2 hover:text-ink">
            <Smile className="h-3.5 w-3.5" /> Іконка
          </span>
        </LineIconPicker>
      )}
      {!coverColor && (
        <CoverPicker value={note.cover} onChange={setCover}>
          <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-surface-2 hover:text-ink">
            <ImageIcon className="h-3.5 w-3.5" /> Обкладинка
          </span>
        </CoverPicker>
      )}
    </div>
  );
  const coverButton = (
    <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
      <CoverPicker value={note.cover} onChange={setCover} />
    </div>
  );

  const meta = (
    <div className="mt-2 grid grid-cols-[22px_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 text-[13.5px] sm:mt-4 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-x-3 sm:gap-y-2">
      <span className="flex items-center gap-2 text-muted">
        <FolderKanban className="h-4 w-4" /> <span className="max-sm:sr-only">Проєкт</span>
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
        <Hash className="h-4 w-4" /> <span className="max-sm:sr-only">Теги</span>
      </span>
      <TagInput
        className="min-w-0"
        value={tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)}
        onChange={(tags) => change({ tags: tags.join(', ') })}
        placeholder="Додати тег…"
      />
      <span className="flex items-center gap-2 text-muted">
        <Clock className="h-4 w-4" /> <span className="max-sm:sr-only">Змінено</span>
      </span>
      <span className="text-muted">
        {updatedAt.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })},{' '}
        {updatedAt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );

  // A band of colour with the icon on its lower edge, cut out of the page by a ring of the page's own colour.
  const head = (
    <div className="group/head">
      {coverColor && (
        <div className="group relative mb-2 mt-2 h-20 rounded-2xl sm:h-28" style={{ background: `linear-gradient(120deg, ${soft(58)}, ${soft(30)})` }}>
          {coverButton}
        </div>
      )}
      <div className={cn('relative z-10 flex items-end gap-2', coverColor && note.icon ? '-mt-9 ml-3 sm:-mt-12' : 'mt-3 sm:mt-4')}>
        {tile('h-14 w-14 sm:h-16 sm:w-16', 'h-7 w-7', 'ring-[5px] ring-surface')}
        {adders}
      </div>
      {titleInput('mt-2')}
    </div>
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Slim top bar */}
        <div className="flex items-center gap-1 px-3 py-2 sm:px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label="До нотаток"
            onClick={() => {
              save.flush();
              void navigate('/notes');
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="flex items-center gap-1 text-xs text-muted" role="status">
            {state === 'saving' || state === 'pending' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : state === 'saved' ? (
              <Check className="h-3 w-3 text-success" />
            ) : null}
            {state === 'pending' ? (
              'Редагування…'
            ) : state === 'saving' ? (
              'Збереження…'
            ) : state === 'saved' ? (
              'Збережено'
            ) : (
              <span className="text-danger">Не збережено</span>
            )}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSource((v) => !v)}
              aria-pressed={source}
              aria-label={source ? 'Редактор' : 'Markdown'}
              title={source ? 'Повернутися до редактора' : 'Показати Markdown'}
              className="max-sm:w-8 max-sm:px-0"
            >
              {source ? <Pencil className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{source ? 'Редактор' : 'Markdown'}</span>
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

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[760px] px-5 pb-16 sm:px-10">
            {head}
            {meta}
            <div className="my-3 h-px bg-line sm:my-6" />

            {source ? (
              <textarea
                ref={textRef}
                value={content}
                onChange={(e) => change({ content: e.target.value })}
                onKeyDown={onKeyDown}
                onBlur={() => save.flush()}
                placeholder={'Почніть писати…\n\nПрацює Markdown: **жирний**, *курсив*, ## заголовок, - список, - [ ] чекліст'}
                aria-label="Текст нотатки (Markdown)"
                className="min-h-[45vh] w-full resize-none overflow-hidden bg-transparent font-mono text-[14px] leading-[1.7] text-ink outline-hidden placeholder:text-subtle"
              />
            ) : (
              <BlockEditor value={content} onChange={(markdown) => change({ content: markdown })} editorRef={editorRef} onBlur={() => save.flush()} />
            )}
          </div>
        </div>
      </div>

      {/* Outline and related items */}
      {(headings.length > 0 || relatedTasks.length > 0 || relatedGoals.length > 0) && (
        <aside className="scrollbar-thin hidden w-[220px] shrink-0 overflow-y-auto border-l border-line p-5 text-[13px] xl:block">
          {headings.length > 0 && (
            <>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-subtle">Зміст</p>
              {headings.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => jumpTo(i)}
                  className={cn(
                    'block w-full truncate py-1 text-left transition-colors hover:text-ink',
                    h.level === 1 ? 'font-medium text-ink' : 'text-muted',
                    h.level === 3 && 'pl-3',
                  )}
                >
                  {h.text}
                </button>
              ))}
            </>
          )}
          {(relatedTasks.length > 0 || relatedGoals.length > 0) && (
            <>
              <p className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-[0.08em] text-subtle first:mt-0">Пов’язане</p>
              {relatedTasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTask(t.id)}
                  className="flex w-full items-center gap-2 py-1 text-left text-muted hover:text-ink"
                >
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
