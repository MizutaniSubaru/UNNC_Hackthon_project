import { describe, expect, it } from 'bun:test';
import { normalizeCreatePayload, normalizeUpdatePayload } from '@/lib/item-payload';
import type { Item } from '@/lib/types';

const BASE_ITEM: Item = {
  created_at: '2026-03-28T02:00:00.000Z',
  due_date: null,
  end_at: '2026-03-30T10:00:00.000Z',
  estimated_minutes: 60,
  group_key: 'work',
  id: 'item-1',
  is_all_day: false,
  location: 'Jubilee Campus',
  needs_confirmation: false,
  notes: null,
  parse_confidence: null,
  priority: 'medium',
  source_text: null,
  start_at: '2026-03-30T06:00:00.000Z',
  status: 'scheduled',
  title: 'Meeting',
  type: 'event',
  updated_at: '2026-03-28T02:00:00.000Z',
};

describe('item payload normalization', () => {
  it('reconciles create payload duration from the explicit timed range', () => {
    const normalized = normalizeCreatePayload({
      end_at: '2026-03-30T10:00:00.000Z',
      estimated_minutes: 60,
      start_at: '2026-03-30T06:00:00.000Z',
      title: 'Meeting',
      type: 'event',
    });

    expect(normalized.end_at).toBe('2026-03-30T10:00:00.000Z');
    expect(normalized.estimated_minutes).toBe(240);
  });

  it('reconciles update payload duration from the explicit timed range', () => {
    const normalized = normalizeUpdatePayload(
      {
        end_at: '2026-03-30T12:00:00.000Z',
        estimated_minutes: 60,
        start_at: '2026-03-30T06:00:00.000Z',
      },
      BASE_ITEM
    );

    expect(normalized.end_at).toBe('2026-03-30T12:00:00.000Z');
    expect(normalized.estimated_minutes).toBe(360);
  });
});
