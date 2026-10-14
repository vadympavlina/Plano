import { describe, expect, it } from 'vitest';
import { markdownExcerpt, renderMarkdown } from './markdown';

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
