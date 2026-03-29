# Orbit Planner

AI-assisted planning workspace for students, built with Next.js, Bun, and Supabase.

![photo_1_2026-03-29_13-14-35](https://github.com/user-attachments/assets/60108cf1-f086-48e7-bed7-093c11259bbe)
<img width="2468" height="1463" alt="image" src="https://github.com/user-attachments/assets/b19446c9-2d91-4eef-83b0-f8488896b3cb" />


## English

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

---

## 中文

### 1. 项目简介

Orbit Planner 是一个面向学生的 AI 辅助计划管理工具，支持将非结构化输入快速整理为可执行的学习安排。
你可以输入自然语言、上传图片，或上传课件 PDF，然后将内容整理成日历事件、待办任务与学习笔记。

项目定位为可快速落地的 Hackathon 产品：上手门槛低、可本地运行、便于二次开发。

### 2. 核心功能

1. 支持中英文自然语言输入。
2. AI 辅助解析并分类为事件或待办。
3. 对不明确时间或推断信息提供确认流程。
4. 提供月/周风格日历视图和待办筛选侧栏。
5. 内置番茄钟功能，可配置专注时长和休息时长。
6. 提供 created/updated/completed/deleted 活动历史。
7. 支持图片 OCR 识别作为输入来源。
8. 支持课件 PDF 转 Markdown 学习笔记（Beta）。
9. 提供日历导出能力与语录轮播等体验功能。

### 3. 技术栈

| 分层    | 技术                                                            |
| ------- | --------------------------------------------------------------- |
| 前端    | Next.js 16、React 19、TypeScript、Tailwind CSS 4、Framer Motion |
| 后端    | Next.js App Router API Routes（Node 运行时）、Bun               |
| 数据库  | Supabase（PostgreSQL + RLS）                                    |
| AI/NLP  | MiniMax（OpenAI 兼容接口），可选 OpenAI 兼容回退                |
| OCR/PDF | Tesseract.js、pdfjs-dist、@napi-rs/canvas                       |
| 日历/UI | FullCalendar、lucide-react、@ncdai/react-wheel-picker           |

### 4. 项目结构

```text
UNNC_Hackthon_project/
  src/
    app/
      api/
        history/           # 活动历史 API
        items/             # 事项 CRUD API
        nl/parse/          # 自然语言解析 API
        nl/notes/          # PDF 课件转笔记 API
        quotes/            # 语录 API
        search/            # 语义搜索 API
      page.tsx             # 页面入口
      layout.tsx           # 根布局
      globals.css          # 全局样式
    components/            # 页面和交互组件
    lib/                   # 业务逻辑、AI、OCR、工具与测试
  supabase/
    schema.sql             # 数据表与策略脚本
    quotes.seed.sql        # 可选语录种子数据
  package.json             # 依赖与命令
```

### 5. 依赖安装说明

依赖定义在 [package.json](./package.json) 中。

运行时关键依赖包括：

- 框架运行：`next`、`react`、`react-dom`
- 数据库：`@supabase/supabase-js`、`@supabase/ssr`、`pg`
- AI：`ai`、`openai`
- OCR/PDF：`tesseract.js`、`pdfjs-dist`、`@napi-rs/canvas`
- 日历与 UI：`@fullcalendar/*`、`framer-motion`、`lucide-react`、`clsx`

开发依赖包括：

- `typescript`、`eslint`、`eslint-config-next`
- `tailwindcss`、`@tailwindcss/postcss`、`daisyui`
- `bun-types`、`@types/*`

安装命令：

```bash
bun install
```

### 6. 快速启动教程（含 Supabase 建表）

#### 第 0 步：准备条件

1. Bun `1.3.11+`
2. 一个 Supabase 项目
3. 可选：MiniMax/OpenAI 兼容 API Key（提升解析质量）

#### 第 1 步：克隆并进入项目

```bash
git clone <你的仓库地址>
cd UNNC_Hackthon_project
```

#### 第 2 步：安装依赖

```bash
bun install
```

#### 第 3 步：创建环境变量文件

Linux/macOS:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

必填变量：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

推荐可选 AI 变量：

- `MINIMAX_API_KEY`
- `MINIMAX_BASE_URL`
- `MINIMAX_MODEL`
- `MINIMAX_PARSE_MODEL`
- `MINIMAX_SEARCH_INTENT_MODEL`
- `MINIMAX_SEARCH_RERANK_MODEL`
- 其他可选 token cap 见 `.env.example`

不配置 AI Key 也可运行，系统会走本地启发式回退解析。

#### 第 4 步：配置 Supabase 并建表

1. 打开 Supabase 项目 Dashboard。
2. 进入 `SQL Editor`。
3. 执行 [supabase/schema.sql](./supabase/schema.sql) 中的 SQL。
4. 确认以下表已创建：
   - `public.groups`
   - `public.items`
   - `public.activity_logs`
   - `public.quotes`
5. 可选执行 [supabase/quotes.seed.sql](./supabase/quotes.seed.sql) 导入语录种子数据。

可使用以下 SQL 进行表校验：

```sql
select tablename
from pg_tables
where schemaname = 'public'
  and tablename in ('groups', 'items', 'activity_logs', 'quotes')
order by tablename;
```

然后在 Supabase Dashboard -> `Settings` -> `API` 中复制：

1. `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
2. `anon public` key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### 第 5 步：启动项目

```bash
bun run dev
```

访问：

- `http://localhost:3000`

#### 第 6 步：基础检查

```bash
bun run lint
bun run build
```

### 7. 常见问题

1. OCR/PDF 依赖缺失导致 `Module not found`：
   重新执行 `bun install`，并确认依赖已写入 lock 文件。
2. Supabase 数据无法读取：
   检查 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否正确。
3. AI 解析效果不理想：
   请确认 `MINIMAX_API_KEY` 已配置，否则会使用回退解析。
4. Windows 本地开发稳定性：
   `bun run dev` 已在 `package.json` 中配置 webpack 模式。

### 8. 开发团队

- [@MizutaniSubaru](https://github.com/MizutaniSubaru)
- [@kondaidaidaisuki-dot](https://github.com/kondaidaidaisuki-dot)
- [@noki0717](https://github.com/noki0717)

### 9. 贡献指南与开源协议

- 贡献指南：[CONTRIBUTING.md](./.github/CONTRIBUTING.md)
- 安全策略：[SECURITY.md](./.github/SECURITY.md)
- 开源协议：[MIT License](./LICENSE)
