import { describe, expect, it } from 'bun:test';
import {
  getTimeGridEventDurationMinutes,
  isShortTimeGridEventDuration,
  shouldUseTitleOnlyTimeGridEvent,
} from '@/lib/calendar-event-display';

describe('calendar event display helpers', () => {
  it('treats 30 and 60 minute events as short events', () => {
    expect(isShortTimeGridEventDuration(30)).toBe(true);
    expect(isShortTimeGridEventDuration(60)).toBe(true);
    expect(isShortTimeGridEventDuration(90)).toBe(false);
  });

  it('prefers title-only layout for short events', () => {
    expect(
      shouldUseTitleOnlyTimeGridEvent({
        compact: false,
        durationMinutes: 60,
      })
    ).toBe(true);

    expect(
      shouldUseTitleOnlyTimeGridEvent({
        compact: false,
        durationMinutes: 120,
      })
    ).toBe(false);
  });

  it('still uses title-only layout when content is compact', () => {
    expect(
      shouldUseTitleOnlyTimeGridEvent({
        compact: true,
        durationMinutes: 180,
      })
    ).toBe(true);
  });

  it('derives time-grid duration from event datetimes', () => {
    expect(
      getTimeGridEventDurationMinutes(
        '2026-03-30T06:00:00.000Z',
        '2026-03-30T07:00:00.000Z'
      )
    ).toBe(60);
  });
});
