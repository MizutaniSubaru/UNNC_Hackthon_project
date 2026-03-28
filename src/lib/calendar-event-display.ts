import { getDurationMinutes } from '@/lib/time';

export function getTimeGridEventDurationMinutes(startAt: string | null, endAt: string | null) {
  return getDurationMinutes(startAt, endAt);
}

export function isShortTimeGridEventDuration(durationMinutes: number | null) {
  return durationMinutes !== null && durationMinutes <= 60;
}

export function shouldUseTitleOnlyTimeGridEvent(input: {
  compact: boolean;
  durationMinutes: number | null;
}) {
  return input.compact || isShortTimeGridEventDuration(input.durationMinutes);
}
