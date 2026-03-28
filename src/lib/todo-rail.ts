import { GROUPS, PRIORITIES } from '@/lib/constants';
import { sortItems } from '@/lib/time';
import type { GroupKey, Item, Priority } from '@/lib/types';

export type TodoSortMode = 'time' | 'group' | 'priority';

export type TodoRailFilters = {
  selectedGroupKeys: GroupKey[];
  selectedPriorities: Priority[];
  sortMode: TodoSortMode;
};

const PRIORITY_BUCKET_ORDER: Priority[] = ['high', 'medium', 'low'];

export function getDefaultGroupKeys(): GroupKey[] {
  return GROUPS.map((group) => group.key as GroupKey);
}

export function getDefaultPriorities(): Priority[] {
  return [...PRIORITIES];
}

export function createDefaultTodoRailFilters(): TodoRailFilters {
  return {
    selectedGroupKeys: getDefaultGroupKeys(),
    selectedPriorities: getDefaultPriorities(),
    sortMode: 'time',
  };
}

export function filterAndSortTodoRailItems(items: Item[], filters: TodoRailFilters) {
  const todos = sortItems(items.filter((item) => item.type === 'todo'));

  if (filters.sortMode === 'time') {
    return todos;
  }

  if (filters.sortMode === 'group') {
    const selectedGroups = new Set(filters.selectedGroupKeys);

    return GROUPS.flatMap((group) =>
      selectedGroups.has(group.key as GroupKey)
        ? todos.filter((item) => item.group_key === group.key)
        : []
    );
  }

  const selectedPriorities = new Set(filters.selectedPriorities);

  return PRIORITY_BUCKET_ORDER.flatMap((priority) =>
    selectedPriorities.has(priority)
      ? todos.filter((item) => item.priority === priority)
      : []
  );
}
