'use client';

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useState,
} from 'react';
import { CalendarFull } from '@/components/calendar-full';
import { ItemEditor } from '@/components/item-editor';
import { DEFAULT_TIMEZONE, GROUPS, PRIORITIES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import {
  formatDateTimeLabel,
  isEndAfterStart,
  sortItems,
  toDateInputValue,
  toDateTimeInputValue,
} from '@/lib/time';
import { DateTimeWheelPicker } from '@/components/date-time-wheel-picker';
import type {
  ActivityAction,
  ActivityLog,
  Item,
  ItemType,
  ParseResult,
  Priority,
} from '@/lib/types';

type ConfirmationPanelProps = {
  busy: boolean;
  copy: typeof COPY.en;
  draft: ParseResult | null;
  locale: string;
  mode: 'ai' | 'fallback' | null;
  onChange: (draft: ParseResult) => void;
  onCreate: () => void;
  onReset: () => void;
  sourceText: string;
};

type TodoRailProps = {
  copy: typeof COPY.en;
  groupFilter: string;
  items: Item[];
  locale: string;
  onQuickStatus: (item: Item, status: string) => void;
  onSelectItem: (item: Item) => void;
  priorityFilter: string;
  search: string;
  setGroupFilter: (value: string) => void;
  setPriorityFilter: (value: string) => void;
  setSearch: (value: string) => void;
  setStatusFilter: (value: string) => void;
  statusFilter: string;
};

type HistoryTimelineProps = {
  copy: typeof COPY.en;
  locale: string;
  logs: ActivityLog[];
};

function resolveLocale() {
  if (typeof navigator === 'undefined') {
    return 'zh-CN';
  }

  return navigator.language?.startsWith('zh') ? 'zh-CN' : navigator.language || 'en-US';
}

function resolveCopy(locale: string) {
  return locale.startsWith('zh') ? COPY.zh : COPY.en;
}

function toIsoOrNull(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

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

function hasInvalidTimedEventRange(input: {
  end_at: string | null;
  is_all_day: boolean;
  start_at: string | null;
  type: string;
}) {
  if (input.type !== 'event' || input.is_all_day || !input.start_at || !input.end_at) {
    return false;
  }

  return !isEndAfterStart(input.start_at, input.end_at);
}

async function fetchWorkspace(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>
) {
  const [{ data: itemsData, error: itemsError }, historyResponse] = await Promise.all([
    supabase.from('items').select('*').order('created_at', { ascending: false }),
    fetch('/api/history?limit=50'),
  ]);

  if (itemsError) {
    throw itemsError;
  }

  const historyPayload = await historyResponse.json().catch(() => ({}));
  if (!historyResponse.ok) {
    throw new Error(historyPayload.error || 'Failed to load activity history.');
  }

  return {
    items: sortItems((itemsData ?? []) as Item[]),
    logs: (historyPayload.logs ?? []) as ActivityLog[],
  };
}

function IntakePanel({
  busy,
  copy,
  locale,
  onAnalyze,
  setComposerText,
  text,
}: {
  busy: boolean;
  copy: typeof COPY.en;
  locale: string;
  onAnalyze: () => void;
  setComposerText: (value: string) => void;
  text: string;
}) {
  return (
    <section className="planner-panel planner-panel--intake">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">{copy.sections.intake}</p>
          <h2 className="planner-panel__title">
            {locale.startsWith('zh') ? '一句话录入你的安排' : 'Describe the plan once'}
          </h2>
        </div>
      </div>

      <div className="planner-stack">
        <div className="status-strip">
          <div>
            <strong>{locale.startsWith('zh') ? '共享演示工作区' : 'Shared demo workspace'}</strong>
            <span>
              {locale.startsWith('zh')
                ? '无需登录，所有访问者看到同一份事项和历史。'
                : 'No sign-in. Everyone sees the same shared task and history data.'}
            </span>
          </div>
          <div>
            <strong>{locale.startsWith('zh') ? '自然语言优先' : 'Natural-language first'}</strong>
            <span>
              {locale.startsWith('zh')
                ? '输入一句话，系统自动判断是日历事件还是普通待办。'
                : 'Write one sentence and the app decides between calendar event and to-do.'}
            </span>
          </div>
        </div>

        <textarea
          className="composer-textarea"
          onChange={(event) => setComposerText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !busy && text.trim()) {
              event.preventDefault();
              onAnalyze();
            }
          }}
          placeholder={
            locale.startsWith('zh')
              ? '例如：明天下午 3 点和导师开会；或者：记得买打印纸'
              : 'Try: Meet my advisor tomorrow at 3pm, or Buy printer paper'
          }
          rows={5}
          value={text}
        />

        <div className="composer-actions">
          <button
            className="planner-button"
            disabled={!text.trim() || busy}
            onClick={onAnalyze}
            type="button"
          >
            {copy.actions.analyze}
          </button>
        </div>
      </div>
    </section>
  );
}

function ConfirmationPanel({
  busy,
  copy,
  draft,
  locale,
  mode,
  onChange,
  onCreate,
  onReset,
  sourceText,
}: ConfirmationPanelProps) {
  if (!draft) {
    return (
      <section className="planner-panel planner-panel--confirmation">
        <div className="planner-panel__header">
          <div>
            <p className="planner-panel__eyebrow">{copy.sections.confirmation}</p>
            <h2 className="planner-panel__title">
              {locale.startsWith('zh') ? '等待 AI 解析结果' : 'Waiting for structured output'}
            </h2>
          </div>
        </div>
      </section>
    );
  }

  function handleDraftStartConfirm(nextStart: string) {
    if (!draft) {
      return;
    }

    const nextEnd = ensureEndAfterStartValue(nextStart, draft.end_at);
    onChange({
      ...draft,
      end_at: nextEnd,
      start_at: nextStart,
    });
  }

  function handleDraftEndConfirm(nextEndInput: string) {
    if (!draft) {
      return;
    }

    const nextEnd = ensureEndAfterStartValue(draft.start_at, nextEndInput);
    onChange({
      ...draft,
      end_at: nextEnd,
    });
  }

  return (
    <section className="planner-panel planner-panel--confirmation">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">{copy.sections.confirmation}</p>
          <h2 className="planner-panel__title">{draft.title}</h2>
        </div>
        <div className="planner-badges">
          <span className="planner-badge">
            {mode === 'fallback' ? copy.badges.demoFallback : copy.badges.aiSuggested}
          </span>
          {draft.needs_confirmation ? (
            <span className="planner-badge planner-badge--warning">
              {copy.badges.needsConfirmation}
            </span>
          ) : null}
        </div>
      </div>

      <div className="editor-grid">
        <label className="field">
          <span>{copy.labels.title}</span>
          <input
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
            value={draft.title}
          />
        </label>

        <label className="field">
          <span>{copy.labels.type}</span>
          <select
            onChange={(event) =>
              onChange({ ...draft, type: event.target.value as ItemType })
            }
            value={draft.type}
          >
            <option value="todo">todo</option>
            <option value="event">event</option>
          </select>
        </label>

        <label className="field">
          <span>{copy.labels.group}</span>
          <select
            onChange={(event) =>
              onChange({
                ...draft,
                group_key: event.target.value as ParseResult['group_key'],
              })
            }
            value={draft.group_key}
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
            onChange={(event) =>
              onChange({
                ...draft,
                priority: event.target.value as Priority,
              })
            }
            value={draft.priority}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
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
                ...draft,
                estimated_minutes: Number(event.target.value || 0),
              })
            }
            type="number"
            value={draft.estimated_minutes ?? 0}
          />
        </label>

        <label className="field field--checkbox">
          <span>{copy.badges.allDay}</span>
          <input
            checked={draft.is_all_day}
            onChange={(event) =>
              onChange({
                ...draft,
                end_at: event.target.checked ? null : draft.end_at,
                is_all_day: event.target.checked,
                start_at: event.target.checked ? null : draft.start_at,
              })
            }
            type="checkbox"
          />
        </label>

        <label className="field">
          <span>{copy.labels.dueDate}</span>
          <input
            onChange={(event) =>
              onChange({
                ...draft,
                due_date: event.target.value || null,
              })
            }
            type="date"
            value={draft.due_date ?? toDateInputValue(draft.start_at)}
          />
        </label>

        {!draft.is_all_day ? (
          <>
            <div className="field">
              <span>{copy.labels.start}</span>
              <DateTimeWheelPicker
                locale={locale}
                onConfirm={handleDraftStartConfirm}
                value={draft.start_at}
              />
            </div>

            <div className="field">
              <span>{copy.labels.end}</span>
              <DateTimeWheelPicker
                locale={locale}
                minValue={draft.start_at}
                onConfirm={handleDraftEndConfirm}
                strictAfterMin
                value={draft.end_at}
              />
            </div>
          </>
        ) : null}

        {!draft.is_all_day && hasInvalidTimedEventRange(draft) ? (
          <p className="panel-note panel-note--warning field--full">
            {locale.startsWith('zh')
              ? '结束时间必须晚于开始时间。'
              : 'End time must be later than start time.'}
          </p>
        ) : null}

        <label className="field field--full">
          <span>{copy.labels.location}</span>
          <input
            onChange={(event) => onChange({ ...draft, location: event.target.value })}
            value={draft.location}
          />
        </label>

        <label className="field field--full">
          <span>{copy.labels.notes}</span>
          <textarea
            onChange={(event) => onChange({ ...draft, notes: event.target.value })}
            rows={4}
            value={draft.notes}
          />
        </label>

        <label className="field field--full">
          <span>{copy.labels.source}</span>
          <textarea readOnly rows={3} value={sourceText} />
        </label>
      </div>

      {draft.ambiguity_reason ? (
        <p className="panel-note panel-note--warning">{draft.ambiguity_reason}</p>
      ) : null}

      <div className="editor-actions">
        <button className="planner-button planner-button--ghost" onClick={onReset} type="button">
          {copy.actions.cancel}
        </button>
        <button className="planner-button" disabled={busy} onClick={onCreate} type="button">
          {copy.actions.create}
        </button>
      </div>
    </section>
  );
}

function TodoRail({
  copy,
  groupFilter,
  items,
  locale,
  onQuickStatus,
  onSelectItem,
  priorityFilter,
  search,
  setGroupFilter,
  setPriorityFilter,
  setSearch,
  setStatusFilter,
  statusFilter,
}: TodoRailProps) {
  return (
    <section className="planner-panel planner-panel--todo">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">{copy.sections.todo}</p>
          <h2 className="planner-panel__title">
            {locale.startsWith('zh') ? '待办筛选与执行' : 'To-do filter rail'}
          </h2>
        </div>
      </div>

      <div className="todo-filters">
        <input
          onChange={(event) => setSearch(event.target.value)}
          placeholder={locale.startsWith('zh') ? '搜索标题或备注' : 'Search title or notes'}
          value={search}
        />
        <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
          <option value="all">{locale.startsWith('zh') ? '全部状态' : 'All statuses'}</option>
          <option value="pending">pending</option>
        </select>
        <select onChange={(event) => setGroupFilter(event.target.value)} value={groupFilter}>
          <option value="all">{locale.startsWith('zh') ? '全部分组' : 'All groups'}</option>
          {GROUPS.map((group) => (
            <option key={group.key} value={group.key}>
              {locale.startsWith('zh') ? group.labelZh : group.labelEn}
            </option>
          ))}
        </select>
        <select
          onChange={(event) => setPriorityFilter(event.target.value)}
          value={priorityFilter}
        >
          <option value="all">{locale.startsWith('zh') ? '全部优先级' : 'All priorities'}</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </div>

      <div className="todo-list">
        {items.length === 0 ? (
          <p className="todo-list__empty">
            {locale.startsWith('zh') ? '当前筛选条件下没有事项。' : 'No items match the current filter.'}
          </p>
        ) : null}
        {items.map((item) => (
          <article className="todo-card" key={item.id}>
            <button className="todo-card__main" onClick={() => onSelectItem(item)} type="button">
              <span className={`todo-card__dot todo-card__dot--${item.priority}`} />
              <div>
                <h3>{item.title}</h3>
                <p>
                  {item.type} · {item.group_key} · {item.status}
                </p>
              </div>
            </button>
            <div className="todo-card__actions">
              {item.status !== 'completed' ? (
                <button onClick={() => onQuickStatus(item, 'completed')} type="button">
                  {locale.startsWith('zh') ? '完成' : 'Complete'}
                </button>
              ) : (
                <button
                  onClick={() =>
                    onQuickStatus(item, item.type === 'event' ? 'scheduled' : 'pending')
                  }
                  type="button"
                >
                  {locale.startsWith('zh') ? '恢复' : 'Reopen'}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function actionTone(action: ActivityAction) {
  if (action === 'completed') {
    return 'history-card__badge--completed';
  }
  if (action === 'deleted') {
    return 'history-card__badge--deleted';
  }
  if (action === 'updated') {
    return 'history-card__badge--updated';
  }
  return 'history-card__badge--created';
}

function HistoryTimeline({ copy, locale, logs }: HistoryTimelineProps) {
  return (
    <section className="planner-panel planner-panel--history">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">{copy.sections.history}</p>
          <h2 className="planner-panel__title">
            {locale.startsWith('zh') ? '最近的操作轨迹' : 'Recent activity'}
          </h2>
        </div>
      </div>

      <div className="history-list">
        {logs.length === 0 ? (
          <p className="todo-list__empty">
            {locale.startsWith('zh') ? '还没有历史记录。' : 'No activity yet.'}
          </p>
        ) : null}
        {logs.map((log) => (
          <article className="history-card" key={log.id}>
            <div className="history-card__meta">
              <span className={`history-card__badge ${actionTone(log.action as ActivityAction)}`}>
                {log.action}
              </span>
              <time>{formatDateTimeLabel(log.created_at, locale, DEFAULT_TIMEZONE)}</time>
            </div>
            <h3>{log.item_title}</h3>
            <p>{log.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function EmptyWorkspace({ copy }: { copy: typeof COPY.en }) {
  return (
    <main className="landing-shell">
      <div className="landing-shell__glow" />
      <section className="landing-card">
        <p className="landing-card__eyebrow">Orbit Planner / shared workspace</p>
        <h1 className="landing-card__title">Supabase configuration required.</h1>
        <p className="landing-card__body">
          Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then reload the app.
        </p>
        <div className="landing-card__actions">
          <p className="landing-card__hint">{copy.actions.refresh}</p>
        </div>
      </section>
    </main>
  );
}

export function PlannerApp() {
  const supabase = getSupabaseClient();
  const configured = isSupabaseConfigured();
  const [locale, setLocale] = useState('zh-CN');
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [items, setItems] = useState<Item[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [composerText, setComposerText] = useState('');
  const [draft, setDraft] = useState<ParseResult | null>(null);
  const [parseMode, setParseMode] = useState<'ai' | 'fallback' | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const deferredSearch = useDeferredValue(search);
  const copy = resolveCopy(locale);

  useEffect(() => {
    setLocale(resolveLocale());

    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE);
    } catch {
      setTimezone(DEFAULT_TIMEZONE);
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const snapshot = await fetchWorkspace(supabase);
    setItems(snapshot.items);
    setLogs(snapshot.logs);
    setSelectedItem((current) =>
      current ? snapshot.items.find((item) => item.id === current.id) ?? null : null
    );
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    void loadWorkspace().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'Failed to load workspace.');
    });
  }, [loadWorkspace, supabase]);

  async function jsonRequest(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || 'Request failed.');
    }

    return payload;
  }

  async function handleAnalyze() {
    if (!composerText.trim()) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const payload = await jsonRequest('/api/nl/parse', {
        body: JSON.stringify({
          locale,
          text: composerText,
          timezone,
        }),
        method: 'POST',
      });

      setDraft(payload.result as ParseResult);
      setParseMode(payload.mode as 'ai' | 'fallback');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to analyze request.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!draft) {
      return;
    }

    if (hasInvalidTimedEventRange(draft)) {
      setMessage(
        locale.startsWith('zh')
          ? '结束时间必须晚于开始时间。'
          : 'End time must be later than start time.'
      );
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await jsonRequest('/api/items', {
        body: JSON.stringify({
          ...draft,
          due_date: draft.is_all_day
            ? draft.due_date ?? toDateInputValue(draft.start_at)
            : draft.due_date,
          end_at: draft.is_all_day ? null : toIsoOrNull(draft.end_at),
          location: draft.location,
          parse_confidence: draft.confidence,
          source_text: composerText,
          start_at: draft.is_all_day ? null : toIsoOrNull(draft.start_at),
          status: draft.type === 'event' ? 'scheduled' : 'pending',
        }),
        method: 'POST',
      });

      setComposerText('');
      setDraft(null);
      setParseMode(null);
      setMessage(locale.startsWith('zh') ? '事项已创建。' : 'Item created.');

      startTransition(() => {
        void loadWorkspace();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create item.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveItem(item: Item) {
    if (hasInvalidTimedEventRange(item)) {
      setMessage(
        locale.startsWith('zh')
          ? '结束时间必须晚于开始时间。'
          : 'End time must be later than start time.'
      );
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await jsonRequest(`/api/items/${item.id}`, {
        body: JSON.stringify({
          due_date: item.due_date,
          end_at: item.is_all_day ? null : toIsoOrNull(item.end_at),
          estimated_minutes: item.estimated_minutes,
          group_key: item.group_key,
          is_all_day: item.is_all_day,
          location: item.location,
          notes: item.notes,
          parse_confidence: item.parse_confidence,
          priority: item.priority,
          source_text: item.source_text,
          start_at: item.is_all_day ? null : toIsoOrNull(item.start_at),
          status: item.status,
          title: item.title,
          type: item.type,
        }),
        method: 'PATCH',
      });

      setMessage(locale.startsWith('zh') ? '事项已更新。' : 'Item updated.');
      startTransition(() => {
        void loadWorkspace();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update item.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteItem(item: Item) {
    setBusy(true);
    setMessage(null);

    try {
      await jsonRequest(`/api/items/${item.id}`, {
        method: 'DELETE',
      });
      setSelectedItem(null);
      setMessage(locale.startsWith('zh') ? '事项已删除。' : 'Item deleted.');
      startTransition(() => {
        void loadWorkspace();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete item.');
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickStatus(item: Item, status: string) {
    await handleSaveItem({ ...item, status });

    if (status === 'completed' || status === 'cancelled') {
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setSelectedItem((current) => (current?.id === item.id ? null : current));
    }
  }

  const activeItems = items.filter(
    (item) => item.status !== 'completed' && item.status !== 'cancelled'
  );

  const calendarItems = activeItems.filter(
    (item) => item.type === 'event' || (item.is_all_day && Boolean(item.due_date))
  );

  const filteredTodos = sortItems(
    activeItems.filter((item) => {
      if (item.type !== 'todo') {
        return false;
      }

      const haystack = `${item.title} ${item.location ?? ''} ${item.notes ?? ''}`.toLowerCase();

      if (deferredSearch.trim() && !haystack.includes(deferredSearch.toLowerCase())) {
        return false;
      }

      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      if (groupFilter !== 'all' && item.group_key !== groupFilter) {
        return false;
      }

      if (priorityFilter !== 'all' && item.priority !== priorityFilter) {
        return false;
      }

      return true;
    })
  );

  if (!configured || !supabase) {
    return <EmptyWorkspace copy={copy} />;
  }

  return (
    <main className="planner-shell">
      <div className="planner-shell__halo planner-shell__halo--one" />
      <div className="planner-shell__halo planner-shell__halo--two" />

      <section className="planner-hero">
        <div>
          <p className="planner-hero__eyebrow">Task calendar management / shared timeline</p>
          <h1 className="planner-hero__title">
            {locale.startsWith('zh')
              ? '自然语言直接生成日历、待办与历史记录'
              : 'Natural language into calendar, to-dos, and activity history'}
          </h1>
        </div>
        <div className="planner-hero__controls">
          <button
            className="planner-button planner-button--ghost"
            onClick={() =>
              startTransition(() => {
                void loadWorkspace();
              })
            }
            type="button"
          >
            {copy.actions.refresh}
          </button>
        </div>
      </section>

      {message ? <div className="planner-toast">{message}</div> : null}

      <section className="planner-grid planner-grid--top">
        <IntakePanel
          busy={busy}
          copy={copy}
          locale={locale}
          onAnalyze={() => void handleAnalyze()}
          setComposerText={setComposerText}
          text={composerText}
        />
        <ConfirmationPanel
          busy={busy}
          copy={copy}
          draft={draft}
          locale={locale}
          mode={parseMode}
          onChange={setDraft}
          onCreate={() => void handleCreate()}
          onReset={() => {
            setDraft(null);
            setParseMode(null);
          }}
          sourceText={composerText}
        />
      </section>

      <section className="planner-grid planner-grid--bottom planner-grid--triple">
        <CalendarFull
          focusDate={focusDate}
          items={calendarItems}
          locale={locale}
          onFocusDateChange={setFocusDate}
          onSelectItem={setSelectedItem}
          timezone={timezone}
        />
        <TodoRail
          copy={copy}
          groupFilter={groupFilter}
          items={filteredTodos}
          locale={locale}
          onQuickStatus={(item, status) => void handleQuickStatus(item, status)}
          onSelectItem={setSelectedItem}
          priorityFilter={priorityFilter}
          search={search}
          setGroupFilter={setGroupFilter}
          setPriorityFilter={setPriorityFilter}
          setSearch={setSearch}
          setStatusFilter={setStatusFilter}
          statusFilter={statusFilter}
        />
        <HistoryTimeline copy={copy} locale={locale} logs={logs} />
      </section>

      <ItemEditor
        item={selectedItem}
        locale={locale}
        onChange={setSelectedItem}
        onDelete={(item) => void handleDeleteItem(item)}
        onSave={(item) => void handleSaveItem(item)}
      />
    </main>
  );
}
