import { expect, type Page } from '@playwright/test';

/** «Today» for every deterministic test: Tuesday, 10 November 2026, 10:30 in Kyiv. */
export const NOW = new Date('2026-11-10T10:30:00+02:00');

const key = (offset: number) => {
  const d = new Date(Date.UTC(2026, 10, 10 + offset));
  return d.toISOString().slice(0, 10);
};
const stamp = '2026-11-01T08:00:00.000Z';

function data(theme: 'light' | 'dark') {
  const base = { createdAt: stamp, updatedAt: stamp };
  const task = (id: string, title: string, extra: object) => ({ id, title, status: 'todo', priority: 'medium', subtasks: [], tags: [], ...base, ...extra });
  const event = (id: string, title: string, day: number, startTime: string, endTime: string, categoryId: string) => ({
    id,
    title,
    date: key(day),
    allDay: false,
    startTime,
    endTime,
    categoryId,
    exdates: [],
    source: 'plano',
    ...base,
  });
  const habit = (id: string, name: string, icon: string, color: string, extra: object) => ({
    id,
    name,
    icon,
    color,
    schedule: [0, 1, 2, 3, 4, 5, 6],
    startDate: key(-40),
    goalType: 'check',
    target: 1,
    archived: false,
    ...base,
    ...extra,
  });
  const logs: Record<string, Record<string, number>> = { h1: {}, h2: {}, h3: {} };
  for (let i = 1; i < 20; i++) {
    logs.h1[key(-i)] = i % 4 ? 8 : 5;
    logs.h2[key(-i)] = 1;
    if (i % 3) logs.h3[key(-i)] = 1;
  }
  logs.h1[key(0)] = 5;
  const list = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x]));
  return {
    tasks: list([
      task('t1', 'Підготувати звіт за жовтень', { dueDate: key(0), priority: 'high', categoryId: 'cat_work', projectId: 'p1' }),
      task('t2', 'Купити ліки', { dueDate: key(0), categoryId: 'cat_health' }),
      task('t3', 'Подзвонити мамі', { dueDate: key(0), startTime: '19:00', endTime: '19:30', categoryId: 'cat_personal' }),
      task('t4', 'Оплатити інтернет', { dueDate: key(1), priority: 'urgent' }),
      task('t5', 'Записатися до стоматолога', { dueDate: key(-1), categoryId: 'cat_health' }),
      task('t6', 'Оновити резюме', { projectId: 'p2' }),
    ]),
    events: list([
      event('e1', 'Нарада команди', 0, '09:00', '10:00', 'cat_work'),
      event('e2', 'Обід з Олею', 0, '13:00', '14:00', 'cat_personal'),
      event('e3', 'Зал', 0, '18:00', '19:30', 'cat_health'),
      event('e4', 'Лікар', 1, '11:00', '12:00', 'cat_health'),
    ]),
    projects: list([
      { id: 'p1', name: 'EdFlow', color: 'blue', status: 'active', icon: 'briefcase', ...base },
      { id: 'p2', name: 'Нова робота', color: 'purple', status: 'active', icon: 'house', ...base },
    ]),
    habits: list([
      habit('h1', 'Вода', '💧', 'blue', { goalType: 'count', target: 8, unit: 'склянок' }),
      habit('h2', 'Зарядка', '🏃', 'green', {}),
      habit('h3', 'Читання', '📚', 'orange', {}),
    ]),
    habitLogs: logs,
    goals: list([
      { id: 'g1', title: 'Прочитати 12 книжок', targetValue: 12, currentValue: 7, unit: 'книжок', status: 'active', projectIds: [], history: [], ...base },
    ]),
    notes: list([
      {
        id: 'n1',
        title: 'Вікенд у Лісабоні',
        content: '# План\n- [ ] Квитки\n- [x] Готель',
        tags: ['ідеї'],
        isPinned: true,
        icon: 'plane',
        cover: 'orange',
        ...base,
      },
    ]),
    theme,
  };
}

/**
 * Opens the local preview with a fixed clock and a fixed set of data, so a screenshot or an
 * accessibility scan sees the same page on every run.
 */
export async function startSeeded(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.clock.setFixedTime(NOW);
  await page.goto('/');
  await page.getByRole('button', { name: 'Відкрити локальний перегляд' }).click();
  await expect(page.getByText(/Добр(ого|ої) (ранку|дня|вечора|ночі)/)).toBeVisible();
  // The local backend writes its store a moment after the first render.
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('plano:preview:data') ?? '{}').users);
  const { theme: t, ...rest } = data(theme);
  await page.evaluate(
    ([rest, t]) => {
      const raw = JSON.parse(localStorage.getItem('plano:preview:data') ?? '{}');
      Object.assign(raw.users.preview, rest);
      raw.users.preview.settings = { ...raw.users.preview.settings, theme: t, defaultCalendarView: 'day' };
      localStorage.setItem('plano:preview:data', JSON.stringify(raw));
      localStorage.setItem('plano:theme', t as string);
    },
    [rest, t] as const,
  );
  await page.reload();
  await expect(page.getByText(/Добр(ого|ої) (ранку|дня|вечора|ночі)/)).toBeVisible();
}

/** Opens a route of the app and waits until its page content is in. */
export async function open(page: Page, hash: string) {
  await page.goto(`/#${hash}`);
  await page.locator('main').waitFor();
  // Lazy page chunks and the first paint of lists.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
}
