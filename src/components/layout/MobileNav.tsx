import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, NotebookPen, Plus, SquareCheck, Sun } from 'lucide-react';
import { useUI } from '@/app/providers/UIProvider';

const TABS = [
  { to: '/', label: 'Сьогодні', icon: Sun },
  { to: '/calendar', label: 'Календар', icon: CalendarDays },
  { to: '/tasks', label: 'Задачі', icon: SquareCheck },
  { to: '/notes', label: 'Нотатки', icon: NotebookPen },
];

/**
 * The phone's floating tab bar: a solid dark pill, always dark whatever the theme, to sit with the
 * dark frame. A lighter pill under the current tab slides between tabs (transform only).
 */
export function MobileNav() {
  const { openQuickAdd } = useUI();
  const { pathname } = useLocation();
  const index = TABS.findIndex((t) => (t.to === '/' ? pathname === '/' : pathname.startsWith(t.to)));

  return (
    <nav aria-label="Головна навігація" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2.5">
        <div className="relative flex min-w-0 flex-1 items-center rounded-full bg-[#131316] p-1 shadow-pop ring-1 ring-white/15">
          {index >= 0 && (
            <span
              aria-hidden
              className="absolute inset-y-1 left-1 rounded-full bg-[#2e2e34] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
              style={{ width: `calc((100% - 8px) / ${TABS.length})`, transform: `translateX(${index * 100}%)` }}
            />
          )}
          {TABS.map(({ to, label, icon: Icon }, i) => (
            <Link
              key={to}
              to={to}
              aria-current={i === index ? 'page' : undefined}
              className={`relative z-10 flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11.5px] font-semibold leading-none transition-colors active:scale-[0.97] ${
                i === index ? 'text-white' : 'text-[#cfcfd4]'
              }`}
            >
              <Icon className="h-[21px] w-[21px]" strokeWidth={2} />
              {label}
            </Link>
          ))}
        </div>
        <button
          type="button"
          aria-label="Швидко додати"
          onClick={() => openQuickAdd()}
          className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg shadow-pop ring-1 ring-white/15 transition-transform active:scale-95"
        >
          <Plus className="h-6 w-6" strokeWidth={2.4} />
        </button>
      </div>
    </nav>
  );
}
