'use client';

import { EVENT_STATUSES, GROUPS, PRIORITIES, TODO_STATUSES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { toDateInputValue, toDateTimeInputValue } from '@/lib/time';
import type { Item } from '@/lib/types';

type ItemEditorProps = {
  item: Item | null;
  locale: string;
  onChange: (item: Item) => void;
  onDelete: (item: Item) => void;
  onSave: (item: Item) => void;
};

export function ItemEditor({ item, locale, onChange, onDelete, onSave }: ItemEditorProps) {
  const copy = locale.startsWith('zh') ? COPY.zh : COPY.en;

  if (!item) {
    return (
      <section className="planner-panel planner-panel--editor">
        <div className="planner-panel__header">
          <div>
            <p className="planner-panel__eyebrow">{copy.sections.editor}</p>
            <h2 className="planner-panel__title">
              {locale.startsWith('zh') ? '选择一个事项进行编辑' : 'Pick an item to edit'}
            </h2>
          </div>
        </div>
      </section>
    );
  }

  const statusOptions = item.type === 'event' ? EVENT_STATUSES : TODO_STATUSES;

  return (
    <section className="planner-panel planner-panel--editor">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">{copy.sections.editor}</p>
          <h2 className="planner-panel__title">{item.title}</h2>
        </div>
      </div>

      <div className="editor-grid">
        <label className="field">
          <span>{copy.labels.title}</span>
          <input
            onChange={(event) => onChange({ ...item, title: event.target.value })}
            value={item.title}
          />
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
                is_all_day: event.target.checked,
                start_at: event.target.checked ? null : item.start_at,
                end_at: event.target.checked ? null : item.end_at,
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
            <label className="field">
              <span>{copy.labels.start}</span>
              <input
                onChange={(event) =>
                  onChange({ ...item, start_at: event.target.value || null })
                }
                type="datetime-local"
                value={toDateTimeInputValue(item.start_at)}
              />
            </label>

            <label className="field">
              <span>{copy.labels.end}</span>
              <input
                onChange={(event) => onChange({ ...item, end_at: event.target.value || null })}
                type="datetime-local"
                value={toDateTimeInputValue(item.end_at)}
              />
            </label>
          </>
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
    </section>
  );
}
