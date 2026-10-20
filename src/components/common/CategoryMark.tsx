import { colorOf, tint } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import type { Category } from '@/types';

/** A category's emoji, or its colour dot when it has none. */
export function CategoryMark({ category, className }: { category: Category; className?: string }) {
  if (category.icon) return <span className={cn('shrink-0 leading-none', className)} aria-hidden>{category.icon}</span>;
  return <span className={cn('h-2 w-2 shrink-0 rounded-full', className)} style={{ backgroundColor: colorOf(category.color) }} aria-hidden />;
}

/** Tinted pill with the category's icon and name. `compact` keeps only the icon (or dot) on phones. */
export function CategoryChip({ category, compact, className }: { category: Category; compact?: boolean; className?: string }) {
  const color = colorOf(category.color);
  return (
    <span
      className={cn('inline-flex max-w-[150px] shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium', className)}
      style={{ backgroundColor: tint(color, 0.13), color }}
      title={category.name}
    >
      <CategoryMark category={category} className="text-[12px]" />
      <span className={cn('truncate', compact && 'hidden sm:inline')}>{category.name}</span>
    </span>
  );
}

/** Title with the category's emoji in front, for compact calendar items. */
export const iconTitle = (title: string, category?: Category) => (category?.icon ? `${category.icon} ${title}` : title);
