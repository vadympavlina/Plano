import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ExternalLink, RefreshCw, Settings2, Zap } from 'lucide-react';
import { useData } from '@/app/providers/DataProvider';
import { useNow } from '@/hooks/useNow';
import { EmptyState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { formatDateKey, relativeDayLabel } from '@/lib/date';
import { OUTAGES_SOURCE } from '@/lib/power/shared';
import { clock, kyivParts, lengthLabel, spanLabel, spansOf, statusAt, totalMinutes, untilLabel, type Outages } from './logic';
import { powerReachable } from './api';
import { usePowerSetup } from './usePower';
import { PowerTimeline } from './PowerTimeline';

const QUEUES = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];

const DISCLAIMER = 'Час може відрізнятися від графіка до години (диспетчер перемикає черги), а за потреби діють аварійні відключення поза графіком.';

/** The household picks its queue; the company's lists tell which one it is by address. */
function QueuePicker({ queues, lookup, onPick }: { queues: string[]; lookup: Outages['lookup'] | undefined; onPick: (q: string) => void }) {
  return (
    <section className="mx-2 mt-4 rounded-[22px] bg-surface-2/70 p-4 sm:p-5" aria-label="Вибір черги">
      <h2 className="text-[17px] font-bold tracking-tight">Яка у вас черга?</h2>
      <p className="mt-1 text-[13.5px] text-muted">
        Оберіть її один раз — графік покаже лише ваші години. Свою чергу можна знайти за адресою в списках Рівнеобленерго.
      </p>
      <div role="radiogroup" aria-label="Черга" className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {queues.map((q) => (
          <button
            key={q}
            type="button"
            role="radio"
            aria-checked={false}
            onClick={() => onPick(q)}
            className="h-12 rounded-2xl border border-line bg-surface text-[16px] font-semibold tabular-nums transition-colors hover:border-ink/40 active:bg-surface-2"
          >
            {q}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-medium">
        <a
          className="inline-flex items-center gap-1 text-primary hover:underline"
          href={lookup?.city ?? OUTAGES_SOURCE}
          target="_blank"
          rel="noopener noreferrer"
        >
          Черга за адресою: м. Рівне <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
        <a
          className="inline-flex items-center gap-1 text-primary hover:underline"
          href={lookup?.region ?? OUTAGES_SOURCE}
          target="_blank"
          rel="noopener noreferrer"
        >
          Рівненська область <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </div>
    </section>
  );
}

export default function PowerPage() {
  const { on, queue, data, loading, failed, savedAt, refresh } = usePowerSetup();
  const { repos } = useData();
  const now = useNow(30_000);
  const nowMs = now.getTime();
  const [all, setAll] = useState(false);
  const set = (patch: { powerQueue?: string; powerOn?: boolean }) => void repos.settings.update(patch).catch(() => undefined);

  const today = kyivParts(nowMs).date;
  const nowMin = kyivParts(nowMs).minutes;
  const status = useMemo(() => (data && queue ? statusAt(data, queue, nowMs) : undefined), [data, queue, nowMs]);
  const days = useMemo(() => (data ? data.days.filter((d) => d.date >= today).slice(0, 7) : []), [data, today]);
  const queues = data?.queues.length ? data.queues : QUEUES;

  if (!on)
    return (
      <div className="px-2 pb-6">
        <h1 className="text-[28px] font-extrabold tracking-tight sm:text-[38px]">Світло</h1>
        <EmptyState
          icon={<Zap />}
          title="Графік відключень вимкнено"
          description="Увімкніть його, щоб бачити години відключень своєї черги, отримувати попередження і бачити їх у календарі."
          action={
            <Button variant="dark" onClick={() => set({ powerOn: true })}>
              Увімкнути
            </Button>
          }
        />
      </div>
    );

  const updated = data?.updatedAt ? `${data.updatedAt.slice(8, 10)}.${data.updatedAt.slice(5, 7)} ${data.updatedAt.slice(11)}` : undefined;

  const hero = (() => {
    if (!status) return undefined;
    if (status.kind === 'off')
      return {
        tone: 'off' as const,
        title: 'Світла немає',
        line: `Має з’явитися до ${untilLabel(status.until, nowMs)} · ще ${lengthLabel(status.until - nowMs)}`,
        extra: status.then ? `Далі: ${clock(status.then.start)}–${clock(status.then.end, true)}` : undefined,
      };
    if (status.kind === 'on')
      return {
        tone: 'on' as const,
        title: 'Світло є',
        line: status.next
          ? `Наступне відключення ${clock(status.next.start)}–${clock(status.next.end, true)} · через ${lengthLabel(status.next.start - nowMs)}`
          : 'Більше сьогодні відключень не заплановано',
        extra: undefined,
      };
    return { tone: 'unknown' as const, title: 'Графік ще не опублікований', line: 'Для вашої черги на сьогодні поки немає годин.', extra: undefined };
  })();

  return (
    <div className="pb-6">
      <header className="flex items-start justify-between gap-3 px-2">
        <div className="min-w-0">
          <h1 className="text-[28px] font-extrabold leading-[1.05] tracking-tight sm:text-[38px]">Світло</h1>
          <p className="mt-1 truncate text-[13px] text-muted">Рівнеобленерго{queue ? ` · черга ${queue}` : ''}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Оновити графік"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted transition-colors hover:text-ink"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <Link
            to="/settings/power"
            aria-label="Налаштування світла"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted transition-colors hover:text-ink"
          >
            <Settings2 className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {!powerReachable && (
        <p className="mx-2 mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-[13.5px] text-muted">
          Графік приходить із сервера Plano, а в локальному перегляді його немає. Увійдіть у Plano на сайті.
        </p>
      )}
      {powerReachable && failed && (
        <p role="status" className="mx-2 mt-4 rounded-2xl bg-warning/15 px-4 py-3 text-[13.5px] text-warning-ink">
          {data ? 'Не вдалося оновити — показано збережений графік' : 'Не вдалося отримати графік.'}
          {savedAt ? ` (від ${clock(savedAt)})` : ''} Спробуйте пізніше або відкрийте{' '}
          <a className="font-semibold underline" href={OUTAGES_SOURCE} target="_blank" rel="noopener noreferrer">
            сторінку Рівнеобленерго
          </a>
          .
        </p>
      )}
      {data?.stale && <p className="mx-2 mt-3 text-[12.5px] text-muted">Рівнеобленерго зараз не відповідає — це остання отримана версія графіка.</p>}

      {!queue && (powerReachable || data) && <QueuePicker queues={queues} lookup={data?.lookup} onPick={(q) => set({ powerQueue: q })} />}
      {!queue && !data && powerReachable && !failed && <p className="mx-2 mt-3 text-[13px] text-muted">Завантажую графік…</p>}

      {queue && hero && data && (
        <section aria-label="Зараз" className="mx-2 mt-4 rounded-[22px] bg-surface-2/70 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                hero.tone === 'off' ? 'bg-ink text-surface' : hero.tone === 'on' ? 'bg-success/20 text-success' : 'bg-line text-muted',
              )}
            >
              <Zap className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-[22px] font-extrabold leading-tight tracking-tight">{hero.title}</h2>
              <p className="mt-0.5 text-[14px] text-muted">{hero.line}</p>
              {hero.extra && <p className="mt-0.5 text-[13px] text-subtle">{hero.extra}</p>}
            </div>
          </div>
          <PowerTimeline className="mt-4" large ticks now={nowMin} spans={spansOf(data, queue, today)} />
        </section>
      )}

      {queue && data && (
        <section aria-label="Дні" className="mx-2 mt-5">
          <h2 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-subtle">Графік</h2>
          <ul className="space-y-2">
            {days.map((d) => {
              const spans = spansOf(data, queue, d.date);
              const total = spans ? totalMinutes(spans) : 0;
              return (
                <li key={d.date} className="rounded-2xl border border-line bg-surface p-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-[15px] font-semibold first-letter:uppercase">
                      {relativeDayLabel(d.date, today, 'EEEE')}
                      <span className="ml-2 text-[13px] font-normal text-muted">{formatDateKey(d.date, 'd MMMM')}</span>
                    </h3>
                    <span className="shrink-0 text-[12.5px] tabular-nums text-muted">
                      {spans === null ? 'очікується' : spans.length ? `${lengthLabel(total * 60_000)} без світла` : 'без відключень'}
                    </span>
                  </div>
                  <PowerTimeline className="mt-2.5" spans={spans} now={d.date === today ? nowMin : undefined} />
                  {spans && spans.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {spans.map((s) => (
                        <span key={s.start} className="rounded-full bg-surface-2 px-2.5 py-1 text-[13px] font-medium tabular-nums">
                          {spanLabel(s)}
                        </span>
                      ))}
                    </div>
                  )}
                  {spans === null && (
                    <p className="mt-2 text-[12.5px] text-subtle">
                      Рівнеобленерго ще не опублікувало години для цього дня. Ми попередимо, щойно вони з’являться.
                    </p>
                  )}
                </li>
              );
            })}
            {days.length === 0 && <li className="rounded-2xl bg-surface-2 px-4 py-3 text-[13.5px] text-muted">У графіку немає майбутніх днів.</li>}
          </ul>
        </section>
      )}

      {data && (
        <section className="mx-2 mt-5">
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            aria-expanded={all}
            className="flex h-11 w-full items-center justify-between rounded-2xl bg-surface-2 px-4 text-[14px] font-medium"
          >
            Усі черги
            <ChevronDown className={cn('h-4 w-4 text-subtle transition-transform', all && 'rotate-180')} aria-hidden />
          </button>
          {all && (
            <div className="mt-2 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[420px] text-left text-[13px]">
                <thead>
                  <tr className="bg-surface-2/70 text-muted">
                    <th className="px-3 py-2 font-semibold">Черга</th>
                    {days.slice(0, 2).map((d) => (
                      <th key={d.date} className="px-3 py-2 font-semibold">
                        {relativeDayLabel(d.date, today, 'EEEEEE, d MMM')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.queues.map((q) => (
                    <tr key={q} className={cn(q === queue && 'bg-primary/8')}>
                      <th scope="row" className="px-3 py-2 font-semibold tabular-nums">
                        <button
                          type="button"
                          onClick={() => set({ powerQueue: q })}
                          aria-label={`Обрати чергу ${q}`}
                          className="rounded-md px-1.5 py-0.5 hover:bg-surface-2"
                        >
                          {q}
                        </button>
                        {q === queue && <span className="ml-1.5 text-[11.5px] font-medium text-primary">ваша</span>}
                      </th>
                      {days.slice(0, 2).map((d) => {
                        const s = spansOf(data, q, d.date);
                        return (
                          <td key={d.date} className="px-3 py-2 tabular-nums text-muted">
                            {s === null ? 'очікується' : s.length ? s.map(spanLabel).join(', ') : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <footer className="mx-3 mt-5 space-y-2 text-[12.5px] leading-relaxed text-muted">
        <p>{DISCLAIMER}</p>
        <p>
          Дані:{' '}
          <a className="font-medium text-ink underline underline-offset-2" href={OUTAGES_SOURCE} target="_blank" rel="noopener noreferrer">
            roe.vsei.ua/disconnections
          </a>
          {updated ? `, оновлено ${updated}` : ''}.{queue && ' Не ваша черга?'}
          {queue && (
            <button type="button" onClick={() => set({ powerQueue: '' })} className="ml-1 font-medium text-primary hover:underline">
              Змінити
            </button>
          )}
        </p>
      </footer>
    </div>
  );
}
