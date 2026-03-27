import { DEFAULT_TIMEZONE } from '@/lib/constants';
import type { Item } from '@/lib/types';

type DateLike = Date | string | null | undefined;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function safeTimezone(timezone?: string | null) {
  if (!timezone) {
    return DEFAULT_TIMEZONE;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function toDate(value: DateLike) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDayLabel(
  value: DateLike,
  locale: string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
) {
  const date = toDate(value);
  if (!date) {
    return 'TBD';
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    timeZone: safeTimezone(timezone),
    ...options,
  }).format(date);
}

export function formatTimeLabel(
  value: DateLike,
  locale: string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
) {
  const date = toDate(value);
  if (!date) {
    return '--:--';
  }

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: safeTimezone(timezone),
    ...options,
  }).format(date);
}

export function formatDateTimeLabel(
  value: DateLike,
  locale: string,
  timezone: string
) {
  const date = toDate(value);
  if (!date) {
    return 'Unscheduled';
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: safeTimezone(timezone),
  }).format(date);
}

type EventTimeRangeInput = {
  end?: DateLike;
  isAllDay?: boolean;
  locale: string;
  start: DateLike;
  timezone: string;
};

export function formatEventTimeRange({
  end,
  isAllDay = false,
  locale,
  start,
  timezone,
}: EventTimeRangeInput) {
  if (isAllDay) {
    return locale.startsWith('zh') ? '\u5168\u5929' : 'All day';
  }

  const startLabel = formatTimeLabel(start, locale, timezone);
  const endDate = toDate(end);

  if (!endDate) {
    return startLabel;
  }

  const endLabel = formatTimeLabel(endDate, locale, timezone);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

export function getMonthGrid(reference: Date) {
  const first = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function getWeekRange(reference: Date) {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  start.setDate(reference.getDate() - reference.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function isSameDay(left: DateLike, right: DateLike) {
  const leftDate = toDate(left);
  const rightDate = toDate(right);

  if (!leftDate || !rightDate) {
    return false;
  }

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

export function toDateInputValue(date: DateLike) {
  const value = toDate(date);
  if (!value) {
    return '';
  }

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function toDateTimeInputValue(date: DateLike) {
  const value = toDate(date);
  if (!value) {
    return '';
  }

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function toTimeInputValue(date: DateLike) {
  const value = toDate(date);
  if (!value) {
    return '';
  }

  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function buildTimeOptions(stepMinutes = 30) {
  const step = Math.max(1, Math.min(60, Math.round(stepMinutes)));
  const total = Math.floor((24 * 60) / step);

  return Array.from({ length: total }, (_, index) => {
    const minutes = index * step;
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${pad(hour)}:${pad(minute)}`;
  });
}

export function combineLocalDateAndTime(
  datePart: string | null | undefined,
  timePart: string | null | undefined
) {
  if (!datePart) {
    return null;
  }

  const time = timePart && /^\d{2}:\d{2}$/.test(timePart) ? timePart : '00:00';
  return `${datePart}T${time}`;
}

export function isEndAfterStart(start: DateLike, end: DateLike) {
  const startDate = toDate(start);
  const endDate = toDate(end);

  if (!startDate || !endDate) {
    return true;
  }

  return endDate.getTime() > startDate.getTime();
}

export function addMinutes(value: string, minutes: number) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function pickItemDate(item: Item) {
  if (item.start_at) {
    return item.start_at;
  }

  if (item.due_date) {
    return `${item.due_date}T00:00:00`;
  }

  return item.created_at;
}

export function sortItems(items: Item[]) {
  return [...items].sort((left, right) => {
    const leftDate = toDate(pickItemDate(left))?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightDate =
      toDate(pickItemDate(right))?.getTime() ?? Number.MAX_SAFE_INTEGER;

    if (left.status === 'completed' && right.status !== 'completed') {
      return 1;
    }

    if (left.status !== 'completed' && right.status === 'completed') {
      return -1;
    }

    return leftDate - rightDate;
  });
}

export function isItemOnDate(item: Item, date: Date) {
  if (item.is_all_day && item.due_date) {
    return item.due_date === toDateInputValue(date);
  }

  return isSameDay(item.start_at, date);
}
