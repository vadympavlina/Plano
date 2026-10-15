# Plano

**Your life. In one place.** · *Plan. Focus. Achieve.*

Plano — приватний персональний центр планування з українським інтерфейсом: задачі, календар, проєкти, звички,
цілі та нотатки в одному місці. Працює в браузері на Mac, iPhone та інших пристроях
і встановлюється як PWA.

## Можливості

- **Home** — привітання за часом доби, статистика з реальних даних (задачі сьогодні,
  найближчі події, прогрес тижня, серія звичок), задачі на сьогодні, наступні події,
  навантаження тижня, Quick Add (задача / подія / нотатка), звички, цілі, дедлайни, нотатки.
- **Calendar** — режими Day / Week / Month, міні-календар, події з кольорами категорій,
  розкладка подій, що перетинаються, перетягування подій мишею/пальцем (з кроком 15 хв),
  клік по слоту створює подію, події на весь день і багатоденні, повторювані події
  з видаленням окремого повторення, ненав’язливе попередження про конфлікт часу,
  задачі з часом і датою відображаються в календарі.
- **Tasks** — фільтри All / Today / Upcoming / Overdue / Completed, пошук, сортування,
  групування за категоріями чи проєктами, підзадачі, нотатки, теги, пріоритети, статуси,
  перенесення дат, повторення (щодня, у вибрані дні тижня, щотижня, щомісяця, щороку,
  власний інтервал) з **ідемпотентним** створенням наступного екземпляра.
- **Projects** — статуси, кольори, прогрес, обчислений із задач, пов’язані задачі,
  нотатки, цілі й події.
- **Habits** — розклад за днями тижня, тип «так/ні» або «кількість», серії
  (незаплановані дні не розривають серію), статистика тижня/місяця, історія за 12 тижнів.
- **Goals** — цільове/поточне значення, одиниці, темп відносно дедлайну, історія прогресу,
  зв’язок із проєктами.
- **Notes** — Markdown з панеллю форматування і переглядом, теги, закріплення, проєкти,
  надійне автозбереження (debounce + збереження при переході/згортанні/закритті).
- **Settings** — профіль, тема Light/Dark/System, початок тижня, формат часу і дати,
  стандартний вигляд календаря, категорії, експорт/імпорт JSON із перевіркою, видалення
  даних, розділ інтеграцій.
- Глобальний пошук (⌘K / Ctrl+K), індикатор синхронізації, повтор невдалих записів,
  PWA з офлайн-завантаженням інтерфейсу.

## Технології

React 19 + TypeScript (strict) · Vite 6 · Tailwind CSS 3 · компоненти в стилі shadcn/ui на
Radix UI · Lucide · Firebase Authentication (email + пароль) + Realtime Database · React Router (HashRouter) ·
date-fns · zod · vite-plugin-pwa (Workbox) · Vitest · GitHub Pages + GitHub Actions.

## Вимоги

- Node.js 20+ (рекомендовано 22) і npm 10+
- Проєкт Firebase (безкоштовний план Spark достатній)

## Встановлення та локальний запуск

```bash
npm install
cp .env.production .env.local   # або свої значення з .env.example
npm run dev                  # http://localhost:5173
```

Без налаштованого Firebase застосунок покаже екран налаштування з кнопкою
**Open local preview** — це окремий режим попереднього перегляду: дані зберігаються
лише в цьому браузері (localStorage), нічого не синхронізується.

Інші команди:

| Команда | Що робить |
| --- | --- |
| `npm run build` | перевірка типів і production-збірка в `dist/` |
| `npm run preview` | локальний перегляд збірки |
| `npm test` | unit-тести бізнес-логіки (дати, повторення, фільтри, прогрес, серії, імпорт) |
| `npm run typecheck` | перевірка TypeScript |
| `npm run icons` | згенерувати PNG-іконки PWA з `assets-src/*.svg` |

## Налаштування Firebase

1. Створіть проєкт у [Firebase console](https://console.firebase.google.com/).
2. **Project settings → General → Your apps → Add app → Web**. Скопіюйте конфігурацію
   у `.env.local` (див. таблицю змінних нижче).

### Firebase Authentication

1. **Build → Authentication → Get started.**
2. **Sign-in method:** увімкніть лише **Email/Password**. Інші провайдери (зокрема Google) залиште вимкненими — у Plano вхід тільки за поштою й паролем.
3. **Settings → Authorized domains:** додайте `localhost` (є за замовчуванням) і домен
   GitHub Pages, наприклад `vadympavlina.github.io`.
4. Публічної реєстрації в застосунку немає. Створіть свій акаунт вручну:
   **Authentication → Users → Add user** (email + пароль).

### Realtime Database

1. **Build → Realtime Database → Create database** (оберіть регіон, режим *locked*).
2. Скопіюйте URL бази (`https://<project>-default-rtdb.<region>.firebasedatabase.app`)
   у `VITE_FIREBASE_DATABASE_URL`.

Структура даних:

```
/allowlist/{uid}: true          ← хто має доступ (редагується лише в консолі)
/users/{uid}/profile
/users/{uid}/settings
/users/{uid}/categories/{id}
/users/{uid}/tasks/{id}
/users/{uid}/events/{id}
/users/{uid}/projects/{id}
/users/{uid}/habits/{id}
/users/{uid}/habitLogs/{habitId}/{yyyy-MM-dd}: number
/users/{uid}/goals/{id}
/users/{uid}/notes/{id}
/users/{uid}/integrations/{provider}
```

### Дозволений обліковий запис (allowlist)

Доступ обмежено **на рівні правил бази**, а не лише в інтерфейсі:

1. Увійдіть у Plano своїм акаунтом. Ви побачите екран *This account has no access*
   з вашим UID (його також видно в **Authentication → Users**).
2. У **Realtime Database → Data** створіть вузол `allowlist` і в ньому ключ із вашим UID
   зі значенням `true` (булеве, не рядок).
3. Натисніть **Check again** у застосунку.

Клієнт не може змінити `/allowlist` (`.write: false`), тож інші акаунти, навіть
успішно автентифіковані, не отримають доступу до жодних даних.

### Застосування Security Rules

Правила лежать у [`database.rules.json`](database.rules.json):

- усе закрито за замовчуванням (`.read/.write: false` у корені);
- `/users/{uid}` доступний лише автентифікованому власнику **і** тільки якщо `allowlist/{uid} === true`;
- перевіряються обов’язкові поля, типи, enum-значення, формати дат/часу та довжини рядків;
- невідомі вузли під `/users/{uid}` заборонені.

Застосувати можна двома способами:

- **Консоль:** Realtime Database → Rules → вставити вміст `database.rules.json` → Publish.
- **CLI:** `npm i -g firebase-tools && firebase login && firebase use <project-id> && firebase deploy --only database`.

## Змінні середовища

| Змінна | Обов’язкова | Опис |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | так | Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | так | `<project>.firebaseapp.com` |
| `VITE_FIREBASE_DATABASE_URL` | так | URL Realtime Database |
| `VITE_FIREBASE_PROJECT_ID` | так | ID проєкту |
| `VITE_FIREBASE_APP_ID` | так | App ID web-застосунку |
| `VITE_FIREBASE_STORAGE_BUCKET` | ні | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ні | Sender ID |
| `VITE_BASE_PATH` | ні | базовий шлях; у CI встановлюється автоматично `/<repo>/` |

Конфігурація Firebase для web — **не секрет**: вона ідентифікує проєкт, а захист
забезпечують Security Rules. Не додавайте в репозиторій приватні ключі, паролі чи OAuth client secrets.

## Публікація на GitHub Pages

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Публічна конфігурація Firebase уже лежить у [`.env.production`](.env.production) — додатково нічого
   налаштовувати не треба. Для іншого проєкту Firebase замініть значення в цьому файлі.
3. Зробіть push у гілку `main` (або запустіть workflow вручну: **Actions → Test & deploy → Run workflow**).

Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) встановлює залежності,
запускає перевірку типів і тести, збирає застосунок з `VITE_BASE_PATH=/<repo>/` і публікує `dist/`.
На pull request виконуються лише перевірки та збірка.

Маршрутизація побудована на `HashRouter` (`/#/calendar`), тому пряме відкриття
сторінок і оновлення браузера на GitHub Pages працюють без серверних перенаправлень.

Не забудьте додати домен `<user>.github.io` в **Authentication → Authorized domains**.

## Встановлення PWA

- **iPhone (Safari):** відкрийте сайт → кнопка *Поділитися* → **На екран «Додому»**.
  Застосунок відкривається в standalone-режимі з власною іконкою, враховує safe-area і
  має нижню навігацію.
- **Mac:** Safari → *Файл → Додати на Dock*; або Chrome/Edge → іконка встановлення в адресному рядку.
- **Android/Chrome:** меню → *Встановити застосунок*.

Оновлення: коли виходить нова версія, Plano показує повідомлення з кнопкою **Update** —
оновлення не застосовується посеред роботи без вашої згоди.

## Офлайн-режим і синхронізація

- Service worker кешує **лише статичну оболонку** (HTML/JS/CSS/шрифти/іконки), тож інтерфейс
  відкривається без мережі. Запити Firebase не кешуються service worker’ом.
- Firebase SDK тримає зміни, зроблені без мережі, **у пам’яті** й надсилає їх після
  відновлення з’єднання. Індикатор показує «Offline · N pending». Якщо закрити застосунок
  до відновлення мережі, ці зміни буде втрачено — повноцінного офлайн-редагування з
  постійною чергою наразі немає.
- Після виходу з акаунта всі дані в пам’яті очищаються, підписки знімаються;
  персональні дані не зберігаються в кеші браузера (у режимі Firebase).
- Невдалий запис (наприклад, відмова правил) не показується як успішний: з’являється
  повідомлення з кнопкою **Retry**.

## Архітектура

```
src/
  app/            App, router, providers (Auth, Data, UI), тема, PWA-оновлення
  components/     ui (кнопки, поля, діалоги, меню…), layout (sidebar, header, mobile nav), common
  features/       dashboard, calendar, tasks, projects, habits, goals, notes, settings, search, auth
                  └─ *logic.ts — чиста бізнес-логіка + *.test.ts
  hooks/          useActions (доменні дії), useCollections, useNow, useFormDialog…
  lib/            firebase config, backend (Firebase / local), date + recurrence, validation (zod), utils
  services/       repositories, auth, sync-стан, integrations (Google Calendar — інтерфейс і заглушка)
  types/          доменні типи
```

UI не звертається до Firebase напряму: компоненти → `useActions` → repositories → `Backend`
(Firebase або локальний для preview). Дані читаються через одну realtime-підписку на кожен вузол
користувача з валідацією zod; невалідні записи пропускаються, а не ламають інтерфейс.

## Відомі обмеження

- Офлайн-зміни не переживають закриття застосунку (див. вище).
- Редагування повторюваної події змінює всю серію; видалити можна окреме повторення або всю серію.
- Повторювані та імпортовані події не перетягуються мишею (редагуйте через форму).
- Окремий часовий пояс (відмінний від пристрою) не підтримується: час зберігається як локальний.
- Security Rules перевірено вручну й за структурою; автоматичних тестів з Firebase Emulator немає.
- Google Calendar ще не підключено.
- Вбудовані поля вибору дати й часу (`<input type="date/time">`) показують формат, заданий мовою
  браузера чи пристрою (на iPhone з українською мовою — український формат).

## Google Calendar у майбутньому

Архітектура вже розділяє власні та імпортовані події і зберігає зовнішні ідентифікатори.
Для реальної синхронізації потрібен серверний компонент (Firebase Cloud Functions) для OAuth 2.0
та фонової інкрементальної синхронізації. Детальний план: [docs/google-calendar.md](docs/google-calendar.md).
