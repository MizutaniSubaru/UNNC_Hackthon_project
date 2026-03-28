import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

type MockCreateInput = {
  max_completion_tokens: number;
  messages: Array<{ content: string; role: string }>;
  model: string;
  response_format: { type: string };
};

type MockOutcome =
  | {
      content: string;
      type: 'success';
    }
  | {
      message: string;
      status?: number;
      type: 'error';
    };

const originalEnv = {
  MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
  MINIMAX_MODEL: process.env.MINIMAX_MODEL,
  MINIMAX_SEARCH_INTENT_MODEL: process.env.MINIMAX_SEARCH_INTENT_MODEL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
};

let callModels: string[] = [];
let queuedOutcomes: MockOutcome[] = [];

mock.module('openai', () => ({
  OpenAI: class MockOpenAI {
    chat = {
      completions: {
        create: async ({ model }: MockCreateInput) => {
          callModels.push(model);
          const outcome = queuedOutcomes.shift();

          if (!outcome) {
            throw new Error(`Missing mock outcome for model ${model}.`);
          }

          if (outcome.type === 'error') {
            const error = new Error(outcome.message) as Error & { status?: number };
            error.status = outcome.status;
            throw error;
          }

          return {
            choices: [{ message: { content: outcome.content } }],
            usage: {
              completion_tokens: 32,
              prompt_tokens: 16,
              total_tokens: 48,
            },
          };
        },
      },
    };
  },
}));

const { requestAiJson } = await import('@/lib/ai-provider');

beforeEach(() => {
  callModels = [];
  queuedOutcomes = [];
  process.env.MINIMAX_API_KEY = 'test-key';
  delete process.env.OPENAI_API_KEY;
  delete process.env.MINIMAX_MODEL;
  delete process.env.OPENAI_MODEL;
  delete process.env.MINIMAX_SEARCH_INTENT_MODEL;
});

afterEach(() => {
  process.env.MINIMAX_API_KEY = originalEnv.MINIMAX_API_KEY;
  process.env.MINIMAX_MODEL = originalEnv.MINIMAX_MODEL;
  process.env.MINIMAX_SEARCH_INTENT_MODEL = originalEnv.MINIMAX_SEARCH_INTENT_MODEL;
  process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
  process.env.OPENAI_MODEL = originalEnv.OPENAI_MODEL;
});

describe('requestAiJson', () => {
  it('retries unsupported search models with the next fallback candidate', async () => {
    process.env.MINIMAX_SEARCH_INTENT_MODEL = 'MiniMax-M2.5-highspeed';
    queuedOutcomes = [
      {
        message: '500 your current token plan not support model, MiniMax-M2.5-highspeed (2061)',
        status: 500,
        type: 'error',
      },
      {
        content: '{"keywords":"advisor","type":"all","date_start":null,"date_end":null}',
        type: 'success',
      },
    ];

    const payload = await requestAiJson({
      messages: [
        { content: 'Return JSON.', role: 'system' },
        { content: 'advisor', role: 'user' },
      ],
      parse: (content) => (content ? JSON.parse(content) : null),
      task: 'search-intent',
    });

    expect(payload).toEqual({
      date_end: null,
      date_start: null,
      keywords: 'advisor',
      type: 'all',
    });
    expect(callModels.slice(0, 2)).toEqual(['MiniMax-M2.5-highspeed', 'MiniMax-M2.5']);
  });
});
