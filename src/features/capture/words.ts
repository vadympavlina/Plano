/** Vocabulary of the quick-capture parser: patterns, spelled-out numbers, month and weekday forms. */

// Word boundaries that work for Cyrillic (\b doesn't).
export const B = "(?<![\\p{L}\\d'#@])";
export const E = "(?![\\p{L}\\d'])";
export const NUM = '(\\d{1,2})';
export const IN = '(?:(?:до|на|в|у|во|к)\\s+)'; // prepositions before a day or date

/** Weekday stems, index = JS day (0 = Sunday): «у середу», «до середи», «щосереди», ru «в среду». */
export const DAY_STEMS = [
  'неділ[юяіь]|воскресень[еяю]|воскресенья',
  'понеділ(?:ок|ка)|понедельник(?:а)?',
  'вівтор(?:ок|ка)|вторник(?:а)?',
  'серед[уиа]|сред[ауы]',
  'четвер(?:га)?|четверг(?:а)?',
  "п'ятниц[юіяь]|пятниц[уыа]",
  'субот[уиа]|суббот[уыа]',
];
export const DAY_RX = DAY_STEMS.map((s) => new RegExp(`^(?:${s})$`, 'iu'));
export const DAY_PLURAL = ['неділях', 'понеділках', 'вівторках', 'середах', 'четвергах', "п'ятницях", 'суботах'];
export const DAY_SHORT = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
export const DAY_EN = ['sun(?:day)?', 'mon(?:day)?', 'tue(?:sday)?', 'wed(?:nesday)?', 'thu(?:rsday)?', 'fri(?:day)?', 'sat(?:urday)?'];
export const dayIndex = (w: string) => {
  const s = w.toLowerCase();
  const short = DAY_SHORT.indexOf(s);
  if (short >= 0) return short;
  const en = DAY_EN.findIndex((p) => new RegExp(`^${p}$`, 'i').test(s));
  return en >= 0 ? en : DAY_RX.findIndex((r) => r.test(s));
};
// Genitive and short forms only, so «2 червоних яблука» isn't read as June.
export const MONTHS = [
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
export const MONTH_RX = `(${MONTHS.flat().join('|')})\\.?`;
export const monthIndex = (word: string) => MONTHS.findIndex((forms) => forms.includes(word.toLowerCase()));
// Spoken hours: «о третій», «о пів на восьму».
export const HOURS_LOC = [
  'першій',
  'другій',
  'третій',
  'четвертій',
  "п'ятій",
  'шостій',
  'сьомій',
  'восьмій',
  "дев'ятій",
  'десятій',
  'одинадцятій',
  'дванадцятій',
];
export const HOURS_ACC = ['першу', 'другу', 'третю', 'четверту', "п'яту", 'шосту', 'сьому', 'восьму', "дев'яту", 'десяту', 'одинадцяту', 'дванадцяту'];
export const HOURS_GEN = [
  'першої',
  'другої',
  'третьої',
  'четвертої',
  "п'ятої",
  'шостої',
  'сьомої',
  'восьмої',
  "дев'ятої",
  'десятої',
  'одинадцятої',
  'дванадцятої',
];
/** An hour as digits or a spoken word («третьої», «третій»). */
export const hourOf = (w: string) => (/^\d/.test(w) ? Number(w) : Math.max(HOURS_GEN.indexOf(w.toLowerCase()), HOURS_LOC.indexOf(w.toLowerCase())) + 1);
export const RT = `(\\d{1,2}|${[...HOURS_GEN, ...HOURS_LOC].join('|')})(?:[:.](\\d{2}))?`;
export const WORD_NUM: Record<string, number> = {
  один: 1,
  одну: 1,
  одна: 1,
  два: 2,
  дві: 2,
  двох: 2,
  три: 3,
  трьох: 3,
  чотири: 4,
  "п'ять": 5,
  шість: 6,
  сім: 7,
  вісім: 8,
  "дев'ять": 9,
  десять: 10,
  пару: 2,
  кілька: 3,
  декілька: 3,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  две: 2,
  четыре: 4,
};
export const NUMW = `(\\d+|${Object.keys(WORD_NUM).join('|')})`;
export const num = (s?: string) => (s == null ? 1 : (WORD_NUM[s.toLowerCase()] ?? Number(s)));
export const PART = '(?:\\s*(ранку|вечора|дня|ночі|утра|вечера|ночи|am|pm))?';
export const T = `${NUM}(?:[:.](\\d{2})|\\s+(\\d{2})(?=\\s*(?:год|$)))?`; // 15, 15:30, 15.30, «15 30 год»
// Events, not tasks, when the title names one and there's a time.
export const EVENT_WORDS =
  "зустріч|нарад|дзвін|созвон|колл|call|meeting|мітинг|вебінар|лекці|семінар|урок|прийом|лікар|стоматолог|співбесід|інтерв'ю|презентаці|конференці|концерт|кіно|театр|вечер[яюі]|обід|сніданок|рейс|поїзд|потяг|літак|день народження|свят|встреч|совещан|врач|бронь|візит|сесі|тренування з";

export const EVENT_RX = new RegExp(`${B}(?:${EVENT_WORDS})`, 'iu');
