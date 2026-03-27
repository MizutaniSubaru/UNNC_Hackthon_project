import { DEFAULT_EVENT_MINUTES } from '@/lib/constants';
import { addMinutes } from '@/lib/time';
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

function asMinutes(value: unknown, fallback: number | null = null) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }

  return fallback;
}

function deriveEndAt(startAt: string | null, estimatedMinutes: number | null) {
  if (!startAt) {
    return null;
  }

  return addMinutes(startAt, estimatedMinutes ?? DEFAULT_EVENT_MINUTES);
}

export function normalizeCreatePayload(payload: Partial<CreateItemPayload>) {
  const type = asType(payload.type);
  const isAllDay = Boolean(payload.is_all_day);
  const estimatedMinutes = asMinutes(payload.estimated_minutes, type === 'event' ? 60 : 45);
  const startAt = asNullableString(payload.start_at);
  const dueDate = asNullableString(payload.due_date);

  return {
    due_date: isAllDay ? dueDate : dueDate,
    end_at:
      type === 'event' && !isAllDay
        ? asNullableString(payload.end_at) ?? deriveEndAt(startAt, estimatedMinutes)
        : null,
    estimated_minutes: estimatedMinutes,
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
    typeof payload.is_all_day === 'boolean' ? payload.is_all_day : currentItem.is_all_day;
  const estimatedMinutes = asMinutes(
    payload.estimated_minutes,
    currentItem.estimated_minutes
  );
  const startAt =
    payload.start_at !== undefined ? asNullableString(payload.start_at) : currentItem.start_at;

  return {
    due_date:
      payload.due_date !== undefined ? asNullableString(payload.due_date) : currentItem.due_date,
    end_at:
      type === 'event' && !isAllDay
        ? payload.end_at !== undefined
          ? asNullableString(payload.end_at) ?? deriveEndAt(startAt, estimatedMinutes)
          : currentItem.end_at ?? deriveEndAt(startAt, estimatedMinutes)
        : null,
    estimated_minutes: estimatedMinutes,
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
