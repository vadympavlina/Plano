import { addDaysKey, fromDateKey, minutesToTime, toDateKey } from '@/lib/date';
import type { DateKey, Priority, RecurrenceRule, TimeString } from '@/types';

/**
 * Quick-capture parsing: «Зустріч з Олею завтра о 15 на годину #робота» →
 * title, date, time, length, repeat, category… Every recognised piece keeps
 * its place in the text (`spans`), so the field can highlight it and a chip
 * can remove it again. Understands Ukrainian, common Russian/surzhyk and a few
 * English words, digits and spelled-out numbers (dictation).
 */

export type SpanType = 'date' | 'time' | 'duration' | 'repeat' | 'tag' | 'project' | 'priority' | 'reminder' | 'kind' | 'note';
export interface Span {
  start: number;
  end: number;
  type: SpanType;
}

export interface ParsedQuick {
  title: string;
  date?: DateKey;
  time?: TimeString;
  endTime?: TimeString;
  /** «цілий день»: an all-day event. */
  allDay?: boolean;
  /** Last day of a several-day event («з 15 по 20 жовтня», «15.10–20.10»). */
  endDate?: DateKey;
  /** Minutes («на годину», «на 30 хв»); events only. */
  duration?: number;
  recurrence?: RecurrenceRule;
  /** Words after # (category, project or a plain tag). */
  tags: string[];
  /** Word after @ (a project). */
  project?: string;
  priority?: Priority;
  /** Minutes before («нагадай за 15 хв»); 0 = at the time («нагадай …»). */
  remindMin?: number;
  /** Text after « // »: the description. */
  description?: string;
  /** «Купити: молоко, хліб, яйця» → subtasks. */
  subtasks?: string[];
  /** What the words suggest: an event (range, length, «зустріч о 15»), a note («нотатка: …»), a task («задача: …»). */
  kind?: 'task' | 'event' | 'note';
  spans: Span[];
}

// Word boundaries that work for Cyrillic (\b doesn't).
const B = "(?<![\\p{L}\\d'#@])";
const E = "(?![\\p{L}\\d'])";
const NUM = '(\\d{1,2})';
const IN = '(?:(?:до|на|в|у|во|к)\\s+)'; // prepositions before a day or date

/** Weekday stems, index = JS day (0 = Sunday): «у середу», «до середи», «щосереди», ru «в среду». */
const DAY_STEMS = [
  'неділ[юяіь]|воскресень[еяю]|воскресенья',
  'понеділ(?:ок|ка)|понедельник(?:а)?',
  'вівтор(?:ок|ка)|вторник(?:а)?',
  'серед[уиа]|сред[ауы]',
  'четвер(?:га)?|четверг(?:а)?',
  "п'ятниц[юіяь]|пятниц[уыа]",
  'субот[уиа]|суббот[уыа]',
];
const DAY_RX = DAY_STEMS.map((s) => new RegExp(`^(?:${s})$`, 'iu'));
const DAY_PLURAL = ['неділях', 'понеділках', 'вівторках', 'середах', 'четвергах', "п'ятницях", 'суботах'];
const DAY_SHORT = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const DAY_EN = ['sun(?:day)?', 'mon(?:day)?', 'tue(?:sday)?', 'wed(?:nesday)?', 'thu(?:rsday)?', 'fri(?:day)?', 'sat(?:urday)?'];
const dayIndex = (w: string) => {
  const s = w.toLowerCase();
  const short = DAY_SHORT.indexOf(s);
  if (short >= 0) return short;
  const en = DAY_EN.findIndex((p) => new RegExp(`^${p}$`, 'i').test(s));
  return en >= 0 ? en : DAY_RX.findIndex((r) => r.test(s));
};
// Genitive and short forms only, so «2 червоних яблука» isn't read as June.
const MONTHS = [
  ['січня', 'січ', 'января', 'jan'],
  ['лютого', 'лют', 'февраля', 'feb'],
  ['березня', 'бер', 'марта', 'mar'],
  ['квітня', 'квіт', 'апреля', 'apr'],
  ['травня', 'трав', 'мая', 'may'],
  ['червня', 'черв', 'июня', 'jun'],
  ['липня', 'лип', 'июля', 'jul'],
  ['серпня', 'серп', 'августа', 'aug'],
  ['вересня', 'вер', 'сентября', 'sep'],
  ['жовтня', 'жовт', 'октября', 'oct'],
  ['листопада', 'лист', 'ноября', 'nov'],
  ['грудня', 'груд', 'декабря', 'dec'],
];
const MONTH_RX = `(${MONTHS.flat().join('|')})\\.?`;
const monthIndex = (word: string) => MONTHS.findIndex((forms) => forms.includes(word.toLowerCase()));
// Spoken hours: «о третій», «о пів на восьму».
const HOURS_LOC = ['першій', 'другій', 'третій', 'четвертій', "п'ятій", 'шостій', 'сьомій', 'восьмій', "дев'ятій", 'десятій', 'одинадцятій', 'дванадцятій'];
const HOURS_ACC = ['першу', 'другу', 'третю', 'четверту', "п'яту", 'шосту', 'сьому', 'восьму', "дев'яту", 'десяту', 'одинадцяту', 'дванадцяту'];
const HOURS_GEN = ['першої', 'другої', 'третьої', 'четвертої', "п'ятої", 'шостої', 'сьомої', 'восьмої', "дев'ятої", 'десятої', 'одинадцятої', 'дванадцятої'];
/** An hour as digits or a spoken word («третьої», «третій»). */
const hourOf = (w: string) => (/^\d/.test(w) ? Number(w) : Math.max(HOURS_GEN.indexOf(w.toLowerCase()), HOURS_LOC.indexOf(w.toLowerCase())) + 1);
const RT = `(\\d{1,2}|${[...HOURS_GEN, ...HOURS_LOC].join('|')})(?:[:.](\\d{2}))?`;
const WORD_NUM: Record<string, number> = {
  один: 1, одну: 1, одна: 1, два: 2, дві: 2, двох: 2, три: 3, трьох: 3, чотири: 4, "п'ять": 5, шість: 6, сім: 7, вісім: 8, "дев'ять": 9, десять: 10,
  пару: 2, кілька: 3, декілька: 3, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, две: 2, четыре: 4,
};
const NUMW = `(\\d+|${Object.keys(WORD_NUM).join('|')})`;
const num = (s?: string) => (s == null ? 1 : WORD_NUM[s.toLowerCase()] ?? Number(s));
const PART = '(?:\\s*(ранку|вечора|дня|ночі|утра|вечера|ночи|am|pm))?';
const T = `${NUM}(?:[:.](\\d{2})|\\s+(\\d{2})(?=\\s*(?:год|$)))?`; // 15, 15:30, 15.30, «15 30 год»
// Events, not tasks, when the title names one and there's a time.
const EVENT_WORDS =
  "зустріч|нарад|дзвін|созвон|колл|call|meeting|мітинг|вебінар|лекці|семінар|урок|прийом|лікар|стоматолог|співбесід|інтерв'ю|презентаці|конференці|концерт|кіно|театр|вечер[яюі]|обід|сніданок|рейс|поїзд|потяг|літак|день народження|свят|встреч|совещан|врач|бронь|візит|сесі|тренування з";

const EVENT_RX = new RegExp(`${B}(?:${EVENT_WORDS})`, 'iu');

interface Ctx {
  s: string;
  used: boolean[];
  out: ParsedQuick;
  today: DateKey;
  now: Date;
  part?: 'morning' | 'day' | 'evening' | 'night';
}

// Rules run on every keystroke: compile each pattern once.
const compiled = new Map<string, RegExp>();
const rx = (source: string) => {
  let r = compiled.get(source);
  if (!r) compiled.set(source, (r = new RegExp(source, 'giu')));
  return r;
};

/** Runs `source` over the text and lets `fn` claim matches that don't overlap earlier ones. */
function claim(c: Ctx, source: string, type: SpanType, fn: (m: RegExpExecArray) => boolean | void, once = true) {
  for (const m of c.s.matchAll(rx(source))) {
    // Leading whitespace in a match (from (^|\s)) isn't part of the span.
    const lead = m[0].length - m[0].trimStart().length;
    const start = m.index! + lead;
    const end = m.index! + m[0].trimEnd().length;
    if (start >= end) continue;
    let free = true;
    for (let i = start; i < end; i++) if (c.used[i]) free = false;
    if (!free || fn(m as RegExpExecArray) === false) continue;
    for (let i = start; i < end; i++) c.used[i] = true;
    c.out.spans.push({ start, end, type });
    if (once) return;
  }
}

const dow = (key: DateKey) => fromDateKey(key).getDay();
/** Next date (today included) that falls on weekday `d`. */
const nextDow = (today: DateKey, d: number) => addDaysKey(today, (d - dow(today) + 7) % 7);
/** Weekday `d` of next week (weeks start on Monday). */
const nextWeekDow = (today: DateKey, d: number) => addDaysKey(today, 7 - ((dow(today) + 6) % 7) + ((d + 6) % 7));
const thisWeekDow = (today: DateKey, d: number) => addDaysKey(today, ((d + 6) % 7) - ((dow(today) + 6) % 7));
const addMonths = (key: DateKey, n: number) => {
  const d = fromDateKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toDateKey(d);
};
const monthStart = (key: DateKey) => key.slice(0, 8) + '01';
/** Day and month (and maybe year) → a date; without a year the next such date from today. */
function dayMonth(today: DateKey, day: number, month: number, year?: number): DateKey | undefined {
  const y0 = year ?? Number(today.slice(0, 4));
  const make = (y: number) => {
    const d = new Date(y, month - 1, day);
    return d.getMonth() === month - 1 && d.getDate() === day ? toDateKey(d) : undefined;
  };
  const k = make(y0);
  if (!k) return undefined;
  return !year && k < today ? make(y0 + 1) : k;
}
/** Next date (today included) with this day of the month. */
function nextMonthDay(today: DateKey, day: number): DateKey | undefined {
  if (day < 1 || day > 31) return undefined;
  for (let i = 0; i < 13; i++) {
    const base = addMonths(monthStart(today), i);
    const k = dayMonth(base, day, Number(base.slice(5, 7)), Number(base.slice(0, 4)));
    if (k && k >= today) return k;
  }
  return undefined;
}

function setTime(c: Ctx, h: number, min: number, part?: string) {
  if (part) {
    const p = part.toLowerCase();
    if (/веч|дня|pm/.test(p) && h < 12) h += 12;
    else if (/ноч|am/.test(p) && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return false;
  c.out.time = minutesToTime(h * 60 + min);
}
const hm = (h: string, m1?: string, m2?: string) => [Number(h), Number(m1 ?? m2 ?? 0)] as const;

/** A date found with «до …» while a repeat is set ends the repeat instead («щодня до 31 грудня»). */
function setDate(c: Ctx, m: RegExpExecArray, key: DateKey) {
  if (c.out.recurrence && /^\s*до\s/i.test(m[0])) c.out.recurrence.until = key;
  else c.out.date = key;
}

export function parseQuick(input: string, today: DateKey, now: Date = new Date()): ParsedQuick {
  // Same length as the input, so spans point into the original text.
  const s = input.replace(/[ʼ’`]/g, "'");
  const c: Ctx = { s, used: new Array(s.length).fill(false), out: { title: '', tags: [], spans: [] }, today, now };
  const o = c.out;

  // Description after « // » or « -- » (taken first, so its words aren't read as dates).
  claim(c, `(?:^|\\s)(?://|--)\\s*(.*)$`, 'note', (m) => void (o.description = m[1].trim() || undefined));

  // Reminder: «нагадай за 15 хв», «з нагадуванням за годину», «напомни за час».
  claim(c, `${B}(?:нагадай(?:те)?|нагадати|з нагадуванням|нагадування|напомни(?:ть)?|remind me)\\s+(?:мені\\s+|мне\\s+)?(?:за|in|before)\\s+(?:${NUMW}\\s*)?(хв(?:илин[уи]?)?|мин(?:ут[уы]?)?|год(?:ин[уи]?)?|час(?:а|ов)?|дн(?:і|ів|я|ей)|день|тижд(?:ень)?|недел[июь]|min|h(?:ours?)?)${E}`, 'reminder', (m) => {
    const n = num(m[1]);
    const u = m[2].toLowerCase();
    o.remindMin = /^(хв|мин|min)/.test(u) ? n : /^(год|час|h)/.test(u) ? n * 60 : /^(т|нед)/.test(u) ? n * 10080 : n * 1440;
  });
  // What it is, at the start: «задача: …», «подія: …», «нотатка: …», «нагадай (мені) …».
  claim(c, `^\\s*(задача|завдання|todo|подія|событие|нотатка|замітка|заметка|note)\\s*[:\\-—]\\s*`, 'kind', (m) => {
    const w = m[1].toLowerCase();
    o.kind = /^(задача|завдання|todo)/.test(w) ? 'task' : /^(подія|событие)/.test(w) ? 'event' : 'note';
  });
  claim(c, `^\\s*(?:нагадай(?:те)?|напомни(?:ть)?|remind me(?: to)?)(?:\\s+мені|\\s+мне)?\\s*[:,]?\\s+`, 'reminder', () => {
    o.remindMin ??= 0;
  });

  // Tags: #категорія / #проєкт, @проєкт. «хештег робота» from dictation.
  claim(c, `(^|\\s)#([\\p{L}\\d_'-]+)`, 'tag', (m) => void o.tags.push(m[2]), false);
  claim(c, `${B}(?:хештег|хеш тег|тег)\\s+([\\p{L}\\d_'-]+)`, 'tag', (m) => void o.tags.push(m[1]), false);
  claim(c, `(^|\\s)@([\\p{L}\\d_'-]+)`, 'project', (m) => void (o.project = m[2]));

  // Priority: !!, !!!, !1–!3, p1–p4, words.
  claim(c, `(^|\\s)(!{2,3})(?=\\s|$)`, 'priority', (m) => void (o.priority = m[2].length === 3 ? 'urgent' : 'high'));
  claim(c, `(^|\\s)(?:!|p)([1-4])(?=\\s|$)`, 'priority', (m) => void (o.priority = (['urgent', 'high', 'medium', 'low'] as const)[Number(m[2]) - 1]));
  claim(c, `${B}(не терміново|не срочно|низький пріоритет|колись|коли буде час)${E}`, 'priority', () => void (o.priority ??= 'low'));
  claim(c, `${B}(терміново|дуже важливо|срочно|asap|горить)${E}`, 'priority', () => void (o.priority = 'urgent'));
  claim(c, `${B}(важливо|пріоритетно|важно)${E}`, 'priority', () => void (o.priority ??= 'high'));

  // Repeats.
  const rule = (r: RecurrenceRule) => void (o.recurrence = r);
  claim(c, `${B}(?:щодня|щоденно|кожного дня|кожен день|кожний день|щодень|каждый день|ежедневно|every day|daily)${E}`, 'repeat', () => rule({ freq: 'daily', interval: 1 }));
  claim(c, `${B}(щоранку|щовечора|щоночі|каждое утро|каждый вечер)${E}`, 'repeat', (m) => {
    rule({ freq: 'daily', interval: 1 });
    c.part = /ранк|утро/i.test(m[1]) ? 'morning' : /ноч/i.test(m[1]) ? 'night' : 'evening';
  });
  claim(c, `${B}(?:щобудня|по буднях|у будні(?: дні)?|в будні(?: дні)?|кожного буднього дня|по будням|в будни|weekdays)${E}`, 'repeat', () => rule({ freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] }));
  claim(c, `${B}(?:щовихідних|по вихідних|кожні вихідні|по выходным|weekends)${E}`, 'repeat', () => rule({ freq: 'weekly', interval: 1, byWeekday: [6, 0] }));
  claim(c, `${B}(?:кожн(?:і|их)|каждые|every)\\s+${NUMW}\\s+(дн(?:і|ів|я|ей)|тижн(?:і|ів)|недел[иь]|місяц(?:і|ів)|месяц(?:а|ев)|рок(?:и|ів)|год(?:а)?|лет|days?|weeks?|months?|years?)${E}`, 'repeat', (m) => {
    const u = m[2].toLowerCase();
    rule({ freq: /^(д|d)/.test(u) ? 'daily' : /^(т|нед|w)/.test(u) ? 'weekly' : /^(м|mo)/.test(u) ? 'monthly' : 'yearly', interval: num(m[1]) });
  });
  claim(c, `${B}раз\\s+на\\s+(?:${NUMW}\\s+)?(день|дні|днів|тиждень|тижні|тижнів|місяць|місяці|місяців|рік|роки|неделю|месяц|год)${E}`, 'repeat', (m) => {
    const u = m[2].toLowerCase();
    rule({ freq: /^д/.test(u) ? 'daily' : /^(т|нед)/.test(u) ? 'weekly' : /^м/.test(u) ? 'monthly' : 'yearly', interval: m[1] ? num(m[1]) : 1 });
  });
  // «щопонеділка», «кожного понеділка», «кожну пʼятницю», «по понеділках і четвергах», «каждую пятницу».
  const anyDay = `(?:${DAY_STEMS.join('|')})`;
  claim(c, `${B}(?:що|кожн(?:ого|ої|ий|у|ен)\\s+|кажд(?:ый|ую|ое|ого)\\s+|every\\s+)(${anyDay}(?:\\s*(?:,|і|й|та|и)\\s*${anyDay})*|${DAY_EN.join('|')})${E}`, 'repeat', (m) => {
    const days = m[1].split(/\s*(?:,|\sі\s|\sй\s|\sта\s|\sи\s)\s*/iu).map(dayIndex).filter((d) => d >= 0);
    if (!days.length) return false;
    rule({ freq: 'weekly', interval: 1, byWeekday: [...new Set(days)].sort() });
  });
  claim(c, `${B}по\\s+((?:${DAY_PLURAL.join('|')})(?:\\s*(?:,|і|й|та)\\s*(?:${DAY_PLURAL.join('|')}))*)${E}`, 'repeat', (m) => {
    rule({ freq: 'weekly', interval: 1, byWeekday: DAY_PLURAL.map((p, d) => (m[1].toLowerCase().includes(p) ? d : -1)).filter((d) => d >= 0) });
  });
  // «кожного 15 числа», «щомісяця 1-го».
  claim(c, `${B}(?:кожного|щомісяця|каждого)\\s+${NUM}(?:-?(?:го|е|те))?(?:\\s+числа)?${E}`, 'repeat', (m) => {
    const d = nextMonthDay(today, Number(m[1]));
    if (!d) return false;
    rule({ freq: 'monthly', interval: 1 });
    o.date = d;
  });
  claim(c, `${B}(?:щотижня|щотижнево|кожного тижня|кожен тиждень|каждую неделю|еженедельно|weekly)${E}`, 'repeat', () => rule({ freq: 'weekly', interval: 1 }));
  claim(c, `${B}(?:щомісяця|щомісячно|кожного місяця|кожен місяць|каждый месяц|ежемесячно|monthly)${E}`, 'repeat', () => rule({ freq: 'monthly', interval: 1 }));
  claim(c, `${B}(?:щороку|щорічно|кожного року|кожен рік|каждый год|ежегодно|yearly)${E}`, 'repeat', () => rule({ freq: 'yearly', interval: 1 }));

  // All day.
  claim(c, `${B}(?:на\\s+)?(?:цілий|весь)\\s+день${E}`, 'time', () => void (o.allDay = true));

  // From now: «через 2 години», «через 30 хв», «через годину», «через пів години», ru «через час».
  claim(c, `${B}(?:через|in)\\s+(?:${NUMW}\\s*|пів\\s*|півтори\\s+|полтора\\s+|пол\\s*)?(хв(?:илин[уи]?)?|мин(?:ут[уы]?)?|годин[уи]?|год|час(?:а|ов)?|min(?:utes?)?|h(?:ours?)?)${E}`, 'time', (m) => {
    const w = m[0].toLowerCase();
    const minutes = /^(хв|мин|min)/i.test(m[2]);
    const n = /півтори|полтора/.test(w) ? 1.5 : /пів|пол/.test(w) ? 0.5 : num(m[1]);
    const at = new Date(c.now.getTime() + (minutes ? n : n * 60) * 60_000);
    o.date = toDateKey(at);
    o.time = minutesToTime(at.getHours() * 60 + at.getMinutes());
  });

  // Several days: «з 15 по 20 жовтня», «з 28 жовтня до 2 листопада», «15.10–20.10», «з 15.10 до 20.10».
  const span = (from?: DateKey, to?: DateKey) => {
    if (!from || !to || to <= from) return false;
    o.date = from;
    o.endDate = to;
    o.allDay = true;
  };
  claim(c, `${B}(?:(?:з|с|від|от)\\s+)?${NUM}(?:\\s+${MONTH_RX})?\\s*(?:до|по|[-–—])\\s*${NUM}\\s+${MONTH_RX}${E}`, 'date', (m) => {
    const m2 = monthIndex(m[4]) + 1;
    const m1 = m[2] ? monthIndex(m[2]) + 1 : m2;
    const from = dayMonth(today, Number(m[1]), m1);
    let to = from && dayMonth(from, Number(m[3]), m2);
    if (from && to && to < from) to = dayMonth(addDaysKey(from, 1), Number(m[3]), m2);
    return span(from, to);
  });
  claim(c, `${B}(?:(?:з|с|від|от)\\s+)?${NUM}\\.${NUM}\\s*(?:до|по|[-–—])\\s*${NUM}\\.${NUM}${E}`, 'date', (m) => {
    if (Number(m[2]) > 12 || Number(m[4]) > 12) return false;
    const from = dayMonth(today, Number(m[1]), Number(m[2]));
    return span(from, from && dayMonth(from, Number(m[3]), Number(m[4])));
  });

  // Time ranges: «з 10 до 12», «на 15:00 до 16:30», «о 15 до 16:30», «від 9 до 18», «15:00-16:30»,
  // «з 9 ранку до 6 вечора», «з третьої до пʼятої», «10-12 год».
  claim(c, `${B}(?:(з|с|від|от|о|об|в|у|на|from|at)\\s+)?${RT}${PART}\\s*(?:до|по|to|[-–—])\\s*${RT}${PART}(\\s*(?:год(?:ини)?|h))?${E}`, 'time', (m) => {
    const pre = m[1]?.toLowerCase();
    const strong = /^(з|с|від|от|from|о|об|at)$/.test(pre ?? '');
    // Bare «5 до 10», «3-5», «у 2-3 етапи» stay text: needs «з/від/о», minutes, a part of the day or «год».
    if (!strong && !m[3] && !m[6] && !m[4] && !m[7] && !m[8]) return false;
    // «15.10 до 20.10» are dates, not times.
    if (/\d\.\d/.test(m[0]) && Number(m[3] ?? 99) <= 12 && Number(m[6] ?? 99) <= 12 && !m[8]) return false;
    const toMin = (h: string, mm: string | undefined, part?: string) => {
      let hh = hourOf(h);
      if (part && /веч|дня|pm/i.test(part) && hh < 12) hh += 12;
      if (part && /ноч|am/i.test(part) && hh === 12) hh = 0;
      const mi = Number(mm ?? 0);
      return hh > 23 || mi > 59 ? NaN : hh * 60 + mi;
    };
    let start = toMin(m[2], m[3], m[4] ?? m[7]);
    let end = toMin(m[5], m[6], m[7] ?? m[4]);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    // «з 9 до 6 вечора»: the part belongs to the end only.
    if (!m[4] && m[7] && start >= end) start = toMin(m[2], m[3]);
    // «з 11 до 1»: afternoon; past midnight ends the day.
    if (end <= start && !m[4] && !m[7] && end + 720 > start && end < 720) end += 720;
    if (end <= start) end = 23 * 60 + 59;
    o.time = minutesToTime(start);
    o.endTime = minutesToTime(end);
  });

  // Length: «на годину», «на 2 години», «на 1.5 год», «на півтори години», «на 45 хв», «на 1 год 30 хв», ru «на час».
  claim(c, `${B}(?:на|тривалістю|for)\\s+(?:${NUMW}(?:[.,](\\d))?\\s*)?(?:(годин[уиі]?|год|час(?:а|ов)?|h(?:ours?)?)(?:\\s+(\\d{1,2})\\s*(?:хв(?:илин[уи]?)?|мин))?|(хв(?:илин[уи]?)?|мин(?:ут[уы]?)?|min(?:utes?)?))${E}`, 'duration', (m) => {
    if (m[5]) o.duration = num(m[1]);
    else o.duration = Math.round((num(m[1]) + Number(m[2] ? `0.${m[2]}` : 0)) * 60) + Number(m[4] ?? 0);
  });
  claim(c, `${B}на\\s+(?:пів\\s*години|півгодини|полчаса|пол часа)${E}`, 'duration', () => void (o.duration = 30));
  claim(c, `${B}на\\s+(?:півтори\\s+години|полтора\\s+часа)${E}`, 'duration', () => void (o.duration = 90));

  // Dates. «до …» (deadline) reads the same as «на …» (or ends a repeat).
  claim(c, `${B}${IN}?(післязавтра|позавтра|послезавтра)${E}`, 'date', (m) => setDate(c, m as RegExpExecArray, addDaysKey(today, 2)));
  claim(c, `${B}${IN}?(завтра|tomorrow)${E}`, 'date', (m) => setDate(c, m, addDaysKey(today, 1)));
  claim(c, `${B}${IN}?(сьогодні|сегодня|today)${E}`, 'date', (m) => setDate(c, m, today));
  claim(c, `${B}(tonight)${E}`, 'date', () => {
    o.date = today;
    c.part = 'evening';
  });
  claim(c, `${B}(?:через|за|in)\\s+(?:${NUMW}\\s+)?(дн(?:і|ів|я|ей)|день|тижн(?:і|ів|я)|тиждень|недел[июь]|місяц(?:і|ів|я)|місяць|месяц(?:а|ев)?|р(?:оки|оків|ік)|days?|weeks?|months?)${E}`, 'date', (m) => {
    const n = num(m[1]);
    const u = m[2].toLowerCase();
    o.date = /^(д|d)/.test(u) ? addDaysKey(today, n) : /^(т|нед|w)/.test(u) ? addDaysKey(today, n * 7) : /^(м|mo)/.test(u) ? addMonths(today, n) : addMonths(today, n * 12);
  });
  claim(c, `${B}(?:на|у|в)?\\s*(?:вихідних|вихідні|выходных|выходные|weekend)${E}`, 'date', () => void (o.date = [6, 0].includes(dow(today)) ? today : nextDow(today, 6)));
  claim(c, `${B}(?:на\\s+)?(?:початку|начале)\\s+(?:наступного\\s+)?(тижня|місяця|недели|месяца)${E}`, 'date', (m) => {
    const next = /наступ/i.test(m[0]);
    o.date = /^(т|н)/i.test(m[1]) ? nextWeekDow(today, 1) : next || today.slice(8) !== '01' ? addMonths(monthStart(today), 1) : today;
  });
  claim(c, `${B}(?:на\\s+)?(?:наступн(?:ого|ому)\\s+тижн(?:я|і)|следующей неделе|на следующей неделе|next week)${E}`, 'date', () => void (o.date = nextWeekDow(today, 1)));
  claim(c, `${B}(?:на\\s+)?(?:наступн(?:ого|ому)\\s+місяц(?:я|і)|next month)${E}`, 'date', () => void (o.date = addMonths(monthStart(today), 1)));
  claim(c, `${B}(?:(?:в|у|на|до)\\s+)?(?:кінці|кінця|кінець|конце|конца)\\s+(?:цього\\s+)?(дня|тижня|місяця|року|недели|месяца|года)${E}`, 'date', (m) => {
    const u = m[1].toLowerCase();
    o.date = u === 'дня' ? today : /^(т|н)/.test(u) ? (thisWeekDow(today, 5) < today ? today : thisWeekDow(today, 5)) : /^м/.test(u) ? addDaysKey(addMonths(monthStart(today), 1), -1) : `${today.slice(0, 4)}-12-31`;
  });
  claim(c, `${B}(?:в|у|на)?\\s*середині\\s+місяця${E}`, 'date', () => void (o.date = nextMonthDay(today, 15)));
  // Weekdays: «у пʼятницю», «до середи», «наступного вівторка», «у цю суботу», «в пт», «в пятницу», «on friday».
  claim(c, `${B}(?:(?:до|на|в|у|во|on|by)\\s+)?(?:(наступн\\p{L}*|следующ\\p{L}*|цього|цієї|цей|цю|ця|эт\\p{L}*|next|this)\\s+)?(${DAY_STEMS.join('|')}|${DAY_SHORT.join('|')}|${DAY_EN.join('|')})${E}`, 'date', (m) => {
    const word = m[2].toLowerCase();
    // A bare abbreviation («ср», «mon») only after a preposition, so it isn't taken from a title.
    const abbr = DAY_SHORT.includes(word) || /^(sun|mon|tue|wed|thu|fri|sat)$/.test(word);
    if (abbr && !/^\s*(до|на|в|у|во|on|by)\s/i.test(m[0])) return false;
    const d = dayIndex(word);
    if (d < 0) return false;
    const which = m[1]?.toLowerCase();
    setDate(c, m, /^(наступ|следующ|next)/.test(which ?? '') ? nextWeekDow(today, d) : which ? thisWeekDow(today, d) : nextDow(today, d));
  });
  // «15 жовтня», «1-го листопада», «15 жовт.», «2 січня 2027», «5 мая».
  claim(c, `${B}${IN}?${NUM}(?:-?(?:го|е|те))?\\s+${MONTH_RX}(?:\\s+(\\d{4}))?(?![\\p{L}\\d'])`, 'date', (m) => {
    const k = dayMonth(today, Number(m[1]), monthIndex(m[2]) + 1, m[3] ? Number(m[3]) : undefined);
    if (!k) return false;
    setDate(c, m, k);
  });
  // «2026-10-15», «15.10», «15/10», «15.10.2026» (not after «о»: «о 10.30» is a time).
  claim(c, `${B}(?:до\\s+)?(\\d{4})-(\\d{2})-(\\d{2})${E}`, 'date', (m) => {
    const k = dayMonth(today, Number(m[3]), Number(m[2]), Number(m[1]));
    if (!k) return false;
    setDate(c, m, k);
  });
  claim(c, `${B}(?:(?:до|на|в|у)\\s+)?${NUM}[./]${NUM}(?:[./](\\d{2,4}))?${E}`, 'date', (m) => {
    const y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : undefined;
    const k = dayMonth(today, Number(m[1]), Number(m[2]), y);
    if (!k) return false;
    setDate(c, m, k);
  });
  // «25 числа», «1-го», «до 20-го»: the next such day of the month.
  claim(c, `${B}${IN}?${NUM}(?:-?(?:го|е|те)(?:\\s+числа)?|\\s+числа)${E}`, 'date', (m) => {
    const k = nextMonthDay(today, Number(m[1]));
    if (!k) return false;
    setDate(c, m, k);
  });

  // Times.
  claim(c, `${B}(?:о|об|в|у)?\\s*(опівдні|опівночі|в полдень|в полночь|noon|midnight)${E}`, 'time', (m) => setTime(c, /дні|полдень|noon/i.test(m[1]) ? 12 : 0, 0));
  claim(c, `${B}(?:о|об|в|у)\\s+пів\\s+на\\s+(\\d{1,2}|${HOURS_ACC.join('|')})${PART}${E}`, 'time', (m) => {
    const h = /\d/.test(m[1]) ? Number(m[1]) : HOURS_ACC.indexOf(m[1].toLowerCase()) + 1;
    return setTime(c, (h + 23) % 24, 30, m[2]);
  });
  claim(c, `${B}(?:о|об)\\s+(${HOURS_LOC.join('|')})(?:\\s+(\\d{1,2})\\s*(?:хв(?:илин)?)?)?${PART}${E}`, 'time', (m) =>
    setTime(c, HOURS_LOC.indexOf(m[1].toLowerCase()) + 1, Number(m[2] ?? 0), m[3]),
  );
  // «о 15», «о 9:30», «о 15 00», «о 9-й», «о 9 годині», «at 5pm».
  claim(c, `${B}(?:о|об|at)\\s+${T}(?:-?й|\\s*(?:год(?:ині)?|h))?${PART}${E}`, 'time', (m) => setTime(c, ...hm(m[1], m[2], m[3]), m[4]));
  // «в/у/на/к/до» only with minutes, «год» or a part of the day, so «у 2 етапи» and «до 5 разів» stay text.
  claim(c, `${B}(?:в|у|на|к|до)\\s+${NUM}(?:[:.](\\d{2})|\\s*(?:год(?:ині)?|час(?:ов|а)?)|(?=\\s+(?:ранку|вечора|дня|ночі|утра|вечера|ночи)))${PART}${E}`, 'time', (m) =>
    // «до 20.10» is a date (minutes ≤ 12 after a dot), «до 20:10» a time.
    /\d\.\d/.test(m[0]) && Number(m[2]) <= 12 ? false : setTime(c, ...hm(m[1], m[2]), m[3]),
  );
  // «в 15» / «у 9» only at the end or before other recognised words: «у 2 етапи» stays text.
  claim(c, `${B}(?:в|у|к)\\s+${NUM}(?=\\s*$|\\s*[,.;!]|\\s+(?:завтра|сьогодні|сегодня|післязавтра|#|@|!|на\\s|до\\s|щ|кожн|по\\s))`, 'time', (m) => setTime(c, Number(m[1]), 0));
  claim(c, `${B}${NUM}:(\\d{2})${PART}${E}`, 'time', (m) => setTime(c, ...hm(m[1], m[2]), m[3]));
  // Bare «15.30» is a time only when it can't be a date (minutes > 12) or says «год».
  claim(c, `${B}${NUM}\\.(\\d{2})(\\s*год(?:ини)?)?${E}`, 'time', (m) => (!m[3] && Number(m[2]) <= 12 ? false : setTime(c, ...hm(m[1], m[2]))));
  claim(c, `${B}${NUM}\\s*(ранку|вечора|дня|ночі|утра|вечера|ночи|am|pm)${E}`, 'time', (m) => setTime(c, Number(m[1]), 0, m[2]));
  // Part of the day: sets the time if none was given, or moves «о 8» to the evening.
  claim(c, `${B}(вранці|зранку|уранці|ранком|з ранку|вдень|удень|в обід|в обідню перерву|по обіді|після обіду|ввечері|увечері|вечором|вночі|уночі|утром|днем|вечером|ночью|morning|afternoon|evening)${E}`, 'time', (m) => {
    const w = m[1].toLowerCase();
    c.part = /ран|утр|morn/.test(w) ? 'morning' : /веч|even/.test(w) ? 'evening' : /ноч/.test(w) ? 'night' : 'day';
  });
  if (c.part) {
    const def = { morning: 9 * 60, day: 13 * 60, evening: 19 * 60, night: 22 * 60 }[c.part];
    if (!o.time) o.time = minutesToTime(def);
    else {
      const [h, mm] = o.time.split(':').map(Number);
      if ((c.part === 'evening' || c.part === 'day') && h < 12 && !(c.part === 'day' && h >= 9)) o.time = minutesToTime((h + 12) * 60 + mm);
    }
  }

  // Repeats start on their first matching day when no date was given.
  const r = o.recurrence;
  if (r && !o.date) o.date = r.byWeekday?.length ? r.byWeekday.map((d) => nextDow(today, d)).sort()[0] : today;
  if (o.allDay) {
    delete o.time;
    delete o.endTime;
  }

  // Title: what's left, without connecting words stranded by the removed parts.
  let title = '';
  for (let i = 0; i < s.length; i++) title += c.used[i] ? ' ' : input[i];
  title = title
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/(?:^|\s)(?:і|й|та|а|о|об|на|до|в|у|з|за|о|и|к|с|по)\s*$/iu, '')
    .replace(/^[\s,.;:—-]+|[\s,;—-]+$/g, '')
    .trim();

  // «Купити: молоко, хліб, яйця» → a task with subtasks.
  const list = o.kind !== 'note' ? title.match(/^([^:]{2,60}):\s*(.+)$/u) : null;
  if (list) {
    const items = list[2].split(/\s*[,;]\s*/).map((x) => x.trim()).filter(Boolean);
    if (items.length >= 2) {
      title = list[1].trim();
      o.subtasks = items.map((x) => x.charAt(0).toLocaleUpperCase('uk') + x.slice(1));
    }
  }
  o.title = title.charAt(0).toLocaleUpperCase('uk') + title.slice(1);

  // What it is: an event when it has a range, length or «цілий день», or its title names a
  // meeting and it has a time (whole words of the title only: «ввечері» isn't «вечеря»).
  if (!o.kind && (o.endTime || o.duration || o.allDay)) o.kind = 'event';
  if (!o.kind && o.time && EVENT_RX.test(title.replace(/[ʼ’`]/g, "'"))) o.kind = 'event';

  o.spans.sort((a, b) => a.start - b.start);
  return o;
}

/** The text without the pieces of one type (a chip's ✕). */
export function removeSpans(input: string, spans: Span[], types: SpanType[]): string {
  let out = input;
  for (const sp of [...spans].filter((x) => types.includes(x.type)).sort((a, b) => b.start - a.start)) out = out.slice(0, sp.start) + out.slice(sp.end);
  return out.replace(/\s{2,}/g, ' ').replace(/^\s+/, '');
}

/** Same name ignoring case, spaces, «_» and apostrophes: «#мій_проєкт» finds «Мій проєкт». */
export const sameName = (a: string, b: string) => {
  const n = (x: string) => x.toLowerCase().replace(/[\s_'ʼ’`-]/g, '');
  return n(a) === n(b);
};
