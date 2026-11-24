import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { Extension, InputRule, type Extensions } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

/** «- [ ] » (the Markdown way to write a checklist item) turns the bullet being typed into a checklist item. */
const TypedChecklist = Extension.create({
  name: 'typedChecklist',
  addInputRules() {
    return [
      new InputRule({
        find: /^\[( |x|X)?\]\s$/,
        handler: ({ range, match, chain }) => {
          if (!this.editor.isActive('bulletList')) return null;
          const checked = (match[1] ?? '').toLowerCase() === 'x';
          chain().deleteRange(range).toggleTaskList().updateAttributes('taskItem', { checked }).run();
          return undefined;
        },
      }),
    ];
  },
});

/**
 * A tap on a checklist's box is handled here, on the editor's current state (the stock handler builds its change from a
 * state it took a moment earlier, and in a browser that ends in «Applying a mismatched transaction»).
 */
const TickChecklist = Extension.create({
  name: 'tickChecklist',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            click: (view, event) => {
              const box = event.target;
              if (!(box instanceof HTMLInputElement) || box.type !== 'checkbox' || !view.editable) return false;
              const item = box.closest('li[data-checked]');
              if (!item) return false;
              event.preventDefault();
              const $pos = view.state.doc.resolve(view.posAtDOM(item, 0));
              for (let d = $pos.depth; d > 0; d--) {
                const node = $pos.node(d);
                if (node.type.name === 'taskItem') {
                  const checked = !node.attrs.checked;
                  view.dispatch(view.state.tr.setNodeMarkup($pos.before(d), undefined, { ...node.attrs, checked }));
                  // The browser takes back the tick of a cancelled click once this handler is done: put it back.
                  setTimeout(() => (box.checked = checked), 0);
                  return true;
                }
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});

/**
 * What a note's text is made of. The note is still kept as Markdown (so search, previews, export and the older notes
 * keep working); the editor shows it as live blocks and writes Markdown back.
 */
export function noteExtensions(extra: Extensions = [], placeholder = 'Пишіть тут. Натисніть «/», щоб додати блок…'): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, protocols: ['mailto'], HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TypedChecklist,
    TickChecklist,
    Placeholder.configure({ placeholder, showOnlyWhenEditable: true }),
    // A single line break in the text stays a line break (as it always was in these notes).
    Markdown.configure({ markedOptions: { breaks: true, gfm: true } }),
    ...extra,
  ];
}
