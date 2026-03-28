import { describe, expect, it } from 'bun:test';
import {
  analyzeTemporalIntent,
  buildExtractedFields,
  fallbackParseInput,
  inferLocation,
  normalizeParseResult,
  titleFromText,
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

  it('calculates timed event duration from start and end time', () => {
    const parsed = fallbackParseInput(
      '\u4e0b\u5468\u4e00\u4e0b\u53482\u70b9\u52306\u70b9\u5728\u56fe\u4e66\u9986\u8ba8\u8bba\u8bba\u6587',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );

    expect(parsed.type).toBe('event');
    expect(parsed.location).toBe('\u56fe\u4e66\u9986');
    expect(parsed.estimated_minutes).toBe(240);
    expect(parsed.title).toBe('\u8ba8\u8bba\u8bba\u6587');
  });

  it('parses chinese numeral clock time without swallowing location digits', () => {
    const parsed = fallbackParseInput(
      '\u660e\u5929\u4e0b\u5348\u4e09\u70b9\u5728A44\u89c1\u5bfc\u5e08',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );
    const start = formatInTimezone(parsed.start_at, SHANGHAI_TIMEZONE);

    expect(parsed.type).toBe('event');
    expect(parsed.location).toBe('A44');
    expect(parsed.title).toBe('\u89c1\u5bfc\u5e08');
    expect(start).toMatchObject({
      day: '29',
      hour: '15',
      minute: '00',
      month: '03',
      year: '2026',
    });
  });

  it('keeps all-day exact day events while extracting concise title and location', () => {
    const parsed = fallbackParseInput(
      '\u660e\u5929\u5728\u56fe\u4e66\u9986\u590d\u4e60',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );

    expect(parsed.type).toBe('event');
    expect(parsed.is_all_day).toBe(true);
    expect(parsed.group_key).toBe('study');
    expect(parsed.location).toBe('\u56fe\u4e66\u9986');
    expect(parsed.title).toBe('\u590d\u4e60');
  });

  it('parses colloquial chinese durations like two and a half hours', () => {
    const parsed = fallbackParseInput(
      '\u5199\u8bba\u6587\u4e24\u4e2a\u534a\u5c0f\u65f6',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );

    expect(parsed.type).toBe('todo');
    expect(parsed.estimated_minutes).toBe(150);
    expect(parsed.title).toBe('\u5199\u8bba\u6587');
  });

  it('keeps explicit day requests with colloquial chinese durations as all-day events', () => {
    const parsed = fallbackParseInput(
      '\u660e\u5929\u5199\u8bba\u6587\u4e24\u4e2a\u534a\u5c0f\u65f6',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );

    expect(parsed.type).toBe('event');
    expect(parsed.is_all_day).toBe(true);
    expect(parsed.due_date).toBe('2026-03-29');
    expect(parsed.estimated_minutes).toBe(150);
    expect(parsed.title).toBe('\u5199\u8bba\u6587');
  });

  it('parses half-hour chinese time ranges as timed events', () => {
    const parsed = fallbackParseInput(
      '\u660e\u5929\u51cc\u6668\u4e00\u70b9\u534a\u5230\u51cc\u6668\u4e09\u70b9\u534a\u5199\u8bba\u6587',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );
    const start = formatInTimezone(parsed.start_at, SHANGHAI_TIMEZONE);
    const end = formatInTimezone(parsed.end_at, SHANGHAI_TIMEZONE);

    expect(parsed.type).toBe('event');
    expect(parsed.estimated_minutes).toBe(120);
    expect(parsed.title).toBe('\u5199\u8bba\u6587');
    expect(start).toMatchObject({
      day: '29',
      hour: '01',
      minute: '30',
      month: '03',
      year: '2026',
    });
    expect(end).toMatchObject({
      day: '29',
      hour: '03',
      minute: '30',
      month: '03',
      year: '2026',
    });
  });

  it('keeps partial half-hour chinese times as confirmable timed events', () => {
    const parsed = fallbackParseInput(
      '\u660e\u5929\u51cc\u6668\u4e00\u70b9\u534a\u5728A44\u89c1\u5bfc\u5e08',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );
    const start = formatInTimezone(parsed.start_at, SHANGHAI_TIMEZONE);
    const end = formatInTimezone(parsed.end_at, SHANGHAI_TIMEZONE);

    expect(parsed.type).toBe('event');
    expect(parsed.location).toBe('A44');
    expect(parsed.needs_confirmation).toBe(true);
    expect(parsed.estimated_minutes).toBe(60);
    expect(parsed.title).toBe('\u89c1\u5bfc\u5e08');
    expect(start).toMatchObject({
      day: '29',
      hour: '01',
      minute: '30',
      month: '03',
      year: '2026',
    });
    expect(end).toMatchObject({
      day: '29',
      hour: '02',
      minute: '30',
      month: '03',
      year: '2026',
    });
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

  it('reconciles estimated_minutes from explicit timed range even when AI is wrong', () => {
    const normalized = normalizeParseResult(
      {
        end_at: '2026-03-30T10:00:00.000Z',
        estimated_minutes: 60,
        start_at: '2026-03-30T06:00:00.000Z',
        title: '\u8ba8\u8bba\u8bba\u6587',
        type: 'event',
      },
      '\u4e0b\u5468\u4e00\u4e0b\u53482\u70b9\u52306\u70b9\u5728\u56fe\u4e66\u9986\u8ba8\u8bba\u8bba\u6587',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );

    expect(normalized.estimated_minutes).toBe(240);
    expect(normalized.location).toBe('\u56fe\u4e66\u9986');
  });

  it('cleans time fragments out of english ai locations', () => {
    const normalized = normalizeParseResult(
      {
        estimated_minutes: 60,
        location: '3 PM in A44',
        priority: 'medium',
        title: 'Meet my advisor',
      },
      'Meet my advisor tomorrow at 3 PM in A44',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );

    expect(normalized.location).toBe('A44');
    expect(normalized.start_at).not.toBeNull();
  });

  it('cleans trailing temporal fragments out of english ai locations', () => {
    const normalized = normalizeParseResult(
      {
        estimated_minutes: 240,
        location: 'library next Monday from 2 PM',
        title: 'Discussion',
      },
      'Discussion in the library next Monday from 2 PM to 6 PM',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );

    expect(normalized.location).toBe('library');
    expect(normalized.estimated_minutes).toBe(240);
  });

  it('cleans chinese ai title and location fragments', () => {
    const normalized = normalizeParseResult(
      {
        location: 'Jubilee Campus\u5f00\u7ec4\u4f1a',
        priority: 'high',
        title: '\u5c3d\u5feb\u5728Jubilee Campus\u5f00\u7ec4\u4f1a',
      },
      '\u5c3d\u5feb\u5728Jubilee Campus\u5f00\u7ec4\u4f1a',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );

    expect(normalized.title).toBe('\u5f00\u7ec4\u4f1a');
    expect(normalized.location).toBe('Jubilee Campus');
    expect(normalized.priority).toBe('high');
  });
});

describe('buildExtractedFields', () => {
  it('returns the fixed five-field response shape for todos', () => {
    const parsed = fallbackParseInput(
      '\u4e0b\u4e2a\u6708\u627e\u5bfc\u5e08\u804a\u8bba\u6587',
      SHANGHAI_TIMEZONE,
      REFERENCE_NOW
    );
    const extracted = buildExtractedFields(parsed, SHANGHAI_TIMEZONE);

    expect(parsed.type).toBe('todo');
    expect(extracted).toEqual({
      duration_minutes: 120,
      location: '',
      priority: 'low',
      time: {
        due_date: null,
        end_at: null,
        is_all_day: false,
        start_at: null,
        timezone: SHANGHAI_TIMEZONE,
      },
      title: '\u4e0b\u4e2a\u6708\u627e\u5bfc\u5e08\u804a\u8bba\u6587',
    });
  });
});

describe('title and location extraction', () => {
  it('extracts a concise chinese action title', () => {
    expect(titleFromText('\u4e0b\u5468\u4e00\u4e0b\u53482\u70b9\u52306\u70b9\u5728\u56fe\u4e66\u9986\u8ba8\u8bba\u8bba\u6587')).toBe(
      '\u8ba8\u8bba\u8bba\u6587'
    );
  });

  it('cleans chinese location boundaries', () => {
    expect(inferLocation('\u660e\u5929\u4e0b\u5348\u4e09\u70b9\u5728A44\u89c1\u5bfc\u5e08')).toBe('A44');
  });

  it('keeps english campus location intact', () => {
    expect(inferLocation('Monday 2pm to 6pm meeting at Jubilee Campus')).toBe('Jubilee Campus');
  });

  it('strips urgency and dangling prepositions from english titles', () => {
    expect(
      titleFromText('Urgent write the project proposal on Wednesday in Portland Building for 90 minutes')
    ).toBe('write the project proposal');
  });

  it('strips colloquial chinese duration fragments from titles', () => {
    expect(titleFromText('\u5199\u8bba\u6587\u4e24\u4e2a\u534a\u5c0f\u65f6')).toBe('\u5199\u8bba\u6587');
    expect(titleFromText('\u5199\u8bba\u6587\u4fe9\u5c0f\u65f6\u534a')).toBe('\u5199\u8bba\u6587');
  });
});
