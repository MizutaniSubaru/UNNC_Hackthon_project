import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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
  } catch (error) {
    return NextResponse.json({ error: 'Failed to analyze' }, { status: 500 });
  }
}
