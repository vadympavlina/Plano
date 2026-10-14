import { CalendarDays, CheckSquare, FolderKanban, Heart, Home, NotebookPen, Settings, Target, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Головна', icon: Home },
  { to: '/calendar', label: 'Календар', icon: CalendarDays },
  { to: '/tasks', label: 'Задачі', icon: CheckSquare },
  { to: '/projects', label: 'Проєкти', icon: FolderKanban },
  { to: '/habits', label: 'Звички', icon: Heart },
  { to: '/goals', label: 'Цілі', icon: Target },
  { to: '/notes', label: 'Нотатки', icon: NotebookPen },
  { to: '/settings', label: 'Налаштування', icon: Settings },
];

export function titleForPath(pathname: string): string {
  if (pathname === '/') return 'Головна';
  const item = NAV_ITEMS.find((i) => i.to !== '/' && pathname.startsWith(i.to));
  return item?.label ?? 'Plano';
}
