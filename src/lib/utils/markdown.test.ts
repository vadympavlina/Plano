import { describe, expect, it } from 'vitest';
import { markdownExcerpt, renderMarkdown, continueList, toggleTask } from './markdown';

describe('markdown', () => {
  it('escapes HTML', () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('blocks javascript: links', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('href');
    expect(renderMarkdown('[site](https://example.com)')).toContain('href="https://example.com"');
  });

  it('renders basic formatting', () => {
    const html = renderMarkdown('# Title\n\n**bold** and *it*\n\n- one\n- [x] done\n\n1. first');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>it</em>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('checked');
    expect(html).toContain('<ol>');
  });

  it('excerpts plain text', () => {
    expect(markdownExcerpt('# Hi\n**there** [link](https://a.b)')).toBe('Hi there link');
  });
});

describe('checklists', () => {
  it('flips a checkbox on its line and leaves the others', () => {
    const src = '# План\n- [ ] Квитки\n- [x] Готель';
    expect(toggleTask(src, 1)).toBe('# План\n- [x] Квитки\n- [x] Готель');
    expect(toggleTask(src, 2)).toBe('# План\n- [ ] Квитки\n- [ ] Готель');
    expect(toggleTask(src, 0)).toBe(src);
    expect(toggleTask(src, 9)).toBe(src);
  });

  it('marks each checkbox with its line, so a tick can be told apart', () => {
    expect(renderMarkdown('текст\n- [ ] а\n- [x] б')).toContain('data-line="1"');
    expect(renderMarkdown('текст\n- [ ] а\n- [x] б')).toContain('data-line="2"');
  });

  it('continues a list on Enter, and ends it on an empty item', () => {
    expect(continueList('- купити')).toEqual({ prefix: '- ', empty: false });
    expect(continueList('- [x] готово')).toEqual({ prefix: '- [ ] ', empty: false });
    expect(continueList('  3. третє')).toEqual({ prefix: '  4. ', empty: false });
    expect(continueList('> цитата')).toEqual({ prefix: '> ', empty: false });
    expect(continueList('- [ ] ')).toMatchObject({ empty: true });
    expect(continueList('- ')).toMatchObject({ empty: true });
    expect(continueList('звичайний рядок')).toBeNull();
  });
});
