import { addDaysKey, fromDateKey, minutesToTime, toDateKey } from '@/lib/date';
import type { DateKey, Priority, RecurrenceRule, TimeString } from '@/types';

/**
 * Quick-capture parsing: «Зустріч з Олею завтра о 15 на годину #робота» →
 * title, date, time, length, repeat, category… Every recognised piece keeps
 * its place in the text (`spans`), so the field can highlight it and a chip
 * can remove it again.
 */

export type SpanType = 'date' | 'time' | 'duration' | 'repeat' | 'tag' | 'project' | 'priority' | 'reminder' | 'kind';
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
  /** Minutes («на годину», «на 30 хв»); events only. */
  duration?: number;
  recurrence?: RecurrenceRule;
  /** Words after # (category, project or a plain tag). */
  tags: string[];
  /** Word after @ (a project). */
  project?: string;
  priority?: Priority;
  /** «нагадай за 15 хв» */
  remindMin?: number;
  /** What the words suggest: an event (time range, length, «зустріч о 15»), a note («нотатка: …»). */
  kind?: 'event' | 'note';
  spans: Span[];
}

// Word boundaries that work for Cyrillic (\b doesn't).
const B = "(?<![\\p{L}\\d'#@])";
const E = "(?![\\p{L}\\d'])";
const NUM = '(\\d{1,2})';

/** Weekday stems: index = JS day (0 = Sunday). Forms cover «у середу», «до середи», «по середах», «щосереди». */
const DAY_STEMS = ['неділ[юяіь]', 'понеділ(?:ок|ка)', 'вівтор(?:ок|ка)', 'серед[уиа]', 'четвер(?:га)?', "п'ятниц[юіяь]", 'субот[уиа]'];
const DAY_PLURAL = ['неділях', 'понеділках', 'вівторках', 'середах', 'четвергах', "п'ятницях", 'суботах'];
const DAY_SHORT = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
// Genitive and short forms only, so «2 червоних яблука» isn't read as June.
const MONTHS = [
  ['січня', 'січ'],
  ['лютого', 'лют'],
  ['березня', 'бер'],
  ['квітня', 'квіт'],
  ['травня', 'трав'],
  ['червня', 'черв'],
  ['липня', 'лип'],
  ['серпня', 'серп'],
  ['вересня', 'вер'],
  ['жовтня', 'жовт'],
  ['листопада', 'лист'],
  ['грудня', 'груд'],
];
const MONTH_RX = `(${MONTHS.flat().join('|')})\\.?`;
const monthIndex = (word: string) => MONTHS.findIndex((forms) => forms.includes(word.toLowerCase()));
// Spoken hours: «о третій», «о пів на восьму».
const HOURS_LOC = ['першій', 'другій', 'третій', 'четвертій', "п'ятій", 'шостій', 'сьомій', 'восьмій', "дев'ятій", 'десятій', 'одинадцятій', 'дванадцятій'];
const HOURS_ACC = ['першу', 'другу', 'третю', 'четверту', "п'яту", 'шосту', 'сьому', 'восьму', "дев'яту", 'десяту', 'одинадцяту', 'дванадцяту'];
const WORD_NUM: Record<string, number> = { один: 1, одну: 1, два: 2, дві: 2, три: 3, чотири: 4, "п'ять": 5, шість: 6, сім: 7, вісім: 8, "дев'ять": 9, десять: 10, пару: 2 };
const NUMW = `(\\d+|${Object.keys(WORD_NUM).join('|')})`;
const num = (s?: string) => (s == null ? 1 : WORD_NUM[s.toLowerCase()] ?? Number(s));
// Events, not tasks, when they come with a time.
const EVENT_WORDS = "зустріч|нарад|дзвін|созвон|колл|call|мітинг|вебінар|лекці|семінар|урок|прийом|лікар|стоматолог|співбесід|інтерв'ю|презентаці|конференці|концерт|кіно|театр|вечер[яюі]|обід|сніданок|рейс|поїзд|потяг|літак|день народження|свят";

interface Ctx {
  s: string;
  used: boolean[];
  out: ParsedQuick;
  today: DateKey;
  now: Date;
  part?: 'morning' | 'day' | 'evening' | 'night';
}

/** Runs `re` over the text and lets `fn` claim matches that don't overlap earlier ones. */
function claim(c: Ctx, source: string, type: SpanType, fn: (m: RegExpExecArray) => boolean | void, once = true) {
  const re = new RegExp(source, 'giu');
  for (const m of c.s.matchAll(re)) {
    // Leading whitespace in a match (from (^|\s)) isn't part of the span.
    const lead = m[0].length - m[0].trimStart().length;
    const start = m.index! + lead;
    const end = m.index! + m[0].length;
    if (start === end || c.used.slice(start, end).some(Boolean)) continue;
    if (fn(m as RegExpExecArray) === false) continue;
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
    const base = addMonths(today.slice(0, 8) + '01', i);
    const k = dayMonth(base, day, Number(base.slice(5, 7)), Number(base.slice(0, 4)));
    if (k && k >= today) return k;
  }
  return undefined;
}

function setTime(c: Ctx, h: number, min: number, part?: string) {
  if (part) {
    if (/веч|дня|по обід/i.test(part) && h < 12) h += 12;
    else if (/ноч/i.test(part) && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return false;
  c.out.time = minutesToTime(h * 60 + min);
}
const hm = (h: string, m?: string) => [Number(h), Number(m ?? 0)] as const;

export function parseQuick(input: string, today: DateKey, now: Date = new Date()): ParsedQuick {
  // Same length as the input, so spans point into the original text.
  const s = input.replace(/[ʼ’`]/g, "'");
  const c: Ctx = { s, used: new Array(s.length).fill(false), out: { title: '', tags: [], spans: [] }, today, now };
  const o = c.out;

  // Note: «нотатка: …» at the start.
  claim(c, `^\\s*(?:нотатка|замітка|note)\\s*[:\\-—]\\s*`, 'kind', () => void (o.kind = 'note'));

  // Tags: #категорія / #проєкт, @проєкт. «хештег робота» from dictation.
  claim(c, `(^|\\s)#([\\p{L}\\d_'-]+)`, 'tag', (m) => void o.tags.push(m[2]), false);
  claim(c, `${B}(?:хештег|хеш тег)\\s+([\\p{L}\\d_'-]+)`, 'tag', (m) => void o.tags.push(m[1]), false);
  claim(c, `(^|\\s)@([\\p{L}\\d_'-]+)`, 'project', (m) => void (o.project = m[2]));

  // Priority.
  claim(c, `(^|\\s)(!{2,3})(?=\\s|$)`, 'priority', (m) => void (o.priority = m[2].length === 3 ? 'urgent' : 'high'));
  claim(c, `(^|\\s)!([1-3])(?=\\s|$)`, 'priority', (m) => void (o.priority = (['urgent', 'high', 'medium'] as const)[Number(m[2]) - 1]));
  claim(c, `${B}(терміново|дуже важливо)${E}`, 'priority', () => void (o.priority = 'urgent'));
  claim(c, `${B}(важливо|пріоритетно)${E}`, 'priority', () => void (o.priority ??= 'high'));

  // Reminder: «нагадай за 15 хв», «з нагадуванням за годину».
  claim(c, `${B}(?:нагадай(?:ти)?|з нагадуванням|нагадування)\\s+(?:мені\\s+)?за\\s+(?:${NUMW}\\s*)?(хв(?:илин[уи]?)?|год(?:ин[уи]?)?|дн(?:і|ів)|день|тижд(?:ень)?)${E}`, 'reminder', (m) => {
    const n = num(m[1]);
    const u = m[2].toLowerCase();
    o.remindMin = u.startsWith('хв') ? n : u.startsWith('год') ? n * 60 : u.startsWith('т') ? n * 10080 : n * 1440;
  });

  // Repeats.
  const rule = (r: RecurrenceRule) => void (o.recurrence = r);
  claim(c, `${B}(?:щодня|щоденно|кожного дня|кожен день|кожний день|щодень)${E}`, 'repeat', () => rule({ freq: 'daily', interval: 1 }));
  claim(c, `${B}(?:щобудня|по буднях|у будні(?: дні)?|в будні(?: дні)?|кожного буднього дня)${E}`, 'repeat', () => rule({ freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] }));
  claim(c, `${B}(?:щовихідних|по вихідних|кожні вихідні)${E}`, 'repeat', () => rule({ freq: 'weekly', interval: 1, byWeekday: [6, 0] }));
  claim(c, `${B}кожн(?:і|их)\\s+${NUMW}\\s+(дн(?:і|ів)|тижн(?:і|ів)|місяц(?:і|ів)|рок(?:и|ів))${E}`, 'repeat', (m) => {
    const u = m[2].toLowerCase();
    rule({ freq: u.startsWith('д') ? 'daily' : u.startsWith('т') ? 'weekly' : u.startsWith('м') ? 'monthly' : 'yearly', interval: num(m[1]) });
  });
  // «щопонеділка», «кожного понеділка», «кожен вівторок», «по понеділках і четвергах», «щопонеділка та п'ятниці».
  const anyDay = `(?:${DAY_STEMS.join('|')})`;
  claim(c, `${B}(?:що|кожн(?:ого|ої|ий|у|ен)\\s+)(${anyDay}(?:\\s*(?:,|і|й|та)\\s*${anyDay})*)${E}`, 'repeat', (m) => {
    const days = DAY_STEMS.map((st, d) => (new RegExp(st, 'iu').test(m[1]) ? d : -1)).filter((d) => d >= 0);
    if (!days.length) return false;
    rule({ freq: 'weekly', interval: 1, byWeekday: days });
  });
  claim(c, `${B}по\\s+((?:${DAY_PLURAL.join('|')})(?:\\s*(?:,|і|й|та)\\s*(?:${DAY_PLURAL.join('|')}))*)${E}`, 'repeat', (m) => {
    rule({ freq: 'weekly', interval: 1, byWeekday: DAY_PLURAL.map((p, d) => (m[1].toLowerCase().includes(p) ? d : -1)).filter((d) => d >= 0) });
  });
  // «кожного 15 числа», «щомісяця 1-го».
  claim(c, `${B}(?:кожного|щомісяця)\\s+${NUM}(?:-?(?:го|е))?(?:\\s+числа)?${E}`, 'repeat', (m) => {
    const d = nextMonthDay(today, Number(m[1]));
    if (!d) return false;
    rule({ freq: 'monthly', interval: 1 });
    o.date = d;
  });
  claim(c, `${B}(?:щотижня|щотижнево|кожного тижня|кожен тиждень)${E}`, 'repeat', () => rule({ freq: 'weekly', interval: 1 }));
  claim(c, `${B}(?:щомісяця|щомісячно|кожного місяця|кожен місяць)${E}`, 'repeat', () => rule({ freq: 'monthly', interval: 1 }));
  claim(c, `${B}(?:щороку|щорічно|кожного року|кожен рік)${E}`, 'repeat', () => rule({ freq: 'yearly', interval: 1 }));

  // From now: «через 2 години», «через 30 хв», «через годину».
  claim(c, `${B}через\\s+(?:${NUMW}\\s*|пів\\s*|півтори\\s+)?(хв(?:илин[уи]?)?|годин[уи]?|год)${E}`, 'time', (m) => {
    const half = /пів/i.test(m[0]) && !/півтори/i.test(m[0]);
    const mins = m[2].toLowerCase().startsWith('хв') ? num(m[1]) : (/півтори/i.test(m[0]) ? 1.5 : half ? 0.5 : num(m[1])) * 60;
    const at = new Date(c.now.getTime() + mins * 60_000);
    o.date = toDateKey(at);
    o.time = minutesToTime(at.getHours() * 60 + at.getMinutes());
  });

  // Time ranges: «з 10 до 12», «з 9:30 до 11», «10:00-11:30», «о 15–16».
  const T = `${NUM}(?:[:.](\\d{2}))?`;
  const PART = '(?:\\s+(ранку|вечора|дня|ночі))?';
  claim(c, `${B}з\\s+${T}${PART}\\s+до\\s+${T}${PART}${E}`, 'time', (m) => {
    const p = m[6] ?? m[3];
    if (setTime(c, ...hm(m[1], m[2]), m[3] ?? p) === false) return false;
    const start = o.time!;
    if (setTime(c, ...hm(m[4], m[5]), p) === false) return false;
    o.endTime = o.time;
    o.time = start;
  });
  claim(c, `(?:${B}(?:о|об|з)\\s+)?${NUM}[:.](\\d{2})\\s*[-–—]\\s*${T}${E}`, 'time', (m) => {
    if (setTime(c, ...hm(m[1], m[2])) === false) return false;
    const start = o.time!;
    if (setTime(c, ...hm(m[3], m[4])) === false) return false;
    o.endTime = o.time;
    o.time = start;
  });

  // Length: «на годину», «на 2 години», «на 1.5 год», «на півтори години», «на 45 хв», «на 1 год 30 хв».
  claim(c, `${B}(?:на|тривалістю)\\s+(?:${NUMW}(?:[.,](\\d))?\\s*)?(?:(годин[уиі]?|год)(?:\\s+(\\d{1,2})\\s*хв(?:илин[уи]?)?)?|(хв(?:илин[уи]?)?))${E}`, 'duration', (m) => {
    if (m[5]) o.duration = num(m[1]);
    else o.duration = Math.round((num(m[1]) + Number(m[2] ? `0.${m[2]}` : 0)) * 60) + Number(m[4] ?? 0);
  });
  claim(c, `${B}на\\s+(?:пів\\s*години|півгодини)${E}`, 'duration', () => void (o.duration = 30));
  claim(c, `${B}на\\s+півтори\\s+години${E}`, 'duration', () => void (o.duration = 90));

  // Dates. «до …» (deadline) reads the same as «на …».
  const PRE = '(?:(?:до|на|в|у|о|об)\\s+)?';
  claim(c, `${B}${PRE}(післязавтра|позавтра)${E}`, 'date', () => void (o.date = addDaysKey(today, 2)));
  claim(c, `${B}${PRE}завтра${E}`, 'date', () => void (o.date = addDaysKey(today, 1)));
  claim(c, `${B}${PRE}сьогодні${E}`, 'date', () => void (o.date = today));
  claim(c, `${B}(?:через|за)\\s+(?:${NUMW}\\s+)?(дн(?:і|ів|я)|день|тижн(?:і|ів|я)|тиждень|місяц(?:і|ів|я)|місяць|р(?:оки|оків|ік))${E}`, 'date', (m) => {
    const n = num(m[1]);
    const u = m[2].toLowerCase();
    o.date = u.startsWith('д') ? addDaysKey(today, n) : u.startsWith('т') ? addDaysKey(today, n * 7) : u.startsWith('м') ? addMonths(today, n) : addMonths(today, n * 12);
  });
  claim(c, `${B}(?:на|у|в)?\\s*(?:вихідних|вихідні)${E}`, 'date', () => void (o.date = [6, 0].includes(dow(today)) ? today : nextDow(today, 6)));
  claim(c, `${B}(?:на\\s+)?наступн(?:ого|ому)\\s+тижн(?:я|і)${E}`, 'date', () => void (o.date = nextWeekDow(today, 1)));
  claim(c, `${B}(?:на\\s+)?наступн(?:ого|ому)\\s+місяц(?:я|і)${E}`, 'date', () => void (o.date = addMonths(today.slice(0, 8) + '01', 1)));
  claim(c, `${B}(?:в|у|на)?\\s*кінці\\s+(?:цього\\s+)?(тижня|місяця)${E}`, 'date', (m) => {
    o.date = m[1].startsWith('т') ? thisWeekDow(today, 5) < today ? today : thisWeekDow(today, 5) : addDaysKey(addMonths(today.slice(0, 8) + '01', 1), -1);
  });
  // Weekdays: «у п'ятницю», «до середи», «наступного вівторка», «цього четверга», «в пт».
  claim(c, `${B}(?:(?:до|на|в|у|во)\\s+)?(?:(наступн\\p{L}*|цього|цієї|цей|цю|ця)\\s+)?(${DAY_STEMS.join('|')}|${DAY_SHORT.join('|')})${E}`, 'date', (m) => {
    const word = m[2].toLowerCase();
    const short = DAY_SHORT.indexOf(word);
    // A bare abbreviation («ср») only after a preposition, so it isn't taken from a title.
    if (short >= 0 && !/^\s*(до|на|в|у|во)\s/i.test(m[0])) return false;
    const d = short >= 0 ? short : DAY_STEMS.findIndex((st) => new RegExp(`^${st}$`, 'iu').test(word));
    if (d < 0) return false;
    const which = m[1]?.toLowerCase();
    o.date = which?.startsWith('наступ') ? nextWeekDow(today, d) : which ? thisWeekDow(today, d) : nextDow(today, d);
  });
  // «15 жовтня», «1-го листопада», «15 жовт.», «2 січня 2027».
  claim(c, `${B}${PRE}${NUM}(?:-?(?:го|е))?\\s+${MONTH_RX}(?:\\s+(\\d{4}))?(?![\\p{L}\\d'])`, 'date', (m) => {
    const k = dayMonth(today, Number(m[1]), monthIndex(m[2]) + 1, m[3] ? Number(m[3]) : undefined);
    if (!k) return false;
    o.date = k;
  });
  // «15.10», «15/10», «15.10.2026», «2026-10-15».
  claim(c, `${B}(\\d{4})-(\\d{2})-(\\d{2})${E}`, 'date', (m) => {
    const k = dayMonth(today, Number(m[3]), Number(m[2]), Number(m[1]));
    if (!k) return false;
    o.date = k;
  });
  // Not after «о»: «о 10.30» is a time.
  claim(c, `${B}(?:(?:до|на|в|у)\\s+)?${NUM}[./]${NUM}(?:[./](\\d{2,4}))?${E}`, 'date', (m) => {
    const y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : undefined;
    const k = dayMonth(today, Number(m[1]), Number(m[2]), y);
    if (!k) return false;
    o.date = k;
  });
  // «15 числа», «1-го» on its own: the next such day of the month.
  claim(c, `${B}${PRE}${NUM}(?:-?(?:го|е)(?:\\s+числа)?|\\s+числа)${E}`, 'date', (m) => {
    const k = nextMonthDay(today, Number(m[1]));
    if (!k) return false;
    o.date = k;
  });

  // Times.
  claim(c, `${B}(?:о|об|в|у)?\\s*(опівдні|опівночі)${E}`, 'time', (m) => setTime(c, m[1].toLowerCase() === 'опівдні' ? 12 : 0, 0));
  claim(c, `${B}(?:о|об|в|у)\\s+пів\\s+на\\s+(\\d{1,2}|${HOURS_ACC.join('|')})${PART}${E}`, 'time', (m) => {
    const h = /\d/.test(m[1]) ? Number(m[1]) : HOURS_ACC.indexOf(m[1].toLowerCase()) + 1;
    return setTime(c, (h + 23) % 24, 30, m[2]);
  });
  claim(c, `${B}(?:о|об)\\s+(${HOURS_LOC.join('|')})(?:\\s+(\\d{1,2})\\s*(?:хв(?:илин)?)?)?${PART}${E}`, 'time', (m) =>
    setTime(c, HOURS_LOC.indexOf(m[1].toLowerCase()) + 1, Number(m[2] ?? 0), m[3]),
  );
  claim(c, `${B}(?:о|об)\\s+${T}(?:\\s*(?:год(?:ині)?|h))?${PART}${E}`, 'time', (m) => setTime(c, ...hm(m[1], m[2]), m[3]));
  // «в/у/на» only with minutes, «год» or a part of the day, so «у 2 етапи» stays text.
  claim(c, `${B}(?:в|у|на)\\s+${NUM}(?::(\\d{2})|\\s*год(?:ині)?|(?=\\s+(?:ранку|вечора|дня|ночі)))${PART}${E}`, 'time', (m) => setTime(c, ...hm(m[1], m[2]), m[3]));
  claim(c, `${B}${NUM}:(\\d{2})${PART}${E}`, 'time', (m) => setTime(c, ...hm(m[1], m[2]), m[3]));
  claim(c, `${B}${NUM}\\s+(ранку|вечора|дня|ночі)${E}`, 'time', (m) => setTime(c, Number(m[1]), 0, m[2]));
  // Part of the day: sets the time if none was given, or moves «о 8» to the evening.
  claim(c, `${B}(вранці|зранку|уранці|ранком|вдень|удень|в обід|в обідню перерву|по обіді|після обіду|ввечері|увечері|вечором|вночі|уночі)${E}`, 'time', (m) => {
    const w = m[1].toLowerCase();
    c.part = /ран/.test(w) ? 'morning' : /веч/.test(w) ? 'evening' : /ноч/.test(w) ? 'night' : 'day';
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
  if (r && !o.date) {
    if (r.byWeekday?.length) o.date = r.byWeekday.map((d) => nextDow(today, d)).sort()[0];
    else o.date = today;
  }

  // Title: what's left, without connecting words stranded by the removed parts.
  let title = '';
  for (let i = 0; i < s.length; i++) title += c.used[i] ? ' ' : input[i];
  title = title
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(new RegExp(`(?:^|\\s)(?:і|й|та|а|о|об|на|до|в|у|з|за|о)\\s*$`, 'iu'), '')
    .replace(/^[\s,.;:—-]+|[\s,;:—-]+$/g, '')
    .trim();
  o.title = title.charAt(0).toLocaleUpperCase('uk') + title.slice(1);

  // What it is: an event when it has a range or length, or its title names a meeting and it has a time
  // (only whole words of the title: «ввечері» isn't «вечеря»).
  if (!o.kind && (o.endTime || o.duration)) o.kind = 'event';
  if (!o.kind && o.time && new RegExp(`${B}(?:${EVENT_WORDS})`, 'iu').test(title.replace(/[ʼ’`]/g, "'"))) o.kind = 'event';
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
