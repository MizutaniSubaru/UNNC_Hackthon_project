create extension if not exists pgcrypto;

drop table if exists public.calendar_connections cascade;
drop table if exists public.activity_logs cascade;
drop table if exists public.items cascade;
drop table if exists public.groups cascade;

create table public.groups (
  key text primary key,
  label_en text not null,
  label_zh text not null,
  accent text not null,
  order_index integer not null default 0
);

insert into public.groups (key, label_en, label_zh, accent, order_index)
values
  ('study', 'Study', '学习', '#4f7cff', 1),
  ('work', 'Work', '工作', '#ff6b4a', 2),
  ('life', 'Life', '生活', '#39b07a', 3),
  ('health', 'Health', '健康', '#f5a623', 4),
  ('other', 'Other', '其他', '#7b6ef6', 5);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('todo', 'event')),
  title text not null,
  location text,
  notes text,
  status text not null,
  group_key text not null default 'other' references public.groups(key),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  estimated_minutes integer,
  start_at timestamptz,
  end_at timestamptz,
  due_date date,
  is_all_day boolean not null default false,
  needs_confirmation boolean not null default false,
  parse_confidence numeric(3, 2),
  source_text text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('created', 'updated', 'completed', 'deleted')),
  item_id text,
  item_title text not null,
  item_type text not null check (item_type in ('todo', 'event')),
  summary text not null,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

alter table public.groups enable row level security;
alter table public.items enable row level security;
alter table public.activity_logs enable row level security;

create policy "groups_readable_by_anon"
on public.groups
for select
to anon, authenticated
using (true);

create policy "items_manageable_by_anon"
on public.items
for all
to anon, authenticated
using (true)
with check (true);

create policy "activity_logs_readable_by_anon"
on public.activity_logs
for select
to anon, authenticated
using (true);

create policy "activity_logs_insertable_by_anon"
on public.activity_logs
for insert
to anon, authenticated
with check (true);
