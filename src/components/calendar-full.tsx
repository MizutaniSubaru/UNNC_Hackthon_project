'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { DatesSetArg, EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core';
import zhCnLocale from '@fullcalendar/core/locales/zh-cn';
import dayGridPlugin from '@fullcalendar/daygrid';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { GROUPS } from '@/lib/constants';
import { formatEventTimeRange } from '@/lib/time';
import type { Item } from '@/lib/types';

type CalendarFullProps = {
  focusDate: Date;
  items: Item[];
  locale: string;
  onFocusDateChange: (date: Date) => void;
  onSelectItem: (item: Item) => void;
  timezone: string;
};

type CalendarEventExtendedProps = {
  accent: string;
  borderColor: string;
  locationLabel: string;
  monthEnd: string;
  monthStart: string;
  sourceItem: Item;
  timeLabel: string;
  weekEnd: string;
  weekStart: string;
};

type EventPalette = {
  accent: string;
  borderColor: string;
  monthEnd: string;
  monthStart: string;
  weekEnd: string;
  weekStart: string;
};

type RgbColor = {
  blue: number;
  green: number;
  red: number;
};

type TimeGridEventCardProps = {
  locationLabel: string;
  style: CSSProperties;
  timeLabel: string;
  title: string;
  tooltip: string;
};

const TWO_DAY_VIEW_DAYS = 2;
const TWO_DAY_VIEW_NAME = 'timeGridTwoDayRail';

function resolveStart(item: Item) {
  if (item.is_all_day) {
    return item.due_date ?? item.start_at ?? item.created_at;
  }

  return item.start_at ?? item.created_at;
}

function sameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function clampColor(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHexColor(input: string): RgbColor {
  const hex = input.replace('#', '').trim();
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return {
      blue: 79,
      green: 124,
      red: 31,
    };
  }

  return {
    blue: Number.parseInt(normalized.slice(4, 6), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    red: Number.parseInt(normalized.slice(0, 2), 16),
  };
}

function mixColors(color: RgbColor, target: RgbColor, amount: number): RgbColor {
  return {
    blue: clampColor(color.blue + (target.blue - color.blue) * amount),
    green: clampColor(color.green + (target.green - color.green) * amount),
    red: clampColor(color.red + (target.red - color.red) * amount),
  };
}

function toColorString(color: RgbColor, alpha = 1) {
  if (alpha >= 1) {
    return `rgb(${color.red} ${color.green} ${color.blue})`;
  }

  return `rgba(${color.red}, ${color.green}, ${color.blue}, ${alpha})`;
}

function buildEventPalette(accent: string): EventPalette {
  const base = parseHexColor(accent);
  const white = { blue: 255, green: 255, red: 255 };
  const warmPaper = { blue: 238, green: 244, red: 250 };

  return {
    accent: toColorString(base),
    borderColor: toColorString(mixColors(base, white, 0.56), 0.95),
    monthEnd: toColorString(mixColors(base, white, 0.82), 0.96),
    monthStart: toColorString(mixColors(base, warmPaper, 0.9), 0.98),
    weekEnd: toColorString(mixColors(base, white, 0.8), 0.98),
    weekStart: toColorString(mixColors(base, warmPaper, 0.92), 0.98),
  };
}

function toCalendarEvent(item: Item, locale: string, timezone: string): EventInput | null {
  const start = resolveStart(item);

  if (!start) {
    return null;
  }

  const group = GROUPS.find((entry) => entry.key === item.group_key);
  const palette = buildEventPalette(group?.accent ?? '#4f7cff');

  return {
    allDay: item.is_all_day,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    classNames: [
      'planner-fullcalendar__event',
      item.is_all_day ? 'planner-fullcalendar__event--all-day' : 'planner-fullcalendar__event--timed',
    ],
    end: item.is_all_day ? undefined : item.end_at ?? undefined,
    extendedProps: {
      accent: palette.accent,
      borderColor: palette.borderColor,
      locationLabel: item.location?.trim() ?? '',
      monthEnd: palette.monthEnd,
      monthStart: palette.monthStart,
      sourceItem: item,
      timeLabel: formatEventTimeRange({
        end: item.end_at,
        isAllDay: item.is_all_day,
        locale,
        start,
        timezone,
      }),
      weekEnd: palette.weekEnd,
      weekStart: palette.weekStart,
    } satisfies CalendarEventExtendedProps,
    id: String(item.id),
    start,
    textColor: '#17304f',
    title: item.title,
  };
}

function buildEventStyle(eventProps: CalendarEventExtendedProps): CSSProperties {
  return {
    '--planner-calendar-accent': eventProps.accent,
    '--planner-calendar-border': eventProps.borderColor,
    '--planner-calendar-month-end': eventProps.monthEnd,
    '--planner-calendar-month-start': eventProps.monthStart,
    '--planner-calendar-week-end': eventProps.weekEnd,
    '--planner-calendar-week-start': eventProps.weekStart,
  } as CSSProperties;
}

function MonthEventCard({
  style,
  title,
  tooltip,
}: {
  style: CSSProperties;
  title: string;
  tooltip: string;
}) {
  return (
    <div aria-label={tooltip} className="planner-calendar-month-event" style={style} title={tooltip}>
      <span aria-hidden="true" className="planner-calendar-month-event__accent" />
      <span className="planner-calendar-month-event__title">{title}</span>
    </div>
  );
}

function TimeGridEventCard({
  locationLabel,
  style,
  timeLabel,
  title,
  tooltip,
}: TimeGridEventCardProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const measureTimeRef = useRef<HTMLSpanElement | null>(null);
  const [compact, setCompact] = useState(false);
  const locationText = locationLabel || '\u00a0';

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const measure = measureRef.current;
    const measureTime = measureTimeRef.current;

    if (!frame || !measure || !measureTime) {
      return;
    }

    let animationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;

    const updateLayout = () => {
      animationFrame = 0;

      const { clientHeight, clientWidth } = frame;
      if (clientHeight <= 0 || clientWidth <= 0) {
        return;
      }

      measure.style.width = `${clientWidth}px`;

      const fitsHeight = measure.scrollHeight <= clientHeight + 1;
      const fitsTime = measureTime.scrollWidth <= measureTime.clientWidth + 1;
      const nextCompact = !(fitsHeight && fitsTime);

      setCompact((current) => (current === nextCompact ? current : nextCompact));
    };

    const scheduleUpdate = () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      animationFrame = requestAnimationFrame(updateLayout);
    };

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(frame);
    }

    scheduleUpdate();

    return () => {
      resizeObserver?.disconnect();
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [locationText, timeLabel, title]);

  return (
    <div
      aria-label={tooltip}
      className={`planner-calendar-week-event${compact ? ' planner-calendar-week-event--compact' : ''}`}
      style={style}
      title={tooltip}
    >
      <div ref={frameRef} className="planner-calendar-week-event__frame">
        <span aria-hidden="true" className="planner-calendar-week-event__accent" />
        <div className="planner-calendar-week-event__body">
          <span className="planner-calendar-week-event__title">{title}</span>
          {compact ? null : (
            <span className="planner-calendar-week-event__meta-group">
              <span className="planner-calendar-week-event__meta planner-calendar-week-event__meta--time">
                {timeLabel}
              </span>
              <span className="planner-calendar-week-event__meta planner-calendar-week-event__meta--location">
                {locationText}
              </span>
            </span>
          )}
        </div>
      </div>

      <div aria-hidden="true" ref={measureRef} className="planner-calendar-week-event__measure">
        <span aria-hidden="true" className="planner-calendar-week-event__accent" />
        <div className="planner-calendar-week-event__body">
          <span className="planner-calendar-week-event__title">{title}</span>
          <span className="planner-calendar-week-event__meta-group">
            <span
              ref={measureTimeRef}
              className="planner-calendar-week-event__meta planner-calendar-week-event__meta--time"
            >
              {timeLabel}
            </span>
            <span className="planner-calendar-week-event__meta planner-calendar-week-event__meta--location">
              {locationText}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function CalendarFull({
  focusDate,
  items,
  locale,
  onFocusDateChange,
  onSelectItem,
  timezone,
}: CalendarFullProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const isChinese = locale.startsWith('zh');
  const buttonText = useMemo(
    () => ({
      month: isChinese ? '\u6708' : 'Month',
      today: isChinese ? '\u4eca\u5929' : 'Today',
    }),
    [isChinese]
  );
  const headerToolbar = useMemo(
    () => ({
      center: 'title',
      left: 'prev,next today',
      right: `dayGridMonth,${TWO_DAY_VIEW_NAME}`,
    }),
    []
  );
  const calendarViews = useMemo(
    () => ({
      [TWO_DAY_VIEW_NAME]: {
        buttonText: isChinese ? '\u5468' : 'Week',
        dateIncrement: { days: TWO_DAY_VIEW_DAYS },
        duration: { days: TWO_DAY_VIEW_DAYS },
        type: 'timeGrid',
      },
    }),
    [isChinese]
  );
  const calendarLocales = useMemo(() => [zhCnLocale], []);
  const calendarPlugins = useMemo(() => [dayGridPlugin, timeGridPlugin], []);

  const events = useMemo(
    () =>
      items
        .map((item) => toCalendarEvent(item, locale, timezone))
        .filter((event): event is EventInput => Boolean(event)),
    [items, locale, timezone]
  );

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

  const handleDatesSet = useCallback(
    (args: DatesSetArg) => {
      const activeDate = args.view.calendar.getDate();
      if (!sameDate(activeDate, focusDate)) {
        onFocusDateChange(activeDate);
      }
    },
    [focusDate, onFocusDateChange]
  );

  const handleEventClick = useCallback(
    (args: EventClickArg) => {
      const sourceItem = args.event.extendedProps.sourceItem as Item | undefined;
      if (sourceItem) {
        onSelectItem(sourceItem);
      }
    },
    [onSelectItem]
  );

  const renderEventContent = useCallback(
    (args: EventContentArg) => {
      const eventProps = args.event.extendedProps as CalendarEventExtendedProps;
      const title = args.event.title || (isChinese ? '\u672a\u547d\u540d\u4e8b\u9879' : 'Untitled item');
      const tooltip = [title, args.event.allDay ? null : eventProps.timeLabel, eventProps.locationLabel]
        .filter(Boolean)
        .join(' | ');
      const style = buildEventStyle(eventProps);

      if (args.view.type === 'dayGridMonth' || args.event.allDay) {
        return <MonthEventCard style={style} title={title} tooltip={tooltip} />;
      }

      return (
        <TimeGridEventCard
          locationLabel={eventProps.locationLabel}
          style={style}
          timeLabel={eventProps.timeLabel}
          title={title}
          tooltip={tooltip}
        />
      );
    },
    [isChinese]
  );

  return (
    <section className="planner-panel planner-panel--calendar">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">
            {isChinese ? '\u65e5\u5386\u89c6\u56fe\uff08FullCalendar\uff09' : 'Calendar view (FullCalendar)'}
          </p>
        </div>
      </div>

      <div className="planner-fullcalendar">
        <FullCalendar
          buttonText={buttonText}
          datesSet={handleDatesSet}
          dayMaxEvents={3}
          displayEventTime={false}
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          events={events}
          firstDay={1}
          headerToolbar={headerToolbar}
          height="auto"
          initialDate={focusDate}
          initialView="dayGridMonth"
          locale={isChinese ? 'zh-cn' : 'en'}
          locales={calendarLocales}
          plugins={calendarPlugins}
          ref={calendarRef}
          views={calendarViews}
        />
      </div>
    </section>
  );
}
