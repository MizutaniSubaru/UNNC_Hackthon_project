import type { Json } from '@/lib/database.types';
import type { ActivityAction, ActivityLog, Item } from '@/lib/types';

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

  return changes;
}

export function buildCreatedLog(item: Item) {
  return {
    action: 'created' as ActivityAction,
    details_json: {
      after: {
        due_date: item.due_date,
        end_at: item.end_at,
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
        group_key: next.group_key,
        location: next.location,
        priority: next.priority,
        start_at: next.start_at,
        status: next.status,
      },
      previous: {
        due_date: previous.due_date,
        end_at: previous.end_at,
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

export function buildUndoLog(params: {
  afterItem: Item | null;
  beforeItem: Item | null;
  reversedUndo?: boolean;
  targetLog: ActivityLog;
}) {
  const { afterItem, beforeItem, reversedUndo = false, targetLog } = params;
  const title =
    targetLog.item_title || afterItem?.title || beforeItem?.title || 'Untitled item';

  return {
    action: 'updated' as ActivityAction,
    details_json: {
      item_after: afterItem,
      item_before: beforeItem,
      undo_meta: {
        reversed_undo: reversedUndo,
        target_action: targetLog.action,
        target_log_id: targetLog.id,
      },
    } satisfies Json,
    item_id: targetLog.item_id,
    item_title: title,
    item_type: targetLog.item_type,
    summary: reversedUndo
      ? `Reverted undo for "${title}".`
      : `Undid ${targetLog.action} for "${title}".`,
  };
}
