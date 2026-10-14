import { CalendarDays, CheckSquare, FolderKanban, Heart, Home, NotebookPen, Settings, Target, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/habits', label: 'Habits', icon: Heart },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/notes', label: 'Notes', icon: NotebookPen },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function titleForPath(pathname: string): string {
  if (pathname === '/') return 'Home';
  const item = NAV_ITEMS.find((i) => i.to !== '/' && pathname.startsWith(i.to));
  return item?.label ?? 'Plano';
}
