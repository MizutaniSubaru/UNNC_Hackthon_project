import { describe, expect, it } from 'bun:test';
import {
  applyAllDayChange,
  applyEndAtChange,
  applyStartAtChange,
  applyTypeChange,
  sanitizeTimingForSubmission,
} from '@/lib/editor-timing';

describe('editor timing helpers', () => {
  it('switches an event into a todo and keeps only a due date', () => {
    const next = applyTypeChange(
      {
        due_date: null,
        end_at: '2026-03-30T04:00',
        estimated_minutes: 60,
        is_all_day: false,
        start_at: '2026-03-30T03:00',
        type: 'event' as const,
      },
      'todo'
    );

    expect(next.type).toBe('todo');
    expect(next.due_date).toBe('2026-03-30');
    expect(next.start_at).toBeNull();
    expect(next.end_at).toBeNull();
    expect(next.is_all_day).toBe(false);
  });

  it('derives the all-day date from start while editing', () => {
    const next = applyAllDayChange(
      {
        due_date: null,
        end_at: '2026-03-30T04:00',
        estimated_minutes: 60,
        is_all_day: false,
        start_at: '2026-03-30T03:00',
        type: 'event' as const,
      },
      true
    );

    expect(next.is_all_day).toBe(true);
    expect(next.due_date).toBe('2026-03-30');
    expect(next.start_at).toBe('2026-03-30T03:00');
    expect(next.end_at).toBeNull();
  });

  it('cleans persisted timing fields for all-day and timed events', () => {
    const allDay = sanitizeTimingForSubmission({
      due_date: '2026-03-30',
      end_at: null,
      estimated_minutes: 60,
      is_all_day: true,
      start_at: '2026-03-30T03:00',
      type: 'event' as const,
    });
    const timed = sanitizeTimingForSubmission({
      due_date: '2026-03-30',
      end_at: '2026-03-30T04:00',
      estimated_minutes: 60,
      is_all_day: false,
      start_at: '2026-03-30T03:00',
      type: 'event' as const,
    });

    expect(allDay.due_date).toBe('2026-03-30');
    expect(allDay.start_at).toBeNull();
    expect(allDay.end_at).toBeNull();

    expect(timed.due_date).toBeNull();
    expect(timed.start_at).toBe('2026-03-30T03:00');
    expect(timed.end_at).toBe('2026-03-30T04:00');
  });

  it('syncs estimated duration when the end time changes', () => {
    const next = applyEndAtChange(
      {
        due_date: null,
        end_at: '2026-03-30T04:00',
        estimated_minutes: 60,
        is_all_day: false,
        start_at: '2026-03-30T03:00',
        type: 'event' as const,
      },
      '2026-03-30T07:00'
    );

    expect(next.end_at).toBe('2026-03-30T07:00');
    expect(next.estimated_minutes).toBe(240);
  });

  it('syncs estimated duration when the start time changes', () => {
    const next = applyStartAtChange(
      {
        due_date: null,
        end_at: '2026-03-30T07:00',
        estimated_minutes: 60,
        is_all_day: false,
        start_at: '2026-03-30T03:00',
        type: 'event' as const,
      },
      '2026-03-30T05:00'
    );

    expect(next.start_at).toBe('2026-03-30T05:00');
    expect(next.estimated_minutes).toBe(120);
  });
});
