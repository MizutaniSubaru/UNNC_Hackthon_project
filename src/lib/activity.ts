import type { Json } from '@/lib/database.types';
import type { ActivityAction, Item } from '@/lib/types';

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return 'empty';
  }

  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }

  return String(value);
}

function summarizeDiff(previous: Item, next: Item) {
  const changes: string[] = [];

  if (previous.title !== next.title) {
    changes.push(`title: "${previous.title}" -> "${next.title}"`);
  }

  if (previous.start_at !== next.start_at || previous.end_at !== next.end_at) {
    changes.push(
      `time: ${formatValue(previous.start_at)} - ${formatValue(previous.end_at)} -> ${formatValue(next.start_at)} - ${formatValue(next.end_at)}`
    );
  }

  if (previous.due_date !== next.due_date) {
    changes.push(`date: ${formatValue(previous.due_date)} -> ${formatValue(next.due_date)}`);
  }

  if (previous.location !== next.location) {
    changes.push(`location: ${formatValue(previous.location)} -> ${formatValue(next.location)}`);
  }

  if (previous.group_key !== next.group_key) {
    changes.push(`group: ${previous.group_key} -> ${next.group_key}`);
  }

  if (previous.priority !== next.priority) {
    changes.push(`priority: ${previous.priority} -> ${next.priority}`);
  }

  if (previous.status !== next.status) {
    changes.push(`status: ${previous.status} -> ${next.status}`);
  }

  if (previous.estimated_minutes !== next.estimated_minutes) {
    changes.push(
      `duration: ${formatValue(previous.estimated_minutes)} -> ${formatValue(next.estimated_minutes)}`
    );
  }

  return changes;
}

export function buildCreatedLog(item: Item) {
  return {
    action: 'created' as ActivityAction,
    details_json: {
      after: {
        due_date: item.due_date,
        end_at: item.end_at,
        estimated_minutes: item.estimated_minutes,
        group_key: item.group_key,
        is_all_day: item.is_all_day,
        location: item.location,
        priority: item.priority,
        start_at: item.start_at,
        status: item.status,
      },
    } satisfies Json,
    item_id: item.id,
    item_title: item.title,
    item_type: item.type,
    summary: `Created ${item.type} "${item.title}".`,
  };
}

export function buildDeletedLog(item: Item) {
  return {
    action: 'deleted' as ActivityAction,
    details_json: {
      before: {
        due_date: item.due_date,
        end_at: item.end_at,
        group_key: item.group_key,
        location: item.location,
        priority: item.priority,
        start_at: item.start_at,
        status: item.status,
      },
    } satisfies Json,
    item_id: item.id,
    item_title: item.title,
    item_type: item.type,
    summary: `Deleted ${item.type} "${item.title}".`,
  };
}

export function buildUpdatedLog(previous: Item, next: Item) {
  const changes = summarizeDiff(previous, next);
  const becameCompleted =
    previous.status !== 'completed' && next.status === 'completed';

  return {
    action: (becameCompleted ? 'completed' : 'updated') as ActivityAction,
    details_json: {
      changes,
      next: {
        due_date: next.due_date,
        end_at: next.end_at,
        estimated_minutes: next.estimated_minutes,
        group_key: next.group_key,
        location: next.location,
        priority: next.priority,
        start_at: next.start_at,
        status: next.status,
      },
      previous: {
        due_date: previous.due_date,
        end_at: previous.end_at,
        estimated_minutes: previous.estimated_minutes,
        group_key: previous.group_key,
        location: previous.location,
        priority: previous.priority,
        start_at: previous.start_at,
        status: previous.status,
      },
    } satisfies Json,
    item_id: next.id,
    item_title: next.title,
    item_type: next.type,
    summary: becameCompleted
      ? `Completed "${next.title}".`
      : changes.length > 0
        ? `Updated "${next.title}": ${changes.join('; ')}.`
        : `Updated "${next.title}".`,
  };
}
