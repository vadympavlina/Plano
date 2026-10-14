// A deliberately small, safe Markdown renderer for notes.
// All input is HTML-escaped first; only a fixed set of constructs is turned
// back into markup, so user content can never inject scripts or attributes.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url: string): string | null {
  const u = url.trim();
  if (/^(https?:|mailto:)/i.test(u)) return u;
  return null;
}

function inline(text: string): string {
  let s = escapeHtml(text);
  // inline code first; protect its content from further formatting
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_, c: string) => {
    codes.push(`<code>${c}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label: string, url: string) => {
    const safe = safeUrl(url.replace(/&amp;/g, '&'));
    return safe ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>` : m;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[Number(i)]);
  return s;
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let para: string[] = [];
  let inCode = false;
  let code: string[] = [];

  const closePara = () => {
    if (para.length) {
      html.push(`<p>${para.map(inline).join('<br/>')}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        closePara();
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const task = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (heading) {
      closePara();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (task) {
      closePara();
      if (list !== 'ul') {
        closeList();
        html.push('<ul>');
        list = 'ul';
      }
      const checked = task[1].toLowerCase() === 'x';
      html.push(
        `<li class="task-item"><input type="checkbox" disabled${checked ? ' checked' : ''}/> <span${checked ? ' style="text-decoration:line-through;opacity:.6"' : ''}>${inline(task[2])}</span></li>`,
      );
    } else if (bullet) {
      closePara();
      if (list !== 'ul') {
        closeList();
        html.push('<ul>');
        list = 'ul';
      }
      html.push(`<li>${inline(bullet[1])}</li>`);
    } else if (ordered) {
      closePara();
      if (list !== 'ol') {
        closeList();
        html.push('<ol>');
        list = 'ol';
      }
      html.push(`<li>${inline(ordered[1])}</li>`);
    } else if (/^\s*>\s?/.test(line)) {
      closePara();
      closeList();
      html.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ''))}</blockquote>`);
    } else if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      closePara();
      closeList();
      html.push('<hr/>');
    } else if (line.trim() === '') {
      closePara();
      closeList();
    } else {
      closeList();
      para.push(line);
    }
  }
  if (inCode) html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  closePara();
  closeList();
  return html.join('\n');
}

/** Plain-text excerpt of a Markdown note for previews and search results. */
export function markdownExcerpt(src: string, max = 140): string {
  const text = src
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~-]+|\[( |x)\]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
