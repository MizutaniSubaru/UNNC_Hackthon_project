import { OpenAI } from 'openai';
import type { APIError } from 'openai/error';
import { NextResponse } from 'next/server';

type ExtractedExpense = {
  amount: number;
  category: string;
  description: string;
};

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    const match = normalized.match(/-?\d+(\.\d+)?/);

    if (!match) {
      return null;
    }

    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeExpense(payload: unknown, text: string): ExtractedExpense | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const amount = parseAmount(candidate.amount);
  const category =
    typeof candidate.category === 'string' && candidate.category.trim()
      ? candidate.category.trim()
      : 'uncategorized';
  const description =
    typeof candidate.description === 'string' && candidate.description.trim()
      ? candidate.description.trim()
      : text.trim();

  if (amount === null) {
    return null;
  }

  return { amount, category, description };
}

async function createExpenseCompletion(
  openai: OpenAI,
  text: string,
  configuredModel: string
) {
  const candidateModels = [
    configuredModel,
    'kimi-k2.5',
    'moonshot-v1-8k',
  ].filter((model, index, arr) => model && arr.indexOf(model) === index);

  let lastError: unknown = null;

  for (const model of candidateModels) {
    try {
      return await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are an AI bookkeeping assistant. Return only a JSON object with keys: amount, category, description. amount must be a number, not a string. description should be the purchased item or event in concise Chinese. category should be one of: 餐饮, 交通, 购物, 日用, 娱乐, 医疗, 学习, 住房, 其他. If the amount cannot be determined, return null for amount.',
          },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
      });
    } catch (error) {
      lastError = error;

      const apiError = error as APIError;
      const shouldRetryWithNextModel =
        apiError?.status === 404 ||
        /not found the model|permission denied/i.test(apiError?.message || '');

      if (!shouldRetryWithNextModel) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error('No available Kimi model could be used.');
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.KIMI_API_KEY;
    const baseURL = process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1';
    const model = process.env.KIMI_MODEL || 'kimi-k2.5';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'KIMI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey, baseURL });
    const { text } = await req.json();

    const response = await createExpenseCompletion(openai, text, model);

    const rawResult = JSON.parse(response.choices[0].message.content || '{}');
    const result = normalizeExpense(rawResult, text);

    if (!result) {
      return NextResponse.json(
        { error: 'Could not extract a valid amount from the input.' },
        { status: 422 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to analyze the expense.';

    console.error('Expense analysis failed:', message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
