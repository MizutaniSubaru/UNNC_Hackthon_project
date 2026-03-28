import { DEFAULT_EVENT_MINUTES } from '@/lib/constants';
import { isEndAfterStart, toDateInputValue, toDateTimeInputValue } from '@/lib/time';
import type { ItemType } from '@/lib/types';

export type EditableTimingState = {
  due_date: string | null;
  end_at: string | null;
  estimated_minutes: number | null;
  is_all_day: boolean;
  start_at: string | null;
  type: string;
};

export type TimingFieldVisibility = {
  disableEnd: boolean;
  showAllDay: boolean;
  showDueDate: boolean;
  showEventTiming: boolean;
  startDateOnly: boolean;
};

function resolveDurationMinutes(estimatedMinutes: number | null) {
  return typeof estimatedMinutes === 'number' && Number.isFinite(estimatedMinutes) && estimatedMinutes > 0
    ? estimatedMinutes
    : DEFAULT_EVENT_MINUTES;
}

function buildRoundedNow() {
  const now = new Date();
  now.setSeconds(0, 0);
  const roundedMinutes = Math.ceil(now.getMinutes() / 30) * 30;
  now.setMinutes(roundedMinutes);
  return now;
}

export function ensureEndAfterStartValue(startAt: string | null, endAt: string | null) {
  if (!startAt || !endAt || isEndAfterStart(startAt, endAt)) {
    return endAt;
  }

  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    return endAt;
  }

  start.setMinutes(start.getMinutes() + 30);
  return toDateTimeInputValue(start);
}

export function buildDefaultStartAt(
  value: Pick<EditableTimingState, 'due_date' | 'start_at'>
) {
  if (value.start_at) {
    return toDateTimeInputValue(value.start_at);
  }

  if (value.due_date) {
    return `${value.due_date}T09:00`;
  }

  return toDateTimeInputValue(buildRoundedNow());
}

export function buildDefaultEndAt(startAt: string, estimatedMinutes: number | null) {
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  start.setMinutes(start.getMinutes() + resolveDurationMinutes(estimatedMinutes));
  return toDateTimeInputValue(start);
}

export function deriveDueDateFromStart(
  startAt: string | null,
  fallback: string | null = null
) {
  return toDateInputValue(startAt) || fallback;
}

export function getTodoDueDateValue(
  value: Pick<EditableTimingState, 'due_date' | 'start_at'>
) {
  return value.due_date ?? deriveDueDateFromStart(value.start_at, null);
}

export function getTimingFieldVisibility(
  value: Pick<EditableTimingState, 'is_all_day' | 'type'>
): TimingFieldVisibility {
  if (value.type === 'todo') {
    return {
      disableEnd: false,
      showAllDay: false,
      showDueDate: true,
      showEventTiming: false,
      startDateOnly: false,
    };
  }

  return {
    disableEnd: value.is_all_day,
    showAllDay: true,
    showDueDate: false,
    showEventTiming: true,
    startDateOnly: value.is_all_day,
  };
}

export function getDisplayStartAt(
  value: Pick<EditableTimingState, 'due_date' | 'start_at'>
) {
  return buildDefaultStartAt(value);
}

export function hasInvalidTimedEventRange(value: {
  end_at: string | null;
  is_all_day: boolean;
  start_at: string | null;
  type: string;
}) {
  if (value.type !== 'event' || value.is_all_day || !value.start_at || !value.end_at) {
    return false;
  }

  return !isEndAfterStart(value.start_at, value.end_at);
}

export function applyTypeChange<T extends EditableTimingState>(value: T, nextType: ItemType): T {
  if (nextType === value.type) {
    return value;
  }

  if (nextType === 'todo') {
    return {
      ...value,
      due_date: getTodoDueDateValue(value),
      end_at: null,
      is_all_day: false,
      start_at: null,
      type: 'todo',
    };
  }

  const nextStart = buildDefaultStartAt(value);
  const suggestedEnd = buildDefaultEndAt(nextStart, value.estimated_minutes);

  return {
    ...value,
    due_date: null,
    end_at: ensureEndAfterStartValue(nextStart, suggestedEnd),
    is_all_day: false,
    start_at: nextStart,
    type: 'event',
  };
}

export function applyAllDayChange<T extends EditableTimingState>(value: T, nextIsAllDay: boolean): T {
  if (value.type !== 'event' || nextIsAllDay === value.is_all_day) {
    return value;
  }

  const nextStart = buildDefaultStartAt(value);

  if (nextIsAllDay) {
    return {
      ...value,
      due_date: deriveDueDateFromStart(nextStart, value.due_date),
      end_at: null,
      is_all_day: true,
      start_at: nextStart,
    };
  }

  const suggestedEnd = value.end_at ?? buildDefaultEndAt(nextStart, value.estimated_minutes);
  return {
    ...value,
    due_date: null,
    end_at: ensureEndAfterStartValue(nextStart, suggestedEnd),
    is_all_day: false,
    start_at: nextStart,
  };
}

export function applyStartAtChange<T extends EditableTimingState>(value: T, nextStart: string): T {
  if (value.type !== 'event') {
    return value;
  }

  if (value.is_all_day) {
    return {
      ...value,
      due_date: deriveDueDateFromStart(nextStart, value.due_date),
      end_at: null,
      start_at: nextStart,
    };
  }

  return {
    ...value,
    due_date: null,
    end_at: ensureEndAfterStartValue(nextStart, value.end_at),
    start_at: nextStart,
  };
}

export function applyEndAtChange<T extends EditableTimingState>(value: T, nextEnd: string): T {
  if (value.type !== 'event' || value.is_all_day) {
    return value;
  }

  return {
    ...value,
    due_date: null,
    end_at: ensureEndAfterStartValue(value.start_at, nextEnd),
  };
}

export function sanitizeTimingForSubmission<T extends EditableTimingState>(value: T): T {
  if (value.type === 'todo') {
    return {
      ...value,
      due_date: getTodoDueDateValue(value),
      end_at: null,
      is_all_day: false,
      start_at: null,
    };
  }

  if (value.is_all_day) {
    const dateSource = value.start_at ?? (value.due_date ? `${value.due_date}T09:00` : null);
    return {
      ...value,
      due_date: deriveDueDateFromStart(dateSource, value.due_date),
      end_at: null,
      start_at: null,
    };
  }

  return {
    ...value,
    due_date: null,
    is_all_day: false,
  };
}
