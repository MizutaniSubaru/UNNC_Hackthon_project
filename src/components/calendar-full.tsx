'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DatesSetArg, EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core';
import zhCnLocale from '@fullcalendar/core/locales/zh-cn';
import dayGridPlugin from '@fullcalendar/daygrid';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { createLaunchOrigin } from '@/lib/launch-origin';
import { formatEventTimeRange } from '@/lib/time';
import type { Item, LaunchOrigin } from '@/lib/types';

type CalendarFullProps = {
  focusDate: Date;
  items: Item[];
  locale: string;
  onFocusDateChange: (date: Date) => void;
  onSelectItem: (item: Item, launchOrigin: LaunchOrigin | null) => void;
  timezone: string;
};

type CalendarEventExtendedProps = {
  locationLabel: string;
  sourceItem: Item;
  timeLabel: string;
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

function toCalendarEvent(item: Item, locale: string, timezone: string): EventInput | null {
  const start = resolveStart(item);

  if (!start) {
    return null;
  }

  return {
    allDay: item.is_all_day,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    classNames: [
      'planner-fullcalendar__event',
      item.is_all_day ? 'planner-fullcalendar__event--all-day' : 'planner-fullcalendar__event--timed',
      `planner-calendar-event--${item.group_key}`,
    ],
    end: item.is_all_day ? undefined : item.end_at ?? undefined,
    extendedProps: {
      locationLabel: item.location?.trim() ?? '',
      sourceItem: item,
      timeLabel: formatEventTimeRange({
        end: item.end_at,
        isAllDay: item.is_all_day,
        locale,
        start,
        timezone,
      }),
    } satisfies CalendarEventExtendedProps,
    id: String(item.id),
    start,
    textColor: '#17304f',
    title: item.title,
  };
}

function MonthEventCard({
  crossDay,
  title,
  tooltip,
  groupKey,
}: {
  crossDay: boolean;
  title: string;
  tooltip: string;
  groupKey?: string;
}) {
  const className = crossDay
    ? 'planner-calendar-month-event planner-calendar-month-event--cross-day'
    : 'planner-calendar-month-event';

  let backgroundColor, borderColor, accentColor;

  switch (groupKey) {
    case 'study':
      backgroundColor = 'linear-gradient(135deg, rgb(119 169 255 / 98%) 0%, rgba(230, 240, 255, 0.96) 100%)';
      borderColor = 'rgba(178, 197, 255, 0.95)';
      accentColor = 'linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, #4f7cff 100%)';
      break;
    case 'work':
      backgroundColor = 'linear-gradient(135deg, rgb(255 130 100 / 98%) 0%, rgba(255, 235, 230, 0.96) 100%)';
      borderColor = 'rgba(255, 190, 175, 0.95)';
      accentColor = 'linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, #ff6b4a 100%)';
      break;
    case 'life':
      backgroundColor = 'linear-gradient(135deg, rgb(90 200 140 / 98%) 0%, rgba(225, 245, 235, 0.96) 100%)';
      borderColor = 'rgba(168, 220, 196, 0.95)';
      accentColor = 'linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, #39b07a 100%)';
      break;
    case 'health':
      backgroundColor = 'linear-gradient(135deg, rgb(250 180 80 / 98%) 0%, rgba(255, 240, 215, 0.96) 100%)';
      borderColor = 'rgba(251, 216, 158, 0.95)';
      accentColor = 'linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, #f5a623 100%)';
      break;
    case 'other':
    default:
      backgroundColor = 'linear-gradient(135deg, rgb(150 140 250 / 98%) 0%, rgba(238, 235, 253, 0.96) 100%)';
      borderColor = 'rgba(197, 191, 251, 0.95)';
      accentColor = 'linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, #7b6ef6 100%)';
      break;
  }

  return (
    <div aria-label={tooltip} className={className} title={tooltip} style={{ background: backgroundColor, borderColor: borderColor, borderWidth: 1, borderStyle: 'solid' }}>
      <span aria-hidden="true" className="planner-calendar-month-event__accent" style={{ background: accentColor }} />
      <span className="planner-calendar-month-event__title">{title}</span>
    </div>
  );
}

type TimeGridEventSurfaceProps = {
  accentColor: string;
  ariaHidden?: boolean;
  backgroundColor: string;
  borderColor: string;
  className: string;
  frameRef?: React.Ref<HTMLDivElement>;
  locationText: string;
  showMeta: boolean;
  timeLabel: string;
  title: string;
};

function TimeGridEventSurface({
  accentColor,
  ariaHidden,
  backgroundColor,
  borderColor,
  className,
  frameRef,
  locationText,
  showMeta,
  timeLabel,
  title,
}: TimeGridEventSurfaceProps) {
  return (
    <div
      aria-hidden={ariaHidden}
      ref={frameRef}
      className={className}
      style={{
        background: backgroundColor,
        borderColor,
        borderStyle: 'solid',
        borderWidth: 1,
      }}
    >
      <span aria-hidden="true" className="planner-calendar-week-event__accent" style={{ background: accentColor }} />
      <div className="planner-calendar-week-event__body">
        <span className="planner-calendar-week-event__title">{title}</span>
        {showMeta ? (
          <span className="planner-calendar-week-event__meta-group">
            <span className="planner-calendar-week-event__meta planner-calendar-week-event__meta--time">
              {timeLabel}
            </span>
            {locationText ? (
              <span className="planner-calendar-week-event__meta planner-calendar-week-event__meta--location">
                {locationText}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

type TimeGridEventCardProps = {
  locationLabel: string;
  timeLabel: string;
  title: string;
  tooltip: string;
  groupKey?: string;
};

function TimeGridEventCard({
  locationLabel,
  timeLabel,
  title,
  tooltip,
  groupKey,
}: TimeGridEventCardProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [showMeta, setShowMeta] = useState(false);
  const locationText = locationLabel.trim();

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const measure = measureRef.current;

    if (!frame || !measure) {
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

      const nextShowMeta = measure.scrollHeight <= clientHeight + 1;

      setShowMeta((current) => (current === nextShowMeta ? current : nextShowMeta));
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

  let backgroundColor, borderColor, accentColor;

  switch (groupKey) {
    case 'study':
      backgroundColor = 'linear-gradient(140deg, rgb(51 97 188 / 98%) 0%, rgba(235, 242, 255, 0.98) 100%)';
      borderColor = 'rgba(178, 197, 255, 0.95)';
      accentColor = 'linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, #4f7cff 100%)';
      break;
    case 'work':
      backgroundColor = 'linear-gradient(140deg, rgb(220 70 40 / 98%) 0%, rgba(255, 225, 219, 0.98) 100%)';
      borderColor = 'rgba(255, 190, 175, 0.95)';
      accentColor = 'linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, #ff6b4a 100%)';
      break;
    case 'life':
      backgroundColor = 'linear-gradient(140deg, rgb(40 150 95 / 98%) 0%, rgba(215, 239, 228, 0.98) 100%)';
      borderColor = 'rgba(168, 220, 196, 0.95)';
      accentColor = 'linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, #39b07a 100%)';
      break;
    case 'health':
      backgroundColor = 'linear-gradient(140deg, rgb(210 130 20 / 98%) 0%, rgba(253, 237, 211, 0.98) 100%)';
      borderColor = 'rgba(251, 216, 158, 0.95)';
      accentColor = 'linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, #f5a623 100%)';
      break;
    case 'other':
    default:
      backgroundColor = 'linear-gradient(140deg, rgb(105 85 210 / 98%) 0%, rgba(229, 226, 253, 0.98) 100%)';
      borderColor = 'rgba(197, 191, 251, 0.95)';
      accentColor = 'linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, #7b6ef6 100%)';
      break;
  }

  return (
    <div
      aria-label={tooltip}
      className="planner-calendar-week-event"
      title={tooltip}
    >
      <TimeGridEventSurface
        accentColor={accentColor}
        backgroundColor={backgroundColor}
        borderColor={borderColor}
        className={`planner-calendar-week-event__frame${showMeta ? '' : ' planner-calendar-week-event__frame--title-only'}`}
        frameRef={frameRef}
        locationText={locationText}
        showMeta={showMeta}
        timeLabel={timeLabel}
        title={title}
      />
      <TimeGridEventSurface
        accentColor={accentColor}
        ariaHidden={true}
        backgroundColor={backgroundColor}
        borderColor={borderColor}
        className="planner-calendar-week-event__measure"
        frameRef={measureRef}
        locationText={locationText}
        showMeta={true}
        timeLabel={timeLabel}
        title={title}
      />
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
        onSelectItem(sourceItem, createLaunchOrigin(args.el.getBoundingClientRect()));
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
      const isCrossDaySegment = args.event.allDay && !(args.isStart && args.isEnd);
      const groupKey = args.event.classNames
        .find((className) => className.startsWith('planner-calendar-event--'))
        ?.replace('planner-calendar-event--', '');

      if (args.view.type === 'dayGridMonth' || args.event.allDay) {
        return <MonthEventCard crossDay={isCrossDaySegment} title={title} tooltip={tooltip} groupKey={groupKey} />;
      }

      return (
        <TimeGridEventCard
          locationLabel={eventProps.locationLabel}
          timeLabel={eventProps.timeLabel}
          title={title}
          tooltip={tooltip}
          groupKey={groupKey}
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
          eventMinHeight={26}
          eventShortHeight={36}
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
