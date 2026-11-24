import { Extension, type Editor, type Range } from '@tiptap/core';
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';
import type { LucideIcon } from 'lucide-react';
import { Code2, Heading1, Heading2, Heading3, List, ListChecks, ListOrdered, Minus, Pilcrow, Quote } from 'lucide-react';

export interface SlashItem {
  id: string;
  title: string;
  hint: string;
  /** What the person might type after «/» to find it. */
  keywords: string[];
  icon: LucideIcon;
  run: (editor: Editor, range: Range) => void;
}

const at = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

/** The blocks that can be added with «/». */
export const SLASH_ITEMS: SlashItem[] = [
  { id: 'p', title: 'Текст', hint: 'Звичайний абзац', keywords: ['text', 'p', 'текст', 'абзац'], icon: Pilcrow, run: (e, r) => at(e, r).setParagraph().run() },
  {
    id: 'h1',
    title: 'Заголовок 1',
    hint: 'Великий розділ',
    keywords: ['h1', 'heading', 'заголовок', 'великий'],
    icon: Heading1,
    run: (e, r) => at(e, r).setNode('heading', { level: 1 }).run(),
  },
  {
    id: 'h2',
    title: 'Заголовок 2',
    hint: 'Середній розділ',
    keywords: ['h2', 'heading', 'заголовок', 'середній'],
    icon: Heading2,
    run: (e, r) => at(e, r).setNode('heading', { level: 2 }).run(),
  },
  {
    id: 'h3',
    title: 'Заголовок 3',
    hint: 'Малий розділ',
    keywords: ['h3', 'heading', 'заголовок', 'малий'],
    icon: Heading3,
    run: (e, r) => at(e, r).setNode('heading', { level: 3 }).run(),
  },
  {
    id: 'ul',
    title: 'Список',
    hint: 'Маркований список',
    keywords: ['list', 'bullet', 'список', 'маркований'],
    icon: List,
    run: (e, r) => at(e, r).toggleBulletList().run(),
  },
  {
    id: 'ol',
    title: 'Нумерований список',
    hint: '1. 2. 3.',
    keywords: ['number', 'ordered', 'нумерований', 'цифри'],
    icon: ListOrdered,
    run: (e, r) => at(e, r).toggleOrderedList().run(),
  },
  {
    id: 'task',
    title: 'Чекліст',
    hint: 'Пункти, які можна відмічати',
    keywords: ['todo', 'task', 'check', 'чекліст', 'задачі', 'галочка'],
    icon: ListChecks,
    run: (e, r) => at(e, r).toggleTaskList().run(),
  },
  { id: 'quote', title: 'Цитата', hint: 'Виділена думка', keywords: ['quote', 'цитата'], icon: Quote, run: (e, r) => at(e, r).toggleBlockquote().run() },
  { id: 'code', title: 'Код', hint: 'Блок із моноширинним текстом', keywords: ['code', 'код'], icon: Code2, run: (e, r) => at(e, r).toggleCodeBlock().run() },
  {
    id: 'hr',
    title: 'Розділювач',
    hint: 'Горизонтальна лінія',
    keywords: ['divider', 'line', 'hr', 'розділювач', 'лінія'],
    icon: Minus,
    run: (e, r) => at(e, r).setHorizontalRule().run(),
  },
];

export const filterSlash = (query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((i) => i.title.toLowerCase().includes(q) || i.keywords.some((k) => k.includes(q)));
};

/** What the page needs to draw the menu: null when it is closed. */
export interface SlashState {
  items: SlashItem[];
  index: number;
  rect: DOMRect | null;
  pick: (item: SlashItem) => void;
}

export interface SlashOptions {
  /** Called whenever the menu opens, moves or closes. */
  onState: (state: SlashState | null) => void;
}

/** «/» in an empty place (or after a space) opens a menu of blocks; the arrows and Enter pick one. */
export const SlashCommand = Extension.create<SlashOptions>({
  name: 'slashCommand',
  addOptions: () => ({ onState: () => undefined }),
  addProseMirrorPlugins() {
    const { onState } = this.options;
    let index = 0;
    let last: SuggestionProps<SlashItem, SlashItem> | null = null;
    const push = (props: SuggestionProps<SlashItem, SlashItem> | null) => {
      last = props;
      if (!props || !props.items.length) return onState(null);
      onState({ items: props.items, index, rect: props.clientRect?.() ?? null, pick: (item) => props.command(item) });
    };
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: '/',
        allowedPrefixes: [' ', '\n'],
        // «/заголовок 2»: the query may have spaces. When nothing matches any more, the menu goes away and Enter is Enter.
        allowSpaces: true,
        items: ({ query }) => filterSlash(query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => ({
          onStart: (props) => {
            index = 0;
            push(props);
          },
          onUpdate: (props) => {
            index = Math.min(index, Math.max(0, props.items.length - 1));
            push(props);
          },
          onKeyDown: ({ event }: SuggestionKeyDownProps) => {
            if (!last || !last.items.length) return false;
            const n = last.items.length;
            if (event.key === 'ArrowDown') index = (index + 1) % n;
            else if (event.key === 'ArrowUp') index = (index - 1 + n) % n;
            else if (event.key === 'Enter' || event.key === 'Tab') {
              last.command(last.items[index]);
              return true;
            } else if (event.key === 'Escape') {
              onState(null);
              return true;
            } else return false;
            push(last);
            return true;
          },
          onExit: () => push(null),
        }),
      }),
    ];
  },
});
