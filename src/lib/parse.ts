import {
  getAiConfig,
  logAiJsonMetrics,
  requestAiJson,
} from '@/lib/ai-provider';
import {
  DEFAULT_EVENT_MINUTES,
  DEFAULT_TIMEZONE,
  MONTH_NAMES_EN,
  PRIORITIES,
} from '@/lib/constants';
import { addMinutes, getDurationMinutes } from '@/lib/time';
import type {
  GroupKey,
  ParseExtractedFields,
  ParseResponse,
  ParseResult,
  Priority,
} from '@/lib/types';

type PartialParseResult = Partial<ParseResult> & {
  ambiguity_reason?: unknown;
  confidence?: unknown;
  due_date?: unknown;
  end_at?: unknown;
  estimated_minutes?: unknown;
  group_key?: unknown;
  is_all_day?: unknown;
  location?: unknown;
  needs_confirmation?: unknown;
  notes?: unknown;
  priority?: unknown;
  start_at?: unknown;
  title?: unknown;
  type?: unknown;
};

export type TemporalIntentKind =
  | 'none'
  | 'specific_day'
  | 'specific_day_with_time'
  | 'vague_window';

type TemporalIntent = {
  ambiguityReason: string | null;
  dueDate: string | null;
  endAt: string | null;
  kind: TemporalIntentKind;
  needsConfirmation: boolean;
  startAt: string | null;
};

type TimeRange = {
  end: string | null;
  start: string;
};

const PRIORITY_SET = new Set(PRIORITIES);
const CHINESE_NUMBER_MAP: Record<string, number> = {
  '\u4e00': 1,
  '\u4e03': 7,
  '\u4e09': 3,
  '\u4e24': 2,
  '\u4fe9': 2,
  '\u4e5d': 9,
  '\u4e8c': 2,
  '\u4e94': 5,
  '\u516b': 8,
  '\u516d': 6,
  '\u5341': 10,
  '\u56db': 4,
  '\u96f6': 0,
  '\u3007': 0,
};
const CHINESE_LOCATION_BOUNDARY =
  '(?:\\u89c1(?:\\u9762)?|\\u96c6\\u5408|\\u4f1a\\u5408|\\u5f00(?:\\u7ec4)?\\u4f1a|\\u7ec4\\u4f1a|\\u4e0a\\u8bfe|\\u8ba8\\u8bba|\\u5403\\u996d|\\u5c31\\u8bca|\\u953b\\u70bc|\\u6c47\\u62a5|\\u78b0\\u5934|\\u590d\\u4e60|\\u5199|\\u505a|\\u53c2\\u52a0|\\u770b|\\u804a|\\u7ea6|\\u62dc\\u8bbf|\\u63d0\\u4ea4|\\u5904\\u7406|\\u5b8c\\u6210|\\u5f00\\u59cb|\\u7ee7\\u7eed|\\u8ddf|\\u548c|\\u7ed9|\\u5411|$)';
const ENGLISH_LOCATION_BOUNDARY =
  '(?:for|with|to|meeting|meet|discuss|review|study|call|class|lecture|presentation|doctor|dentist|work(?:ing)?|shopping|dinner|lunch|breakfast|$)';

const EN_WEEKDAY_TO_INDEX: Record<string, number> = {
  fri: 5,
  friday: 5,
  mon: 1,
  monday: 1,
  sat: 6,
  saturday: 6,
  sun: 0,
  sunday: 0,
  thu: 4,
  thursday: 4,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
};

const ZH_WEEKDAY_TO_INDEX: Record<string, number> = {
  '\u4e00': 1,
  '\u4e09': 3,
  '\u4e8c': 2,
  '\u516d': 6,
  '\u56db': 4,
  '\u5929': 0,
  '\u4e94': 5,
  '\u65e5': 0,
};

function parseJson<T>(content: string | null | undefined) {
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function sanitizePriority(value: unknown): Priority {
  return typeof value === 'string' && PRIORITY_SET.has(value as Priority)
    ? (value as Priority)
    : 'medium';
}

function sanitizeMinutes(value: unknown, fallback: number | null) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }

  return fallback;
}

function normalizeSpacing(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function locationFromMatch(value: string | undefined) {
  if (!value) {
    return '';
  }

  return normalizeSpacing(value)
    .trim()
    .replace(/^(the\s+)/i, '')
    .replace(/^(?:from\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\s+(?:at|in)\s+/i, '')
    .replace(
      /^(?:today|tomorrow|day after tomorrow|tonight|this evening|next week|this week|next month|this month)\s+/i,
      ''
    )
    .replace(
      /\b(?:from\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)(?:\s*(?:to|until|through|-|\u2013)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b/gi,
      ' '
    )
    .replace(
      /\b(?:today|tomorrow|day after tomorrow|tonight|this evening|next|this|next week|this week|next month|this month|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/gi,
      ' '
    )
    .replace(
      /(?:\u4eca\u5929|\u660e\u5929|\u540e\u5929|\u4eca\u665a|\u4eca\u591c|\u4eca\u665a\u4e0a|\u660e\u665a|\u4e0b\u5468|\u8fd9\u5468|\u672c\u5468|\u4e0b\u4e2a?\u6708|\u8fd9\u4e2a?\u6708|\u672c\u6708)/gu,
      ' '
    )
    .replace(
      /(?:(?:\u51cc\u6668|\u65e9\u4e0a|\u4e0a\u5348|\u4e2d\u5348|\u4e0b\u5348|\u665a\u4e0a)\s*)?\d{1,2}\s*(?:(?::|\uFF1A)\d{1,2}|\u70b9(?:(\d{1,2})\u5206?)?(\u534a)?)(?:\s*(?:\u5230|\u81f3|~|\uFF5E|-)\s*(?:(?:\u51cc\u6668|\u65e9\u4e0a|\u4e0a\u5348|\u4e2d\u5348|\u4e0b\u5348|\u665a\u4e0a)\s*)?\d{1,2}\s*(?:(?::|\uFF1A)\d{1,2}|\u70b9(?:(\d{1,2})\u5206?)?(\u534a)?))?/gu,
      ' '
    )
    .replace(
      /(?:\u89c1(?:\u9762)?|\u96c6\u5408|\u4f1a\u5408|\u5f00(?:\u7ec4)?\u4f1a|\u7ec4\u4f1a|\u4e0a\u8bfe|\u8ba8\u8bba|\u5403\u996d|\u5c31\u8bca|\u953b\u70bc|\u6c47\u62a5|\u78b0\u5934|\u590d\u4e60|\u5199|doing|do|for|with|to|meeting|meet|discuss|review|study|call|class|lecture|presentation|doctor|dentist|work(?:ing)?|shopping|dinner|lunch|breakfast).*$/giu,
      ''
    )
    .replace(/^[,.;:，。；：\-\s]+|[,.;:，。；：\-\s]+$/gu, '')
    .replace(/\b(?:at|in|on|from|to|for|with)\b\s*$/i, '')
    .slice(0, 120);
}

function parseChineseNumberToken(value: string) {
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  if (!value) {
    return null;
  }

  if (value === '\u5341') {
    return 10;
  }

  if (value.includes('\u5341')) {
    const [tensToken, onesToken] = value.split('\u5341');
    const tens = tensToken ? CHINESE_NUMBER_MAP[tensToken] : 1;
    const ones = onesToken ? CHINESE_NUMBER_MAP[onesToken] : 0;

    if (tens === undefined || ones === undefined) {
      return null;
    }

    return tens * 10 + ones;
  }

  const digits = [...value].map((char) => CHINESE_NUMBER_MAP[char]);
  return digits.every((digit) => digit !== undefined)
    ? Number(digits.join(''))
    : null;
}

function normalizeTemporalText(text: string) {
  return text.replace(
    /([\u96f6\u3007\u4e00\u4e8c\u4e24\u4fe9\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]{1,3})(?=\s*(?:\u70b9|\u65f6|\u6708|\u65e5|\u53f7|\u5206|(?:\u4e2a)?\s*\u534a?\s*\u5c0f\u65f6|\u5c0f\u65f6\s*\u534a))/gu,
    (match) => {
      const parsed = parseChineseNumberToken(match);
      return parsed === null ? match : String(parsed);
    }
  );
}

function parseExplicitDurationMinutes(text: string) {
  const normalized = normalizeTemporalText(text.toLowerCase());

  const chineseHourHalfBeforeHourMatch = normalized.match(
    /(\d{1,2})\s*(?:\u4e2a)?\s*\u534a\s*\u5c0f\u65f6/u
  );
  if (chineseHourHalfBeforeHourMatch) {
    return Number(chineseHourHalfBeforeHourMatch[1]) * 60 + 30;
  }

  const chineseHourHalfMatch = normalized.match(
    /(\d{1,2})\s*(?:\u4e2a)?\s*\u5c0f\u65f6\s*\u534a/u
  );
  if (chineseHourHalfMatch) {
    return Number(chineseHourHalfMatch[1]) * 60 + 30;
  }

  if (/\u534a\s*(?:\u4e2a)?\s*\u5c0f\u65f6/u.test(normalized)) {
    return 30;
  }

  const chineseHourMatch = normalized.match(/(\d{1,2})\s*(?:\u4e2a)?\s*\u5c0f\u65f6/u);
  if (chineseHourMatch) {
    return Number(chineseHourMatch[1]) * 60;
  }

  const chineseMinuteMatch = normalized.match(/(\d{1,3})\s*(?:\u5206\u949f|\u5206)\b/u);
  if (chineseMinuteMatch) {
    return Number(chineseMinuteMatch[1]);
  }

  const englishHourMinuteMatch = normalized.match(
    /\bfor\s+(\d{1,2})\s*(?:hours?|hrs?)(?:\s+(\d{1,2})\s*(?:minutes?|mins?))?\b/i
  );
  if (englishHourMinuteMatch) {
    return Number(englishHourMinuteMatch[1]) * 60 + Number(englishHourMinuteMatch[2] ?? '0');
  }

  const englishMinuteMatch = normalized.match(/\bfor\s+(\d{1,3})\s*(?:minutes?|mins?)\b/i);
  if (englishMinuteMatch) {
    return Number(englishMinuteMatch[1]);
  }

  return null;
}

function stripTemporalPhrases(text: string) {
  const normalized = normalizeTemporalText(text);

  return [
    /\b20\d{2}-\d{2}-\d{2}\b/giu,
    /(?:(?:\u4e0b\u5468|\u8fd9\u5468|\u672c\u5468)\s*)?(?:\u661f\u671f|\u5468|\u793c\u62dc)\s*[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u65e5\u5929]/gu,
    /(?:\u4eca\u5929|\u660e\u5929|\u540e\u5929|\u4eca\u665a|\u4eca\u591c|\u4eca\u665a\u4e0a|\u660e\u665a)/gu,
    /\b(?:(?:next|this)\s+)?(?:monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/giu,
    /\b(?:today|tomorrow|day after tomorrow|tonight|this evening)\b/giu,
    /(?:(?:\u51cc\u6668|\u65e9\u4e0a|\u4e0a\u5348|\u4e2d\u5348|\u4e0b\u5348|\u665a\u4e0a)\s*)?\d{1,2}\s*(?:(?::|\uFF1A)\d{1,2}|(?:\u70b9(?:(\d{1,2})\u5206?)?(\u534a)?))(?:\s*(?:\u5230|\u81f3|~|\uFF5E|-)\s*(?:(?:\u51cc\u6668|\u65e9\u4e0a|\u4e0a\u5348|\u4e2d\u5348|\u4e0b\u5348|\u665a\u4e0a)\s*)?\d{1,2}\s*(?:(?::|\uFF1A)\d{1,2}|(?:\u70b9(?:(\d{1,2})\u5206?)?(\u534a)?)))?/gu,
    /\b(?:from\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*(?:to|until|through|-|\u2013)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/giu,
    /\b(?:from\s+)?(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:to|until|through|-|\u2013)\s*(?:[01]?\d|2[0-3]):[0-5]\d\b/giu,
    /\b(?:for\s+\d{1,3}\s*(?:minutes?|mins?|hours?|hrs?))\b/giu,
    /(?:\d{1,2}\s*(?:\u4e2a)?\s*\u534a\s*\u5c0f\u65f6|\d{1,2}\s*(?:\u4e2a)?\s*\u5c0f\u65f6\s*\u534a|\u534a\s*(?:\u4e2a)?\s*\u5c0f\u65f6|\d{1,3}\s*(?:\u4e2a)?\s*\u5c0f\u65f6|\d{1,3}\s*(?:\u5206\u949f|\u5206))/gu,
  ].reduce((current, pattern) => current.replace(pattern, ' '), normalized)
    .replace(/^(?:\u4e0b|\u4e0a)\s+/u, ' ');
}

function stripLocationPhrases(text: string) {
  return text
    .replace(
      new RegExp(`\\u5728\\s*([^,\\u3002\\uFF0C\\uFF1B;\\n]+?)(?=${CHINESE_LOCATION_BOUNDARY})`, 'gu'),
      ' '
    )
    .replace(
      /\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\s+in\s+([^,.;\n]+?)(?=(?:\s+for|\s+with|[,.;\n]|$))/gi,
      ' '
    )
    .replace(
      new RegExp(`\\b(?:at|in)\\s+([^,.;\\n]+?)(?=(?:\\s+${ENGLISH_LOCATION_BOUNDARY})|[,.;\\n]|$)`, 'gi'),
      ' '
    );
}

export function titleFromText(text: string) {
  const stripped = normalizeSpacing(
    stripLocationPhrases(stripTemporalPhrases(text))
      .replace(/^[,.;:，。；：\-\s]+|[,.;:，。；：\-\s]+$/gu, '')
      .replace(
        /^(?:\u8bf7|\u5e2e\u6211|\u5e2e\u5fd9|\u8bb0\u5f97|\u5b89\u6392|\u6211\u8981|\u6211\u60f3|\u9700\u8981|\u5c3d\u5feb|\u9a6c\u4e0a|\u7acb\u5373|please|need to|remember to|schedule|urgent|asap|immediately)\s+/iu,
        ''
      )
      .replace(/\b(?:on|at|in|from|to|for|with)\b\s*$/i, '')
  );

  if (stripped) {
    return stripped.slice(0, 120);
  }

  return normalizeSpacing(text).slice(0, 120);
}

export function inferLocation(text: string) {
  const normalized = normalizeTemporalText(text);
  const chineseMatch = normalized.match(
    new RegExp(`\\u5728\\s*([^,\\u3002\\uFF0C\\uFF1B;\\n]+?)(?=${CHINESE_LOCATION_BOUNDARY})`, 'u')
  );
  if (chineseMatch) {
    return locationFromMatch(chineseMatch[1]);
  }

  const englishTimeThenLocationMatch = normalized.match(
    /\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\s+in\s+([^,.;\n]+?)(?=(?:\s+for|\s+with|[,.;\n]|$))/i
  );
  if (englishTimeThenLocationMatch) {
    return locationFromMatch(englishTimeThenLocationMatch[1]);
  }

  const englishMatch = normalized.match(
    new RegExp(`\\b(?:at|in)\\s+([^,.;\\n]+?)(?=(?:\\s+${ENGLISH_LOCATION_BOUNDARY})|[,.;\\n]|$)`, 'i')
  );
  if (englishMatch) {
    return locationFromMatch(englishMatch[1]);
  }

  return '';
}

function inferGroup(text: string): GroupKey {
  const normalized = text.toLowerCase();

  if (/\u8bba\u6587|\u4f5c\u4e1a|\u8003\u8bd5|study|assignment|course|class|lecture|\u5bfc\u5e08|\u590d\u4e60/u.test(normalized)) {
    return 'study';
  }

  if (/meeting|client|project|review|\u5de5\u4f5c|\u5f00\u4f1a|\u6c47\u62a5|\u9700\u6c42/u.test(normalized)) {
    return 'work';
  }

  if (/gym|doctor|\u533b\u9662|\u8dd1\u6b65|\u5065\u8eab|\u4f53\u68c0/u.test(normalized)) {
    return 'health';
  }

  if (/buy|shop|grocer|\u670b\u53cb|\u7535\u5f71|\u751f\u6d3b|\u91c7\u8d2d|\u4e70|\u505a\u996d/u.test(normalized)) {
    return 'life';
  }

  return 'other';
}

function inferPriority(text: string): Priority {
  const normalized = text.toLowerCase();

  if (/urgent|asap|today|\u4eca\u665a|\u4eca\u5929|\u9a6c\u4e0a|\u5c3d\u5feb|\u7acb\u523b/u.test(normalized)) {
    return 'high';
  }

  if (/tomorrow|\u660e\u5929|next week|\u4e0b\u5468/u.test(normalized)) {
    return 'medium';
  }

  return 'low';
}

function inferEstimatedMinutes(text: string, type: 'todo' | 'event') {
  const explicitDuration = parseExplicitDurationMinutes(text);
  if (explicitDuration) {
    return explicitDuration;
  }

  const normalized = text.toLowerCase();

  if (/meeting|\u5f00\u4f1a|\u8ba8\u8bba|\u6c9f\u901a|call/u.test(normalized)) {
    return 60;
  }

  if (/essay|assignment|\u8bba\u6587|\u4f5c\u4e1a|coding|\u7f16\u7801|\u590d\u4e60/u.test(normalized)) {
    return 120;
  }

  if (/buy|\u4e70|grocer|\u6253\u5370|\u6253\u5370\u7eb8/u.test(normalized)) {
    return 30;
  }

  return type === 'event' ? DEFAULT_EVENT_MINUTES : 45;
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function cloneStartOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeekMonday(value: Date) {
  const date = cloneStartOfDay(value);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date;
}

function addCalendarDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function getOffsetMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((accumulator, part) => {
      if (part.type !== 'literal') {
        accumulator[part.type] = part.value;
      }

      return accumulator;
    }, {});

  const zonedUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return (zonedUtc - date.getTime()) / 60000;
}

function buildIsoDateTime(date: string, time: string, timezone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second] = time.split(':').map(Number);
  const baselineUtc = Date.UTC(year, month - 1, day, hour, minute, second || 0);
  const firstPass = baselineUtc - getOffsetMinutes(new Date(baselineUtc), timezone) * 60_000;
  const secondPass = baselineUtc - getOffsetMinutes(new Date(firstPass), timezone) * 60_000;
  return new Date(secondPass).toISOString();
}

function parseMonthNameDate(text: string, currentYear: number) {
  const normalized = text.toLowerCase();

  for (const [index, monthName] of MONTH_NAMES_EN.entries()) {
    const pattern = new RegExp(`${monthName.toLowerCase()}\\s+(\\d{1,2})`, 'i');
    const match = normalized.match(pattern);
    if (match) {
      const day = Number(match[1]);
      const date = new Date(currentYear, index, day);
      return formatIsoDate(date);
    }
  }

  return null;
}

function resolveWeekdayDate(
  targetDay: number,
  now: Date,
  modifier: 'next' | 'same_or_next'
) {
  const weekStart = startOfWeekMonday(now);
  const mondayOffset = targetDay === 0 ? 6 : targetDay - 1;

  if (modifier === 'next') {
    return formatIsoDate(addCalendarDays(weekStart, 7 + mondayOffset));
  }

  const candidate = addCalendarDays(weekStart, mondayOffset);
  if (candidate.getTime() < cloneStartOfDay(now).getTime()) {
    candidate.setDate(candidate.getDate() + 7);
  }

  return formatIsoDate(candidate);
}

function inferSpecificDate(text: string, now: Date) {
  const normalized = text.toLowerCase();

  const isoMatch = normalized.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const chineseYearMatch = normalized.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/u);
  if (chineseYearMatch) {
    const date = new Date(
      Number(chineseYearMatch[1]),
      Number(chineseYearMatch[2]) - 1,
      Number(chineseYearMatch[3])
    );
    return formatIsoDate(date);
  }

  const chineseMonthDayMatch = normalized.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/u);
  if (chineseMonthDayMatch) {
    const date = new Date(
      now.getFullYear(),
      Number(chineseMonthDayMatch[1]) - 1,
      Number(chineseMonthDayMatch[2])
    );
    return formatIsoDate(date);
  }

  const chineseRelativeWeekdayMatch = normalized.match(
    /(?:(\u4e0b\u5468|\u8fd9\u5468|\u672c\u5468)\s*)?(?:\u661f\u671f|\u5468|\u793c\u62dc)\s*([一二三四五六日天])/u
  );
  if (chineseRelativeWeekdayMatch) {
    const modifier = chineseRelativeWeekdayMatch[1] === '\u4e0b\u5468' ? 'next' : 'same_or_next';
    const weekday = ZH_WEEKDAY_TO_INDEX[chineseRelativeWeekdayMatch[2]];
    if (weekday !== undefined) {
      return resolveWeekdayDate(weekday, now, modifier);
    }
  }

  const englishWeekdayMatch = normalized.match(
    /\b(?:(next|this)\s+)?(monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/i
  );
  if (englishWeekdayMatch) {
    const modifier = englishWeekdayMatch[1]?.toLowerCase() === 'next' ? 'next' : 'same_or_next';
    const weekday = EN_WEEKDAY_TO_INDEX[englishWeekdayMatch[2].toLowerCase()];
    if (weekday !== undefined) {
      return resolveWeekdayDate(weekday, now, modifier);
    }
  }

  if (/\bday after tomorrow\b|\u540e\u5929/u.test(normalized)) {
    return formatIsoDate(addCalendarDays(now, 2));
  }

  if (/\btomorrow\b|\u660e\u5929/u.test(normalized)) {
    return formatIsoDate(addCalendarDays(now, 1));
  }

  if (
    /\btoday\b|\btonight\b|\bthis evening\b|\u4eca\u5929|\u4eca\u665a|\u4eca\u591c|\u4eca\u665a\u4e0a/u.test(
      normalized
    )
  ) {
    return formatIsoDate(now);
  }

  return parseMonthNameDate(text, now.getFullYear());
}

function containsBroadWindow(text: string) {
  return (
    /\b(next week|this week|next month|this month|later|sometime|upcoming week)\b/i.test(text) ||
    /(?:\u4e0b\u5468(?![一二三四五六日天])|\u8fd9\u5468(?![一二三四五六日天])|\u672c\u5468(?![一二三四五六日天])|\u4e0b\u4e2a?月|\u8fd9\u4e2a?月|\u672c月|\u8fd1\u671f|\u6700\u8fd1|\u5468\u5185|\u6539\u5929)/u.test(
      text
    )
  );
}

function resolveChineseMinute(
  colonMinute: string | undefined,
  minuteAfterDian: string | undefined,
  halfToken: string | undefined
) {
  if (typeof colonMinute === 'string') {
    return Number(colonMinute);
  }

  if (typeof minuteAfterDian === 'string') {
    return Number(minuteAfterDian);
  }

  if (halfToken) {
    return 30;
  }

  return 0;
}

function toTwentyFourHour(
  hour: number,
  meridiem: string | null,
  source: 'english' | 'chinese'
) {
  if (source === 'english') {
    if (meridiem === 'pm' && hour < 12) {
      return hour + 12;
    }

    if (meridiem === 'am' && hour === 12) {
      return 0;
    }

    return hour;
  }

  switch (meridiem) {
    case '\u51cc\u6668':
    case '\u65e9\u4e0a':
    case '\u4e0a\u5348':
      return hour === 12 ? 0 : hour;
    case '\u4e2d\u5348':
      return hour < 11 ? hour + 12 : hour;
    case '\u4e0b\u5348':
    case '\u665a\u4e0a':
      return hour < 12 ? hour + 12 : hour;
    default:
      return hour;
  }
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

export function parseTimeRange(text: string): TimeRange | null {
  const chineseRange = text.match(
    /(?:(\u51cc\u6668|\u65e9\u4e0a|\u4e0a\u5348|\u4e2d\u5348|\u4e0b\u5348|\u665a\u4e0a)\s*)?(\d{1,2})(?:(?::|：)(\d{1,2})|点(?:(\d{1,2})分?)?(半)?)?\s*(?:到|至|~|～|-)\s*(?:(\u51cc\u6668|\u65e9\u4e0a|\u4e0a\u5348|\u4e2d\u5348|\u4e0b\u5348|\u665a\u4e0a)\s*)?(\d{1,2})(?:(?::|：)(\d{1,2})|点(?:(\d{1,2})分?)?(半)?)?/u
  );
  if (chineseRange) {
    const startPeriod = chineseRange[1] ?? null;
    const startHour = Number(chineseRange[2]);
    const startMinute = resolveChineseMinute(chineseRange[3], chineseRange[4], chineseRange[5]);
    const endPeriod = chineseRange[6] ?? startPeriod;
    const endHour = Number(chineseRange[7]);
    const endMinute = resolveChineseMinute(chineseRange[8], chineseRange[9], chineseRange[10]);

    return {
      end: formatTime(toTwentyFourHour(endHour, endPeriod, 'chinese'), endMinute),
      start: formatTime(toTwentyFourHour(startHour, startPeriod, 'chinese'), startMinute),
    };
  }

  const englishRange = text.match(
    /\b(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:to|until|through|-|–)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i
  );
  if (englishRange) {
    const startMeridiem = englishRange[3].toLowerCase();
    const endMeridiem = (englishRange[6] ?? englishRange[3]).toLowerCase();

    return {
      end: formatTime(
        toTwentyFourHour(Number(englishRange[4]), endMeridiem, 'english'),
        Number(englishRange[5] ?? '0')
      ),
      start: formatTime(
        toTwentyFourHour(Number(englishRange[1]), startMeridiem, 'english'),
        Number(englishRange[2] ?? '0')
      ),
    };
  }

  const militaryRange = text.match(
    /\b(?:from\s+)?([01]?\d|2[0-3]):([0-5]\d)\s*(?:to|until|through|-|–)\s*([01]?\d|2[0-3]):([0-5]\d)\b/i
  );
  if (militaryRange) {
    return {
      end: formatTime(Number(militaryRange[3]), Number(militaryRange[4])),
      start: formatTime(Number(militaryRange[1]), Number(militaryRange[2])),
    };
  }

  const chineseSingle = text.match(
    /(?:(\u51cc\u6668|\u65e9\u4e0a|\u4e0a\u5348|\u4e2d\u5348|\u4e0b\u5348|\u665a\u4e0a)\s*)?(\d{1,2})(?:(?::|：)(\d{1,2})|点(?:(\d{1,2})分?)?(半)?)?/u
  );
  if (chineseSingle) {
    const hour = toTwentyFourHour(Number(chineseSingle[2]), chineseSingle[1] ?? null, 'chinese');
    const minute = resolveChineseMinute(chineseSingle[3], chineseSingle[4], chineseSingle[5]);
    return {
      end: null,
      start: formatTime(hour, minute),
    };
  }

  const englishSingle = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (englishSingle) {
    return {
      end: null,
      start: formatTime(
        toTwentyFourHour(Number(englishSingle[1]), englishSingle[3].toLowerCase(), 'english'),
        Number(englishSingle[2] ?? '0')
      ),
    };
  }

  const militarySingle = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (militarySingle) {
    return {
      end: null,
      start: formatTime(Number(militarySingle[1]), Number(militarySingle[2])),
    };
  }

  return null;
}

function parseTimeRangeNormalized(text: string): TimeRange | null {
  const normalized = normalizeTemporalText(text);
  const chineseRange = normalized.match(
    /(?:(\u51cc\u6668|\u65e9\u4e0a|\u4e0a\u5348|\u4e2d\u5348|\u4e0b\u5348|\u665a\u4e0a)\s*)?(\d{1,2})\s*(?:(?::|\uFF1A)(\d{1,2})|\u70b9(?:(\d{1,2})\u5206?)?(\u534a)?)\s*(?:\u5230|\u81f3|~|\uFF5E|-)\s*(?:(\u51cc\u6668|\u65e9\u4e0a|\u4e0a\u5348|\u4e2d\u5348|\u4e0b\u5348|\u665a\u4e0a)\s*)?(\d{1,2})\s*(?:(?::|\uFF1A)(\d{1,2})|\u70b9(?:(\d{1,2})\u5206?)?(\u534a)?)/u
  );
  if (chineseRange) {
    const startPeriod = chineseRange[1] ?? null;
    const startHour = Number(chineseRange[2]);
    const startMinute = resolveChineseMinute(chineseRange[3], chineseRange[4], chineseRange[5]);
    const endPeriod = chineseRange[6] ?? startPeriod;
    const endHour = Number(chineseRange[7]);
    const endMinute = resolveChineseMinute(chineseRange[8], chineseRange[9], chineseRange[10]);

    return {
      end: formatTime(toTwentyFourHour(endHour, endPeriod, 'chinese'), endMinute),
      start: formatTime(toTwentyFourHour(startHour, startPeriod, 'chinese'), startMinute),
    };
  }

  const englishRange = normalized.match(
    /\b(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:to|until|through|-|\u2013)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i
  );
  if (englishRange) {
    const startMeridiem = englishRange[3].toLowerCase();
    const endMeridiem = (englishRange[6] ?? englishRange[3]).toLowerCase();

    return {
      end: formatTime(
        toTwentyFourHour(Number(englishRange[4]), endMeridiem, 'english'),
        Number(englishRange[5] ?? '0')
      ),
      start: formatTime(
        toTwentyFourHour(Number(englishRange[1]), startMeridiem, 'english'),
        Number(englishRange[2] ?? '0')
      ),
    };
  }

  const militaryRange = normalized.match(
    /\b(?:from\s+)?([01]?\d|2[0-3]):([0-5]\d)\s*(?:to|until|through|-|\u2013)\s*([01]?\d|2[0-3]):([0-5]\d)\b/i
  );
  if (militaryRange) {
    return {
      end: formatTime(Number(militaryRange[3]), Number(militaryRange[4])),
      start: formatTime(Number(militaryRange[1]), Number(militaryRange[2])),
    };
  }

  const chineseSingle = normalized.match(
    /(?:(\u51cc\u6668|\u65e9\u4e0a|\u4e0a\u5348|\u4e2d\u5348|\u4e0b\u5348|\u665a\u4e0a)\s*)?(\d{1,2})\s*(?:(?::|\uFF1A)(\d{1,2})|\u70b9(?:(\d{1,2})\u5206?)?(\u534a)?)/u
  );
  if (chineseSingle) {
    const hour = toTwentyFourHour(Number(chineseSingle[2]), chineseSingle[1] ?? null, 'chinese');
    const minute = resolveChineseMinute(chineseSingle[3], chineseSingle[4], chineseSingle[5]);
    return {
      end: null,
      start: formatTime(hour, minute),
    };
  }

  const englishSingle = normalized.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (englishSingle) {
    return {
      end: null,
      start: formatTime(
        toTwentyFourHour(Number(englishSingle[1]), englishSingle[3].toLowerCase(), 'english'),
        Number(englishSingle[2] ?? '0')
      ),
    };
  }

  const militarySingle = normalized.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (militarySingle) {
    return {
      end: null,
      start: formatTime(Number(militarySingle[1]), Number(militarySingle[2])),
    };
  }

  return null;
}

export function analyzeTemporalIntent(
  text: string,
  now = new Date(),
  timezone = DEFAULT_TIMEZONE
): TemporalIntent {
  const normalized = normalizeTemporalText(text);
  const dueDate = inferSpecificDate(normalized, now);
  const timeRange = parseTimeRangeNormalized(normalized);

  if (dueDate && timeRange) {
    return {
      ambiguityReason: null,
      dueDate,
      endAt: timeRange.end ? buildIsoDateTime(dueDate, timeRange.end, timezone) : null,
      kind: 'specific_day_with_time',
      needsConfirmation: false,
      startAt: buildIsoDateTime(dueDate, timeRange.start, timezone),
    };
  }

  if (dueDate) {
    return {
      ambiguityReason: null,
      dueDate,
      endAt: null,
      kind: 'specific_day',
      needsConfirmation: false,
      startAt: null,
    };
  }

  if (containsBroadWindow(normalized)) {
    return {
      ambiguityReason: 'The request references a broad time window without an exact day.',
      dueDate: null,
      endAt: null,
      kind: 'vague_window',
      needsConfirmation: true,
      startAt: null,
    };
  }

  return {
    ambiguityReason: null,
    dueDate: null,
    endAt: null,
    kind: 'none',
    needsConfirmation: false,
    startAt: null,
  };
}

function reconcileTimedEventFields(
  startAt: string | null,
  endAt: string | null,
  estimatedMinutes: number | null
) {
  const durationMinutes = getDurationMinutes(startAt, endAt);

  if (durationMinutes) {
    return {
      endAt,
      estimatedMinutes: durationMinutes,
    };
  }

  const normalizedEstimatedMinutes = estimatedMinutes ?? DEFAULT_EVENT_MINUTES;
  return {
    endAt: startAt ? endAt ?? addMinutes(startAt, normalizedEstimatedMinutes) : endAt,
    estimatedMinutes: normalizedEstimatedMinutes,
  };
}

function shouldRequestConfirmationForTimedEvent(
  temporalIntent: TemporalIntent,
  text: string
) {
  return (
    temporalIntent.kind === 'specific_day_with_time' &&
    !temporalIntent.endAt &&
    parseExplicitDurationMinutes(text) === null
  );
}

function toTemporalParseResult(
  text: string,
  timezone: string,
  now = new Date()
) {
  const temporalIntent = analyzeTemporalIntent(text, now, timezone);
  const type = temporalIntent.kind === 'specific_day' || temporalIntent.kind === 'specific_day_with_time'
    ? 'event'
    : 'todo';
  const estimatedMinutes = inferEstimatedMinutes(text, type);
  const startAt = temporalIntent.startAt;
  const rawEndAt =
    startAt && temporalIntent.kind === 'specific_day_with_time'
      ? temporalIntent.endAt ?? addMinutes(startAt, estimatedMinutes)
      : null;
  const timing =
    type === 'event' && temporalIntent.kind === 'specific_day_with_time'
      ? reconcileTimedEventFields(startAt, rawEndAt, estimatedMinutes)
      : {
          endAt: rawEndAt,
          estimatedMinutes,
        };
  const needsConfirmation =
    temporalIntent.needsConfirmation ||
    shouldRequestConfirmationForTimedEvent(temporalIntent, text);

  return {
    temporalIntent,
    result: {
      ambiguity_reason:
        temporalIntent.ambiguityReason ??
        (needsConfirmation
          ? `The time expression is ambiguous for timezone ${timezone}.`
          : null),
      confidence:
        temporalIntent.kind === 'specific_day_with_time'
          ? 0.92
          : temporalIntent.kind === 'specific_day'
            ? 0.88
            : temporalIntent.kind === 'vague_window'
              ? 0.6
              : 0.78,
      due_date: temporalIntent.kind === 'specific_day' ? temporalIntent.dueDate : null,
      end_at: type === 'event' ? timing.endAt : null,
      estimated_minutes: timing.estimatedMinutes,
      group_key: inferGroup(text),
      is_all_day: temporalIntent.kind === 'specific_day',
      location: inferLocation(text),
      needs_confirmation: needsConfirmation,
      notes: '',
      priority: inferPriority(text),
      start_at: temporalIntent.kind === 'specific_day_with_time' ? startAt : null,
      title: titleFromText(text),
      type,
    } satisfies ParseResult,
  };
}

export function fallbackParseInput(
  text: string,
  timezone = DEFAULT_TIMEZONE,
  now = new Date()
): ParseResult {
  return toTemporalParseResult(text, timezone, now).result;
}

function applyTemporalIntentToResult(
  input: ParseResult,
  temporalIntent: TemporalIntent
): ParseResult {
  if (temporalIntent.kind === 'vague_window') {
    return {
      ...input,
      ambiguity_reason: temporalIntent.ambiguityReason,
      due_date: null,
      end_at: null,
      is_all_day: false,
      needs_confirmation: true,
      start_at: null,
      type: 'todo',
    };
  }

  if (temporalIntent.kind === 'specific_day') {
    return {
      ...input,
      ambiguity_reason: null,
      due_date: temporalIntent.dueDate,
      end_at: null,
      is_all_day: true,
      needs_confirmation: false,
      start_at: null,
      type: 'event',
    };
  }

  if (temporalIntent.kind === 'specific_day_with_time') {
    const timing = reconcileTimedEventFields(
      input.start_at ?? temporalIntent.startAt,
      input.end_at ?? temporalIntent.endAt,
      input.estimated_minutes ?? DEFAULT_EVENT_MINUTES
    );
    const startAt = input.start_at ?? temporalIntent.startAt;

    return {
      ...input,
      ambiguity_reason: null,
      due_date: null,
      end_at: timing.endAt,
      estimated_minutes: timing.estimatedMinutes,
      is_all_day: false,
      needs_confirmation: input.needs_confirmation,
      start_at: startAt,
      type: 'event',
    };
  }

  if (input.type === 'todo') {
    return {
      ...input,
      due_date: input.due_date,
      end_at: null,
      is_all_day: false,
      start_at: null,
      type: 'todo',
    };
  }

  if (input.is_all_day) {
    return {
      ...input,
      due_date: input.due_date,
      end_at: null,
      start_at: null,
      type: 'event',
    };
  }

  if (input.start_at && !input.end_at) {
    const timing = reconcileTimedEventFields(
      input.start_at,
      input.end_at,
      input.estimated_minutes ?? DEFAULT_EVENT_MINUTES
    );
    return {
      ...input,
      due_date: null,
      end_at: timing.endAt,
      estimated_minutes: timing.estimatedMinutes,
      type: 'event',
    };
  }

  return {
    ...input,
    due_date: input.type === 'event' ? null : input.due_date,
  };
}

export function normalizeParseResult(
  payload: PartialParseResult | null,
  text: string,
  timezone = DEFAULT_TIMEZONE,
  now = new Date()
) {
  const { result: fallback, temporalIntent } = toTemporalParseResult(text, timezone, now);
  const title =
    typeof payload?.title === 'string' && payload.title.trim()
      ? titleFromText(payload.title.trim())
      : fallback.title;
  const type = fallback.type;
  const estimatedMinutes = sanitizeMinutes(
    payload?.estimated_minutes,
    fallback.estimated_minutes
  );
  const startAt: string | null = fallback.start_at;
  let endAt: string | null = fallback.end_at;
  const dueDate: string | null = fallback.due_date;
  const isAllDay = fallback.is_all_day;
  const timing =
    type === 'event' && !isAllDay
      ? reconcileTimedEventFields(startAt, endAt, estimatedMinutes)
      : {
          endAt,
          estimatedMinutes,
        };
  endAt = timing.endAt;
  const location =
    typeof payload?.location === 'string'
      ? locationFromMatch(payload.location)
      : fallback.location;
  const aiInferredLocation = Boolean(location && !fallback.location && typeof payload?.location === 'string');
  const ambiguityReason =
    typeof payload?.ambiguity_reason === 'string'
      ? payload.ambiguity_reason.trim() || null
      : fallback.ambiguity_reason;

  const candidate = {
    ambiguity_reason:
      ambiguityReason ?? (aiInferredLocation ? 'Location inferred from context.' : null),
    confidence:
      typeof payload?.confidence === 'number' && Number.isFinite(payload.confidence)
        ? Math.max(0, Math.min(1, payload.confidence))
        : fallback.confidence,
    due_date: dueDate,
    end_at: endAt,
    estimated_minutes: timing.estimatedMinutes,
    group_key: fallback.group_key,
    is_all_day: isAllDay,
    location,
    needs_confirmation:
      (typeof payload?.needs_confirmation === 'boolean'
        ? payload.needs_confirmation
        : fallback.needs_confirmation) || aiInferredLocation,
    notes: fallback.notes,
    priority:
      payload?.priority !== undefined ? sanitizePriority(payload.priority) : fallback.priority,
    start_at: startAt,
    title,
    type,
  } satisfies ParseResult;

  return applyTemporalIntentToResult(candidate, temporalIntent);
}

function buildParseAiMessages(input: {
  locale: string;
  now: string;
  text: string;
  timezone: string;
}) {
  const { locale, now, text, timezone } = input;

  return [
    {
      role: 'system' as const,
      content: `
You are a bilingual AI planning assistant.
Return only a JSON object with these keys:
type, title, location, notes, group_key, priority, estimated_minutes, start_at, end_at, due_date, is_all_day, needs_confirmation, ambiguity_reason, confidence.

Rules:
- group_key must be one of: study, work, life, health, other.
- priority must be one of: low, medium, high.
- type must be event or todo.
- location should contain only the place name when the user clearly provides one. Otherwise use an empty string.
- Use ISO 8601 for start_at/end_at. Use YYYY-MM-DD for due_date.
- If the user gives a date but no time, create an all-day event with due_date set and start_at/end_at null.
- If the text is ambiguous like "next week", set needs_confirmation true and explain ambiguity_reason.
- If an event has a start time but no end time, estimate estimated_minutes and derive a reasonable end_at.
- Understand common Chinese colloquial time phrases: "明天凌晨一点半到三点半" means 01:30 to 03:30 on the referenced day.
- Understand common Chinese duration phrases: "两个半小时", "两小时半", and "俩小时半" all mean 150 minutes.
- If the user only gives a duration without a start time, keep start_at/end_at null and fill estimated_minutes.
- Keep title concise. location and notes can be empty.
- Respect locale ${locale} and timezone ${timezone}.
- Current timestamp is ${now}.
      `.trim(),
    },
    {
      role: 'user' as const,
      content: text,
    },
  ];
}

export function buildExtractedFields(
  result: ParseResult,
  timezone = DEFAULT_TIMEZONE
): ParseExtractedFields {
  return {
    duration_minutes: result.estimated_minutes,
    location: result.location,
    priority: result.priority,
    time: {
      due_date: result.due_date,
      end_at: result.end_at,
      is_all_day: result.is_all_day,
      start_at: result.start_at,
      timezone,
    },
    title: result.title,
  };
}

function buildParseResponse(
  mode: ParseResponse['mode'],
  result: ParseResult,
  timezone: string
): ParseResponse {
  return {
    extracted_fields: buildExtractedFields(result, timezone),
    mode,
    result,
  };
}

export async function parseInputWithAi(input: {
  locale?: string;
  text: string;
  timezone?: string;
}): Promise<ParseResponse> {
  const { locale = 'en-US', text, timezone = DEFAULT_TIMEZONE } = input;
  const aiConfig = getAiConfig('parse');
  const { result: fallback } = toTemporalParseResult(text, timezone);

  if (!aiConfig.apiKey) {
    return buildParseResponse('fallback', fallback, timezone);
  }

  const now = new Date().toISOString();
  try {
    const payload = await requestAiJson<PartialParseResult>({
      messages: buildParseAiMessages({
        locale,
        now,
        text,
        timezone,
      }),
      parse: (content) => parseJson<PartialParseResult>(content),
      task: 'parse',
    });

    if (payload) {
      return buildParseResponse('ai', normalizeParseResult(payload, text, timezone), timezone);
    }
  } catch {
    logAiJsonMetrics({
      fastPath: false,
      outcome: 'skip',
      reason: 'parse_request_failed_fallback',
      task: 'parse',
    });
  }

  logAiJsonMetrics({
    fastPath: false,
    outcome: 'skip',
    reason: 'empty_ai_payload_fallback',
    task: 'parse',
  });

  return buildParseResponse('fallback', fallback, timezone);
}
