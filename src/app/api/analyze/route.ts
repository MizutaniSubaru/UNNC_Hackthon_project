import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.KIMI_API_KEY;
    const baseURL = process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1';
    const model = process.env.KIMI_MODEL || 'moonshot/kimi-k2.5';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'KIMI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey, baseURL });
    const { text } = await req.json();

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a professional bookkeeper. Extract "amount", "category", and "description" from user input in JSON format. Amount should be a number. Language is Chinese.'
        },
        { role: 'user', content: text }
      ],
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to analyze' }, { status: 500 });
  }
}
