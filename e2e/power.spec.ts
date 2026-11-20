import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { open, startSeeded } from './fixtures';

// «Світло»: the power-outage schedule. The Worker's JSON is replaced by a fixed one (the fixed clock is
// 10 листопада 2026, 10:30 Kyiv time): queue 2.1 has no power 10:00–14:00 today, queue 4.1 17:00–21:00.
const queues = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];
const today: Record<string, string[][] | null> = {};
for (const q of queues) {
  const n = Number(q[0]);
  today[q] =
    n === 1 || n === 6
      ? [
          ['09:00', '13:00'],
          ['21:00', '23:59'],
        ]
      : n === 2
        ? [['10:00', '14:00']]
        : n === 3
          ? [['13:00', '17:00']]
          : [['17:00', '21:00']];
}
const schedule = {
  source: 'https://www.roe.vsei.ua/disconnections/',
  updatedAt: '2026-11-10T09:00',
  fetchedAt: 0,
  queues,
  lookup: { city: 'https://example.test/city.pdf', region: 'https://example.test/region.pdf' },
  days: [
    { date: '2026-11-10', state: 'schedule', slots: today },
    { date: '2026-11-11', state: 'pending', slots: Object.fromEntries(queues.map((q) => [q, null])) },
  ],
};

/** Opens the app with the schedule mocked and «Світло» turned on for a queue ('' = not chosen yet). */
async function start(page: Page, queue: string, extra: object = {}) {
  await page.route('https://worker.test/outages', (route) => route.fulfill({ json: schedule, headers: { 'access-control-allow-origin': '*' } }));
  await startSeeded(page);
  await page.evaluate(
    ([queue, extra]) => {
      const raw = JSON.parse(localStorage.getItem('plano:preview:data') ?? '{}');
      Object.assign(raw.users.preview.settings, { powerOn: true, powerQueue: queue, powerLeadMin: 30, powerCalendar: true }, extra);
      localStorage.setItem('plano:preview:data', JSON.stringify(raw));
    },
    [queue, extra] as const,
  );
  await page.reload();
  await page.locator('main').waitFor();
}

test('today: one line says there is no power and until when; a tap opens the page', async ({ page }) => {
  await start(page, '2.1');
  const strip = page.getByRole('link', { name: 'Графік відключень світла' });
  await expect(strip).toContainText('Світла немає');
  await expect(strip).toContainText('до 14:00');
  await expect(strip).toContainText('ще 3 год 30 хв');
  await strip.click();
  await expect(page).toHaveURL(/#\/power/);
  await expect(page.getByRole('heading', { name: 'Світла немає' })).toBeVisible();
  // Today's hours as a bar and as a chip; tomorrow is still «очікується».
  await expect(page.getByRole('img', { name: 'Без світла: 10:00–14:00' }).first()).toBeVisible();
  await expect(page.getByText('10:00–14:00', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Графік ще не опублікований' })).toBeVisible();
  await expect(page.getByText('очікується').first()).toBeVisible();
});

test('a queue with power now shows when it goes', async ({ page }) => {
  await start(page, '4.1');
  await open(page, '/power');
  await expect(page.getByRole('heading', { name: 'Світло є' })).toBeVisible();
  await expect(page.getByText('Наступне відключення 17:00–21:00 · через 6 год 30 хв')).toBeVisible();
});

test('without a queue the page asks for one, and the choice sticks', async ({ page }) => {
  await start(page, '');
  await open(page, '/power');
  await expect(page.getByRole('heading', { name: 'Яка у вас черга?' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Черга за адресою: м\. Рівне/ })).toHaveAttribute('href', 'https://example.test/city.pdf');
  await page.getByRole('radio', { name: '3.2' }).click();
  await expect(page.getByRole('heading', { name: 'Світло є' })).toBeVisible();
  await expect(page.getByText('Рівнеобленерго · черга 3.2')).toBeVisible();
  // The whole table, and a queue can be switched from it.
  await page.getByRole('button', { name: 'Усі черги' }).click();
  await page.getByRole('button', { name: 'Обрати чергу 1.1' }).click();
  await expect(page.getByText('Рівнеобленерго · черга 1.1')).toBeVisible();
});

const bandHeight = async (page: Page) => Math.round((await page.locator('[data-power-band]').first().boundingBox())!.height);

test('calendar, «виділені години» (the default): a plate on the time scale with the hours inside', async ({ page }) => {
  await start(page, '2.1');
  await open(page, '/calendar?view=day');
  await expect(page.locator('[data-power-band]')).toHaveCount(1);
  expect(await bandHeight(page)).toBeGreaterThan(4 * 68 - 6);
  // The start and the end are written on the plate, and the note says it in words.
  const plate = (await page.locator('[data-power-band]').boundingBox())!;
  for (const t of ['10:00', '14:00']) {
    const label = page.locator('span.text-surface', { hasText: t });
    await expect(label).toHaveCount(1);
    const box = (await label.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(plate.y);
    expect(box.y + box.height).toBeLessThanOrEqual(plate.y + plate.height + 1);
  }
  await expect(page.getByRole('link', { name: /Без світла 10:00–14:00 · черга 2\.1/ })).toBeVisible();
});

test('calendar, «смужка біля годин»: a thin rail and the same words', async ({ page }) => {
  await start(page, '2.1', { powerStyle: 'rail' });
  await open(page, '/calendar?view=day');
  await expect(page.locator('[data-power-band]')).toHaveCount(1);
  expect((await page.locator('[data-power-band]').boundingBox())!.width).toBeLessThan(8);
  await expect(page.getByRole('link', { name: /Без світла 10:00–14:00 · черга 2\.1/ })).toBeVisible();
});

test('calendar, the new looks: amber plate, marks on the scale, a bar of the day', async ({ page }) => {
  await start(page, '2.1', { powerStyle: 'amber' });
  await open(page, '/calendar?view=day');
  await expect(page.locator('[data-power-band]')).toHaveCount(1);
  expect(await bandHeight(page)).toBeGreaterThan(4 * 68 - 6);
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('plano:preview:data') ?? '{}');
    raw.users.preview.settings.powerStyle = 'marks';
    localStorage.setItem('plano:preview:data', JSON.stringify(raw));
  });
  await page.reload();
  await open(page, '/calendar?view=day');
  await expect(page.locator('[data-power-band]')).toHaveCount(1);
  await expect(page.locator('[data-power-band]').getByText('10:00')).toBeVisible();
  await expect(page.locator('[data-power-band]').getByText('14:00')).toBeVisible();
});

test('calendar, «смужка доби»: the whole day as a bar above the grid, the grid untouched', async ({ page }) => {
  await start(page, '2.1', { powerStyle: 'minibar' });
  await open(page, '/calendar?view=day');
  const bar = page.getByRole('link', { name: /Без світла 10:00–14:00 · черга 2\.1/ });
  await expect(bar).toBeVisible();
  await expect(bar.getByRole('img', { name: 'Без світла: 10:00–14:00' })).toBeVisible();
  await expect(page.locator('[data-power-band]')).toHaveCount(0);
});

test('calendar, «у рядку весь день»: a dark mark with the hours, nothing in the grid', async ({ page }) => {
  await start(page, '2.1', { powerStyle: 'chip' });
  await open(page, '/calendar?view=day');
  await expect(page.getByRole('link', { name: 'Без світла: 10:00–14:00' })).toBeVisible();
  await expect(page.locator('[data-power-band]')).toHaveCount(0);
});

test('calendar, «лінії початку й кінця»: two dashed lines with labels', async ({ page }) => {
  await start(page, '2.1', { powerStyle: 'lines' });
  await open(page, '/calendar?view=day');
  await expect(page.locator('[data-power-band]')).toHaveCount(1);
  await expect(page.getByText('вимкнуть')).toBeVisible();
  await expect(page.getByText('увімкнуть')).toBeVisible();
});

test('calendar, «легке тло»: a faint band behind the blocks', async ({ page }) => {
  await start(page, '2.1', { powerStyle: 'tint' });
  await open(page, '/calendar?view=day');
  await expect(page.locator('.power-tint')).toHaveCount(1);
  expect(await bandHeight(page)).toBe(4 * 68);
});

test('the week view carries each style too', async ({ page }) => {
  await start(page, '2.1');
  await open(page, '/calendar?view=week');
  await expect(page.locator('[data-power-band]')).toHaveCount(1);
});

test('when it is off in the settings nothing about it shows', async ({ page }) => {
  await start(page, '2.1', { powerOn: false });
  await expect(page.getByRole('link', { name: 'Графік відключень світла' })).toHaveCount(0);
  await open(page, '/calendar?view=day');
  await expect(page.locator('[data-power-band]')).toHaveCount(0);
  await open(page, '/power');
  await expect(page.getByText('Графік відключень вимкнено')).toBeVisible();
  await page.getByRole('button', { name: 'Увімкнути' }).click();
  await expect(page.getByRole('heading', { name: 'Світла немає' })).toBeVisible();
});

test('the settings section has the switch, the queue and the warning', async ({ page }) => {
  await start(page, '2.1');
  await open(page, '/settings/power');
  await expect(page.getByRole('switch', { name: 'Графік відключень світла' })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Моя черга' })).toContainText('Черга 2.1');
  await expect(page.getByRole('combobox', { name: 'Попереджати про відключення' })).toContainText('За 30 хв');
});

for (const theme of ['light', 'dark'] as const) {
  test(`axe: the power page, ${theme} theme`, async ({ page }) => {
    await start(page, '2.1');
    await page.evaluate((t) => localStorage.setItem('plano:theme', t), theme);
    await page.reload();
    await open(page, '/power');
    await page.waitForTimeout(350);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['label-content-name-mismatch'])
      .analyze();
    const lines = result.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} — ${v.help}`));
    expect(lines, lines.join('\n')).toEqual([]);
  });
}

test('the side menu always has «Світло», and shows the state once it is set up', async ({ page, isMobile }) => {
  await start(page, '2.1');
  if (isMobile) await page.getByRole('button', { name: 'Меню' }).first().click();
  const menu = page.getByRole('navigation', { name: 'Розділи' }).filter({ visible: true });
  await expect(menu.getByRole('link', { name: /Світло/ })).toContainText('до 14:00');
  await menu.getByRole('link', { name: /Світло/ }).click();
  await expect(page).toHaveURL(/#\/power/);
});

test('the side menu has «Світло» even before it is turned on', async ({ page, isMobile }) => {
  await start(page, '', { powerOn: false });
  if (isMobile) await page.getByRole('button', { name: 'Меню' }).first().click();
  await expect(page.getByRole('navigation', { name: 'Розділи' }).filter({ visible: true }).getByRole('link', { name: 'Світло' })).toBeVisible();
});
