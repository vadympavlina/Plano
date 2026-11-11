import { useContext, useState } from 'react';
import { CategoryIcon, LineIconPicker, categoryIcon } from '@/components/common/CategoryMark';
import { Plus, SmilePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { confirm } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { useActions } from '@/hooks/useActions';
import { useCollections } from '@/hooks/useCollections';
import { plural } from '@/lib/date';
import { colorOf } from '@/lib/utils/colors';
import { SearchCtx, matches, Group } from './shared';
import type { Category } from '@/types';

function CategoryRow({ category, usage }: { category: Category; usage: number }) {
  const actions = useActions();
  const [name, setName] = useState(category.name);
  const commit = () => {
    const n = name.trim();
    if (!n) setName(category.name);
    else if (n !== category.name) void actions.categories.update(category.id, { name: n }).catch(() => undefined);
  };
  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <Popover>
        <PopoverTrigger
          className="relative h-6 w-6 shrink-0 rounded-full before:absolute before:-inset-2.5 before:content-[''] ring-offset-2 ring-offset-surface hover:ring-2 hover:ring-line"
          style={{ backgroundColor: colorOf(category.color) }}
          aria-label={`Змінити колір «${category.name}»`}
        />
        <PopoverContent className="w-[220px]">
          <ColorPicker value={category.color} onChange={(color) => void actions.categories.update(category.id, { color }).catch(() => undefined)} />
        </PopoverContent>
      </Popover>
      <LineIconPicker
        label={`Іконка «${category.name}»`}
        value={category.icon}
        color={colorOf(category.color)}
        onChange={(icon) => void actions.categories.update(category.id, { icon }).catch(() => undefined)}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-2" title="Іконка" style={{ color: colorOf(category.color) }}>
          {categoryIcon(category) ? <CategoryIcon category={category} className="h-[18px] w-[18px]" /> : <SmilePlus className="h-4 w-4 text-subtle" />}
        </span>
      </LineIconPicker>
      <input
        autoComplete="off"
        className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-[14px] font-medium outline-hidden hover:bg-surface-2 focus:bg-surface-2"
        aria-label="Назва категорії"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span className="hidden text-right text-[12px] text-muted sm:block">
        {usage} {plural(usage, ['елемент', 'елементи', 'елементів'])}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Видалити «${category.name}»`}
        onClick={async () => {
          const ok = await confirm({
            title: `Видалити «${category.name}»?`,
            description: usage ? `Цю категорію використовують елементи: ${usage}. Вони залишаться без категорії.` : undefined,
            confirmLabel: 'Видалити',
            danger: true,
          });
          if (ok)
            await actions.categories.remove(category.id).then(
              () => toast.success('Категорію видалено'),
              () => undefined,
            );
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function CategoriesSection() {
  const { categories, tasks, events, goals } = useCollections();
  const actions = useActions();
  const q = useContext(SearchCtx);
  const [name, setName] = useState('');
  const add = () => {
    const n = name.trim();
    if (!n) return;
    const colors = ['blue', 'green', 'purple', 'pink', 'orange', 'teal', 'yellow', 'red', 'slate'] as const;
    actions.categories.create({ name: n, color: colors[categories.length % colors.length], order: categories.length }).write.catch(() => undefined);
    setName('');
  };
  return (
    <Group
      id="categories"
      title="Категорії"
      description="Колір та іконка для задач, подій і цілей."
      keywords={`колір ${categories.map((c) => c.name).join(' ')}`}
    >
      {categories
        .filter((c) => matches(q, c.name))
        .map((c) => (
          <CategoryRow
            key={c.id}
            category={c}
            usage={
              tasks.filter((t) => t.categoryId === c.id).length +
              events.filter((e) => e.categoryId === c.id).length +
              goals.filter((g) => g.categoryId === c.id).length
            }
          />
        ))}
      <form
        className="flex items-center gap-3 px-5 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-subtle text-subtle">
          <Plus className="h-3.5 w-3.5" />
        </span>
        <input
          autoComplete="off"
          className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-[14px] outline-hidden placeholder:text-subtle hover:bg-surface-2 focus:bg-surface-2"
          placeholder="Нова категорія…"
          aria-label="Назва нової категорії"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {name.trim() && (
          <Button type="submit" variant="outline" size="sm">
            Додати
          </Button>
        )}
      </form>
    </Group>
  );
}
