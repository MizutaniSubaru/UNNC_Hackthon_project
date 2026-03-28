import { describe, expect, it } from 'bun:test';
import { PRIORITIES } from '@/lib/constants';
import {
  createDefaultTodoRailFilters,
  filterAndSortTodoRailItems,
  getDefaultGroupKeys,
  getDefaultPriorities,
} from '@/lib/todo-rail';
import type { Item } from '@/lib/types';

function makeItem(overrides: Partial<Item>): Item {
  return {
    created_at: '2026-03-28T08:00:00.000Z',
    due_date: '2026-03-28',
    end_at: null,
    estimated_minutes: 30,
    group_key: 'other',
    id: 'item',
    is_all_day: false,
    location: null,
    needs_confirmation: false,
    notes: null,
    parse_confidence: null,
    priority: 'medium',
    source_text: null,
    start_at: null,
    status: 'pending',
    title: 'Todo',
    type: 'todo',
    updated_at: '2026-03-28T08:00:00.000Z',
    ...overrides,
  };
}

describe('todo rail helpers', () => {
  const items: Item[] = [
    makeItem({
      due_date: '2026-04-04',
      group_key: 'work',
      id: 'work-medium',
      priority: 'medium',
      title: 'Work medium',
    }),
    makeItem({
      due_date: '2026-04-02',
      group_key: 'study',
      id: 'study-high-later',
      priority: 'high',
      title: 'Study high later',
    }),
    makeItem({
      due_date: '2026-03-30',
      group_key: 'health',
      id: 'health-high-earlier',
      priority: 'high',
      title: 'Health high earlier',
    }),
    makeItem({
      due_date: '2026-04-01',
      group_key: 'life',
      id: 'life-low',
      priority: 'low',
      title: 'Life low',
    }),
    makeItem({
      due_date: '2026-03-29',
      group_key: 'study',
      id: 'study-medium-earlier',
      priority: 'medium',
      title: 'Study medium earlier',
    }),
  ];

  it('sorts todos by nearest time by default', () => {
    const result = filterAndSortTodoRailItems(items, createDefaultTodoRailFilters());

    expect(result.map((item) => item.id)).toEqual([
      'study-medium-earlier',
      'health-high-earlier',
      'life-low',
      'study-high-later',
      'work-medium',
    ]);
  });

  it('filters to selected groups and keeps group bucket order', () => {
    const result = filterAndSortTodoRailItems(items, {
      selectedGroupKeys: ['study', 'health'],
      selectedPriorities: getDefaultPriorities(),
      sortMode: 'group',
    });

    expect(result.map((item) => item.id)).toEqual([
      'study-medium-earlier',
      'study-high-later',
      'health-high-earlier',
    ]);
  });

  it('filters to selected priorities and keeps priority bucket order', () => {
    const result = filterAndSortTodoRailItems(items, {
      selectedGroupKeys: getDefaultGroupKeys(),
      selectedPriorities: ['high', 'low'],
      sortMode: 'priority',
    });

    expect(result.map((item) => item.id)).toEqual([
      'health-high-earlier',
      'study-high-later',
      'life-low',
    ]);
  });

  it('returns the default reset state', () => {
    expect(createDefaultTodoRailFilters()).toEqual({
      selectedGroupKeys: getDefaultGroupKeys(),
      selectedPriorities: [...PRIORITIES],
      sortMode: 'time',
    });
  });

  it('returns an empty list when the selected bucket has no matches', () => {
    const result = filterAndSortTodoRailItems(items, {
      selectedGroupKeys: [],
      selectedPriorities: getDefaultPriorities(),
      sortMode: 'group',
    });

    expect(result).toEqual([]);
  });
});
