import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { noteExtensions } from './extensions';

const roundtrip = (md: string) => {
  const editor = new Editor({ extensions: noteExtensions(), content: md, contentType: 'markdown' });
  const out = editor.getMarkdown();
  editor.destroy();
  return out;
};

describe('the note editor keeps the Markdown of a note', () => {
  it.each([
    ['# Заголовок\n\nТекст з **жирним** і *курсивом*.'],
    ['- один\n- два\n- три'],
    ['1. перший\n2. другий'],
    ['- [ ] Квитки\n- [x] Готель'],
    ['> цитата'],
    ['---'],
    ['```\nкод\n```'],
    ['[посилання](https://example.com)'],
    ['- батько\n  - дитина'],
    ['- [ ] батько\n  - [x] дитина'],
  ])('%j', (md) => {
    expect(roundtrip(md).trim()).toBe(md);
  });

  it('keeps a single line break inside a paragraph', () => {
    const out = roundtrip('рядок один\nрядок два');
    expect(out).toMatch(/рядок один\s*\n\s*рядок два/);
  });

  it('does not turn text into markup', () => {
    const out = roundtrip('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(out).not.toMatch(/<img[^>]*onerror/);
  });
});
