# Google Calendar — синхронізація

Статус: **реалізовано** (двостороння синхронізація подій, задачі не синхронізуються).

## Як це працює

- Вхід у Google — через Google Identity Services (token model) прямо в браузері.
  Сервер не потрібен, GitHub Pages залишається статичним хостингом.
- Токен доступу живе ~1 годину і зберігається **лише в `sessionStorage` цієї вкладки**.
  Він ніколи не записується в базу даних і очищується при виході з Plano.
  Коли токен закінчується, у календарі й налаштуваннях з’являється кнопка «Увійти в Google».
- Синхронізація запускається, поки Plano відкритий: після локальних змін (через ~1,5 с),
  кожні 5 хвилин і при поверненні на вкладку. Фонової синхронізації без відкритого Plano немає.
- Вікно синхронізації: від 60 днів тому до 400 днів уперед.

## Алгоритм одного проходу

1. Список календарів (`calendarList`) — назви, кольори, права (запис / лише читання).
2. Видалення, зроблені в Plano (`integrations/google_calendar/pendingDeletes`), надсилаються в Google.
3. Події з `syncPending: true` надсилаються в Google:
   - пов’язані з Google (`external`) — `PATCH` наявної події;
   - нові події Plano — `POST` у календар «Нові події з Plano» з **детермінованим id**
     (base32hex від id Plano). Повторна вставка з іншого пристрою повертає 409 і стає оновленням,
     тож дублікатів у Google немає.
   - повторювані події Plano надсилаються з `RRULE` та `EXDATE`.
4. Події з вибраних календарів завантажуються з `singleEvents=true` (повторювані серії розгорнуті).
   Чиста функція `planPull` (`src/services/integrations/google/reconcile.ts`) вирішує:
   - нові події імпортуються з детермінованим локальним id (`localIdForGoogle`) — без дублікатів;
   - змінені в Google оновлюються, **якщо в Plano немає ненадісланих змін** (локальні правки мають пріоритет);
   - зниклі з Google (у межах вікна) видаляються з Plano;
   - екземпляри серій, створених у Plano, не імпортуються повторно;
   - події з календарів, з яких зняли позначку, прибираються.

## Модель даних

- `CalendarEvent.source`: `plano` | `google`; `external`: `{ calendarId, eventId, etag, color }`;
  `syncPending`: локальна зміна ще не надіслана.
- `/users/{uid}/integrations/google_calendar`: `status`, `calendarIds`, `targetCalendarId`,
  `calendars`, `pendingDeletes`, `lastSyncAt`, `lastError`.

## Обмеження

- Події Google, що тривають через північ, показуються до 23:59 першого дня.
- Повторення подій, імпортованих з Google, редагується в Google Calendar
  (в Plano редагуються окремі повторення).
- Поле «Посилання» події Plano не передається в Google.
- Для фонової синхронізації без відкритого застосунку потрібен серверний компонент
  (наприклад, Firebase Cloud Functions на тарифі Blaze) з refresh token на сервері.

## Налаштування Google Cloud

1. Увімкнути **Google Calendar API** у проєкті, де створено OAuth Client ID.
2. **OAuth consent screen**: External, статус Testing, у Test users — ваша Google-пошта.
3. **OAuth Client ID** типу Web application, Authorized JavaScript origins:
   `https://<user>.github.io`, `http://localhost:5173`.
4. Client ID — у `VITE_GOOGLE_CLIENT_ID` (`.env.production`). Client secret не потрібен.
