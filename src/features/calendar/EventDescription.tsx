import { useState, type ReactNode } from 'react';
import { ExternalLink, Video } from 'lucide-react';

const URL_RE = /https?:\/\/[^\s<>"]+/g;

/** Short label for a link: host + a hint of the path. */
function linkLabel(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    return u.pathname.length > 1 ? `${host}/…` : host;
  } catch {
    return url.slice(0, 40);
  }
}

/** The first video-call link in a description (Teams, Zoom, Meet, Webex). */
export function meetingLink(text?: string): string | undefined {
  return text?.match(URL_RE)?.find((u) => /teams\.microsoft\.com\/(l\/meetup-join|meet\/)|zoom\.us\/j\/|meet\.google\.com\/|webex\.com\/meet/i.test(u));
}

function renderLine(line: string, key: number): ReactNode {
  // "______" and "-----" separators from mail clients become a thin rule.
  if (/^[\s_\-–—=*]{8,}$/.test(line)) return <hr key={key} className="my-2 border-line" />;
  // "<https://…>" wrappers (Outlook) → plain links.
  const clean = line.replace(/<(https?:\/\/[^>]+)>/g, ' $1');
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of clean.matchAll(URL_RE)) {
    parts.push(clean.slice(last, m.index));
    parts.push(
      <a key={m.index} href={m[0]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
        {linkLabel(m[0])}
        <ExternalLink className="h-3 w-3" />
      </a>,
    );
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(clean.slice(last));
  return (
    <p key={key} className="min-h-[1em]">
      {parts}
    </p>
  );
}

/** Event description: wraps long text and links, tidies mail-style separators, folds long text. */
export function EventDescription({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, '\n').trim().split('\n');
  const long = lines.length > 8 || text.length > 400;
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0 rounded-xl bg-surface-2 p-3 text-[13px] leading-relaxed text-muted">
      <div className={long && !open ? 'relative max-h-[9.5rem] overflow-hidden' : undefined} style={{ overflowWrap: 'anywhere' }}>
        {lines.map(renderLine)}
        {long && !open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface-2 to-transparent" />}
      </div>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1.5 text-[12.5px] font-semibold text-ink hover:underline">
          {open ? 'Згорнути' : 'Показати повністю'}
        </button>
      )}
    </div>
  );
}

export function JoinMeetingButton({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:brightness-110"
    >
      <Video className="h-4 w-4" /> Приєднатися до зустрічі
    </a>
  );
}
