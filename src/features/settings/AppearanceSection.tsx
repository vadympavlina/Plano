import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useData } from '@/app/providers/DataProvider';
import { cn } from '@/lib/utils/cn';
import type { AccentColor, ThemePreference } from '@/types';
import { Row, Group } from './shared';

const ACCENTS: [AccentColor, string, string][] = [
  ['coral', 'Кораловий', '197 57 43'],
  ['blue', 'Синій', '60 102 208'],
  ['violet', 'Фіолетовий', '116 83 217'],
  ['green', 'Зелений', '17 124 84'],
  ['orange', 'Помаранчевий', '169 86 22'],
  ['pink', 'Рожевий', '186 58 113'],
];

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Світла', icon: Sun },
  { value: 'dark', label: 'Темна', icon: Moon },
  { value: 'system', label: 'Системна', icon: Monitor },
];

/** Tiny picture of the app in a theme; "system" is split light/dark. */
function ThemePreview({ theme }: { theme: ThemePreference }) {
  const half = (dark: boolean) => (
    <div className={cn('min-w-0 flex-1 overflow-hidden p-2', dark ? 'bg-[#151a2b]' : 'bg-[#eef1f6]')}>
      <div className={cn('h-1.5 w-3/5 max-w-8 rounded-sm', dark ? 'bg-white/30' : 'bg-[#cfd5df]')} />
      <div className={cn('mt-2 h-5 rounded-md', dark ? 'bg-white/10' : 'bg-white')} />
      <div className={cn('mt-1.5 h-1.5 w-4/5 max-w-10 rounded-sm', dark ? 'bg-white/15' : 'bg-[#dde2ea]')} />
    </div>
  );
  return <div className="flex h-[68px] overflow-hidden rounded-xl">{theme === 'system' ? [half(false), half(true)] : half(theme === 'dark')}</div>;
}

export function AppearanceSection() {
  const { data, repos } = useData();
  return (
    <Group id="appearance" title="Вигляд" keywords="тема світла темна системна колір акцент">
      <Row label="Тема" hint="Системна повторює налаштування пристрою." keywords="світла темна системна">
        <div className="grid grid-cols-3 gap-2 sm:w-[400px]" role="radiogroup" aria-label="Тема">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={data.settings.theme === value}
              onClick={() => void repos.settings.update({ theme: value }).catch(() => undefined)}
              className={cn(
                'rounded-2xl border-2 p-1.5 text-left transition-colors',
                data.settings.theme === value ? 'border-ink' : 'border-line/70 hover:border-line',
              )}
            >
              <ThemePreview theme={value} />
              <span className="mt-1.5 flex items-center gap-1.5 px-1 pb-0.5 text-[12.5px] font-medium">
                <Icon className="h-3.5 w-3.5" /> {label}
              </span>
            </button>
          ))}
        </div>
      </Row>
      <Row label="Акцентний колір" hint="Кнопки, посилання, позначка «сьогодні»." keywords="колір акцент синій фіолетовий зелений помаранчевий рожевий">
        <div className="flex gap-2" role="radiogroup" aria-label="Акцентний колір">
          {ACCENTS.map(([value, label, rgb]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={data.settings.accent === value}
              aria-label={label}
              title={label}
              onClick={() => void repos.settings.update({ accent: value }).catch(() => undefined)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition-shadow',
                data.settings.accent === value ? 'ring-2 ring-ink' : 'hover:ring-2 hover:ring-line',
              )}
              style={{ backgroundColor: `rgb(${rgb})` }}
            >
              {data.settings.accent === value && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </Row>
    </Group>
  );
}
