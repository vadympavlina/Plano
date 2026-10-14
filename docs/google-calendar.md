# Google Calendar — план інтеграції

Статус: **не реалізовано** (у застосунку показується чесний стан *Not connected · Coming soon*).

## Що вже підготовлено

- Модель події `CalendarEvent` має поля `source` (`plano` | `google`) та `external`
  (`provider`, `calendarId`, `eventId`, `etag`, `lastSyncedAt`).
- Власні події Plano та імпортовані події розрізняються за `source`; імпортовані
  в UI позначаються як «Imported from Google Calendar» і не перетягуються мишею.
- Абстракція провайдера: `src/services/integrations/types.ts`
  (`CalendarIntegrationProvider`: `connect`, `listCalendars`, `pull`, `push`, `remove`)
  і ключ дедуплікації `externalKey()` = `google:<calendarId>:<eventId>`.
- Заглушка `src/services/integrations/googleCalendar.ts` — усі методи кидають помилку,
  тож нічого не може «вдавати» підключення.
- Вузол бази `/users/{uid}/integrations/google_calendar` для стану (вибрані календарі,
  час останньої синхронізації, помилка).

## Чому потрібен серверний компонент

GitHub Pages — статичний хостинг. Безпечно зберігати refresh token і client secret
у браузері неможливо. Тому синхронізація має виконуватися на сервері:

1. **Firebase Cloud Functions** (план Blaze) або інший бекенд.
2. OAuth 2.0 Authorization Code flow з PKCE: браузер отримує `code`, функція обмінює
   його на токени, **refresh token зберігається лише на сервері**
   (наприклад, у Secret Manager або в захищеному вузлі, недоступному клієнту за правилами).
3. Scopes: `https://www.googleapis.com/auth/calendar.events` (+ `calendar.readonly` для списку календарів).

## Алгоритм синхронізації

1. **Початковий імпорт:** `events.list` для кожного вибраного календаря
   (`singleEvents=false`, щоб зберегти правила повторення), збереження `nextSyncToken`.
2. **Інкрементальна синхронізація:** `events.list?syncToken=…` за розкладом
   (Cloud Scheduler) або через push-сповіщення (`events.watch`).
   При `410 Gone` — повний ресинк.
3. **Upsert:** шукати подію за `externalKey`; якщо є — оновити (порівнюючи `etag`),
   якщо немає — створити з `source: 'google'`. Дублікати неможливі, бо ключ стабільний.
4. **Скасовані події** (`status: 'cancelled'`) — видаляти локальну копію або додавати
   дату в `exdates` для окремих повторень.
5. **Двостороння синхронізація:** зміни в Plano для подій із `external` відправляються
   через `events.patch` з `If-Match: etag`; конфлікти — «останній запис перемагає»
   з логуванням, або показ користувачу.
6. **Часові пояси:** Google повертає `dateTime` з offset або `date` для all-day —
   перетворювати у локальні `date` + `HH:mm` у часовому поясі користувача, а
   оригінальний `timeZone` зберігати в полі `timezone`.

## Обмеження Google API

- Квоти на запити: використовувати `syncToken` і батчинг.
- Access token живе ~1 годину — оновлювати на сервері.
- Для публічного використання застосунок має пройти верифікацію OAuth consent screen;
  для особистого користування достатньо режиму *Testing* з вашим акаунтом у списку тестувальників.
