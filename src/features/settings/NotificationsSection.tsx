import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useData } from '@/app/providers/DataProvider';
import { disablePush, enablePush, needsHomeScreen, pushEnabledHere, pushSupported, sendTestPush } from '@/services/push';
import { Switch } from '@/components/ui/controls';
import { Row, Group } from './shared';
import type { Settings } from '@/types';

export function NotificationsSection() {
  const { data, repos, backendKind } = useData();
  const s = data.settings;
  const set = (patch: Partial<Settings>) => void repos.settings.update(patch).catch(() => undefined);
  const [on, setOn] = useState(pushEnabledHere);
  const [busy, setBusy] = useState(false);
  const supported = backendKind === 'firebase' && pushSupported();
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не вдалося');
    } finally {
      setBusy(false);
      setOn(pushEnabledHere());
    }
  };
  const times = (label: string) => [
    { value: '', label },
    ...['06:00', '07:00', '08:00', '09:00', '10:00', '19:00', '20:00', '21:00', '22:00'].map((t) => ({ value: t, label: t })),
  ];
  return (
    <Group
      id="notifications"
      title="Сповіщення"
      keywords="сповіщення нагадування push пуш ранок звички"
      description="Нагадування приходять, навіть коли Plano закритий."
    >
      <Row
        label="На цьому пристрої"
        hint={
          !supported
            ? backendKind !== 'firebase'
              ? 'Доступно після входу в Plano.'
              : 'Цей браузер не підтримує сповіщення.'
            : needsHomeScreen()
              ? 'На iPhone спершу додайте Plano на домашній екран (Поділитися → На екран «Додому») і відкрийте звідти.'
              : on
                ? 'Увімкнено.'
                : 'Вимкнено.'
        }
      >
        {supported && !needsHomeScreen() && (
          <div className="flex gap-2">
            {on && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(sendTestPush, 'Тестове сповіщення надіслано')}>
                Перевірити
              </Button>
            )}
            <Button
              variant={on ? 'outline' : 'dark'}
              size="sm"
              loading={busy}
              onClick={() => void run(on ? disablePush : enablePush, on ? undefined : 'Сповіщення увімкнено')}
            >
              {on ? 'Вимкнути' : 'Увімкнути'}
            </Button>
          </div>
        )}
      </Row>
      <Row label="Події" hint="Нагадування перед початком.">
        <Select
          aria-label="Нагадування про події"
          className="w-[170px]"
          value={String(s.remindEventsMin)}
          onChange={(v) => set({ remindEventsMin: Number(v) })}
          options={[
            ['0', 'Вимкнено'],
            ['5', 'За 5 хв'],
            ['10', 'За 10 хв'],
            ['15', 'За 15 хв'],
            ['30', 'За 30 хв'],
            ['60', 'За 1 год'],
          ].map(([value, label]) => ({ value, label }))}
        />
      </Row>
      <Row label="Задачі з часом" hint="У час початку задачі.">
        <Switch label="Нагадування про задачі" checked={s.remindTasks} onCheckedChange={(remindTasks) => set({ remindTasks })} />
      </Row>
      <Row label="Ранковий підсумок" hint="Скільки задач і подій сьогодні.">
        <Select
          aria-label="Ранковий підсумок"
          className="w-[170px]"
          value={s.digestAt}
          onChange={(digestAt) => set({ digestAt })}
          options={times('Вимкнено')}
        />
      </Row>
      <Row label="Вечірній підсумок" hint="Скільки зроблено, і кнопка перенести решту на завтра.">
        <Select
          aria-label="Вечірній підсумок"
          className="w-[170px]"
          value={s.eveningAt}
          onChange={(eveningAt) => set({ eveningAt })}
          options={times('Вимкнено')}
        />
      </Row>
      <Row label="Звички" hint="Якщо щось ще не відмічено.">
        <Select
          aria-label="Нагадування про звички"
          className="w-[170px]"
          value={s.habitsReminderAt}
          onChange={(habitsReminderAt) => set({ habitsReminderAt })}
          options={times('Вимкнено')}
        />
      </Row>
    </Group>
  );
}
