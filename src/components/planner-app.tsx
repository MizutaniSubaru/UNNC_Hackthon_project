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
import { PlannerEditorFields } from '@/components/planner-editor-fields';
import { DEFAULT_TIMEZONE, GROUPS, PRIORITIES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import {
  hasInvalidTimedEventRange,
  sanitizeTimingForSubmission,
} from '@/lib/editor-timing';
import { createLaunchOrigin } from '@/lib/launch-origin';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { formatDateTimeLabel, sortItems } from '@/lib/time';
import type {
  ActivityAction,
  ActivityLog,
  Item,
  LaunchOrigin,
  ParseResult,
  SearchHit,
  SearchMode,
  SearchResponse,
} from '@/lib/types';

type ConfirmationModalProps = {
  busy: boolean;
  copy: typeof COPY.en;
  draft: ParseResult | null;
  locale: string;
  mode: 'ai' | 'fallback' | null;
  onChange: (draft: ParseResult) => void;
  onCreate: () => void;
  onDismiss: () => void;
  open: boolean;
  sourceText: string;
};

type TodoRailProps = {
  copy: typeof COPY.en;
  groupFilter: string;
  items: Item[];
  locale: string;
  onQuickStatus: (item: Item, status: string) => void;
  onSelectItem: (item: Item, launchOrigin: LaunchOrigin | null) => void;
  priorityFilter: string;
  search: string;
  setGroupFilter: (value: string) => void;
  setPriorityFilter: (value: string) => void;
  setSearch: (value: string) => void;
  setStatusFilter: (value: string) => void;
  statusFilter: string;
};

type HistoryTimelineProps = {
  busy: boolean;
  copy: typeof COPY.en;
  locale: string;
  logs: ActivityLog[];
  onDeleteLogs: (logIds: string[]) => Promise<void>;
  onUndoLogs: (logIds: string[]) => Promise<void>;
};

type SearchResultsPanelProps = {
  fallbackToKeyword: boolean;
  locale: string;
  mode: SearchMode;
  onClear: () => void;
  onModeChange: (mode: SearchMode) => void;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onSelectItem: (item: Item) => void;
  query: string;
  results: SearchHit[];
  searching: boolean;
  timeRangeLabel: string | null;
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

function GuidePanel({ copy, locale }: { copy: typeof COPY.en; locale: string }) {
  const isChinese = locale.startsWith('zh');
  const examples = isChinese
    ? [
      {
        label: '开始时间 + 结束时间 + 地点',
        text: '周三下午 2 点到 3 点半在 Trent Building 和导师开会',
      },
      {
        label: '开始时间 + 持续时长 + 地点',
        text: '明天 10:00 在 Portland Building 写 90 分钟 project proposal',
      },
      {
        label: 'To-Do',
        text: '买打印纸并提交报销',
      },
    ]
    : [
      {
        label: 'Start time + end time + location',
        text: 'Meet my advisor on Wednesday from 2:00 PM to 3:30 PM in Trent Building.',
      },
      {
        label: 'Start time + duration + location',
        text: 'Start writing the project proposal tomorrow at 10:00 AM in Portland Building for 90 minutes.',
      },
      {
        label: 'To-do',
        text: 'Buy printer paper and submit the reimbursement form.',
      },
    ];

  return (
    <section className="planner-panel planner-panel--guide">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">{copy.sections.intake}</p>
          <h2 className="planner-panel__title">
            {isChinese
              ? '用自然语言描述你想创建的安排'
              : 'Describe your request in natural language'}
          </h2>
        </div>
      </div>

      <div className="planner-stack planner-stack--compact">
        <p className="intake-guide__lead">
          {isChinese
            ? '直接用一句话说明你想创建的 Event 或 To-Do。AI 会先生成结构化结果，再由你在弹窗里确认或修改。'
            : 'Use one sentence to describe the event or to-do you want. The app will structure it first, then let you confirm or edit it in a centered review step.'}
        </p>

        <div className="intake-guide__examples">
          {examples.map((example) => (
            <article className="intake-example" key={example.label}>
              <p className="intake-example__label">{example.label}</p>
              <p className="intake-example__text">{example.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComposerPanel({
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
  const isChinese = locale.startsWith('zh');

  return (
    <section className="planner-panel planner-panel--composer">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">{copy.sections.intake}</p>
          <h2 className="planner-panel__title">{isChinese ? '输入你的请求' : 'Write the request'}</h2>
        </div>
      </div>

      <div className="planner-stack planner-stack--compact">
        <p className="composer-panel__hint">
          {isChinese
            ? '可以直接写时间范围、开始时间加持续时长，或者一条普通待办。按 Enter 提交，Shift + Enter 换行。'
            : 'Write a time range, a start time with duration, or a plain to-do. Press Enter to analyze and Shift + Enter for a new line.'}
        </p>

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
            isChinese
              ? '例如：明天下午 3 点到 4 点半和导师开会；或者：从晚上 8 点开始健身 45 分钟'
              : 'Example: Meet my advisor tomorrow from 3:00 PM to 4:30 PM, or Start a 45-minute workout at 8:00 PM tonight'
          }
          rows={4}
          value={text}
        />

        <div className="composer-actions composer-actions--end">
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

function ConfirmationModal({
  busy,
  copy,
  draft,
  locale,
  mode,
  onChange,
  onCreate,
  onDismiss,
  open,
  sourceText,
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onDismiss();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss, open]);

  if (!open || !draft) {
    return null;
  }

  const activeDraft = draft;

  return (
    <>
      <button
        aria-label="Close confirmation dialog"
        className="planner-modal__overlay is-visible"
        onClick={onDismiss}
        type="button"
      />
      <div
        aria-labelledby="confirmation-dialog-title"
        aria-modal="true"
        className="planner-modal"
        role="dialog"
      >
        <section className="planner-panel planner-panel--confirmation planner-panel--modal planner-panel--confirmation-modal planner-panel--modal-pop">
          <div className="planner-panel__header">
            <div>
              <p className="planner-panel__eyebrow">{copy.sections.confirmation}</p>
              <h2 className="planner-panel__title" id="confirmation-dialog-title">
                {activeDraft.title}
              </h2>
            </div>
            <div className="planner-badges">
              <span className="planner-badge">
                {mode === 'fallback' ? copy.badges.demoFallback : copy.badges.aiSuggested}
              </span>
              {activeDraft.needs_confirmation ? (
                <span className="planner-badge planner-badge--warning">
                  {copy.badges.needsConfirmation}
                </span>
              ) : null}
            </div>
          </div>

          <PlannerEditorFields
            autoFocusTitle
            copy={copy}
            locale={locale}
            onChange={onChange}
            sourceMode="readonly"
            sourceValue={sourceText}
            value={activeDraft}
          />
          {/*

                  ? '结束时间必须晚于开始时间。'
          */}
          {activeDraft.ambiguity_reason ? (
            <p className="panel-note panel-note--warning">{activeDraft.ambiguity_reason}</p>
          ) : null}

          <div className="editor-actions">
            <button className="planner-button planner-button--ghost" onClick={onDismiss} type="button">
              {copy.actions.cancel}
            </button>
            <button className="planner-button" disabled={busy} onClick={onCreate} type="button">
              {copy.actions.create}
            </button>
          </div>
        </section>
      </div>
    </>
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
            <button
              className="todo-card__main"
              onClick={(event) =>
                onSelectItem(item, createLaunchOrigin(event.currentTarget.getBoundingClientRect()))
              }
              type="button"
            >
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
  if (action === 'undo') {
    return 'history-card__badge--undo';
  }
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

function isUndoLog(log: ActivityLog) {
  const details = log.details_json;
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return false;
  }

  const undoMeta = (details as Record<string, unknown>).undo_meta;
  return Boolean(undoMeta && typeof undoMeta === 'object' && !Array.isArray(undoMeta));
}

function HistoryTimeline({
  busy,
  copy,
  locale,
  logs,
  onDeleteLogs,
  onUndoLogs,
}: HistoryTimelineProps) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const logIdSet = new Set(logs.map((log) => log.id));
  const activeSelectedIds = selectedIds.filter((id) => logIdSet.has(id));

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds([]);
  }

  function toggleSelect(logId: string) {
    setSelectedIds((current) =>
      current.includes(logId)
        ? current.filter((id) => id !== logId)
        : [...current, logId]
    );
  }

  const allSelected = logs.length > 0 && activeSelectedIds.length === logs.length;

  return (
    <section className="planner-panel planner-panel--history">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">{copy.sections.history}</p>
          <h2 className="planner-panel__title">
            {locale.startsWith('zh') ? '最近的操作轨迹' : 'Recent activity'}
          </h2>
        </div>
        <div className="history-toolbar">
          <button
            className="planner-button planner-button--ghost history-toolbar__toggle"
            disabled={busy || logs.length === 0}
            onClick={() => {
              if (selectMode) {
                exitSelectMode();
              } else {
                setSelectMode(true);
              }
            }}
            type="button"
          >
            {selectMode
              ? locale.startsWith('zh')
                ? '退出选择'
                : 'Exit select'
              : locale.startsWith('zh')
                ? '选择'
                : 'Select'}
          </button>
        </div>
      </div>

      {selectMode ? (
        <div className="history-bulk-actions">
          <p>
            {locale.startsWith('zh')
              ? `已选择 ${activeSelectedIds.length} 条日志`
              : `${activeSelectedIds.length} selected`}
          </p>
          <div className="history-bulk-actions__buttons">
            <button
              disabled={busy || logs.length === 0}
              onClick={() =>
                setSelectedIds(allSelected ? [] : logs.map((log) => log.id))
              }
              type="button"
            >
              {allSelected
                ? locale.startsWith('zh')
                  ? '取消全选'
                  : 'Clear all'
                : locale.startsWith('zh')
                  ? '全选'
                  : 'Select all'}
            </button>
            <button
              disabled={busy || activeSelectedIds.length === 0}
              onClick={() =>
                void onUndoLogs(activeSelectedIds).then(() => {
                  exitSelectMode();
                })
              }
              type="button"
            >
              {locale.startsWith('zh') ? '撤销' : 'Undo'}
            </button>
            <button
              disabled={busy || activeSelectedIds.length === 0}
              onClick={() =>
                void onDeleteLogs(activeSelectedIds).then(() => {
                  exitSelectMode();
                })
              }
              type="button"
            >
              {locale.startsWith('zh') ? '删除' : 'Delete'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="history-list">
        {logs.length === 0 ? (
          <p className="todo-list__empty">
            {locale.startsWith('zh') ? '还没有历史记录。' : 'No activity yet.'}
          </p>
        ) : null}
        {logs.map((log) => (
          <article
            className={`history-card ${activeSelectedIds.includes(log.id) ? 'history-card--selected' : ''} ${log.action === 'updated' && !isUndoLog(log) ? 'history-card--compact' : ''}`}
            key={log.id}
          >
            {selectMode ? (
              <label className="history-card__check">
                <input
                  checked={activeSelectedIds.includes(log.id)}
                  disabled={busy}
                  onChange={() => toggleSelect(log.id)}
                  type="checkbox"
                />
                <span>{locale.startsWith('zh') ? '选择该日志' : 'Select log'}</span>
              </label>
            ) : null}
            <div className="history-card__meta">
              <span
                className={`history-card__badge ${actionTone(
                  (isUndoLog(log) ? 'undo' : log.action) as ActivityAction
                )}`}
              >
                {isUndoLog(log) ? 'undo' : log.action}
              </span>
              <time>{formatDateTimeLabel(log.created_at, locale, DEFAULT_TIMEZONE)}</time>
            </div>
            <h3>{log.item_title}</h3>
            {log.action === 'updated' && !isUndoLog(log) ? null : <p>{log.summary}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function SearchResultsPanel({
  fallbackToKeyword,
  locale,
  mode,
  onClear,
  onModeChange,
  onQueryChange,
  onSearch,
  onSelectItem,
  query,
  results,
  searching,
  timeRangeLabel,
}: SearchResultsPanelProps) {
  const isChinese = locale.startsWith('zh');

  return (
    <section className="planner-panel planner-panel--search">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">{isChinese ? '智能搜索' : 'Smart search'}</p>
          <h2 className="planner-panel__title">
            {isChinese ? '关键词 / AI 语义检索' : 'Keyword / AI semantic search'}
          </h2>
        </div>
      </div>

      <div className="search-panel__controls">
        <input
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSearch();
            }
          }}
          placeholder={
            isChinese
              ? '例如：我上周做了些什么'
              : 'Try: What did I do last week?'
          }
          value={query}
        />

        <label className="field field--checkbox search-panel__toggle">
          <span>{isChinese ? 'AI 模糊搜索（慢）' : 'AI fuzzy search (slower)'}</span>
          <input
            checked={mode === 'ai'}
            onChange={(event) => onModeChange(event.target.checked ? 'ai' : 'keyword')}
            type="checkbox"
          />
        </label>

        <div className="search-panel__actions">
          <button className="planner-button" disabled={!query.trim() || searching} onClick={onSearch} type="button">
            {searching
              ? isChinese
                ? '搜索中...'
                : 'Searching...'
              : isChinese
                ? '搜索'
                : 'Search'}
          </button>
          <button className="planner-button planner-button--ghost" onClick={onClear} type="button">
            {isChinese ? '清空' : 'Clear'}
          </button>
        </div>
      </div>

      {timeRangeLabel ? (
        <p className="panel-note">
          {isChinese ? '时间范围：' : 'Time range: '}
          {timeRangeLabel}
        </p>
      ) : null}

      {fallbackToKeyword ? (
        <p className="panel-note panel-note--warning">
          {isChinese
            ? 'AI 搜索暂时不可用，已自动回退为关键词搜索。'
            : 'AI search is temporarily unavailable. Automatically fell back to keyword search.'}
        </p>
      ) : null}

      <div className="search-panel__results">
        {!query.trim() ? (
          <p className="todo-list__empty">
            {isChinese ? '输入搜索内容后可查看结果。' : 'Enter a query to view results.'}
          </p>
        ) : null}

        {query.trim() && !searching && results.length === 0 ? (
          <p className="todo-list__empty">
            {isChinese ? '没有匹配到结果。' : 'No results matched your query.'}
          </p>
        ) : null}

        {results.map((result) => (
          <article className="search-result-card" key={result.item.id}>
            <button className="search-result-card__main" onClick={() => onSelectItem(result.item)} type="button">
              <div>
                <div className="search-result-card__meta">
                  <span className="planner-badge">{result.item.type}</span>
                  <span>{result.item.group_key}</span>
                  <span>{result.item.status}</span>
                </div>
                <h3>{result.item.title}</h3>
                {result.matched_at ? (
                  <p>
                    {isChinese ? '匹配时间：' : 'Matched at: '}
                    {formatDateTimeLabel(result.matched_at, locale, DEFAULT_TIMEZONE)}
                  </p>
                ) : null}
                <p>{result.reason}</p>
              </div>
            </button>
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
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [parseMode, setParseMode] = useState<'ai' | 'fallback' | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedItemLaunchOrigin, setSelectedItemLaunchOrigin] = useState<LaunchOrigin | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [historyBusy, setHistoryBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('keyword');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searchRangeLabel, setSearchRangeLabel] = useState<string | null>(null);
  const [searchFallback, setSearchFallback] = useState(false);

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

  const closeConfirmation = useCallback(() => {
    setDraft(null);
    setParseMode(null);
    setIsConfirmationOpen(false);
  }, []);

  const closeSelectedItem = useCallback(() => {
    setSelectedItem(null);
    setSelectedItemLaunchOrigin(null);
  }, []);

  const handleOpenItem = useCallback((item: Item, launchOrigin: LaunchOrigin | null) => {
    setSelectedItem(item);
    setSelectedItemLaunchOrigin(launchOrigin);
  }, []);

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
      setIsConfirmationOpen(true);
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
      const draftPayload = sanitizeTimingForSubmission(draft);

      await jsonRequest('/api/items', {
        body: JSON.stringify({
          ...draftPayload,
          due_date: draftPayload.due_date,
          end_at: draftPayload.end_at ? toIsoOrNull(draftPayload.end_at) : null,
          location: draftPayload.location,
          parse_confidence: draftPayload.confidence,
          source_text: composerText,
          start_at: draftPayload.start_at ? toIsoOrNull(draftPayload.start_at) : null,
          status: draftPayload.type === 'event' ? 'scheduled' : 'pending',
        }),
        method: 'POST',
      });

      setComposerText('');
      setDraft(null);
      setIsConfirmationOpen(false);
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
      const nextItem = sanitizeTimingForSubmission(item);

      await jsonRequest(`/api/items/${item.id}`, {
        body: JSON.stringify({
          due_date: nextItem.due_date,
          end_at: nextItem.end_at ? toIsoOrNull(nextItem.end_at) : null,
          estimated_minutes: nextItem.estimated_minutes,
          group_key: nextItem.group_key,
          is_all_day: nextItem.is_all_day,
          location: nextItem.location,
          notes: nextItem.notes,
          parse_confidence: nextItem.parse_confidence,
          priority: nextItem.priority,
          source_text: nextItem.source_text,
          start_at: nextItem.start_at ? toIsoOrNull(nextItem.start_at) : null,
          status: nextItem.status,
          title: nextItem.title,
          type: nextItem.type,
        }),
        method: 'PATCH',
      });

      setMessage(locale.startsWith('zh') ? '事项已更新。' : 'Item updated.');
      startTransition(() => {
        void loadWorkspace();
      });
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update item.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveItemAndClose(item: Item) {
    const didSave = await handleSaveItem(item);
    if (didSave) {
      closeSelectedItem();
    }
  }

  async function handleDeleteItem(item: Item) {
    setBusy(true);
    setMessage(null);

    try {
      await jsonRequest(`/api/items/${item.id}`, {
        method: 'DELETE',
      });
      closeSelectedItem();
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
      if (selectedItem?.id === item.id) {
        closeSelectedItem();
      }
    }
  }

  async function handleUndoLogs(logIds: string[]) {
    if (logIds.length === 0) {
      return;
    }

    setHistoryBusy(true);
    setMessage(null);

    try {
      const payload = await jsonRequest('/api/history', {
        body: JSON.stringify({ logIds }),
        method: 'PATCH',
      });

      const failedCount = Array.isArray(payload.failed) ? payload.failed.length : 0;
      if (failedCount > 0) {
        setMessage(
          locale.startsWith('zh')
            ? `已撤销部分日志，失败 ${failedCount} 条。`
            : `Partially undone. ${failedCount} log(s) failed.`
        );
      } else {
        setMessage(locale.startsWith('zh') ? '日志已撤销。' : 'History undone.');
      }

      startTransition(() => {
        void loadWorkspace();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to undo history logs.');
    } finally {
      setHistoryBusy(false);
    }
  }

  async function handleDeleteLogs(logIds: string[]) {
    if (logIds.length === 0) {
      return;
    }

    setHistoryBusy(true);
    setMessage(null);

    try {
      await jsonRequest('/api/history', {
        body: JSON.stringify({ logIds }),
        method: 'DELETE',
      });

      setMessage(locale.startsWith('zh') ? '日志已删除。' : 'History deleted.');
      startTransition(() => {
        void loadWorkspace();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete history logs.');
    } finally {
      setHistoryBusy(false);
    }
  }

  async function runSearch(modeOverride?: SearchMode) {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchRangeLabel(null);
      setSearchFallback(false);
      return;
    }

    const effectiveMode = modeOverride ?? searchMode;

    setSearching(true);
    setMessage(null);

    try {
      const payload = (await jsonRequest('/api/search', {
        body: JSON.stringify({
          locale,
          mode: effectiveMode,
          query: trimmed,
          timezone,
        }),
        method: 'POST',
      })) as SearchResponse;

      setSearchResults(Array.isArray(payload.results) ? payload.results : []);
      setSearchRangeLabel(payload.timeRange?.label ?? null);
      setSearchFallback(Boolean(payload.fallbackToKeyword));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to search items.');
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchResults([]);
    setSearchRangeLabel(null);
    setSearchFallback(false);
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
        <GuidePanel copy={copy} locale={locale} />
        <ComposerPanel
          busy={busy}
          copy={copy}
          locale={locale}
          onAnalyze={() => void handleAnalyze()}
          setComposerText={setComposerText}
          text={composerText}
        />
      </section>

      <section className="planner-grid">
        <SearchResultsPanel
          fallbackToKeyword={searchFallback}
          locale={locale}
          mode={searchMode}
          onClear={clearSearch}
          onModeChange={(nextMode) => {
            setSearchMode(nextMode);
            if (searchQuery.trim()) {
              void runSearch(nextMode);
            }
          }}
          onQueryChange={setSearchQuery}
          onSearch={() => void runSearch()}
          onSelectItem={setSelectedItem}
          query={searchQuery}
          results={searchResults}
          searching={searching}
          timeRangeLabel={searchRangeLabel}
        />
      </section>

      <ConfirmationModal
        busy={busy}
        copy={copy}
        draft={draft}
        locale={locale}
        mode={parseMode}
        onChange={setDraft}
        onCreate={() => void handleCreate()}
        onDismiss={closeConfirmation}
        open={isConfirmationOpen}
        sourceText={composerText}
      />

      <ItemEditor
        item={selectedItem}
        launchOrigin={selectedItemLaunchOrigin}
        locale={locale}
        onChange={setSelectedItem}
        onDelete={(item) => void handleDeleteItem(item)}
        onDismiss={closeSelectedItem}
        onSave={(item) => void handleSaveItemAndClose(item)}
      />

      <section className="planner-grid planner-grid--bottom planner-grid--triple">
        <CalendarFull
          focusDate={focusDate}
          items={calendarItems}
          locale={locale}
          onFocusDateChange={setFocusDate}
          onSelectItem={handleOpenItem}
          timezone={timezone}
        />
        <TodoRail
          copy={copy}
          groupFilter={groupFilter}
          items={filteredTodos}
          locale={locale}
          onQuickStatus={(item, status) => void handleQuickStatus(item, status)}
          onSelectItem={handleOpenItem}
          priorityFilter={priorityFilter}
          search={search}
          setGroupFilter={setGroupFilter}
          setPriorityFilter={setPriorityFilter}
          setSearch={setSearch}
          setStatusFilter={setStatusFilter}
          statusFilter={statusFilter}
        />
        <HistoryTimeline
          busy={busy || historyBusy}
          copy={copy}
          locale={locale}
          logs={logs}
          onDeleteLogs={handleDeleteLogs}
          onUndoLogs={handleUndoLogs}
        />
      </section>
    </main>
  );
}
