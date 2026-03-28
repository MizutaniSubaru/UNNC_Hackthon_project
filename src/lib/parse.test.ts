import { describe, expect, it } from 'bun:test';
import {
  analyzeTemporalIntent,
  fallbackParseInput,
  normalizeParseResult,
} from '@/lib/parse';

const SHANGHAI_TIMEZONE = 'Asia/Shanghai';
const REFERENCE_NOW = new Date('2026-03-28T10:00:00+08:00');

function formatInTimezone(value: string | null, timezone: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((parts, part) => {
      if (part.type !== 'literal') {
        parts[part.type] = part.value;
      }

      return parts;
    }, {});
}

describe('temporal analyzer', () => {
  it('classifies broad windows as todo intent', () => {
    const intent = analyzeTemporalIntent('\u4e0b\u5468\u5199\u8bba\u6587', REFERENCE_NOW);

    expect(intent.kind).toBe('vague_window');
    expect(intent.dueDate).toBeNull();
  });

  it('classifies exact day with time as event intent', () => {
    const intent = analyzeTemporalIntent('\u4e0b\u5468\u4e00\u51cc\u6668 3 \u70b9\u5230 4 \u70b9', REFERENCE_NOW);

    expect(intent.kind).toBe('specific_day_with_time');
    expect(intent.dueDate).toBe('2026-03-30');
  });
});

describe('fallbackParseInput', () => {
  it('parses next monday 3am to 4am as a timed event in Shanghai', () => {
    const parsed = fallbackParseInput(
      '\u4e0b\u5468\u4e00\u51cc\u6668 3 \u70b9\u5230 4 \u70b9',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );
    const start = formatInTimezone(parsed.start_at, SHANGHAI_TIMEZONE);
    const end = formatInTimezone(parsed.end_at, SHANGHAI_TIMEZONE);

    expect(parsed.type).toBe('event');
    expect(parsed.is_all_day).toBe(false);
    expect(parsed.due_date).toBeNull();
    expect(start).toMatchObject({
      day: '30',
      hour: '03',
      minute: '00',
      month: '03',
      year: '2026',
    });
    expect(end).toMatchObject({
      day: '30',
      hour: '04',
      minute: '00',
      month: '03',
      year: '2026',
    });
  });

  it('parses exact day without time as an all-day event', () => {
    const parsed = fallbackParseInput('\u4e0b\u5468\u4e00\u5199\u8bba\u6587', SHANGHAI_TIMEZONE, REFERENCE_NOW);

    expect(parsed.type).toBe('event');
    expect(parsed.is_all_day).toBe(true);
    expect(parsed.due_date).toBe('2026-03-30');
    expect(parsed.start_at).toBeNull();
    expect(parsed.end_at).toBeNull();
  });

  it('parses tomorrow afternoon 3pm as a timed event', () => {
    const parsed = fallbackParseInput(
      '\u660e\u5929\u4e0b\u5348 3 \u70b9\u5f00\u4f1a',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );
    const start = formatInTimezone(parsed.start_at, SHANGHAI_TIMEZONE);

    expect(parsed.type).toBe('event');
    expect(parsed.is_all_day).toBe(false);
    expect(start).toMatchObject({
      day: '29',
      hour: '15',
      minute: '00',
      month: '03',
      year: '2026',
    });
  });

  it('keeps broad month windows as todos', () => {
    const parsed = fallbackParseInput(
      '\u4e0b\u4e2a\u6708\u627e\u5bfc\u5e08\u804a\u8bba\u6587',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );

    expect(parsed.type).toBe('todo');
    expect(parsed.is_all_day).toBe(false);
    expect(parsed.start_at).toBeNull();
    expect(parsed.due_date).toBeNull();
  });
});

describe('normalizeParseResult', () => {
  it('coerces exact-day prompts back to events even if AI returns todo', () => {
    const normalized = normalizeParseResult(
      { type: 'todo', title: '\u4e0b\u5468\u4e00\u5199\u8bba\u6587' },
      '\u4e0b\u5468\u4e00\u5199\u8bba\u6587',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );

    expect(normalized.type).toBe('event');
    expect(normalized.is_all_day).toBe(true);
    expect(normalized.due_date).toBe('2026-03-30');
  });

  it('coerces vague windows back to todos even if AI returns event', () => {
    const normalized = normalizeParseResult(
      {
        due_date: '2026-04-01',
        is_all_day: true,
        type: 'event',
      },
      '\u4e0b\u5468\u5199\u8bba\u6587',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );

    expect(normalized.type).toBe('todo');
    expect(normalized.start_at).toBeNull();
    expect(normalized.due_date).toBeNull();
  });
});
