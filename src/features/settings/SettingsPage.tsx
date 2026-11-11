import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageContainer } from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils/cn';
import { SECTIONS, SearchCtx, norm, type SectionId } from './shared';
import { ProfileCard } from './ProfileCard';
import { PreferencesSection } from './PreferencesSection';
import { AppearanceSection } from './AppearanceSection';
import { CategoriesSection } from './CategoriesSection';
import { NotificationsSection } from './NotificationsSection';
import { IntegrationsSection } from './IntegrationsSection';
import { DataSection } from './DataSection';

export default function SettingsPage() {
  const { section } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<SectionId>('profile');
  const q = norm(query.trim());
  const picked = useRef<{ id: SectionId; until: number } | null>(null);

  // /settings/<section> (also used by links elsewhere in the app) scrolls to that section.
  useEffect(() => {
    if (!section || !SECTIONS.some((x) => x.id === section)) return;
    setActive(section as SectionId);
    picked.current = { id: section as SectionId, until: Date.now() + 1200 };
    const raf = requestAnimationFrame(() => document.getElementById(`settings-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return () => cancelAnimationFrame(raf);
  }, [section]);

  // Highlight the section being read: the last one whose top has passed the upper part of the screen,
  // or the section that was just picked (the last ones can't scroll to the top).
  useEffect(() => {
    const onScroll = () => {
      const pick = picked.current;
      if (pick && pick.until > Date.now()) return setActive(pick.id);
      // The page scrolls inside the main card on wide screens, with the window elsewhere.
      const card = document.querySelector('main');
      const inCard = !!card && card.scrollHeight > card.clientHeight + 1 && getComputedStyle(card).overflowY !== 'visible';
      const viewTop = inCard ? card!.getBoundingClientRect().top : 0;
      const viewHeight = inCard ? card!.clientHeight : window.innerHeight;
      const atBottom = inCard
        ? card!.scrollTop + card!.clientHeight >= card!.scrollHeight - 4
        : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      // At the very bottom keep a picked section (e.g. "Дані"), otherwise follow the scroll position.
      if (atBottom && pick) return setActive(pick.id);
      picked.current = null;
      let current: SectionId | null = null;
      for (const { id } of SECTIONS) {
        const el = document.getElementById(`settings-${id}`);
        if (el && (atBottom || el.getBoundingClientRect().top <= viewTop + viewHeight * 0.25)) current = id;
      }
      if (current) setActive(current);
    };
    onScroll();
    // Capture: scroll events don't bubble, and the scroller may be the main card or the window.
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [q]);

  const go = (id: SectionId) => {
    setQuery('');
    if (id === section) document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else void navigate(`/settings/${id}`, { replace: true });
  };

  return (
    <PageContainer className="pb-10">
      <h1 className="mb-5 text-[32px] font-extrabold leading-[1.05] tracking-tight sm:text-[38px]">Налаштування</h1>
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <aside className="lg:sticky lg:top-0 lg:w-56 lg:shrink-0 lg:self-start">
          <label className="mb-3 flex h-10 items-center gap-2 rounded-full bg-surface-2 px-3.5 text-[13px] focus-within:ring-2 focus-within:ring-primary/20">
            <Search className="h-4 w-4 shrink-0 text-subtle" />
            <input
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Знайти налаштування…"
              aria-label="Знайти налаштування"
              className="min-w-0 flex-1 bg-transparent outline-hidden placeholder:text-subtle"
            />
          </label>
          <nav aria-label="Розділи налаштувань" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                aria-current={active === id && !q ? 'true' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-3 rounded-full px-3.5 py-2 text-[13.5px] transition-colors',
                  active === id && !q ? 'bg-accent font-semibold text-surface' : 'text-muted hover:bg-surface-2 hover:text-ink',
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <SearchCtx.Provider value={q}>
            <ProfileCard />
            <AppearanceSection />
            <PreferencesSection />
            <CategoriesSection />
            <NotificationsSection />
            <IntegrationsSection />
            <DataSection />
          </SearchCtx.Provider>
          {q && <NoResults />}
        </div>
      </div>
    </PageContainer>
  );
}

/** Shown under the results; visible only when every group hid itself. */
function NoResults() {
  return <p className="hidden py-10 text-center text-[13.5px] text-muted only:block">Нічого не знайдено.</p>;
}
