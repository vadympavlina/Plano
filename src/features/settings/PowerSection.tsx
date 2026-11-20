import { ExternalLink } from 'lucide-react';
import { useData } from '@/app/providers/DataProvider';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/controls';
import { OUTAGES_SOURCE } from '@/lib/power/shared';
import { usePowerSetup } from '@/features/power/usePower';
import { powerReachable } from '@/features/power/api';
import { pushEnabledHere } from '@/services/push';
import { Group, Row } from './shared';
import type { Settings } from '@/types';

const QUEUES = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];
const LEADS = [
  [0, 'Не попереджати'],
  [10, 'За 10 хв'],
  [15, 'За 15 хв'],
  [30, 'За 30 хв'],
  [60, 'За 1 год'],
  [120, 'За 2 год'],
] as const;

/** «Світло»: the power-outage schedule of Рівнеобленерго. Off by default; nothing about it shows until it is turned on. */
export function PowerSection() {
  const { data: store, repos } = useData();
  const s = store.settings;
  const set = (patch: Partial<Settings>) => void repos.settings.update(patch).catch(() => undefined);
  const { data } = usePowerSetup();
  const lookup = data?.lookup;
  return (
    <Group
      id="power"
      title="Світло"
      keywords="світло відключення графік електроенергія черга рівнеобленерго"
      description="Графік погодинних відключень Рівнеобленерго для вашої черги."
    >
      <Row label="Графік відключень" hint="Сторінка «Світло», рядок на «Сьогодні» і смуги в календарі.">
        <Switch label="Графік відключень світла" checked={s.powerOn} onCheckedChange={(powerOn) => set({ powerOn })} />
      </Row>
      {s.powerOn && (
        <>
          <Row
            label="Моя черга"
            hint={
              <>
                Не знаєте свою?{' '}
                <a className="font-medium text-primary hover:underline" href={lookup?.city ?? OUTAGES_SOURCE} target="_blank" rel="noopener noreferrer">
                  Знайти за адресою <ExternalLink className="inline h-3 w-3" aria-hidden />
                </a>
              </>
            }
          >
            <Select
              aria-label="Моя черга"
              className="w-[170px]"
              placeholder="Не обрано"
              value={s.powerQueue}
              onChange={(powerQueue) => set({ powerQueue })}
              options={[{ value: '', label: 'Не обрано' }, ...(data?.queues.length ? data.queues : QUEUES).map((q) => ({ value: q, label: `Черга ${q}` }))]}
            />
          </Row>
          <Row
            label="Попереджати про відключення"
            hint={
              !powerReachable
                ? 'Працює після входу в Plano.'
                : pushEnabledHere()
                  ? 'Сповіщення також про опублікований чи змінений графік.'
                  : 'Потрібні сповіщення: увімкніть їх вище на цьому пристрої.'
            }
          >
            <Select
              aria-label="Попереджати про відключення"
              className="w-[170px]"
              value={String(s.powerLeadMin)}
              onChange={(v) => set({ powerLeadMin: Number(v) })}
              options={LEADS.map(([value, label]) => ({ value: String(value), label }))}
            />
          </Row>
          <Row label="Відключення в календарі" hint="Показувати години без світла в календарі.">
            <Switch label="Показувати відключення в календарі" checked={s.powerCalendar} onCheckedChange={(powerCalendar) => set({ powerCalendar })} />
          </Row>
          {s.powerCalendar && (
            <Row label="Як показувати" hint="Спробуйте різні — календар змінюється одразу.">
              <Select
                aria-label="Як показувати відключення в календарі"
                className="w-[220px]"
                value={s.powerStyle ?? 'hours'}
                onChange={(powerStyle) => set({ powerStyle })}
                options={[
                  { value: 'hours', label: 'Виділені години', hint: 'Години без світла темною плашкою на шкалі часу' },
                  { value: 'rail', label: 'Смужка біля годин', hint: 'Тонка смужка на шкалі часу' },
                  { value: 'chip', label: 'У рядку «весь день»', hint: 'Темна позначка з годинами' },
                  { value: 'lines', label: 'Лінії початку й кінця', hint: 'Пунктир, де вимкнуть і увімкнуть' },
                  { value: 'tint', label: 'Легке тло', hint: 'Ледь помітне затінення' },
                ]}
              />
            </Row>
          )}
        </>
      )}
    </Group>
  );
}
