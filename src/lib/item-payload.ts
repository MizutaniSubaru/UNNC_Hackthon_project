import { toDateInputValue } from '@/lib/time';
import type {
  CreateItemPayload,
  GroupKey,
  Item,
  ItemType,
  Priority,
  UpdateItemPayload,
} from '@/lib/types';

function asNullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asPriority(value: unknown): Priority {
  return value === 'low' || value === 'medium' || value === 'high' ? value : 'medium';
}

function asGroupKey(value: unknown): GroupKey {
  return value === 'study' ||
    value === 'work' ||
    value === 'life' ||
    value === 'health' ||
    value === 'other'
    ? value
    : 'other';
}

function asType(value: unknown): ItemType {
  return value === 'event' ? 'event' : 'todo';
}

function normalizeDueDate(type: ItemType, isAllDay: boolean, dueDate: string | null, startAt: string | null) {
  if (type === 'todo') {
    return dueDate ?? (toDateInputValue(startAt) || null);
  }

  if (isAllDay) {
    return dueDate ?? (toDateInputValue(startAt) || null);
  }

  return null;
}

function assertValidEventRange(
  type: ItemType,
  isAllDay: boolean,
  startAt: string | null,
  endAt: string | null
) {
  if (type !== 'event' || isAllDay || !startAt || !endAt) {
    return;
  }

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Invalid start or end datetime.');
  }

  if (endDate.getTime() <= startDate.getTime()) {
    throw new Error('End time must be later than start time.');
  }
}

export function normalizeCreatePayload(payload: Partial<CreateItemPayload>) {
  const type = asType(payload.type);
  const isAllDay = type === 'event' && Boolean(payload.is_all_day);
  const startAt = asNullableString(payload.start_at);
  const dueDate = asNullableString(payload.due_date);
  const endAt = type === 'event' && !isAllDay ? asNullableString(payload.end_at) : null;

  assertValidEventRange(type, isAllDay, startAt, endAt);

  return {
    due_date: normalizeDueDate(type, isAllDay, dueDate, startAt),
    end_at: endAt,
    estimated_minutes: null,
    group_key: asGroupKey(payload.group_key),
    is_all_day: isAllDay,
    location: asNullableString(payload.location),
    needs_confirmation: false,
    notes: asNullableString(payload.notes),
    parse_confidence:
      typeof payload.parse_confidence === 'number' && Number.isFinite(payload.parse_confidence)
        ? payload.parse_confidence
        : null,
    priority: asPriority(payload.priority),
    source_text: asNullableString(payload.source_text),
    start_at: type === 'event' && !isAllDay ? startAt : null,
    status:
      typeof payload.status === 'string' && payload.status.trim()
        ? payload.status.trim()
        : type === 'event'
          ? 'scheduled'
          : 'pending',
    title: asNullableString(payload.title) ?? 'Untitled item',
    type,
  };
}

export function normalizeUpdatePayload(
  payload: Partial<UpdateItemPayload>,
  currentItem: Item
) {
  const type = payload.type ? asType(payload.type) : (currentItem.type as ItemType);
  const isAllDay =
    type === 'event' &&
    (typeof payload.is_all_day === 'boolean' ? payload.is_all_day : currentItem.is_all_day);
  const startAt =
    payload.start_at !== undefined ? asNullableString(payload.start_at) : currentItem.start_at;
  const dueDate =
    payload.due_date !== undefined ? asNullableString(payload.due_date) : currentItem.due_date;
  const rawEndAt =
    type === 'event' && !isAllDay
      ? payload.end_at !== undefined
        ? asNullableString(payload.end_at)
        : currentItem.end_at
      : null;
  const endAt = rawEndAt;

  assertValidEventRange(type, isAllDay, startAt, endAt);

  return {
    due_date: normalizeDueDate(type, isAllDay, dueDate, startAt),
    end_at: endAt,
    estimated_minutes: null,
    group_key:
      payload.group_key !== undefined
        ? asGroupKey(payload.group_key)
        : (currentItem.group_key as GroupKey),
    is_all_day: isAllDay,
    location:
      payload.location !== undefined ? asNullableString(payload.location) : currentItem.location,
    notes: payload.notes !== undefined ? asNullableString(payload.notes) : currentItem.notes,
    parse_confidence:
      typeof payload.parse_confidence === 'number' && Number.isFinite(payload.parse_confidence)
        ? payload.parse_confidence
        : currentItem.parse_confidence,
    priority:
      payload.priority !== undefined
        ? asPriority(payload.priority)
        : (currentItem.priority as Priority),
    source_text:
      payload.source_text !== undefined
        ? asNullableString(payload.source_text)
        : currentItem.source_text,
    start_at: type === 'event' && !isAllDay ? startAt : null,
    status:
      typeof payload.status === 'string' && payload.status.trim()
        ? payload.status.trim()
        : currentItem.status,
    title:
      payload.title !== undefined
        ? asNullableString(payload.title) ?? currentItem.title
        : currentItem.title,
    type,
  };
}
