'use client';

import {
  WheelPicker,
  WheelPickerWrapper,
  type WheelPickerOption,
} from '@ncdai/react-wheel-picker';
import { useEffect, useMemo, useState } from 'react';
import { MotionButton } from '@/components/ui/motion-button';

type DateTimeWheelPickerProps = {
  dateOnly?: boolean;
  locale: string;
  minValue?: string | null;
  onConfirm: (value: string) => void;
  strictAfterMin?: boolean;
  value: string | null;
  yearEnd?: number;
  yearStart?: number;
};

const WHEEL_ITEM_HEIGHT = 36;
const WHEEL_VISIBLE_COUNT = 20;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function isLeapYear(year: number) {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

function getDaysInMonth(year: number, month: number) {
  const monthToDays = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return monthToDays[month - 1] ?? 31;
}

function parseDateTime(value: string | null, yearStart: number, yearEnd: number) {
  const fallback = new Date();
  const parsed = value ? new Date(value) : fallback;
  const base = Number.isNaN(parsed.getTime()) ? fallback : parsed;

  const year = Math.min(yearEnd, Math.max(yearStart, base.getFullYear()));
  const month = base.getMonth() + 1;
  const day = base.getDate();
  const hour = base.getHours();
  const minute = base.getMinutes();

  return { day, hour, minute, month, year };
}

function toLocalDateTimeValue(year: number, month: number, day: number, hour: number, minute: number) {
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getTime();
}

function buildNumberOptions(
  values: number[],
  formatter: (value: number) => string = String
): WheelPickerOption<number>[] {
  return values.map((entry) => {
    const label = formatter(entry);

    return {
      label,
      textValue: label,
      value: entry,
    };
  });
}

export function DateTimeWheelPicker({
  dateOnly = false,
  locale,
  minValue,
  onConfirm,
  strictAfterMin = false,
  value,
  yearEnd = 3000,
  yearStart = 2000,
}: DateTimeWheelPickerProps) {
  const parsed = useMemo(() => parseDateTime(value, yearStart, yearEnd), [value, yearEnd, yearStart]);
  const isChinese = locale.startsWith('zh');
  const copy = isChinese
    ? {
      cancel: '\u53d6\u6d88',
      confirm: '\u786e\u8ba4',
      date: '\u65e5\u671f',
      day: '\u65e5',
      hour: '\u65f6',
      invalidRange: '\u65f6\u95f4\u5fc5\u987b\u665a\u4e8e\u5f00\u59cb\u65f6\u95f4\u3002',
      minute: '\u5206',
      month: '\u6708',
      pickDate: '\u9009\u62e9\u65e5\u671f',
      pickTime: '\u9009\u62e9\u65f6\u95f4',
      time: '\u65f6\u95f4',
      year: '\u5e74',
    }
    : {
      cancel: 'Cancel',
      confirm: 'Confirm',
      date: 'Date',
      day: 'Day',
      hour: 'Hour',
      invalidRange: 'Time must be later than start time.',
      minute: 'Minute',
      month: 'Month',
      pickDate: 'Pick Date',
      pickTime: 'Pick Time',
      time: 'Time',
      year: 'Year',
    };

  const [openPanel, setOpenPanel] = useState<'date' | 'time' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [committedYear, setCommittedYear] = useState(parsed.year);
  const [committedMonth, setCommittedMonth] = useState(parsed.month);
  const [committedDay, setCommittedDay] = useState(parsed.day);
  const [committedHour, setCommittedHour] = useState(parsed.hour);
  const [committedMinute, setCommittedMinute] = useState(parsed.minute);

  const [draftYear, setDraftYear] = useState(parsed.year);
  const [draftMonth, setDraftMonth] = useState(parsed.month);
  const [draftDay, setDraftDay] = useState(parsed.day);
  const [draftHour, setDraftHour] = useState(parsed.hour);
  const [draftMinute, setDraftMinute] = useState(parsed.minute);

  useEffect(() => {
    setCommittedYear(parsed.year);
    setCommittedMonth(parsed.month);
    setCommittedDay(parsed.day);
    setCommittedHour(parsed.hour);
    setCommittedMinute(parsed.minute);

    setDraftYear(parsed.year);
    setDraftMonth(parsed.month);
    setDraftDay(parsed.day);
    setDraftHour(parsed.hour);
    setDraftMinute(parsed.minute);
  }, [parsed]);

  useEffect(() => {
    if (dateOnly && openPanel === 'time') {
      setOpenPanel(null);
    }
  }, [dateOnly, openPanel]);

  const draftDaysInMonth = useMemo(() => getDaysInMonth(draftYear, draftMonth), [draftMonth, draftYear]);
  const safeDraftDay = Math.min(draftDay, draftDaysInMonth);

  useEffect(() => {
    if (draftDay !== safeDraftDay) {
      setDraftDay(safeDraftDay);
    }
  }, [draftDay, safeDraftDay]);

  const yearOptions = useMemo(
    () => buildNumberOptions(Array.from({ length: yearEnd - yearStart + 1 }, (_, index) => yearStart + index)),
    [yearEnd, yearStart]
  );
  const monthOptions = useMemo(
    () => buildNumberOptions(Array.from({ length: 12 }, (_, index) => index + 1), pad),
    []
  );
  const dayOptions = useMemo(
    () => buildNumberOptions(Array.from({ length: draftDaysInMonth }, (_, index) => index + 1), pad),
    [draftDaysInMonth]
  );
  const hourOptions = useMemo(
    () => buildNumberOptions(Array.from({ length: 24 }, (_, index) => index), pad),
    []
  );
  const minuteOptions = useMemo(
    () => buildNumberOptions(Array.from({ length: 60 }, (_, index) => index), pad),
    []
  );

  const committedDateValue = toLocalDateTimeValue(
    committedYear,
    committedMonth,
    committedDay,
    committedHour,
    committedMinute
  );
  const minTimestamp = toTimestamp(minValue);

  function isBlocked(candidateValue: string) {
    const candidate = toTimestamp(candidateValue);
    if (candidate === null || minTimestamp === null) {
      return false;
    }

    return strictAfterMin ? candidate <= minTimestamp : candidate < minTimestamp;
  }

  function dismissPanel() {
    setFeedback(null);
    setOpenPanel(null);
  }

  function openDatePanel() {
    setDraftYear(committedYear);
    setDraftMonth(committedMonth);
    setDraftDay(committedDay);
    setFeedback(null);
    setOpenPanel('date');
  }

  function openTimePanel() {
    setDraftHour(committedHour);
    setDraftMinute(committedMinute);
    setFeedback(null);
    setOpenPanel('time');
  }

  function cancelDateSelection() {
    setDraftYear(committedYear);
    setDraftMonth(committedMonth);
    setDraftDay(committedDay);
    dismissPanel();
  }

  function cancelTimeSelection() {
    setDraftHour(committedHour);
    setDraftMinute(committedMinute);
    dismissPanel();
  }

  function confirmDateSelection() {
    const nextValue = toLocalDateTimeValue(
      draftYear,
      draftMonth,
      safeDraftDay,
      committedHour,
      committedMinute
    );

    if (isBlocked(nextValue)) {
      setFeedback(copy.invalidRange);
      return;
    }

    setCommittedYear(draftYear);
    setCommittedMonth(draftMonth);
    setCommittedDay(safeDraftDay);
    setFeedback(null);
    onConfirm(nextValue);
    setOpenPanel(null);
  }

  function confirmTimeSelection() {
    const nextValue = toLocalDateTimeValue(
      committedYear,
      committedMonth,
      committedDay,
      draftHour,
      draftMinute
    );

    if (isBlocked(nextValue)) {
      setFeedback(copy.invalidRange);
      return;
    }

    setCommittedHour(draftHour);
    setCommittedMinute(draftMinute);
    setFeedback(null);
    onConfirm(nextValue);
    setOpenPanel(null);
  }

  const wheelClassNames = {
    highlightItem: 'wheel-picker__highlight-item',
    highlightWrapper: 'wheel-picker__highlight',
    optionItem: 'wheel-picker__option',
  } as const;

  return (
    <div className="wheel-picker">
      <div className="wheel-picker__triggers">
        <MotionButton className="wheel-picker__trigger" motionPreset="subtle" onClick={openDatePanel} type="button">
          {copy.pickDate} · {`${committedYear}-${pad(committedMonth)}-${pad(committedDay)}`}
        </MotionButton>
        {dateOnly ? null : (
          <MotionButton className="wheel-picker__trigger" motionPreset="subtle" onClick={openTimePanel} type="button">
            {copy.pickTime} · {`${pad(committedHour)}:${pad(committedMinute)}`}
          </MotionButton>
        )}
      </div>

      {openPanel ? (
        <MotionButton
          aria-label="Close picker"
          className="wheel-picker__overlay"
          motionPreset="overlay"
          onClick={dismissPanel}
          type="button"
        />
      ) : null}

      {openPanel === 'date' ? (
        <div className="wheel-picker__popover" role="dialog" aria-modal="true">
          <div className="wheel-picker__panel">
            <div className="wheel-picker__title">{copy.date}</div>
            <div className="wheel-picker__header wheel-picker__header--date">
              <span>{copy.year}</span>
              <span>{copy.month}</span>
              <span>{copy.day}</span>
            </div>
            <WheelPickerWrapper className="wheel-picker__triple">
              <WheelPicker
                classNames={wheelClassNames}
                onValueChange={setDraftYear}
                optionItemHeight={WHEEL_ITEM_HEIGHT}
                options={yearOptions}
                value={draftYear}
                visibleCount={WHEEL_VISIBLE_COUNT}
              />
              <WheelPicker
                classNames={wheelClassNames}
                infinite
                onValueChange={setDraftMonth}
                optionItemHeight={WHEEL_ITEM_HEIGHT}
                options={monthOptions}
                value={draftMonth}
                visibleCount={WHEEL_VISIBLE_COUNT}
              />
              <WheelPicker
                classNames={wheelClassNames}
                infinite
                onValueChange={setDraftDay}
                optionItemHeight={WHEEL_ITEM_HEIGHT}
                options={dayOptions}
                value={safeDraftDay}
                visibleCount={WHEEL_VISIBLE_COUNT}
              />
            </WheelPickerWrapper>
            <div className="wheel-picker__actions">
              <MotionButton
                className="wheel-picker__button wheel-picker__button--cancel"
                motionPreset="subtle"
                onClick={cancelDateSelection}
                type="button"
              >
                {copy.cancel}
              </MotionButton>
              <MotionButton
                className="wheel-picker__button wheel-picker__button--confirm"
                motionPreset="subtle"
                onClick={confirmDateSelection}
                type="button"
              >
                {copy.confirm}
              </MotionButton>
            </div>
          </div>
        </div>
      ) : null}

      {openPanel === 'time' && !dateOnly ? (
        <div className="wheel-picker__popover" role="dialog" aria-modal="true">
          <div className="wheel-picker__panel">
            <div className="wheel-picker__title">{copy.time}</div>
            <div className="wheel-picker__header wheel-picker__header--time">
              <span>{copy.hour}</span>
              <span>{copy.minute}</span>
            </div>
            <WheelPickerWrapper className="wheel-picker__double">
              <WheelPicker
                classNames={wheelClassNames}
                infinite
                onValueChange={setDraftHour}
                optionItemHeight={WHEEL_ITEM_HEIGHT}
                options={hourOptions}
                value={draftHour}
                visibleCount={WHEEL_VISIBLE_COUNT}
              />
              <WheelPicker
                classNames={wheelClassNames}
                infinite
                onValueChange={setDraftMinute}
                optionItemHeight={WHEEL_ITEM_HEIGHT}
                options={minuteOptions}
                value={draftMinute}
                visibleCount={WHEEL_VISIBLE_COUNT}
              />
            </WheelPickerWrapper>
            <div className="wheel-picker__actions">
              <MotionButton
                className="wheel-picker__button wheel-picker__button--cancel"
                motionPreset="subtle"
                onClick={cancelTimeSelection}
                type="button"
              >
                {copy.cancel}
              </MotionButton>
              <MotionButton
                className="wheel-picker__button wheel-picker__button--confirm"
                motionPreset="subtle"
                onClick={confirmTimeSelection}
                type="button"
              >
                {copy.confirm}
              </MotionButton>
            </div>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div className="wheel-picker__feedback">
          <span className="wheel-picker__hint">{feedback}</span>
        </div>
      ) : null}

      <input type="hidden" value={committedDateValue} readOnly />
    </div>
  );
}
