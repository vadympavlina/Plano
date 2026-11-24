// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { noteExtensions } from './extensions';

describe('a tick in a checklist', () => {
  it('is written into the note', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = new Editor({ element, extensions: noteExtensions(), content: '- [ ] Квитки\n- [x] Готель', contentType: 'markdown' });
    const box = editor.view.dom.querySelector('input[type=checkbox]') as HTMLInputElement;
    box.click();
    expect(editor.getMarkdown()).toContain('- [x] Квитки');
    editor.destroy();
  });
});
