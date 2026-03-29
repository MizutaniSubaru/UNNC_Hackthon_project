# Orbit Planner

[English](./README.md) | [简体中文](./README.zh-CN.md)

AI-assisted planning workspace for students, built with Next.js, Bun, and Supabase.

![photo_1_2026-03-29_13-14-35](https://github.com/user-attachments/assets/60108cf1-f086-48e7-bed7-093c11259bbe)
<img width="2468" height="1463" alt="image" src="https://github.com/user-attachments/assets/b19446c9-2d91-4eef-83b0-f8488896b3cb" />

### 1. Project Overview

Orbit Planner helps students turn unstructured inputs into an executable study plan.
You can type natural language, upload images, or upload courseware PDFs, then quickly organize content into calendar events, to-do items, and study notes.

This project is designed as a practical hackathon product: fast setup, low friction, and easy local testing.

### Core Features

1. Natural-language planning intake in Chinese and English.
2. AI-assisted parsing into calendar events and to-do tasks.
3. Confirmation flow for ambiguous or inferred schedule data.
4. Calendar views (month/week-style) plus filtered to-do rail.
5. Activity history for created, updated, completed, and deleted items.
6. OCR-based image text extraction for planning inputs(beta).
7. Calendar export utilities.

### Other Features

1. Quote rotation UX elements.
2. A simple pomodoro timer.
3. PDF courseware to markdown notes workflow (beta).

### 3. Tech Stack

| Layer       | Stack                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| Frontend    | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion        |
| Backend     | Next.js App Router API Routes (Node runtime), Bun                      |
| Database    | Supabase (PostgreSQL + RLS)                                            |
| AI/NLP      | MiniMax via OpenAI-compatible API, optional OpenAI-compatible fallback |
| OCR/PDF     | Tesseract.js, pdfjs-dist, @napi-rs/canvas                              |
| Calendar/UI | FullCalendar, lucide-react, @ncdai/react-wheel-picker                  |

### 4. Project Structure

```text
UNNC_Hackthon_project/
  src/
    app/
      api/
        history/           # activity history APIs
        items/             # item CRUD APIs
        nl/parse/          # natural-language parse API
        nl/notes/          # PDF courseware -> notes API
        quotes/            # quote APIs
        search/            # semantic search APIs
      page.tsx             # app entry page
      layout.tsx           # root layout
      globals.css          # global styles
    components/            # UI components and planner views
    lib/                   # business logic, AI, OCR, formatting, tests
  supabase/
    schema.sql             # database schema and policies
    quotes.seed.sql        # optional quote seed data
  package.json             # dependencies and scripts
```

### 5. Dependencies and Installation

Dependencies are defined in [package.json](./package.json).

Key runtime dependencies include:

- Framework/runtime: `next`, `react`, `react-dom`
- Database: `@supabase/supabase-js`, `@supabase/ssr`, `pg`
- AI: `ai`, `openai`
- OCR/PDF: `tesseract.js`, `pdfjs-dist`, `@napi-rs/canvas`
- Calendar/UI: `@fullcalendar/*`, `framer-motion`, `lucide-react`, `clsx`

Key dev dependencies include:

- `typescript`, `eslint`, `eslint-config-next`
- `tailwindcss`, `@tailwindcss/postcss`, `daisyui`
- `bun-types`, `@types/*`

Install all dependencies:

```bash
bun install
```

### 6. Quick Start (Including Supabase Table Setup)

#### Step 0: Prerequisites

1. Bun `1.3.11+`
2. A Supabase project
3. Optional: MiniMax/OpenAI-compatible API key for AI-enhanced parsing

#### Step 1: Clone and Enter Project

```bash
git clone <your-repo-url>
cd UNNC_Hackthon_project
```

#### Step 2: Install Dependencies

```bash
bun install
```

#### Step 3: Create Environment File

Linux/macOS:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional AI variables (recommended for best NLP quality):

- `MINIMAX_API_KEY`
- `MINIMAX_BASE_URL`
- `MINIMAX_MODEL`
- `MINIMAX_PARSE_MODEL`
- `MINIMAX_SEARCH_INTENT_MODEL`
- `MINIMAX_SEARCH_RERANK_MODEL`
- Optional token caps in `.env.example`

If AI keys are not configured, the app can still run with heuristic fallback parsing for local use.

#### Step 4: Supabase Database Setup (Create Tables)

1. Open [Supabase project dashboard.](https://supabase.com/),Register your account and create your project.
2. Go to `SQL Editor`.
3. Run the SQL from [supabase/schema.sql](./supabase/schema.sql).
4. Confirm these tables exist:
   - `public.groups`
   - `public.items`
   - `public.activity_logs`
   - `public.quotes`
5. (Optional) Run [supabase/quotes.seed.sql](./supabase/quotes.seed.sql) to preload quote data.

Then copy Supabase values into `.env.local`:

1. Supabase Dashboard -> `Settings` -> `API`
2. Copy `Project URL` to `NEXT_PUBLIC_SUPABASE_URL`
3. Copy `anon public` key to `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### Step 5: Run the Project

```bash
bun run dev
```

Open:

- `http://localhost:3000`

#### Step 6: Quality Checks

```bash
bun run lint
bun run build
```

### 7. Common Issues

1. `Module not found` for OCR/PDF packages:
   Run `bun install` again and ensure lockfile is up to date.
2. Supabase data is not loading:
   Re-check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. AI parsing quality is low:
   Confirm `MINIMAX_API_KEY` is configured; otherwise fallback parser is used.
4. Windows local stability:
   `bun run dev` already uses webpack mode in `package.json`.

### 8. Development Team

- [@MizutaniSubaru](https://github.com/MizutaniSubaru)
- [@kondaidaidaisuki-dot](https://github.com/kondaidaidaisuki-dot)
- [@noki0717](https://github.com/noki0717)

### 9. Contributing and License

- Contribution Guide: [CONTRIBUTING.md](./.github/CONTRIBUTING.md)
- Security Policy: [SECURITY.md](./.github/SECURITY.md)
- Open Source License: [MIT License](./LICENSE)
