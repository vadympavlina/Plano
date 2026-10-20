import { addDaysKey, fromDateKey, minutesToTime } from '@/lib/date';
import type { DateKey, Priority, TimeString } from '@/types';

/** What a quick-add line says besides the title: «Зустріч завтра о 15 на годину #робота». */
export interface ParsedQuick {
  title: string;
  date?: DateKey;
  time?: TimeString;
  /** Minutes; set by «на годину», «на 30 хв». */
  duration?: number;
  /** Words after # (without it). */
  tags: string[];
  priority?: Priority;
}

const B = '(?<![\\p{L}\\d])';
const E = '(?![\\p{L}\\d])';
const rx = (s: string) => new RegExp(B + s + E, 'iu');

const WEEKDAYS: [RegExp, number][] = [
  [/понеділ(?:ок|ка)/, 1],
  [/вівтор(?:ок|ка)/, 2],
  [/серед[уа]/, 3],
  [/четвер/, 4],
  [/п[''ʼ’]?ятниц[юя]/, 5],
  [/субот[уа]/, 6],
  [/неділ[юя]/, 0],
];
const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const pad = (n: number) => String(n).padStart(2, '0');
// Dictation spells hours out: «о третій дня», «о дев'ятій ранку».
const HOURS = ['першій', 'другій', 'третій', 'четвертій', "п'ятій", 'шостій', 'сьомій', 'восьмій', "дев'ятій", 'десятій', 'одинадцятій', 'дванадцятій'];
const spoken = (t: string) =>
  t
    .replace(new RegExp(`${B}(?:хештег|хеш тег|тег)\\s+`, 'giu'), '#')
    .replace(
      new RegExp(`${B}(о|об)\\s+(${HOURS.map((h) => h.replace("'", "[ʼ’'`]")).join('|')})${E}`, 'giu'),
      (_, o: string, h: string) => `${o} ${HOURS.indexOf(h.toLowerCase().replace(/[ʼ’`]/, "'")) + 1}`,
    );

/** Pulls dates, times, durations, #tags and !! priority out of a quick-add line. */
export function parseQuick(input: string, today: DateKey): ParsedQuick {
  let text = ` ${spoken(input)} `;
  const out: ParsedQuick = { title: '', tags: [] };
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    const m = text.match(re);
    if (m && fn(m) !== false) text = text.replace(m[0], ' ');
  };
  const year = Number(today.slice(0, 4));
  const future = (m: number, d: number, y?: number) => {
    let key = `${y ?? year}-${pad(m)}-${pad(d)}`;
    if (!y && key < today) key = `${year + 1}-${pad(m)}-${pad(d)}`;
    return Number.isNaN(fromDateKey(key).getTime()) || fromDateKey(key).getDate() !== d ? undefined : key;
  };

  for (let m; (m = text.match(/(^|\s)#([\p{L}\d_-]+)/u)); ) {
    out.tags.push(m[2]);
    text = text.replace(m[0], ' ');
  }
  take(/(^|\s)(!{2,3})(?=\s)/u, (m) => void (out.priority = m[2].length === 3 ? 'urgent' : 'high'));

  // Duration first, so «на 2 години» isn't read as a time.
  take(rx('на\\s+півгодини'), () => void (out.duration = 30));
  take(rx('на\\s+(\\d+(?:[.,]5)?)?\\s*(годин[уиі]?|год)'), (m) => void (out.duration = Math.round(Number((m[1] ?? '1').replace(',', '.')) * 60)));
  take(rx('на\\s+(\\d+)\\s*(хвилин[уи]?|хв)'), (m) => void (out.duration = Number(m[1])));

  // Dates.
  take(rx('післязавтра'), () => void (out.date = addDaysKey(today, 2)));
  take(rx('завтра'), () => void (out.date = addDaysKey(today, 1)));
  take(rx('сьогодні'), () => void (out.date = today));
  take(rx('через\\s+(\\d+)?\\s*(дн[іяь]{1,2}|день|тижн[іь]{1,2}|тиждень)'), (m) => {
    const n = Number(m[1] ?? 1);
    out.date = addDaysKey(today, /^т/i.test(m[2]) ? n * 7 : n);
  });
  for (const [re, dow] of WEEKDAYS) {
    take(new RegExp(`${B}(?:(?:в|у|во)\\s+)?(наступн(?:ий|у|ого)\\s+)?${re.source}${E}`, 'iu'), (m) => {
      const diff = (dow - fromDateKey(today).getDay() + 7) % 7;
      out.date = addDaysKey(today, diff + (m[1] ? 7 : 0));
    });
    if (out.date) break;
  }
  take(rx(`(\\d{1,2})\\s+(${MONTHS.join('|')})`), (m) => {
    const key = future(MONTHS.indexOf(m[2].toLowerCase()) + 1, Number(m[1]));
    if (!key) return false;
    out.date = key;
  });
  take(rx('(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{2,4}))?'), (m) => {
    const y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : undefined;
    const key = future(Number(m[2]), Number(m[1]), y);
    if (!key) return false;
    out.date = key;
  });

  // Time: «о 15», «об 11:30», «в 9 ранку», «о 7 вечора», or a bare «15:30».
  const setTime = (h: number, min: number, part?: string) => {
    if (part && /веч|дня/i.test(part) && h < 12) h += 12;
    if (part && /ноч/i.test(part) && h === 12) h = 0;
    if (h > 23 || min > 59) return false;
    out.time = minutesToTime(h * 60 + min);
  };
  take(rx('(?:о|об)\\s+(\\d{1,2})(?:[:.](\\d{2}))?(?:\\s+(ранку|вечора|дня|ночі))?'), (m) => setTime(Number(m[1]), Number(m[2] ?? 0), m[3]));
  // «в/у/на» only with minutes or a part of the day, so «у 2 етапи» stays text.
  if (!out.time) take(rx('(?:в|у|на)\\s+(\\d{1,2})(?::(\\d{2})|\\s+(ранку|вечора|дня|ночі))'), (m) => setTime(Number(m[1]), Number(m[2] ?? 0), m[3]));
  if (!out.time) take(rx('(\\d{1,2}):(\\d{2})'), (m) => setTime(Number(m[1]), Number(m[2])));

  out.title = text.replace(/\s+/g, ' ').trim();
  return out;
}
