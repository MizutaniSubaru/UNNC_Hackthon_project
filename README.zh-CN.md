# Orbit Planner

[English](./README.md) | [简体中文](./README.zh-CN.md)

面向学生的 AI 辅助规划工作台，基于 Next.js、Bun 和 Supabase 构建。

![photo_1_2026-03-29_13-14-35](https://github.com/user-attachments/assets/60108cf1-f086-48e7-bed7-093c11259bbe)
<img width="2468" height="1463" alt="image" src="https://github.com/user-attachments/assets/b19446c9-2d91-4eef-83b0-f8488896b3cb" />

### 1. 项目概述

Orbit Planner 帮助学生将非结构化输入整理为可执行的学习计划。
你可以输入自然语言、上传图片，或上传课程 PDF 材料，然后快速将内容组织为日历事件、待办事项和学习笔记。

该项目定位为一个实用型 Hackathon 产品：部署快、使用门槛低，并且便于本地测试。

### 核心功能

1. 支持中文和英文的自然语言规划输入。
2. 通过 AI 辅助解析为日历事件和待办任务。
3. 针对含糊或推断出的日程信息提供确认流程。
4. 提供日历视图（月视图/周视图风格）以及可筛选的待办侧栏。
5. 提供创建、更新、完成和删除项目的活动历史。
6. 支持基于 OCR 的图片文本提取，用作规划输入（beta）。
7. 支持日历导出功能。

### 其他功能

1. 语录轮播类交互元素。
2. 简单的番茄钟计时器。
3. 课程 PDF 转 Markdown 学习笔记流程（beta）。

### 3. 技术栈

| 分层    | 技术栈                                                            |
| ------- | ----------------------------------------------------------------- |
| 前端    | Next.js 16、React 19、TypeScript、Tailwind CSS 4、Framer Motion   |
| 后端    | Next.js App Router API Routes（Node runtime）、Bun                |
| 数据库  | Supabase（PostgreSQL + RLS）                                      |
| AI/NLP  | 通过 OpenAI 兼容接口接入 MiniMax，并可选使用 OpenAI 兼容回退方案 |
| OCR/PDF | Tesseract.js、pdfjs-dist、@napi-rs/canvas                         |
| 日历/UI | FullCalendar、lucide-react、@ncdai/react-wheel-picker             |

### 4. 项目结构

```text
UNNC_Hackthon_project/
  src/
    app/
      api/
        history/           # 活动历史 API
        items/             # 项目 CRUD API
        nl/parse/          # 自然语言解析 API
        nl/notes/          # PDF 课程材料转笔记 API
        quotes/            # 语录 API
        search/            # 语义搜索 API
      page.tsx             # 应用入口页
      layout.tsx           # 根布局
      globals.css          # 全局样式
    components/            # UI 组件与规划器视图
    lib/                   # 业务逻辑、AI、OCR、格式化和测试
  supabase/
    schema.sql             # 数据库结构和策略
    quotes.seed.sql        # 可选的语录种子数据
  package.json             # 依赖和脚本
```

### 5. 依赖与安装

依赖定义见 [package.json](./package.json)。

关键运行时依赖包括：

- 框架/运行时：`next`、`react`、`react-dom`
- 数据库：`@supabase/supabase-js`、`@supabase/ssr`、`pg`
- AI：`ai`、`openai`
- OCR/PDF：`tesseract.js`、`pdfjs-dist`、`@napi-rs/canvas`
- 日历/UI：`@fullcalendar/*`、`framer-motion`、`lucide-react`、`clsx`

关键开发依赖包括：

- `typescript`、`eslint`、`eslint-config-next`
- `tailwindcss`、`@tailwindcss/postcss`、`daisyui`
- `bun-types`、`@types/*`

安装全部依赖：

```bash
bun install
```

### 6. 快速开始（含 Supabase 建表）

#### 第 0 步：前置条件

1. Bun `1.3.11+`
2. 一个 Supabase 项目
3. 可选：用于增强解析效果的 MiniMax/OpenAI 兼容 API Key

#### 第 1 步：克隆并进入项目

```bash
git clone <your-repo-url>
cd UNNC_Hackthon_project
```

#### 第 2 步：安装依赖

```bash
bun install
```

#### 第 3 步：创建环境变量文件

Linux/macOS：

```bash
cp .env.example .env.local
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
```

必填变量：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

可选 AI 变量（推荐配置以获得更好的 NLP 效果）：

- `MINIMAX_API_KEY`
- `MINIMAX_BASE_URL`
- `MINIMAX_MODEL`
- `MINIMAX_PARSE_MODEL`
- `MINIMAX_SEARCH_INTENT_MODEL`
- `MINIMAX_SEARCH_RERANK_MODEL`
- 可选的 token cap 配置见 `.env.example`

如果没有配置 AI Key，应用仍可在本地使用启发式回退解析正常运行。

#### 第 4 步：配置 Supabase 数据库（创建数据表）

1. 打开 [Supabase 项目控制台](https://supabase.com/)，注册账号并创建项目。
2. 进入 `SQL Editor`。
3. 运行 [supabase/schema.sql](./supabase/schema.sql) 中的 SQL。
4. 确认以下数据表已经存在：
   - `public.groups`
   - `public.items`
   - `public.activity_logs`
   - `public.quotes`
5. （可选）运行 [supabase/quotes.seed.sql](./supabase/quotes.seed.sql) 预加载语录数据。

然后将 Supabase 的值复制到 `.env.local`：

1. 在 Supabase 控制台进入 `Settings` -> `API`
2. 将 `Project URL` 复制到 `NEXT_PUBLIC_SUPABASE_URL`
3. 将 `anon public` key 复制到 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### 第 5 步：运行项目

```bash
bun run dev
```

打开：

- `http://localhost:3000`

#### 第 6 步：质量检查

```bash
bun run lint
bun run build
```

### 7. 常见问题

1. OCR/PDF 相关包出现 `Module not found`：
   重新执行 `bun install`，并确认锁文件已更新。
2. Supabase 数据没有加载：
   重新检查 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
3. AI 解析效果较差：
   确认已配置 `MINIMAX_API_KEY`，否则会使用回退解析器。
4. Windows 本地开发稳定性：
   `bun run dev` 已在 `package.json` 中使用 webpack 模式。

### 8. 开发团队

- [@MizutaniSubaru](https://github.com/MizutaniSubaru)
- [@kondaidaidaisuki-dot](https://github.com/kondaidaidaisuki-dot)
- [@noki0717](https://github.com/noki0717)

### 9. 贡献与许可证

- 贡献指南：[CONTRIBUTING.md](./.github/CONTRIBUTING.md)
- 安全策略：[SECURITY.md](./.github/SECURITY.md)
- 开源许可证：[MIT License](./LICENSE)
