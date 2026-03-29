import type { Item } from './types';

/**
 * Generate iCalendar (.ics) data for planner items.
 */
export function generateICalendar(items: Item[], calendarName: string = 'My Calendar'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UNNC Planner//CN',
    `X-WR-CALNAME:${calendarName}`,
    'X-WR-TIMEZONE:Asia/Shanghai',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];

  items.forEach((item) => {
    const start = item.start_at ?? item.due_date ?? item.created_at;
    if (!start) {
      return;
    }

    const dtStart = formatICalDate(new Date(start), item.is_all_day);
    const dtEnd = item.end_at
      ? formatICalDate(new Date(item.end_at), item.is_all_day)
      : dtStart;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.id}@planner.local`,
      `DTSTAMP:${formatICalDate(new Date(), false)}`,
      `DTSTART${item.is_all_day ? ';VALUE=DATE' : ''}:${dtStart}`,
      `DTEND${item.is_all_day ? ';VALUE=DATE' : ''}:${dtEnd}`,
      `SUMMARY:${escapeICalText(item.title)}`,
      `DESCRIPTION:${escapeICalText(item.notes || '')}`,
      item.location ? `LOCATION:${escapeICalText(item.location)}` : '',
      `STATUS:${item.status === 'completed' ? 'CONFIRMED' : 'TENTATIVE'}`,
      item.group_key ? `CATEGORIES:${item.group_key}` : '',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
}

/**
 * Format a date into iCalendar-compatible output.
 */
function formatICalDate(date: Date, isAllDay: boolean): string {
  if (isAllDay) {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Escape iCalendar text fields.
 */
function escapeICalText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * Download planner items as an .ics file.
 */
export function downloadICalendar(items: Item[], filename: string = 'calendar.ics') {
  const icsContent = generateICalendar(items);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a data URL for planner items in iCalendar format.
 */
export function generateICalendarDataUrl(items: Item[]) {
  const icsContent = generateICalendar(items);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
}
