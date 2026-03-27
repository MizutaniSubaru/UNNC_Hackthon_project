import { NextResponse } from 'next/server';
import { buildUndoLog } from '@/lib/activity';
import { getSupabaseClient } from '@/lib/supabase';
import type { Json } from '@/lib/database.types';
import type { ActivityLog, Item, ItemType } from '@/lib/types';

type HistoryMarkerDetails = {
  history_meta?: {
    hidden_log_ids?: string[];
    reason?: 'manual-delete' | 'undo-apply';
  };
  [key: string]: Json | undefined;
};

type ItemSnapshot = {
  title?: unknown;
  type?: unknown;
  due_date?: unknown;
  end_at?: unknown;
  estimated_minutes?: unknown;
  group_key?: unknown;
  is_all_day?: unknown;
  location?: unknown;
  notes?: unknown;
  parse_confidence?: unknown;
  priority?: unknown;
  source_text?: unknown;
  start_at?: unknown;
  status?: unknown;
};

function asText(value: unknown, fallback: string | null = null) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function asNullableText(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNullableNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function asItemType(value: unknown): ItemType {
  return value === 'event' ? 'event' : 'todo';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asStatus(value: unknown, type: ItemType) {
  const fallback = type === 'event' ? 'scheduled' : 'pending';
  const normalized = asText(value, fallback);
  if (!normalized) {
    return fallback;
  }

  if (type === 'event') {
    return normalized === 'completed' || normalized === 'cancelled' || normalized === 'scheduled'
      ? normalized
      : fallback;
  }

  return normalized === 'completed' || normalized === 'pending' ? normalized : fallback;
}

function asGroup(value: unknown) {
  const normalized = asText(value, 'other');
  if (
    normalized === 'study' ||
    normalized === 'work' ||
    normalized === 'life' ||
    normalized === 'health' ||
    normalized === 'other'
  ) {
    return normalized;
  }

  return 'other';
}

function asPriority(value: unknown) {
  const normalized = asText(value, 'medium');
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }

  return 'medium';
}

function asDetailsObject(value: Json) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>;
  }

  return {};
}

function hasUndoMeta(log: ActivityLog) {
  const details = asDetailsObject(log.details_json);
  return isObject(details.undo_meta);
}

function getHistoryMarkerDetails(log: ActivityLog): HistoryMarkerDetails | null {
  if (!isObject(log.details_json)) {
    return null;
  }

  const details = log.details_json as HistoryMarkerDetails;
  if (!details.history_meta || !isObject(details.history_meta)) {
    return null;
  }

  return details;
}

function getHiddenLogIdsFromMarker(log: ActivityLog) {
  const details = getHistoryMarkerDetails(log);
  if (!details?.history_meta || !Array.isArray(details.history_meta.hidden_log_ids)) {
    return [] as string[];
  }

  return details.history_meta.hidden_log_ids.filter(
    (id): id is string => typeof id === 'string' && id.trim().length > 0
  );
}

function isHistoryMarkerLog(log: ActivityLog) {
  const details = getHistoryMarkerDetails(log);
  return Boolean(details?.history_meta);
}

async function insertHistoryHideMarker(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  hiddenLogIds: string[],
  reason: 'manual-delete' | 'undo-apply'
) {
  if (hiddenLogIds.length === 0) {
    return;
  }

  const uniqueIds = Array.from(new Set(hiddenLogIds));
  const { error } = await supabase.from('activity_logs').insert({
    action: 'updated',
    details_json: {
      history_meta: {
        hidden_log_ids: uniqueIds,
        reason,
      },
    } satisfies Json,
    item_id: null,
    item_title: 'History',
    item_type: 'todo',
    summary:
      reason === 'manual-delete'
        ? `Deleted ${uniqueIds.length} history log(s).`
        : `Applied undo to ${uniqueIds.length} history log(s).`,
  });

  if (error) {
    throw error;
  }
}

function toSnapshot(value: unknown) {
  return isObject(value) ? (value as ItemSnapshot) : null;
}

function normalizeSnapshot(
  snapshot: ItemSnapshot | null,
  log: ActivityLog,
  currentItem: Item | null
) {
  if (!snapshot) {
    return null;
  }

  const type = asItemType(snapshot.type ?? currentItem?.type ?? log.item_type);
  const isAllDay = asBoolean(snapshot.is_all_day, currentItem?.is_all_day ?? false);
  const startAt = asNullableText(snapshot.start_at ?? currentItem?.start_at ?? null);
  const endAt = asNullableText(snapshot.end_at ?? currentItem?.end_at ?? null);

  return {
    due_date: asNullableText(snapshot.due_date ?? currentItem?.due_date ?? null),
    end_at: type === 'event' && !isAllDay ? endAt : null,
    estimated_minutes: asNullableNumber(
      snapshot.estimated_minutes ?? currentItem?.estimated_minutes ?? null
    ),
    group_key: asGroup(snapshot.group_key ?? currentItem?.group_key ?? 'other'),
    is_all_day: isAllDay,
    location: asNullableText(snapshot.location ?? currentItem?.location ?? null),
    needs_confirmation: false,
    notes: asNullableText(snapshot.notes ?? currentItem?.notes ?? null),
    parse_confidence: asNullableNumber(
      snapshot.parse_confidence ?? currentItem?.parse_confidence ?? null
    ),
    priority: asPriority(snapshot.priority ?? currentItem?.priority ?? 'medium'),
    source_text: asNullableText(
      snapshot.source_text ?? currentItem?.source_text ?? 'Recovered from activity history.'
    ),
    start_at: type === 'event' && !isAllDay ? startAt : null,
    status: asStatus(snapshot.status ?? currentItem?.status ?? null, type),
    title: asText(snapshot.title, currentItem?.title ?? log.item_title) ?? 'Untitled item',
    type,
  };
}

async function fetchItemById(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  itemId: string
) {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as Item | null) ?? null;
}

async function applyItemTransition(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  itemId: string,
  target: ReturnType<typeof normalizeSnapshot>
) {
  if (!target) {
    const { error: deleteError } = await supabase.from('items').delete().eq('id', itemId);
    if (deleteError) {
      throw deleteError;
    }

    return null;
  }

  const current = await fetchItemById(supabase, itemId);
  if (current) {
    const { error: updateError } = await supabase.from('items').update(target).eq('id', itemId);
    if (updateError) {
      throw updateError;
    }
  } else {
    const { error: insertError } = await supabase.from('items').insert({
      ...target,
      id: itemId,
    });
    if (insertError) {
      throw insertError;
    }
  }

  return await fetchItemById(supabase, itemId);
}

function resolveUndoTargetSnapshot(log: ActivityLog, currentItem: Item | null) {
  const details = asDetailsObject(log.details_json);

  if (hasUndoMeta(log)) {
    return normalizeSnapshot(toSnapshot(details.item_before), log, currentItem);
  }

  if (log.action === 'created') {
    return null;
  }

  if (log.action === 'deleted') {
    return normalizeSnapshot(toSnapshot(details.before), log, currentItem);
  }

  return normalizeSnapshot(toSnapshot(details.previous), log, currentItem);
}

function parseLogIds(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return [] as string[];
  }

  const source = payload as { ids?: unknown; logIds?: unknown };
  const candidates = Array.isArray(source.logIds)
    ? source.logIds
    : Array.isArray(source.ids)
      ? source.ids
      : [];

  return candidates
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    .map((id) => id.trim());
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase is not configured.' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || '40'), 100);
    const fetchSize = Math.min((Number.isFinite(limit) && limit > 0 ? limit : 40) * 3, 300);

    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(fetchSize);

    if (error) {
      throw error;
    }

    const hiddenIds = new Set<string>();
    const visibleLogs: ActivityLog[] = [];
    for (const rawLog of (data ?? []) as ActivityLog[]) {
      const log = rawLog as ActivityLog;

      if (isHistoryMarkerLog(log)) {
        for (const hiddenId of getHiddenLogIdsFromMarker(log)) {
          hiddenIds.add(hiddenId);
        }
        continue;
      }

      if (hiddenIds.has(log.id)) {
        continue;
      }

      visibleLogs.push(log);
      if (visibleLogs.length >= (Number.isFinite(limit) && limit > 0 ? limit : 40)) {
        break;
      }
    }

    return NextResponse.json({ logs: visibleLogs });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch activity history.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase is not configured.' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const logIds = parseLogIds(body);

    if (logIds.length === 0) {
      return NextResponse.json({ error: 'No history log ids were provided.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .in('id', logIds)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const logs = (data ?? []) as ActivityLog[];
    if (logs.length === 0) {
      return NextResponse.json({ error: 'No matching history logs were found.' }, { status: 404 });
    }

    const undoneLogIds: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const log of logs) {
      try {
        if (!log.item_id) {
          throw new Error('Log has no item id.');
        }

        const beforeItem = await fetchItemById(supabase, log.item_id);
        const target = resolveUndoTargetSnapshot(log, beforeItem);
        const afterItem = await applyItemTransition(supabase, log.item_id, target);

        const undoLog = buildUndoLog({
          afterItem,
          beforeItem,
          reversedUndo: hasUndoMeta(log),
          targetLog: log,
        });

        const { error: insertUndoLogError } = await supabase
          .from('activity_logs')
          .insert(undoLog);

        if (insertUndoLogError) {
          throw insertUndoLogError;
        }

        undoneLogIds.push(log.id);
      } catch (undoError) {
        const reason = undoError instanceof Error ? undoError.message : 'Undo failed.';
        failed.push({ id: log.id, reason });
      }
    }

    if (undoneLogIds.length === 0) {
      return NextResponse.json(
        {
          error: 'No selected logs could be undone.',
          failed,
        },
        { status: 400 }
      );
    }

    await insertHistoryHideMarker(supabase, undoneLogIds, 'undo-apply');

    return NextResponse.json({
      failed,
      success: true,
      undoneLogIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to undo history logs.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase is not configured.' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const logIds = parseLogIds(body);

    if (logIds.length === 0) {
      return NextResponse.json({ error: 'No history log ids were provided.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('activity_logs')
      .select('id')
      .in('id', logIds);

    if (error) {
      throw error;
    }

    const existingIds = (data ?? []).map((entry) => entry.id);
    if (existingIds.length === 0) {
      return NextResponse.json({ error: 'No matching history logs were found.' }, { status: 404 });
    }

    await insertHistoryHideMarker(supabase, existingIds, 'manual-delete');

    return NextResponse.json({
      deletedLogIds: existingIds,
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete history logs.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
