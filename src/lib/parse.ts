import { OpenAI } from 'openai';
import type { APIError } from 'openai/error';
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

const GROUP_KEY_SET = new Set(GROUPS.map((group) => group.key));
const PRIORITY_SET = new Set(PRIORITIES);

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
  const chineseMatch = text.match(/在([^，。；;\n]+?)(?:见面|集合|会合|开会|上课|讨论|吃饭|就诊|锻炼|汇报|碰头|$)/);
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

  if (/论文|作业|考试|study|assignment|course|class|lecture|导师/.test(normalized)) {
    return 'study';
  }

  if (/meeting|client|project|review|工作|开会|汇报|需求/.test(normalized)) {
    return 'work';
  }

  if (/gym|doctor|医院|跑步|健身|体检/.test(normalized)) {
    return 'health';
  }

  if (/buy|shop|grocer|朋友|电影|生活|采购|买|做饭/.test(normalized)) {
    return 'life';
  }

  return 'other';
}

function inferPriority(text: string): Priority {
  const normalized = text.toLowerCase();

  if (/urgent|asap|today|今晚|今天|马上|尽快|立刻/.test(normalized)) {
    return 'high';
  }

  if (/tomorrow|明天|next week|下周/.test(normalized)) {
    return 'medium';
  }

  return 'low';
}

function inferEstimatedMinutes(text: string, type: 'todo' | 'event') {
  const normalized = text.toLowerCase();

  if (/meeting|开会|讨论|沟通|call/.test(normalized)) {
    return 60;
  }

  if (/essay|assignment|论文|作业|coding|编码|复习/.test(normalized)) {
    return 120;
  }

  if (/buy|买|grocer|打印|打印纸/.test(normalized)) {
    return 30;
  }

  return type === 'event' ? DEFAULT_EVENT_MINUTES : 45;
}

function detectAmbiguity(text: string) {
  return /下周| sometime |later|近期|最近|next week|this week|周内/.test(
    ` ${text.toLowerCase()} `
  );
}

function parseMonthNameDate(text: string, currentYear: number) {
  const normalized = text.toLowerCase();

  for (const [index, monthName] of MONTH_NAMES_EN.entries()) {
    const pattern = new RegExp(`${monthName.toLowerCase()}\\s+(\\d{1,2})`, 'i');
    const match = normalized.match(pattern);
    if (match) {
      const day = Number(match[1]);
      const date = new Date(currentYear, index, day);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate()
      ).padStart(2, '0')}`;
    }
  }

  return null;
}

function inferDate(text: string, now: Date) {
  const normalized = text.toLowerCase();

  if (/明天|tomorrow/.test(normalized)) {
    const date = new Date(now);
    date.setDate(now.getDate() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
  }

  const chineseMatch = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (chineseMatch) {
    const date = new Date(now.getFullYear(), Number(chineseMatch[1]) - 1, Number(chineseMatch[2]));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
  }

  const isoMatch = normalized.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  return parseMonthNameDate(text, now.getFullYear());
}

function inferTime(text: string) {
  const normalized = text.toLowerCase();

  const chineseMatch = normalized.match(/(上午|下午|晚上|中午)?\s*(\d{1,2})点(?:(\d{1,2})分?)?/);
  if (chineseMatch) {
    const period = chineseMatch[1];
    let hour = Number(chineseMatch[2]);
    const minute = Number(chineseMatch[3] || '0');

    if ((period === '下午' || period === '晚上') && hour < 12) {
      hour += 12;
    }

    if (period === '中午' && hour < 11) {
      hour += 12;
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  }

  const englishMatch = normalized.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (englishMatch) {
    let hour = Number(englishMatch[1]);
    const minute = Number(englishMatch[2] || '0');
    const meridiem = englishMatch[3];

    if (meridiem === 'pm' && hour < 12) {
      hour += 12;
    }

    if (meridiem === 'am' && hour === 12) {
      hour = 0;
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  }

  return null;
}

export function fallbackParseInput(text: string, timezone = DEFAULT_TIMEZONE): ParseResult {
  const now = new Date();
  const dueDate = inferDate(text, now);
  const time = inferTime(text);
  const hasDate = Boolean(dueDate);
  const hasTime = Boolean(time);
  const type = hasDate || hasTime ? 'event' : 'todo';
  const estimatedMinutes = inferEstimatedMinutes(text, type);
  const startAt =
    dueDate && time ? new Date(`${dueDate}T${time}`).toISOString() : null;
  const endAt =
    startAt && type === 'event' ? addMinutes(startAt, estimatedMinutes) : null;
  const needsConfirmation = detectAmbiguity(text);

  return {
    ambiguity_reason: needsConfirmation
      ? `The time expression is ambiguous for timezone ${timezone}.`
      : null,
    confidence: needsConfirmation ? 0.52 : 0.78,
    due_date: dueDate,
    end_at: !hasTime && hasDate ? null : endAt,
    estimated_minutes: estimatedMinutes,
    group_key: inferGroup(text),
    is_all_day: hasDate && !hasTime,
    location: inferLocation(text),
    needs_confirmation: needsConfirmation,
    notes: '',
    priority: inferPriority(text),
    start_at: hasTime ? startAt : null,
    title: titleFromText(text),
    type,
  };
}

function normalizeParseResult(payload: PartialParseResult | null, text: string) {
  const fallback = fallbackParseInput(text);
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

  let startAt: string | null = isIsoDateTime(payloadStartAt)
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

  if (type === 'todo') {
    startAt = null;
    endAt = null;
  }

  return {
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
}

function getAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.KIMI_API_KEY;
  const baseURL =
    process.env.OPENAI_BASE_URL || process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1';
  const model = process.env.OPENAI_MODEL || process.env.KIMI_MODEL || 'kimi-k2.5';

  return { apiKey, baseURL, model };
}

export async function parseInputWithAi(input: {
  locale?: string;
  text: string;
  timezone?: string;
}) {
  const { locale = 'en-US', text, timezone = DEFAULT_TIMEZONE } = input;
  const { apiKey, baseURL, model } = getAiConfig();

  if (!apiKey) {
    return {
      mode: 'fallback' as const,
      result: fallbackParseInput(text, timezone),
    };
  }

  const openai = new OpenAI({
    apiKey,
    baseURL,
  });

  const now = new Date().toISOString();

  const candidateModels = [model, 'kimi-k2.5', 'moonshot-v1-8k'].filter(
    (value, index, array) => value && array.indexOf(value) === index
  );

  let lastError: unknown = null;

  for (const candidate of candidateModels) {
    try {
      const response = await openai.chat.completions.create({
        model: candidate,
        messages: [
          {
            role: 'system',
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
- Keep title concise. location and notes can be empty.
- Respect locale ${locale} and timezone ${timezone}.
- Current timestamp is ${now}.
            `.trim(),
          },
          {
            role: 'user',
            content: text,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const payload = parseJson<PartialParseResult>(
        response.choices[0]?.message?.content
      );

      return {
        mode: 'ai' as const,
        result: normalizeParseResult(payload, text),
      };
    } catch (error) {
      lastError = error;
      const apiError = error as APIError;
      const shouldRetry =
        apiError?.status === 404 ||
        /not found the model|permission denied/i.test(apiError?.message || '');

      if (!shouldRetry) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return {
    mode: 'fallback' as const,
    result: fallbackParseInput(text, timezone),
  };
}
