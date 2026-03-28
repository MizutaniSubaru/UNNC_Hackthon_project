import {
  getAiConfig,
  logAiJsonMetrics,
  requestAiJson,
} from '@/lib/ai-provider';
import {
  DEFAULT_EVENT_MINUTES,
  DEFAULT_TIMEZONE,
  GROUPS,
  MONTH_NAMES_EN,
  PRIORITIES,
} from '@/lib/constants';
import { addMinutes } from '@/lib/time';
import type { GroupKey, ParseResult, Priority } from '@/lib/types';

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

const GROUP_KEY_SET = new Set(GROUPS.map((group) => group.key));
const PRIORITY_SET = new Set(PRIORITIES);

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

function isIsoDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isIsoDateTime(value: unknown) {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

function sanitizeGroup(value: unknown): GroupKey {
  return typeof value === 'string' && GROUP_KEY_SET.has(value as GroupKey)
    ? (value as GroupKey)
    : 'other';
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

function titleFromText(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function locationFromMatch(value: string | undefined) {
  if (!value) {
    return '';
  }

  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the\s+)/i, '')
    .slice(0, 120);
}

function inferLocation(text: string) {
  const chineseMatch = text.match(
    /\u5728([^,\u3002\uFF0C\uFF1B;\n]+?)(?:\u89c1\u9762|\u96c6\u5408|\u4f1a\u5408|\u5f00\u4f1a|\u4e0a\u8bfe|\u8ba8\u8bba|\u5403\u996d|\u5c31\u8bca|\u953b\u70bc|\u6c47\u62a5|\u78b0\u5934|$)/u
  );
  if (chineseMatch) {
    return locationFromMatch(chineseMatch[1]);
  }

  const englishMatch = text.match(/\b(?:at|in)\s+([^,.;\n]+?)(?:\s+(?:for|with|to)\b|$)/i);
  if (englishMatch) {
    return locationFromMatch(englishMatch[1]);
  }

  return '';
}

function inferGroup(text: string): GroupKey {
  const normalized = text.toLowerCase();

  if (/\u8bba\u6587|\u4f5c\u4e1a|\u8003\u8bd5|study|assignment|course|class|lecture|\u5bfc\u5e08/u.test(normalized)) {
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

function parseTimeRange(text: string): TimeRange | null {
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

export function analyzeTemporalIntent(
  text: string,
  now = new Date(),
  timezone = DEFAULT_TIMEZONE
): TemporalIntent {
  const dueDate = inferSpecificDate(text, now);
  const timeRange = parseTimeRange(text);

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

  if (containsBroadWindow(text)) {
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

function countMeaningfulTokens(text: string) {
  return text.match(/[a-z0-9\u4e00-\u9fff]+/gi)?.length ?? 0;
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
  const endAt =
    startAt && temporalIntent.kind === 'specific_day_with_time'
      ? temporalIntent.endAt ?? addMinutes(startAt, estimatedMinutes)
      : null;

  return {
    temporalIntent,
    result: {
      ambiguity_reason:
        temporalIntent.ambiguityReason ??
        (temporalIntent.needsConfirmation
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
      end_at: type === 'event' ? endAt : null,
      estimated_minutes: estimatedMinutes,
      group_key: inferGroup(text),
      is_all_day: temporalIntent.kind === 'specific_day',
      location: inferLocation(text),
      needs_confirmation: temporalIntent.needsConfirmation,
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

function shouldUseParseFastPath(text: string, fallback: ParseResult, temporalIntent: TemporalIntent) {
  if (temporalIntent.kind === 'specific_day' || temporalIntent.kind === 'specific_day_with_time') {
    return true;
  }

  if (temporalIntent.kind === 'vague_window') {
    return true;
  }

  if (fallback.needs_confirmation) {
    return false;
  }

  const tokenCount = countMeaningfulTokens(text);
  return tokenCount > 0 && tokenCount <= 12;
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
    const estimatedMinutes = input.estimated_minutes ?? DEFAULT_EVENT_MINUTES;
    const startAt = input.start_at ?? temporalIntent.startAt;
    const endAt =
      input.end_at ??
      temporalIntent.endAt ??
      (startAt ? addMinutes(startAt, estimatedMinutes) : null);

    return {
      ...input,
      ambiguity_reason: null,
      due_date: null,
      end_at: endAt,
      is_all_day: false,
      needs_confirmation: false,
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
    return {
      ...input,
      due_date: null,
      end_at: addMinutes(input.start_at, input.estimated_minutes ?? DEFAULT_EVENT_MINUTES),
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
      ? payload.title.trim()
      : fallback.title;
  const type = payload?.type === 'event' || payload?.type === 'todo' ? payload.type : fallback.type;
  const estimatedMinutes = sanitizeMinutes(
    payload?.estimated_minutes,
    fallback.estimated_minutes
  );
  const payloadStartAt = payload?.start_at;
  const payloadEndAt = payload?.end_at;
  const payloadDueDate = payload?.due_date;

  const startAt: string | null = isIsoDateTime(payloadStartAt)
    ? (payloadStartAt as string)
    : fallback.start_at;
  let endAt: string | null = isIsoDateTime(payloadEndAt)
    ? (payloadEndAt as string)
    : fallback.end_at;
  const dueDate: string | null = isIsoDate(payloadDueDate)
    ? (payloadDueDate as string)
    : fallback.due_date;
  const isAllDay =
    typeof payload?.is_all_day === 'boolean' ? payload.is_all_day : fallback.is_all_day;

  if (type === 'event' && !isAllDay && startAt && !endAt) {
    endAt = addMinutes(startAt, estimatedMinutes ?? DEFAULT_EVENT_MINUTES);
  }

  const candidate = {
    ambiguity_reason:
      typeof payload?.ambiguity_reason === 'string'
        ? payload.ambiguity_reason.trim() || null
        : fallback.ambiguity_reason,
    confidence:
      typeof payload?.confidence === 'number' && Number.isFinite(payload.confidence)
        ? Math.max(0, Math.min(1, payload.confidence))
        : fallback.confidence,
    due_date: dueDate,
    end_at: endAt,
    estimated_minutes: estimatedMinutes,
    group_key: sanitizeGroup(payload?.group_key),
    is_all_day: isAllDay,
    location:
      typeof payload?.location === 'string' ? payload.location.trim() : fallback.location,
    needs_confirmation:
      typeof payload?.needs_confirmation === 'boolean'
        ? payload.needs_confirmation
        : fallback.needs_confirmation,
    notes:
      typeof payload?.notes === 'string' ? payload.notes.trim() : fallback.notes,
    priority: sanitizePriority(payload?.priority),
    start_at: startAt,
    title,
    type,
  } satisfies ParseResult;

  return applyTemporalIntentToResult(candidate, temporalIntent);
}

export async function parseInputWithAi(input: {
  locale?: string;
  text: string;
  timezone?: string;
}) {
  const { locale = 'en-US', text, timezone = DEFAULT_TIMEZONE } = input;
  const aiConfig = getAiConfig('parse');
  const { result: fallback, temporalIntent } = toTemporalParseResult(text, timezone);

  if (!aiConfig.apiKey) {
    return {
      mode: 'fallback' as const,
      result: fallback,
    };
  }

  if (shouldUseParseFastPath(text, fallback, temporalIntent)) {
    logAiJsonMetrics({
      fastPath: true,
      outcome: 'skip',
      reason:
        temporalIntent.kind === 'specific_day' || temporalIntent.kind === 'specific_day_with_time'
          ? 'deterministic_specific_day'
          : temporalIntent.kind === 'vague_window'
            ? 'deterministic_vague_window'
            : 'short_todo_fast_path',
      task: 'parse',
    });

    return {
      mode: 'ai' as const,
      result: fallback,
    };
  }

  const now = new Date().toISOString();
  try {
    const payload = await requestAiJson<PartialParseResult>({
      messages: [
        {
          role: 'system',
          content: `
You are a bilingual planning parser.
Return one JSON object only with keys:
type,title,location,notes,group_key,priority,estimated_minutes,start_at,end_at,due_date,is_all_day,needs_confirmation,ambiguity_reason,confidence.
Rules:
- type: event | todo
- group_key: study | work | life | health | other
- priority: low | medium | high
- start_at/end_at: ISO 8601, due_date: YYYY-MM-DD
- If the user only gives a broad time window such as 下周, 下个月, next week, next month, this week, later, or sometime without an exact day, return type=todo.
- If the user names an exact calendar day such as 明天, 下周一, Monday, or 2026-03-30, return type=event.
- If the user names an exact day without a clock time, return an all-day event with due_date only and start_at/end_at null.
- If the user names an exact day with a clock time or time range, return a timed event with start_at/end_at and set due_date to null.
- If start_at exists and end_at is missing, infer estimated_minutes and end_at.
- Keep title concise. location and notes may be empty.
Locale=${locale}; Timezone=${timezone}; Now=${now}.
          `.trim(),
        },
        {
          role: 'user',
          content: text,
        },
      ],
      parse: (content) => parseJson<PartialParseResult>(content),
      task: 'parse',
    });

    if (payload) {
      return {
        mode: 'ai' as const,
        result: normalizeParseResult(payload, text, timezone),
      };
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

  return {
    mode: 'fallback' as const,
    result: fallback,
  };
}
