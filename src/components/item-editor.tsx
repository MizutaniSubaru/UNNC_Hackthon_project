'use client';

import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { X } from 'lucide-react';
import { DateTimeWheelPicker } from '@/components/date-time-wheel-picker';
import { COPY } from '@/lib/copy';
import { EVENT_STATUSES, GROUPS, PRIORITIES, TODO_STATUSES } from '@/lib/constants';
import { hasValidLaunchOrigin } from '@/lib/launch-origin';
import { isEndAfterStart, toDateInputValue, toDateTimeInputValue } from '@/lib/time';
import type { Item, ItemType, LaunchOrigin } from '@/lib/types';

type ItemEditorProps = {
  item: Item | null;
  launchOrigin: LaunchOrigin | null;
  locale: string;
  onChange: (item: Item) => void;
  onDelete: (item: Item) => void;
  onDismiss: () => void;
  onSave: (item: Item) => void;
};

type LaunchMotionStyle = CSSProperties & {
  '--planner-modal-origin-scale-x': string;
  '--planner-modal-origin-scale-y': string;
  '--planner-modal-origin-x': string;
  '--planner-modal-origin-y': string;
};

type ItemEditorFormProps = {
  copy: typeof COPY.en;
  item: Item;
  locale: string;
  onChange: (item: Item) => void;
  onDelete: (item: Item) => void;
  onSave: (item: Item) => void;
};

function ensureEndAfterStartValue(startAt: string | null, endAt: string | null) {
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

function buildDefaultStartAt(item: Item) {
  if (item.start_at) {
    return toDateTimeInputValue(item.start_at);
  }

  if (item.due_date) {
    return `${item.due_date}T09:00`;
  }

  const now = new Date();
  now.setSeconds(0, 0);
  const roundedMinutes = Math.ceil(now.getMinutes() / 30) * 30;
  now.setMinutes(roundedMinutes);

  return toDateTimeInputValue(now);
}

function buildDefaultEndAt(startAt: string, estimatedMinutes: number | null) {
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const duration =
    typeof estimatedMinutes === 'number' && Number.isFinite(estimatedMinutes) && estimatedMinutes > 0
      ? estimatedMinutes
      : 60;

  start.setMinutes(start.getMinutes() + duration);
  return toDateTimeInputValue(start);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => undefined;
      }

      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handleChange = () => onStoreChange();

      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      }

      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    },
    () => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
      }

      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
    () => false
  );
}

function buildLaunchMotionStyle(origin: LaunchOrigin, targetRect: DOMRect): LaunchMotionStyle {
  const targetWidth = Math.max(targetRect.width, 1);
  const targetHeight = Math.max(targetRect.height, 1);
  const originWidth = Math.max(Math.min(origin.width, targetWidth), 40);
  const originHeight = Math.max(Math.min(origin.height, targetHeight), 28);
  const sourceCenterX = origin.left + origin.width / 2;
  const sourceCenterY = origin.top + origin.height / 2;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  return {
    '--planner-modal-origin-scale-x': String(originWidth / targetWidth),
    '--planner-modal-origin-scale-y': String(originHeight / targetHeight),
    '--planner-modal-origin-x': `${sourceCenterX - targetCenterX}px`,
    '--planner-modal-origin-y': `${sourceCenterY - targetCenterY}px`,
  };
}

function ItemEditorForm({
  copy,
  item,
  locale,
  onChange,
  onDelete,
  onSave,
}: ItemEditorFormProps) {
  const statusOptions = item.type === 'event' ? EVENT_STATUSES : TODO_STATUSES;
  const invalidRange =
    item.type === 'event' &&
    !item.is_all_day &&
    item.start_at &&
    item.end_at &&
    !isEndAfterStart(item.start_at, item.end_at);

  function handleStartConfirm(nextStart: string) {
    const nextEnd = ensureEndAfterStartValue(nextStart, item.end_at);
    onChange({
      ...item,
      end_at: nextEnd,
      start_at: nextStart,
    });
  }

  function handleEndConfirm(nextEndInput: string) {
    const nextEnd = ensureEndAfterStartValue(item.start_at, nextEndInput);
    onChange({
      ...item,
      end_at: nextEnd,
    });
  }

  function handleTypeChange(nextType: ItemType) {
    if (nextType === item.type) {
      return;
    }

    if (nextType === 'todo') {
      onChange({
        ...item,
        end_at: null,
        is_all_day: false,
        start_at: null,
        status: 'pending',
        type: 'todo',
      });
      return;
    }

    const nextStart = buildDefaultStartAt(item);
    const suggestedEnd = buildDefaultEndAt(nextStart, item.estimated_minutes);

    onChange({
      ...item,
      end_at: ensureEndAfterStartValue(nextStart, suggestedEnd),
      is_all_day: false,
      start_at: nextStart,
      status: 'scheduled',
      type: 'event',
    });
  }

  return (
    <>
      <div className="editor-grid">
        <label className="field">
          <span>{copy.labels.title}</span>
          <input
            autoFocus
            onChange={(event) => onChange({ ...item, title: event.target.value })}
            value={item.title}
          />
        </label>

        <label className="field">
          <span>{copy.labels.type}</span>
          <select
            onChange={(event) => handleTypeChange(event.target.value as ItemType)}
            value={item.type}
          >
            <option value="todo">todo</option>
            <option value="event">event</option>
          </select>
        </label>

        <label className="field">
          <span>{copy.labels.group}</span>
          <select
            onChange={(event) => onChange({ ...item, group_key: event.target.value })}
            value={item.group_key}
          >
            {GROUPS.map((group) => (
              <option key={group.key} value={group.key}>
                {locale.startsWith('zh') ? group.labelZh : group.labelEn}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{copy.labels.priority}</span>
          <select
            onChange={(event) => onChange({ ...item, priority: event.target.value })}
            value={item.priority}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{copy.labels.status}</span>
          <select
            onChange={(event) => onChange({ ...item, status: event.target.value })}
            value={item.status}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{copy.labels.estimatedMinutes}</span>
          <input
            min={0}
            onChange={(event) =>
              onChange({
                ...item,
                estimated_minutes: Number(event.target.value || 0),
              })
            }
            type="number"
            value={item.estimated_minutes ?? 0}
          />
        </label>

        <label className="field field--checkbox">
          <span>{copy.badges.allDay}</span>
          <input
            checked={item.is_all_day}
            onChange={(event) =>
              onChange({
                ...item,
                end_at: event.target.checked ? null : item.end_at,
                is_all_day: event.target.checked,
                start_at: event.target.checked ? null : item.start_at,
              })
            }
            type="checkbox"
          />
        </label>

        <label className="field">
          <span>{copy.labels.dueDate}</span>
          <input
            onChange={(event) => onChange({ ...item, due_date: event.target.value || null })}
            type="date"
            value={item.due_date ?? toDateInputValue(item.start_at)}
          />
        </label>

        {!item.is_all_day ? (
          <>
            <div className="field">
              <span>{copy.labels.start}</span>
              <DateTimeWheelPicker
                locale={locale}
                onConfirm={handleStartConfirm}
                value={item.start_at}
              />
            </div>

            <div className="field">
              <span>{copy.labels.end}</span>
              <DateTimeWheelPicker
                locale={locale}
                minValue={item.start_at}
                onConfirm={handleEndConfirm}
                strictAfterMin
                value={item.end_at}
              />
            </div>
          </>
        ) : null}

        {!item.is_all_day && invalidRange ? (
          <p className="panel-note panel-note--warning field--full">
            {locale.startsWith('zh')
              ? '结束时间必须晚于开始时间。'
              : 'End time must be later than start time.'}
          </p>
        ) : null}

        <label className="field field--full">
          <span>{copy.labels.location}</span>
          <input
            onChange={(event) => onChange({ ...item, location: event.target.value })}
            value={item.location ?? ''}
          />
        </label>

        <label className="field field--full">
          <span>{copy.labels.notes}</span>
          <textarea
            onChange={(event) => onChange({ ...item, notes: event.target.value })}
            rows={4}
            value={item.notes ?? ''}
          />
        </label>

        <label className="field field--full">
          <span>{copy.labels.source}</span>
          <textarea
            onChange={(event) => onChange({ ...item, source_text: event.target.value })}
            rows={3}
            value={item.source_text ?? ''}
          />
        </label>
      </div>

      <div className="editor-actions">
        <button className="planner-button planner-button--ghost" onClick={() => onDelete(item)} type="button">
          {copy.actions.delete}
        </button>
        <button className="planner-button" onClick={() => onSave(item)} type="button">
          {copy.actions.save}
        </button>
      </div>
    </>
  );
}

export function ItemEditor({
  item,
  launchOrigin,
  locale,
  onChange,
  onDelete,
  onDismiss,
  onSave,
}: ItemEditorProps) {
  const copy = locale.startsWith('zh') ? COPY.zh : COPY.en;
  const dialogTitleId = useId();
  const overlayRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const itemId = item?.id ?? null;
  const useLaunchTransition = !prefersReducedMotion && hasValidLaunchOrigin(launchOrigin);

  useEffect(() => {
    if (!item) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [item]);

  useEffect(() => {
    if (!item) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onDismiss();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onDismiss]);

  useLayoutEffect(() => {
    if (!itemId) {
      return;
    }

    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) {
      return;
    }

    overlay.classList.remove('is-visible');
    panel.classList.remove('is-visible');
    panel.style.removeProperty('--planner-modal-origin-scale-x');
    panel.style.removeProperty('--planner-modal-origin-scale-y');
    panel.style.removeProperty('--planner-modal-origin-x');
    panel.style.removeProperty('--planner-modal-origin-y');

    if (!useLaunchTransition) {
      overlay.classList.add('is-visible');
      return;
    }

    const launchStyle = buildLaunchMotionStyle(launchOrigin, panel.getBoundingClientRect());
    panel.style.setProperty('--planner-modal-origin-scale-x', launchStyle['--planner-modal-origin-scale-x']);
    panel.style.setProperty('--planner-modal-origin-scale-y', launchStyle['--planner-modal-origin-scale-y']);
    panel.style.setProperty('--planner-modal-origin-x', launchStyle['--planner-modal-origin-x']);
    panel.style.setProperty('--planner-modal-origin-y', launchStyle['--planner-modal-origin-y']);

    const frame = requestAnimationFrame(() => {
      overlay.classList.add('is-visible');
      panel.classList.add('is-visible');
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [itemId, launchOrigin, useLaunchTransition]);

  if (!item) {
    return null;
  }

  const closeLabel = locale.startsWith('zh') ? '关闭编辑弹窗' : 'Close item editor';
  const panelClassName = [
    'planner-panel',
    'planner-panel--modal',
    'planner-panel--editor-modal',
    useLaunchTransition ? 'planner-panel--modal-launch' : 'planner-panel--modal-pop',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <button
        aria-label={closeLabel}
        className="planner-modal__overlay"
        onClick={onDismiss}
        ref={overlayRef}
        type="button"
      />
      <div
        aria-labelledby={dialogTitleId}
        aria-modal="true"
        className="planner-modal"
        role="dialog"
      >
        <section className={panelClassName} ref={panelRef}>
          <div className="planner-panel__header item-editor-modal__header">
            <div>
              <p className="planner-panel__eyebrow">{copy.sections.editor}</p>
              <h2 className="planner-panel__title" id={dialogTitleId}>
                {item.title}
              </h2>
            </div>
            <button
              aria-label={closeLabel}
              className="item-editor-modal__close"
              onClick={onDismiss}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>

          <ItemEditorForm
            copy={copy}
            item={item}
            locale={locale}
            onChange={onChange}
            onDelete={onDelete}
            onSave={onSave}
          />
        </section>
      </div>
    </>
  );
}
