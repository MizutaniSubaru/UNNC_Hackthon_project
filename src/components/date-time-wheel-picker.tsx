'use client';

import { useEffect, useMemo, useState } from 'react';

type DateTimeWheelPickerProps = {
    locale: string;
    minValue?: string | null;
    onConfirm: (value: string) => void;
    strictAfterMin?: boolean;
    value: string | null;
    yearEnd?: number;
    yearStart?: number;
};

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

export function DateTimeWheelPicker({
    locale,
    minValue,
    onConfirm,
    strictAfterMin = false,
    value,
    yearEnd = 3000,
    yearStart = 2000,
}: DateTimeWheelPickerProps) {
    const parsed = useMemo(() => parseDateTime(value, yearStart, yearEnd), [value, yearEnd, yearStart]);

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

    const draftDaysInMonth = useMemo(
        () => getDaysInMonth(draftYear, draftMonth),
        [draftMonth, draftYear]
    );

    useEffect(() => {
        if (draftDay > draftDaysInMonth) {
            setDraftDay(draftDaysInMonth);
        }
    }, [draftDay, draftDaysInMonth]);

    const yearOptions = useMemo(
        () => Array.from({ length: yearEnd - yearStart + 1 }, (_, index) => yearStart + index),
        [yearEnd, yearStart]
    );
    const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
    const dayOptions = useMemo(
        () => Array.from({ length: draftDaysInMonth }, (_, index) => index + 1),
        [draftDaysInMonth]
    );
    const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, index) => index), []);
    const minuteOptions = useMemo(() => Array.from({ length: 60 }, (_, index) => index), []);

    const committedDateValue = toLocalDateTimeValue(
        committedYear,
        committedMonth,
        committedDay,
        committedHour,
        committedMinute
    );
    const minTimestamp = toTimestamp(minValue);

    const isChinese = locale.startsWith('zh');

    function isBlocked(candidateValue: string) {
        const candidate = toTimestamp(candidateValue);
        if (candidate === null || minTimestamp === null) {
            return false;
        }

        return strictAfterMin ? candidate <= minTimestamp : candidate < minTimestamp;
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
        setFeedback(null);
        setOpenPanel(null);
    }

    function cancelTimeSelection() {
        setDraftHour(committedHour);
        setDraftMinute(committedMinute);
        setFeedback(null);
        setOpenPanel(null);
    }

    function confirmDateSelection() {
        const nextValue = toLocalDateTimeValue(
            draftYear,
            draftMonth,
            draftDay,
            committedHour,
            committedMinute
        );

        if (isBlocked(nextValue)) {
            setFeedback(
                isChinese ? '时间必须晚于开始时间。' : 'Time must be later than start time.'
            );
            return;
        }

        setCommittedYear(draftYear);
        setCommittedMonth(draftMonth);
        setCommittedDay(draftDay);
        setFeedback(null);
        setOpenPanel(null);
        onConfirm(nextValue);
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
            setFeedback(
                isChinese ? '时间必须晚于开始时间。' : 'Time must be later than start time.'
            );
            return;
        }

        setCommittedHour(draftHour);
        setCommittedMinute(draftMinute);
        setFeedback(null);
        setOpenPanel(null);
        onConfirm(nextValue);
    }

    return (
        <div className="wheel-picker">
            <div className="wheel-picker__triggers">
                <button className="wheel-picker__trigger" onClick={openDatePanel} type="button">
                    {isChinese ? '选择日期' : 'Pick Date'} · {`${committedYear}-${pad(committedMonth)}-${pad(committedDay)}`}
                </button>
                <button className="wheel-picker__trigger" onClick={openTimePanel} type="button">
                    {isChinese ? '选择时间' : 'Pick Time'} · {`${pad(committedHour)}:${pad(committedMinute)}`}
                </button>
            </div>

            {openPanel ? <button className="wheel-picker__overlay" onClick={() => setOpenPanel(null)} type="button" /> : null}

            {openPanel === 'date' ? (
                <div className="wheel-picker__popover" role="dialog" aria-modal="true">
                    <div className="wheel-picker__panel">
                        <div className="wheel-picker__title">Date</div>
                        <div className="wheel-picker__header wheel-picker__header--date">
                            <span>Year</span>
                            <span>Month</span>
                            <span>Day</span>
                        </div>
                        <div className="wheel-picker__triple">
                            <select className="wheel-picker__select" onChange={(event) => setDraftYear(Number(event.target.value))} size={3} value={String(draftYear)}>
                                {yearOptions.map((entry) => (
                                    <option key={entry} value={entry}>{entry}</option>
                                ))}
                            </select>
                            <select className="wheel-picker__select" onChange={(event) => setDraftMonth(Number(event.target.value))} size={3} value={String(draftMonth)}>
                                {monthOptions.map((entry) => (
                                    <option key={entry} value={entry}>{entry}</option>
                                ))}
                            </select>
                            <select className="wheel-picker__select" onChange={(event) => setDraftDay(Number(event.target.value))} size={3} value={String(draftDay)}>
                                {dayOptions.map((entry) => (
                                    <option key={entry} value={entry}>{entry}</option>
                                ))}
                            </select>
                        </div>
                        <div className="wheel-picker__actions">
                            <button className="wheel-picker__button wheel-picker__button--cancel" onClick={cancelDateSelection} type="button">
                                {isChinese ? '取消' : 'Cancel'}
                            </button>
                            <button className="wheel-picker__button wheel-picker__button--confirm" onClick={confirmDateSelection} type="button">
                                {isChinese ? '确认' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {openPanel === 'time' ? (
                <div className="wheel-picker__popover" role="dialog" aria-modal="true">
                    <div className="wheel-picker__panel">
                        <div className="wheel-picker__title">Time</div>
                        <div className="wheel-picker__double">
                            <select className="wheel-picker__select" onChange={(event) => setDraftHour(Number(event.target.value))} size={3} value={String(draftHour)}>
                                {hourOptions.map((entry) => (
                                    <option key={entry} value={entry}>{pad(entry)}</option>
                                ))}
                            </select>
                            <select className="wheel-picker__select" onChange={(event) => setDraftMinute(Number(event.target.value))} size={3} value={String(draftMinute)}>
                                {minuteOptions.map((entry) => (
                                    <option key={entry} value={entry}>{pad(entry)}</option>
                                ))}
                            </select>
                        </div>
                        <div className="wheel-picker__actions">
                            <button className="wheel-picker__button wheel-picker__button--cancel" onClick={cancelTimeSelection} type="button">
                                {isChinese ? '取消' : 'Cancel'}
                            </button>
                            <button className="wheel-picker__button wheel-picker__button--confirm" onClick={confirmTimeSelection} type="button">
                                {isChinese ? '确认' : 'Confirm'}
                            </button>
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
