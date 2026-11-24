import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import { Bold, Check, Code, IndentDecrease, IndentIncrease, Italic, Link2, Link2Off, Plus, Quote, Redo2, Strikethrough, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsPhone } from '@/components/ui/picker';
import { cn } from '@/lib/utils/cn';
import { noteExtensions } from './extensions';
import { SlashCommand, type SlashState } from './slash';

interface Props {
  /** The note's text, as Markdown. */
  value: string;
  onChange: (markdown: string) => void;
  /** Gives the page the editor, to focus it or to find headings in it. */
  editorRef?: MutableRefObject<Editor | null>;
  /** The editor lost focus (the page saves what is pending). */
  onBlur?: () => void;
  className?: string;
}

/**
 * The text of a note as live blocks: type «/» (or tap «+») to add a heading, list, checklist, quote, code or divider;
 * «# », «- », «[ ] », «> » and **bold** work as shortcuts too. The note itself stays Markdown.
 */
export function BlockEditor({ value, onChange, editorRef, onBlur, className }: Props) {
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [focused, setFocused] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const phone = useIsPhone();
  const lastEmitted = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const extensions = useMemo(() => noteExtensions([SlashCommand.configure({ onState: setSlash })]), []);
  // The options are the same object on every render: tiptap re-applies changed options, and doing that in the middle of a
  // tap on a checkbox (a render can happen then) breaks the tap.
  const options = useMemo(
    () => ({
      extensions,
      content: value,
      contentType: 'markdown' as const,
      immediatelyRender: true,
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': 'Текст нотатки',
          autocapitalize: 'sentences',
          class: 'note-editor prose-note min-h-[45vh] cursor-text pb-24 text-[15.5px] leading-[1.75] text-ink outline-hidden',
        },
      },
      onUpdate: ({ editor: e }: { editor: Editor }) => {
        const md = e.getMarkdown();
        lastEmitted.current = md;
        onChangeRef.current(md);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extensions],
  );
  const editor = useEditor(options);

  useEffect(() => {
    if (editorRef) editorRef.current = editor;
    return () => {
      if (editorRef) editorRef.current = null;
    };
  }, [editor, editorRef]);

  useEffect(() => {
    if (!editor) return;
    const on = () => setFocused(true);
    const off = () => setFocused(false);
    editor.on('focus', on);
    editor.on('blur', off);
    return () => {
      editor.off('focus', on);
      editor.off('blur', off);
    };
  }, [editor]);

  // A change that came from elsewhere (another device, the Markdown view) replaces the text; our own typing does not.
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    if (editor.getMarkdown() !== value) editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }, [editor, value]);

  // On a phone the tools ride just above the keyboard while the text is being typed.
  const typing = phone && (focused || linkOpen);
  const inset = useKeyboardInset(typing);
  if (!editor) return null;
  // Only with a real keyboard up: with none (a hardware keyboard) the bar stays at the top of the text.
  const pinned = typing && inset > 100;
  return (
    <div className={className} onBlur={onBlur}>
      {pinned && <div className="h-11" aria-hidden />}
      <Toolbar editor={editor} pinned={pinned} inset={inset} linkOpen={linkOpen} setLinkOpen={setLinkOpen} />
      <EditorContent editor={editor} />
      {slash && <SlashMenu state={slash} />}
    </div>
  );
}

/** How far the on-screen keyboard reaches up from the bottom of the window (0 when there is none). */
function useKeyboardInset(active: boolean) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    const update = () => setInset(vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0);
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [active]);
  return active ? inset : 0;
}

function Toolbar({
  editor,
  pinned,
  inset,
  linkOpen,
  setLinkOpen,
}: {
  editor: Editor;
  pinned: boolean;
  inset: number;
  linkOpen: boolean;
  setLinkOpen: (open: boolean) => void;
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      quote: e.isActive('blockquote'),
      inList: e.isActive('listItem') || e.isActive('taskItem'),
      undo: e.can().undo(),
      redo: e.can().redo(),
    }),
  });
  // A tap on a tool must not take the cursor (and on a phone the keyboard) away from the text.
  const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();
  const tool = (label: string, icon: React.ReactNode, run: () => void, active = false, disabled = false) => (
    <Button
      key={label}
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onPointerDown={keep}
      onMouseDown={keep}
      onClick={run}
      className={cn('shrink-0', active && 'bg-surface-2 text-ink')}
    >
      {icon}
    </Button>
  );
  return (
    <div
      className={cn(
        pinned
          ? 'fixed inset-x-0 z-[58] border-t border-line bg-surface px-2 pb-[max(4px,env(safe-area-inset-bottom))] pt-1 shadow-pop'
          : 'sticky top-0 z-10 -mx-2 mb-3 rounded-xl bg-surface/95 px-1 py-1 backdrop-blur-sm',
      )}
      style={pinned ? { bottom: inset } : undefined}
    >
      {linkOpen && <LinkBar editor={editor} onClose={() => setLinkOpen(false)} />}
      <div role="toolbar" aria-label="Форматування" className="no-scrollbar flex items-center gap-0.5 overflow-x-auto">
        {tool('Додати блок', <Plus className="h-4 w-4" />, () => editor.chain().focus().insertContent('/').run())}
        <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
        {tool('Жирний', <Bold className="h-4 w-4" />, () => editor.chain().focus().toggleBold().run(), s.bold)}
        {tool('Курсив', <Italic className="h-4 w-4" />, () => editor.chain().focus().toggleItalic().run(), s.italic)}
        {tool('Закреслений', <Strikethrough className="h-4 w-4" />, () => editor.chain().focus().toggleStrike().run(), s.strike)}
        {tool('Код у рядку', <Code className="h-4 w-4" />, () => editor.chain().focus().toggleCode().run(), s.code)}
        {tool('Посилання', <Link2 className="h-4 w-4" />, () => setLinkOpen(!linkOpen), s.link || linkOpen)}
        {tool('Цитата', <Quote className="h-4 w-4" />, () => editor.chain().focus().toggleBlockquote().run(), s.quote)}
        {s.inList && (
          <>
            <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
            {tool('Вкласти глибше', <IndentIncrease className="h-4 w-4" />, () => {
              const c = editor.chain().focus();
              (editor.isActive('taskItem') ? c.sinkListItem('taskItem') : c.sinkListItem('listItem')).run();
            })}
            {tool('Винести вище', <IndentDecrease className="h-4 w-4" />, () => {
              const c = editor.chain().focus();
              (editor.isActive('taskItem') ? c.liftListItem('taskItem') : c.liftListItem('listItem')).run();
            })}
          </>
        )}
        <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
        {tool('Скасувати', <Undo2 className="h-4 w-4" />, () => editor.chain().focus().undo().run(), false, !s.undo)}
        {tool('Повторити', <Redo2 className="h-4 w-4" />, () => editor.chain().focus().redo().run(), false, !s.redo)}
      </div>
    </div>
  );
}

/** The address of a link: typed here, applied to the selected text (or inserted as a link when nothing is selected). */
function LinkBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const had = editor.isActive('link');
  const [url, setUrl] = useState((editor.getAttributes('link').href as string | undefined) ?? '');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const apply = () => {
    const raw = url.trim();
    if (!raw) return remove();
    const href = /^(https?:|mailto:)/i.test(raw) ? raw : `https://${raw}`;
    const chain = editor.chain().focus();
    if (editor.state.selection.empty && !editor.isActive('link'))
      chain.insertContent({ type: 'text', text: raw, marks: [{ type: 'link', attrs: { href } }] }).run();
    else chain.extendMarkRange('link').setLink({ href }).run();
    onClose();
  };
  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose();
  };
  return (
    <div className="mb-1 flex items-center gap-1 px-1">
      <input
        ref={input}
        type="url"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            apply();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
            editor.commands.focus();
          }
        }}
        placeholder="Адреса: https://…"
        aria-label="Адреса посилання"
        className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-[14px] text-ink outline-hidden placeholder:text-subtle"
      />
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Застосувати посилання" title="Застосувати" onClick={apply}>
        <Check className="h-4 w-4" />
      </Button>
      {had && (
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Прибрати посилання" title="Прибрати посилання" onClick={remove}>
          <Link2Off className="h-4 w-4" />
        </Button>
      )}
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Закрити" title="Закрити" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** The list of blocks next to the cursor. */
function SlashMenu({ state }: { state: SlashState }) {
  const { items, index, rect, pick } = state;
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; maxHeight: number } | null>(null);

  // Under the cursor, or above it when there is no room (on a phone the keyboard takes the lower half).
  useEffect(() => {
    if (!rect) return;
    const vv = window.visualViewport;
    const viewH = vv?.height ?? window.innerHeight;
    const viewW = vv?.width ?? window.innerWidth;
    const width = Math.min(300, viewW - 24);
    const left = Math.max(12, Math.min(rect.left, viewW - width - 12));
    const below = viewH - rect.bottom - 12;
    const above = rect.top - 12;
    const wanted = Math.min(items.length * 52 + 8, 320);
    if (below >= Math.min(wanted, 200) || below >= above) setPlace({ left, top: rect.bottom + 6, maxHeight: Math.max(120, Math.min(wanted, below)) });
    else setPlace({ left, top: Math.max(12, rect.top - 6 - Math.min(wanted, above)), maxHeight: Math.max(120, Math.min(wanted, above)) });
  }, [rect, items.length]);

  useEffect(() => {
    box.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!place) return null;
  return (
    <div
      ref={box}
      role="listbox"
      tabIndex={-1}
      aria-label="Блоки"
      style={{
        position: 'fixed',
        left: place.left,
        top: place.top,
        maxHeight: place.maxHeight,
        width: Math.min(300, (window.visualViewport?.width ?? window.innerWidth) - 24),
      }}
      className="scrollbar-thin z-[70] overflow-y-auto rounded-2xl border border-line bg-surface p-1 shadow-pop enter-fade"
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.length === 0 ? (
        <p className="px-3 py-2.5 text-[13px] text-muted">Нічого не знайдено</p>
      ) : (
        items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={i === index}
            onClick={() => pick(item)}
            className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left', i === index ? 'bg-surface-2' : 'active:bg-surface-2')}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-muted">
              <item.icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-medium text-ink">{item.title}</span>
              <span className="block truncate text-[12px] text-muted">{item.hint}</span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}
