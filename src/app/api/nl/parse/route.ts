import { NextResponse } from 'next/server';
import { parseMultipleInputWithAi } from '@/lib/parse';

export async function POST(request: Request) {
  try {
    const { locale, text, timezone } = await request.json();

    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { error: 'Text is required for parsing.' },
        { status: 400 }
      );
    }

    const parsed = await parseMultipleInputWithAi({
      locale: typeof locale === 'string' ? locale : 'en-US',
      text,
      timezone: typeof timezone === 'string' ? timezone : undefined,
    });

    return NextResponse.json(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to parse planning request.';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
