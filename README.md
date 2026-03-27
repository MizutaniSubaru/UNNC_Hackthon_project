# UNNC Hackathon Project

This project now runs on Bun as the default backend/runtime for Next.js.

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

Create a production build:

```bash
bun run build
```

Start the production server:

```bash
bun run start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file with the following values when you want to enable AI and Supabase features:

```bash
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Without these variables, the app still builds successfully, but the related runtime features stay disabled.
