import { useState, type ReactNode } from 'react';
import {
  Baby,
  BookOpen,
  Brain,
  Briefcase,
  Calendar,
  Camera,
  Car,
  CircleCheck,
  Clapperboard,
  Code,
  Coffee,
  Dog,
  Dumbbell,
  Flame,
  Flower2,
  Gamepad2,
  GraduationCap,
  Heart,
  HeartPulse,
  House,
  Laptop,
  Lightbulb,
  Luggage,
  Music,
  NotebookPen,
  Palette,
  PartyPopper,
  Pin,
  Plane,
  Rocket,
  ShoppingCart,
  Sprout,
  Star,
  Target,
  TrendingUp,
  Users,
  Utensils,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { colorOf, tint } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import type { Category } from '@/types';

/** Line icons a category or project can have (stored by key), in the same style as the rest of the UI. */
export const LINE_ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  house: House,
  'heart-pulse': HeartPulse,
  'book-open': BookOpen,
  'graduation-cap': GraduationCap,
  dumbbell: Dumbbell,
  users: Users,
  'shopping-cart': ShoppingCart,
  wallet: Wallet,
  plane: Plane,
  luggage: Luggage,
  car: Car,
  utensils: Utensils,
  coffee: Coffee,
  laptop: Laptop,
  code: Code,
  palette: Palette,
  music: Music,
  camera: Camera,
  clapperboard: Clapperboard,
  'gamepad-2': Gamepad2,
  baby: Baby,
  dog: Dog,
  sprout: Sprout,
  'flower-2': Flower2,
  brain: Brain,
  lightbulb: Lightbulb,
  'notebook-pen': NotebookPen,
  target: Target,
  rocket: Rocket,
  'trending-up': TrendingUp,
  wrench: Wrench,
  calendar: Calendar,
  pin: Pin,
  heart: Heart,
  star: Star,
  flame: Flame,
  'circle-check': CircleCheck,
  'party-popper': PartyPopper,
};

// Categories and projects saved with an emoji before icons became line icons.
const FROM_EMOJI: Record<string, string> = {
  '💼': 'briefcase', '🏠': 'house', '💪': 'dumbbell', '📚': 'book-open', '💡': 'lightbulb', '📝': 'notebook-pen', '📌': 'pin',
  '🎯': 'target', '🚀': 'rocket', '🛒': 'shopping-cart', '✈️': 'plane', '🧳': 'luggage', '🍳': 'utensils', '🧘': 'flower-2',
  '🎨': 'palette', '🎵': 'music', '🎬': 'clapperboard', '📷': 'camera', '💻': 'laptop', '🧠': 'brain', '❤️': 'heart', '⭐': 'star',
  '🔥': 'flame', '🌱': 'sprout', '☕': 'coffee', '🗓️': 'calendar', '💰': 'wallet', '🛠️': 'wrench', '📈': 'trending-up',
  '✅': 'circle-check', '🎉': 'party-popper',
};

/** Icon for a stored key (or a legacy emoji). */
export const lineIcon = (key?: string): LucideIcon | undefined => (key ? (LINE_ICONS[key] ?? LINE_ICONS[FROM_EMOJI[key]]) : undefined);

export const categoryIcon = (category?: Category) => lineIcon(category?.icon);

/** Icon for a stored key, or `fallback` when there is none. */
export function LineIcon({ icon, fallback: Fallback, className }: { icon?: string; fallback: LucideIcon; className?: string }) {
  const Icon = lineIcon(icon) ?? Fallback;
  return <Icon className={className} aria-hidden />;
}

/** The category's line icon (in `color`, else the text colour), or nothing. */
export function CategoryIcon({ category, className, color }: { category?: Category; className?: string; color?: string }) {
  const Icon = categoryIcon(category);
  return Icon ? <Icon className={cn('h-3.5 w-3.5 shrink-0', className)} style={color ? { color } : undefined} aria-hidden /> : null;
}

/** The category's icon in its colour, or its colour dot when it has none. */
export function CategoryMark({ category, className }: { category: Category; className?: string }) {
  const color = colorOf(category.color);
  if (categoryIcon(category)) return <CategoryIcon category={category} className={className} color={color} />;
  return <span className={cn('h-2 w-2 shrink-0 rounded-full', className)} style={{ backgroundColor: color }} aria-hidden />;
}

/** Tinted pill with the category's icon and name. `compact` keeps only the icon (or dot) on phones. */
export function CategoryChip({ category, compact, className }: { category: Category; compact?: boolean; className?: string }) {
  const color = colorOf(category.color);
  return (
    <span
      className={cn('inline-flex max-w-[150px] shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold', className)}
      style={{ backgroundColor: tint(color, 0.12), color }}
      title={category.name}
    >
      <CategoryMark category={category} className={categoryIcon(category) ? 'h-3.5 w-3.5' : 'h-1.5 w-1.5'} />
      <span className={cn('truncate', compact && 'hidden sm:inline')}>{category.name}</span>
    </span>
  );
}

/** Grid of line icons to pick from (categories in Settings, the project page). */
export function LineIconPicker({ value, color, label, onChange, children }: { value?: string; color: string; label: string; onChange: (icon: string | undefined) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const current = lineIcon(value);
  const pick = (icon: string | undefined) => {
    onChange(icon);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[284px] p-2">
        <div className="grid grid-cols-8 gap-0.5">
          {Object.entries(LINE_ICONS).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              aria-label={key}
              onClick={() => pick(key)}
              className={cn('flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-2', current === Icon && 'ring-1 ring-line')}
              style={current === Icon ? { backgroundColor: tint(color, 0.14), color } : undefined}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        {current && (
          <button type="button" onClick={() => pick(undefined)} className="mt-2 w-full rounded-lg py-1.5 text-[12.5px] text-muted hover:bg-surface-2 hover:text-ink">
            Без іконки
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
