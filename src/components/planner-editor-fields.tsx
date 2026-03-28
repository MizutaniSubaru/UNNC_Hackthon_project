'use client';

import { DateTimeWheelPicker } from '@/components/date-time-wheel-picker';
import { MotionButton } from '@/components/ui/motion-button';
import { COPY } from '@/lib/copy';
import {
  EVENT_STATUSES,
  GROUPS,
  PRIORITIES,
  TODO_STATUSES,
} from '@/lib/constants';
import {
  applyAllDayChange,
  applyEndAtChange,
  applyStartAtChange,
  applyTypeChange,
  type EditableTimingState,
  getDisplayStartAt,
  getTimingFieldVisibility,
  getTodoDueDateValue,
  hasInvalidTimedEventRange,
} from '@/lib/editor-timing';
import type {
  GroupKey,
  ItemType,
  Priority,
} from '@/lib/types';

type EditorFieldsValue = {
  due_date: string | null;
  end_at: string | null;
  group_key: string;
  is_all_day: boolean;
  location: string | null;
  notes: string | null;
  priority: string;
  start_at: string | null;
  status?: string;
  source_text?: string | null;
  title: string;
  type: string;
};

type PlannerEditorFieldsProps<T extends EditorFieldsValue> = {
  autoFocusTitle?: boolean;
  copy: typeof COPY.en;
  locale: string;
  onChange: (value: T) => void;
  showStatus?: boolean;
  sourceMode?: 'editable' | 'hidden' | 'readonly';
  sourceValue?: string;
  typeChangeTransformer?: (value: T, nextType: ItemType) => T;
  value: T;
};

export function PlannerEditorFields<T extends EditorFieldsValue>({
  autoFocusTitle = false,
  copy,
  locale,
  onChange,
  showStatus = false,
  sourceMode = 'hidden',
  sourceValue,
  typeChangeTransformer,
  value,
}: PlannerEditorFieldsProps<T>) {
  const statusOptions = value.type === 'event' ? EVENT_STATUSES : TODO_STATUSES;
  const timingVisibility = getTimingFieldVisibility(value);
  const invalidRange = hasInvalidTimedEventRange(value);
  const startValue = getDisplayStartAt(value);
  const dueDateValue = getTodoDueDateValue(value) ?? '';
  const isChinese = locale.startsWith('zh');

  function handleTypeChange(nextType: ItemType) {
    const nextValue = applyTypeChange(value as T & EditableTimingState, nextType) as T;
    onChange(typeChangeTransformer ? typeChangeTransformer(nextValue, nextType) : nextValue);
  }

  return (
    <div className="editor-grid">
      <label className="field">
        <span>{copy.labels.title}</span>
        <input
          autoFocus={autoFocusTitle}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
          value={value.title}
        />
      </label>

      <label className="field">
        <span>{copy.labels.type}</span>
        <select onChange={(event) => handleTypeChange(event.target.value as ItemType)} value={value.type}>
          <option value="todo">todo</option>
          <option value="event">event</option>
        </select>
      </label>

      <label className="field">
        <span>{copy.labels.group}</span>
        <select
          onChange={(event) => onChange({ ...value, group_key: event.target.value as GroupKey })}
          value={value.group_key}
        >
          {GROUPS.map((group) => (
            <option key={group.key} value={group.key}>
              {isChinese ? group.labelZh : group.labelEn}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>{copy.labels.priority}</span>
        <select
          onChange={(event) => onChange({ ...value, priority: event.target.value as Priority })}
          value={value.priority}
        >
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </label>

      {showStatus ? (
        <label className="field">
          <span>{copy.labels.status}</span>
          <select
            onChange={(event) => onChange({ ...value, status: event.target.value })}
            value={value.status ?? ''}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {timingVisibility.showDueDate ? (
        <label className="field">
          <span>{copy.labels.dueDate}</span>
          <input
            onChange={(event) => onChange({ ...value, due_date: event.target.value || null })}
            type="date"
            value={dueDateValue}
          />
        </label>
      ) : null}

      {timingVisibility.showEventTiming ? (
        <div className="editor-timing-row field--full">
          <div className="field field--timing">
            <span>{copy.labels.start}</span>
            <DateTimeWheelPicker
              dateOnly={timingVisibility.startDateOnly}
              locale={locale}
              onConfirm={(nextStart) =>
                onChange(applyStartAtChange(value as T & EditableTimingState, nextStart) as T)
              }
              value={startValue}
            />
          </div>

          <div className="field field--timing">
            <span>{copy.labels.end}</span>
            {timingVisibility.disableEnd ? (
              <MotionButton
                aria-disabled="true"
                className="wheel-picker__trigger wheel-picker__trigger--disabled"
                disabled
                motionPreset="subtle"
                type="button"
              >
                {isChinese ? '\u5168\u5929\u65f6\u95f4' : 'All-day timing'}
              </MotionButton>
            ) : (
              <DateTimeWheelPicker
                locale={locale}
                minValue={value.start_at}
                onConfirm={(nextEnd) =>
                  onChange(applyEndAtChange(value as T & EditableTimingState, nextEnd) as T)
                }
                strictAfterMin
                value={value.end_at}
              />
            )}
          </div>

          <div className="field field--timing field--timing-toggle">
            <span>{copy.badges.allDay}</span>
            <MotionButton
              aria-pressed={value.is_all_day}
              className={[
                'editor-toggle-button',
                value.is_all_day ? 'is-active' : null,
              ]
                .filter(Boolean)
                .join(' ')}
              motionPreset="subtle"
              onClick={() =>
                onChange(applyAllDayChange(value as T & EditableTimingState, !value.is_all_day) as T)
              }
              type="button"
            >
              {value.is_all_day
                ? isChinese
                  ? '\u5df2\u5f00\u542f'
                  : 'On'
                : isChinese
                  ? '\u70b9\u51fb\u5f00\u542f'
                  : 'Turn on'}
            </MotionButton>
          </div>
        </div>
      ) : null}

      {invalidRange ? (
        <p className="panel-note panel-note--warning field--full">
          {isChinese
            ? '\u7ed3\u675f\u65f6\u95f4\u5fc5\u987b\u665a\u4e8e\u5f00\u59cb\u65f6\u95f4\u3002'
            : 'End time must be later than start time.'}
        </p>
      ) : null}

      <label className="field field--full">
        <span>{copy.labels.location}</span>
        <input
          onChange={(event) => onChange({ ...value, location: event.target.value })}
          value={value.location ?? ''}
        />
      </label>

      <label className="field field--full">
        <span>{copy.labels.notes}</span>
        <textarea
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
          rows={4}
          value={value.notes ?? ''}
        />
      </label>

      {sourceMode === 'editable' ? (
        <label className="field field--full">
          <span>{copy.labels.source}</span>
          <textarea
            onChange={(event) => onChange({ ...value, source_text: event.target.value })}
            rows={3}
            value={value.source_text ?? ''}
          />
        </label>
      ) : null}

      {sourceMode === 'readonly' ? (
        <label className="field field--full">
          <span>{copy.labels.source}</span>
          <textarea readOnly rows={3} value={sourceValue ?? ''} />
        </label>
      ) : null}
    </div>
  );
}
