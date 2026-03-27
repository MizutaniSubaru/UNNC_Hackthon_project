# Orbit Planner

An AI-first task calendar manager built with `Next.js`, `Bun`, and `Supabase`.

## What It Does

- Shared anonymous workspace with no sign-in flow
- Natural-language intake in Chinese and English
- AI classification into calendar events vs. to-do items
- Confirmation card before creating ambiguous or inferred events
- Month view, week view, and filtered to-do rail
- Activity timeline for created, updated, completed, and deleted items
- Enter key shortcut for parsing in the intake box (`Shift+Enter` keeps newline)
- Event time guard: end time must be later than start time
- Scrollable time picker for start/end selection in confirmation and editor panels
- Completed/cancelled items are removed from schedule and active to-do rail views

## Requirements

- Bun `1.3.11` or newer
- A Supabase project
- Optional AI provider credentials:
  - `OPENAI_*` for OpenAI-compatible models
  - or `KIMI_*` for Moonshot/Kimi

## Local Setup

```bash
bun install
cp .env.example .env.local
```

Then configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- AI credentials if you want model-backed parsing

If no AI key is configured, the app falls back to a lightweight heuristic parser for local testing.

## Supabase Setup

1. Run the SQL in [`supabase/schema.sql`](./supabase/schema.sql).
2. Confirm the tables exist:
   - `groups`
   - `items`
   - `activity_logs`
3. Use the project `anon` key in `.env.local`.

## Commands

```bash
bun run dev
bun run lint
bun run build
```

`bun run dev` uses webpack mode by default for better local stability on Windows.

## Notes

- This is a shared demo workspace, not a production multi-user app.
- History is stored as an activity feed for `created`, `updated`, `completed`, and `deleted`.
- Repeating events, reminders, collaboration, and external calendar sync are intentionally out of scope for `v1`.
