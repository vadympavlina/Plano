# Plano

**Your life. In one place.** · *Plan. Focus. Achieve.*

Plano — приватний персональний центр планування з українським інтерфейсом: задачі, календар, проєкти, звички,
цілі та нотатки в одному місці. Працює в браузері на Mac, iPhone та інших пристроях
і встановлюється як PWA.

## Можливості

- **Сьогодні** — привітання, смужка днів тижня, підсумок дня (події, звички, задачі, важливі), швидкий запис,
  один список на день (задачі, події, звички), блок шкідливих звичок «Кидаю», вхідні в бічній картці.
- **Найближчі** — наступні дні списком або дошкою; задачі переносяться між днями перетягуванням
  (мишею, пером і пальцем).
- **Календар** — день, 3 дні, тиждень, місяць; на телефоні відкривається на сьогоднішньому дні. Події з кольорами
  категорій, події на весь день і багатоденні, повторювані події, перетягування й розтягування мишею (крок 15 хв),
  створення виділенням слота, задачі з часом у сітці, лінія «зараз», попередження про конфлікт часу.
- **Задачі** — списки за датами, дошка за статусами, пошук, підзадачі, нотатки, теги, пріоритети, повторення,
  свайп рядка (виконати / на завтра), деталі в бічній картці.
- **Швидкий запис** — одне поле розуміє дати, час, повторення, пріоритет, категорію, проєкт, нагадування
  («Завтра о 15 зал #здоров’я !!»), голосовий ввід, вставлений список додається рядками.
- **Проєкти, цілі** — картки з прогресом і темпом, пов’язані задачі й події.
- **Звички** — добрі й шкідливі, розклад за днями, кількісні та «так/ні», серії, статистика, історія.
- **Нотатки** — Markdown з панеллю форматування, теги, закріплення, обкладинка й іконка, автозбереження.
- **Налаштування** — профіль, тема (світла, темна, системна) і колір акценту, формати, категорії,
  сповіщення, інтеграції, експорт/імпорт JSON з перевіркою, автоматичні резервні копії, видалення даних.
- Глобальний пошук (⌘K / Ctrl+K), індикатор синхронізації з повтором невдалих записів, push-нагадування
  (через Cloudflare Worker), Google Calendar.
- **Дизайн** описано в [docs/DESIGN.md](docs/DESIGN.md): темна рамка зі світлими картками, пілюлі, один акцент;
  жести (шторки, свайпи, перетягування) стежать за пальцем і завершуються пружиною.

## Технології

React 19 + TypeScript (strict) · Vite 6 · Tailwind CSS 3 · Radix UI · Lucide · Firebase Authentication
(email + пароль) + Realtime Database · React Router (HashRouter) · date-fns · zod 4 · vite-plugin-pwa (Workbox) ·
Cloudflare Worker (токени Google, push, збір помилок) · GitHub Pages + GitHub Actions.

Якість: ESLint (typescript-eslint, react-hooks, jsx-a11y) · Prettier · Vitest · Playwright
(+ axe-core для доступності, скріншоти для візуальної регресії) · Firebase Emulator для правил бази.

## Вимоги

- Node.js 20+ (рекомендовано 22) і npm 10+
- Проєкт Firebase (безкоштовний план Spark достатній)
- Java 11+ — лише для `npm run test:rules` (емулятор Firebase)

## Встановлення та локальний запуск

```bash
npm install
cp .env.production .env.local   # або свої значення з .env.example
npm run dev                  # http://localhost:5173
```

Без налаштованого Firebase застосунок покаже екран налаштування з кнопкою
**Open local preview** — це окремий режим попереднього перегляду: дані зберігаються
лише в цьому браузері (localStorage), нічого не синхронізується.

Основні команди:

| Команда | Що робить |
| --- | --- |
| `npm run dev` | локальний сервер розробки |
| `npm run build` | перевірка типів і production-збірка в `dist/` |
| `npm run preview` | локальний перегляд збірки |
| `npm run typecheck` | перевірка TypeScript |
| `npm run lint` | ESLint (типи, хуки React, доступність JSX, незавершені проміси) |
| `npm run format` / `format:check` | Prettier: виправити / лише перевірити |
| `npm test` | unit-тести логіки й Worker (дати, повторення, розбір тексту, прогрес, серії, імпорт) |
| `npm run e2e` | end-to-end у Chromium (десктоп і телефон) разом із перевіркою доступності axe |
| `npm run e2e:a11y` | лише axe-перевірка WCAG 2 A/AA (12 сторінок і діалоги, світла й темна теми) |
| `npm run e2e:visual` | скріншоти сторінок проти еталонів у `e2e/visual.spec.ts-snapshots/` |
| `npm run e2e:visual:update` | оновити еталони після навмисної зміни вигляду |
| `npm run test:rules` | тести правил бази в емуляторі Firebase (потрібна Java) |
| `npm run icons` | згенерувати іконки PWA, favicon і заставки iPhone з `assets-src/` |


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

Правила покриті тестами в емуляторі Firebase (`npm run test:rules`, `rules-test/`): вхід без акаунта, акаунт поза
allowlist, чужі дані, незмінність allowlist і перевірка полів задач, подій, категорій, профілю та налаштувань.

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

Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. **build** — `typecheck`, `lint`, `format:check`, unit-тести, end-to-end (разом з axe), потім збірка з
   `VITE_BASE_PATH` і публікація `dist/`. Браузер Playwright кешується між запусками. Крок зі скріншотами
   *інформаційний*: він показує зміну вигляду, але не блокує деплой (різниця малих пікселів між машинами
   можлива); різниці зберігаються як артефакт `visual-diffs`.
2. **rules** — тести правил бази в емуляторі Firebase. Червона перевірка видна на коміті, але деплой
   не зупиняє (емулятор завантажується щоразу).
3. **worker** — публікація Cloudflare Worker (лише коли задані секрети).
4. **deploy** — GitHub Pages, лише з `main` і лише після успішного **build**.

На pull request виконуються перевірки й збірка без деплою.

Маршрутизація побудована на `HashRouter` (`/#/calendar`), тому пряме відкриття
сторінок і оновлення браузера на GitHub Pages працюють без серверних перенаправлень.

Не забудьте додати домен `<user>.github.io` в **Authentication → Authorized domains**.

### Власний домен

Застосунок працює на `plano.edvault.online`:

1. DNS: запис `CNAME plano → vadympavlina.github.io`.
2. GitHub → Settings → Pages → **Custom domain** `plano.edvault.online`, потім **Enforce HTTPS**.
3. У `.github/workflows/deploy.yml` `VITE_BASE_PATH: /` (для адреси без домену це `/<repo>/`).
4. Додайте домен у Firebase (**Authorized domains**) і `https://plano.edvault.online`
   в **Authorized JavaScript origins** OAuth-клієнта Google.

## Встановлення PWA

- **Налаштування → Параметри → «Застосунок на пристрої»**: кнопка **Встановити** (Chrome, Edge, Android)
  або підказка для Safari.
- **iPhone (Safari):** *Поділитися* → **На екран «Додому»**. Застосунок відкривається окремим вікном з
  власною іконкою й заставкою, враховує safe-area; свайп від лівого краю відкриває меню.
- **Mac:** Safari → *Файл → Додати на Dock*; або Chrome/Edge → іконка встановлення в адресному рядку.
- **Android/Chrome:** меню → *Встановити застосунок*.

Що ще вміє встановлений застосунок: швидкі дії на іконці (Сьогодні, Нова задача, Нова подія, Звички),
**«Поділитися → Plano»** з інших застосунків (текст відкриває швидкий запис), число на іконці (відкриті
задачі на сьогодні та прострочені, де це підтримує система), повторне відкриття фокусує вже запущене вікно.

Оновлення: коли виходить нова версія, Plano показує повідомлення з кнопкою **Оновити** — оновлення не
застосовується посеред роботи без вашої згоди.

## Офлайн-режим і синхронізація

- Service worker кешує **лише статичну оболонку** (HTML/JS/CSS/шрифти/іконки), тож інтерфейс відкривається
  без мережі. Запити Firebase не кешуються service worker’ом.
- Записи, які ще не підтверджені Firebase, зберігаються в постійній черзі (`src/lib/backend/outbox.ts`,
  localStorage) і надсилаються після відновлення зв’язку — навіть якщо застосунок закрили раніше.
  Індикатор показує стан синхронізації.
- Невдалий запис (наприклад, відмова правил) не показується як успішний: з’являється повідомлення з
  кнопкою повтору.
- Після виходу з акаунта дані в пам’яті очищаються, підписки знімаються; персональні дані не
  зберігаються в кеші браузера (у режимі Firebase, окрім черги незавершених записів).

## Архітектура

```
src/
  app/            App, router, providers (Auth, Data, UI), тема, PWA-оновлення, значок на іконці, share target
  components/     ui (кнопки, поля, діалоги, меню), layout (бічне меню, верхня панель, нижня навігація), common
  features/       dashboard, calendar, tasks, projects, habits, goals, notes, settings, search, capture, auth,
                  integrations, reminders
                  └─ *logic.ts — чиста бізнес-логіка + *.test.ts
  hooks/          useActions (доменні дії), useCollections, useNow, useFormDialog…
  lib/            backend (Firebase / локальний / черга записів), date + повторення, validation (zod),
                  gesture (пружина, швидкість, перетягування й закриття свайпом), pwa (встановлення), utils
  services/       repositories, auth, синхронізація, push, звіти про помилки, Google Calendar
  styles/         токени теми, Tailwind
e2e/              сценарії Playwright, axe, скріншоти (fixtures.ts — фіксований час і дані)
rules-test/       тести правил бази в емуляторі Firebase
worker/           Cloudflare Worker: токени Google, push-нагадування, збір помилок
docs/             DESIGN.md (опис дизайну), AUDIT.md (аудит і план), google-calendar.md
```

UI не звертається до Firebase напряму: компоненти → `useActions` → repositories → `Backend`
(Firebase або локальний для preview). Дані читаються через одну realtime-підписку на кожен вузол
користувача з валідацією zod; невалідні записи пропускаються, а не ламають інтерфейс.

## Відомі обмеження

- Редагування повторюваної події змінює всю серію; видалити можна окреме повторення або всю серію.
- Повторювані та імпортовані події не перетягуються мишею (редагуйте через форму).
- Окремий часовий пояс (відмінний від пристрою) не підтримується: час зберігається як локальний.
- Google Calendar синхронізується лише поки Plano відкритий.
- Інтерфейс лише українською.
- Скріншотні тести залежать від рендера: їх еталони створені в Chromium на Linux.
- Вбудовані поля вибору дати й часу (`<input type="date/time">`) показують формат мови браузера чи пристрою.

## Google Calendar

Двостороння синхронізація подій з Google Calendar: **Налаштування → Інтеграції → Підключити Google Calendar**.
Можна вибрати, які календарі показувати в Plano і куди додавати нові події. Синхронізація працює,
поки Plano відкритий. Деталі й налаштування Google Cloud: [docs/google-calendar.md](docs/google-calendar.md).

### Постійне підключення (сервер токенів на Cloudflare)

Без сервера Google дає доступ лише на годину, і потім треба входити знову. Маленький Cloudflare Worker
(`worker/`) робить підключення постійним: він обмінює одноразовий код від Google на довгостроковий
дозвіл і видає застосунку свіжі ключі доступу. Сам Worker нічого не зберігає — дозвіл зашифровано
ключем, відомим лише Worker'у, і прив'язано до вашого облікового запису Plano.

1. Зареєструйтеся на [dash.cloudflare.com](https://dash.cloudflare.com) (безкоштовно) і один раз
   відкрийте **Workers & Pages**, щоб вибрати піддомен `*.workers.dev`.
2. **My Profile → API Tokens → Create Token → Edit Cloudflare Workers** — створіть токен.
   Account ID видно на головній сторінці акаунта (праве меню).
3. Google Cloud Console → **APIs & Services → Credentials** → ваш OAuth client → скопіюйте **Client secret**.
   На сторінці **OAuth consent screen** натисніть **Publish app** (статус *In production*), інакше Google
   скасовує доступ кожні 7 днів.
4. GitHub → **Settings → Secrets and variables → Actions** → додайте секрети
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GOOGLE_CLIENT_SECRET`.
5. Запустіть workflow «Test & deploy» (або зробіть push у `main`): він опублікує Worker і збере сайт
   з його адресою. У Plano натисніть **Увійти в Google** ще раз — далі вхід не знадобиться.

Без цих секретів усе працює як раніше (вхід раз на годину).
