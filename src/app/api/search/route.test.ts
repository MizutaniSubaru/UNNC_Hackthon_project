import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { Item } from '@/lib/types';

let currentItems: Item[] = [];
let aiCalls: string[] = [];
let searchIntentPayload: unknown = null;
let searchRerankPayload: unknown = null;

function makeItem(overrides: Partial<Item>): Item {
  return {
    created_at: '2026-03-01T09:00:00.000Z',
    due_date: null,
    end_at: null,
    estimated_minutes: null,
    group_key: 'other',
    id: 'item-1',
    is_all_day: false,
    location: '',
    needs_confirmation: false,
    notes: '',
    parse_confidence: null,
    priority: 'medium',
    source_text: '',
    start_at: null,
    status: 'pending',
    title: 'Untitled',
    type: 'todo',
    updated_at: '2026-03-01T09:00:00.000Z',
    ...overrides,
  };
}

mock.module('@/lib/ai-provider', () => ({
  logAiJsonMetrics: () => {},
  requestAiJson: async ({ task }: { task: string }) => {
    aiCalls.push(task);
    if (task === 'search-intent') {
      return searchIntentPayload;
    }
    if (task === 'search-rerank') {
      return searchRerankPayload;
    }
    return null;
  },
}));

mock.module('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => ({ data: currentItems, error: null }),
        }),
      }),
    }),
  }),
}));

const { POST } = await import('@/app/api/search/route');

beforeEach(() => {
  aiCalls = [];
  searchIntentPayload = null;
  searchRerankPayload = null;
  currentItems = [];
});

describe('/api/search POST', () => {
  it('accepts AI keyword strings and keeps AI search enabled', async () => {
    currentItems = [
      makeItem({
        id: 'advisor-event',
        notes: 'Thesis discussion',
        start_at: '2026-03-28T10:00:00.000Z',
        title: 'Meet advisor',
        type: 'event',
      }),
      makeItem({
        id: 'groceries',
        title: 'Buy groceries',
      }),
    ];
    searchIntentPayload = {
      date_end: null,
      date_start: null,
      keywords: 'advisor',
      type: 'all',
    };

    const response = await POST(
      new Request('http://localhost/api/search', {
        body: JSON.stringify({
          locale: 'en-US',
          mode: 'ai',
          query: 'mentor',
          timezone: 'Asia/Shanghai',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(aiCalls).toEqual(['search-intent']);
    expect(payload.fallbackToKeyword).toBe(false);
    expect(payload.timeRange).toBeNull();
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]?.item.id).toBe('advisor-event');
  });

  it('ignores AI date hallucinations for summary queries without explicit time hints', async () => {
    currentItems = [
      makeItem({
        id: 'old-item',
        start_at: '2026-01-05T09:00:00.000Z',
        title: 'Meet advisor',
        type: 'event',
      }),
      makeItem({
        id: 'recent-item',
        start_at: '2026-03-22T09:00:00.000Z',
        title: 'Finish report',
        type: 'event',
      }),
    ];
    searchIntentPayload = {
      date_end: '2026-01-31',
      date_start: '2026-01-01',
      keywords: [],
      type: 'all',
    };
    searchRerankPayload = null;

    const response = await POST(
      new Request('http://localhost/api/search', {
        body: JSON.stringify({
          locale: 'en-US',
          mode: 'ai',
          query: 'what did i do',
          timezone: 'Asia/Shanghai',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(aiCalls).toContain('search-intent');
    expect(payload.fallbackToKeyword).toBe(false);
    expect(payload.timeRange).toBeNull();
    expect(payload.results).toHaveLength(2);
    expect(payload.results.map((result: { item: Item }) => result.item.id)).toEqual([
      'recent-item',
      'old-item',
    ]);
  });
});
