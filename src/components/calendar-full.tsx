'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { EventClickArg, EventInput } from '@fullcalendar/core';
import zhCnLocale from '@fullcalendar/core/locales/zh-cn';
import dayGridPlugin from '@fullcalendar/daygrid';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { GROUPS } from '@/lib/constants';
import type { Item } from '@/lib/types';

type CalendarFullProps = {
  focusDate: Date;
  items: Item[];
  locale: string;
  onFocusDateChange: (date: Date) => void;
  onSelectItem: (item: Item) => void;
};

const groupAccentMap = new Map<string, string>(
  GROUPS.map((group) => [group.key, group.accent])
);

function resolveStart(item: Item) {
  if (item.is_all_day) {
    return item.due_date ?? item.start_at ?? item.created_at;
  }

  return item.start_at ?? item.created_at;
}

function toCalendarEvent(item: Item): EventInput | null {
  const start = resolveStart(item);

  if (!start) {
    return null;
  }

  const accent = groupAccentMap.get(item.group_key) ?? '#14213d';

  return {
    allDay: item.is_all_day,
    backgroundColor: `${accent}22`,
    borderColor: accent,
    end: item.is_all_day ? undefined : item.end_at ?? undefined,
    extendedProps: {
      sourceItem: item,
    },
    id: String(item.id),
    start,
    textColor: '#14213d',
    title: item.title,
  };
}

function sameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function CalendarFull({
  focusDate,
  items,
  locale,
  onFocusDateChange,
  onSelectItem,
}: CalendarFullProps) {
  const calendarRef = useRef<FullCalendar | null>(null);

  const events = useMemo(
    () =>
      items
        .map((item) => toCalendarEvent(item))
        .filter((event): event is EventInput => Boolean(event)),
    [items]
  );

  const isChinese = locale.startsWith('zh');

  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();

    if (!calendarApi) {
      return;
    }

    const currentDate = calendarApi.getDate();
    if (!sameDate(currentDate, focusDate)) {
      calendarApi.gotoDate(focusDate);
    }
  }, [focusDate]);

  function handleDatesSet() {
    const calendarApi = calendarRef.current?.getApi();

    if (!calendarApi) {
      return;
    }

    const activeDate = calendarApi.getDate();
    if (!sameDate(activeDate, focusDate)) {
      onFocusDateChange(activeDate);
    }
  }

  function handleEventClick(args: EventClickArg) {
    const sourceItem = args.event.extendedProps.sourceItem as Item | undefined;
    if (sourceItem) {
      onSelectItem(sourceItem);
    }
  }

  return (
    <section className="planner-panel planner-panel--calendar">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">
            {isChinese ? '日历视图（FullCalendar）' : 'Calendar view (FullCalendar)'}
          </p>
        </div>
      </div>

      <div className="planner-fullcalendar">
        <FullCalendar
          buttonText={{
            month: isChinese ? '月' : 'Month',
            today: isChinese ? '今天' : 'Today',
            week: isChinese ? '周' : 'Week',
          }}
          datesSet={handleDatesSet}
          dayMaxEvents={3}
          eventClick={handleEventClick}
          events={events}
          firstDay={1}
          headerToolbar={{
            center: 'title',
            left: 'prev,next today',
            right: 'dayGridMonth,timeGridWeek',
          }}
          height={760}
          initialDate={focusDate}
          initialView="dayGridMonth"
          locale={isChinese ? 'zh-cn' : 'en'}
          locales={[zhCnLocale]}
          nowIndicator
          plugins={[dayGridPlugin, timeGridPlugin]}
          ref={calendarRef}
          scrollTime="07:00:00"
          slotDuration="00:30:00"
        />
      </div>
    </section>
  );
}
