import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import { Bold, Code, IndentDecrease, IndentIncrease, Italic, Link2, Plus, Quote, Redo2, Strikethrough, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  // A change that came from elsewhere (another device, the Markdown view) replaces the text; our own typing does not.
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    if (editor.getMarkdown() !== value) editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;
  return (
    <div className={className} onBlur={onBlur}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      {slash && <SlashMenu state={slash} />}
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
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
  const setLink = () => {
    const previous = (editor.getAttributes('link').href as string | undefined) ?? '';
    const url = window.prompt('Адреса посилання', previous || 'https://');
    if (url === null) return;
    const chain = editor.chain().focus().extendMarkRange('link');
    if (url.trim() === '' || url.trim() === 'https://') chain.unsetLink().run();
    else chain.setLink({ href: /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}` }).run();
  };
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
      role="toolbar"
      aria-label="Форматування"
      className="no-scrollbar sticky top-0 z-10 -mx-2 mb-3 flex items-center gap-0.5 overflow-x-auto rounded-xl bg-surface/95 px-1 py-1 backdrop-blur-sm"
    >
      {tool('Додати блок', <Plus className="h-4 w-4" />, () => editor.chain().focus().insertContent('/').run())}
      <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
      {tool('Жирний', <Bold className="h-4 w-4" />, () => editor.chain().focus().toggleBold().run(), s.bold)}
      {tool('Курсив', <Italic className="h-4 w-4" />, () => editor.chain().focus().toggleItalic().run(), s.italic)}
      {tool('Закреслений', <Strikethrough className="h-4 w-4" />, () => editor.chain().focus().toggleStrike().run(), s.strike)}
      {tool('Код у рядку', <Code className="h-4 w-4" />, () => editor.chain().focus().toggleCode().run(), s.code)}
      {tool('Посилання', <Link2 className="h-4 w-4" />, setLink, s.link)}
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
