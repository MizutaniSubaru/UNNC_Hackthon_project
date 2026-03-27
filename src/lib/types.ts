import type { Database } from '@/lib/database.types';
import type {
  EVENT_STATUSES,
  GROUPS,
  PRIORITIES,
  TODO_STATUSES,
} from '@/lib/constants';

export type Item = Database['public']['Tables']['items']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
export type GroupKey = (typeof GROUPS)[number]['key'];
export type Priority = (typeof PRIORITIES)[number];
export type TodoStatus = (typeof TODO_STATUSES)[number];
export type EventStatus = (typeof EVENT_STATUSES)[number];

export type ItemType = 'todo' | 'event';

export type ParseResult = {
  ambiguity_reason: string | null;
  confidence: number;
  due_date: string | null;
  end_at: string | null;
  estimated_minutes: number | null;
  group_key: GroupKey;
  is_all_day: boolean;
  location: string;
  needs_confirmation: boolean;
  notes: string;
  priority: Priority;
  start_at: string | null;
  title: string;
  type: ItemType;
};

export type CreateItemPayload = {
  due_date: string | null;
  end_at: string | null;
  estimated_minutes: number | null;
  group_key: GroupKey;
  is_all_day: boolean;
  location: string | null;
  notes: string;
  parse_confidence: number | null;
  priority: Priority;
  source_text: string;
  start_at: string | null;
  status: string;
  title: string;
  type: ItemType;
};

export type UpdateItemPayload = Partial<CreateItemPayload> & {
  status?: string;
};

export type ActivityAction = 'created' | 'updated' | 'completed' | 'deleted';

export type LocaleCopy = {
  actions: {
    analyze: string;
    cancel: string;
    create: string;
    delete: string;
    refresh: string;
    save: string;
  };
  badges: {
    aiSuggested: string;
    allDay: string;
    demoFallback: string;
    needsConfirmation: string;
  };
  labels: {
    dueDate: string;
    end: string;
    estimatedMinutes: string;
    group: string;
    location: string;
    notes: string;
    priority: string;
    source: string;
    start: string;
    status: string;
    title: string;
    type: string;
  };
  sections: {
    calendar: string;
    confirmation: string;
    editor: string;
    history: string;
    intake: string;
    todo: string;
  };
};
