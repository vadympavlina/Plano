import { CategoryIcon, categoryIcon } from '@/components/common/CategoryMark';

/** Leading mark of an event: its category icon, or a dot in the category colour. */
export function Marker({ category, color }: { category?: import('@/types').Category; color: string }) {
  return categoryIcon(category) ? (
    <CategoryIcon category={category} className="h-3.5 w-3.5" color={color} />
  ) : (
    <span className="mx-[3px] block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
  );
}

/** A small ring of a day's finished tasks. */
export function DayRing({ done, total }: { done: number; total: number }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  const share = total ? done / total : 0;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0" role="img" aria-label={total ? `Виконано ${done} з ${total}` : 'Задач немає'}>
      <circle cx="10" cy="10" r={r} fill="none" strokeWidth="2.4" className="stroke-line" />
      {share > 0 && (
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray={`${c * share} ${c}`}
          transform="rotate(-90 10 10)"
          className={share === 1 ? 'stroke-success' : 'stroke-primary'}
        />
      )}
    </svg>
  );
}
