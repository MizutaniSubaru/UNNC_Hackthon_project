# UNNC Hackathon Project

This project now runs on Bun as the default backend/runtime for Next.js.

The `dev`, `build`, and `start` scripts are powered by the built-in Next.js CLI.
There is no separate custom backend server file for these commands.

## Requirements

- Bun 1.3.11 or newer

## Getting Started

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun run dev
```

This runs `next dev --hostname 0.0.0.0`.

Create a production build:

```bash
bun run build
```

This runs `next build`.

Start the production server:

```bash
bun run start
```

This runs `next start --hostname 0.0.0.0`, and it requires `bun run build` first.

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file with the following values when you want to enable AI and Supabase features:

```bash
KIMI_API_KEY=
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL=kimi-k2.5
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Without these variables, the app still builds successfully, but the related runtime features stay disabled.
