import { CalendarClock, CalendarDays, Heart, NotebookPen, Settings, SquareCheck, Sun, Target, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Сьогодні', icon: Sun },
  { to: '/upcoming', label: 'Найближчі', icon: CalendarClock },
  { to: '/calendar', label: 'Календар', icon: CalendarDays },
  { to: '/notes', label: 'Нотатки', icon: NotebookPen },
  { to: '/tasks', label: 'Задачі', icon: SquareCheck },
  { to: '/habits', label: 'Звички', icon: Heart },
  { to: '/goals', label: 'Цілі', icon: Target },
];

export const SETTINGS_ITEM: NavItem = { to: '/settings', label: 'Налаштування', icon: Settings };

export function titleForPath(pathname: string): string {
  if (pathname === '/') return 'Сьогодні';
  if (pathname.startsWith('/projects')) return 'Проєкти';
  const item = [...NAV_ITEMS, SETTINGS_ITEM].find((i) => i.to !== '/' && pathname.startsWith(i.to));
  return item?.label ?? 'Plano';
}
