import { beforeEach, describe, expect, it, mock } from 'bun:test';

let requestCount = 0;
let lastRequestInput: Record<string, unknown> | null = null;
let queuedPayload: Record<string, unknown> | null = null;

mock.module('@/lib/ai-provider', () => ({
  getAiConfig: () => ({
    apiKey: 'test-key',
    baseURL: 'https://example.test/v1',
    candidateModels: ['MiniMax-M2.7'],
    model: 'MiniMax-M2.7',
    task: 'parse' as const,
  }),
  logAiJsonMetrics: () => {},
  requestAiJson: async (input: Record<string, unknown>) => {
    requestCount += 1;
    lastRequestInput = input;
    return queuedPayload;
  },
}));

const { parseInputWithAi } = await import('@/lib/parse');

describe('parseInputWithAi', () => {
  beforeEach(() => {
    lastRequestInput = null;
    queuedPayload = null;
    requestCount = 0;
  });

  it('calls AI even for deterministic event inputs', async () => {
    queuedPayload = {
      ambiguity_reason: null,
      confidence: 0.97,
      estimated_minutes: 60,
      location: 'A44',
      needs_confirmation: true,
      priority: 'medium',
      title: 'Meet my advisor',
    };

    const parsed = await parseInputWithAi({
      locale: 'en-US',
      text: 'Meet my advisor tomorrow at 3 PM in A44',
      timezone: 'Asia/Shanghai',
    });

    expect(requestCount).toBe(1);
    expect(parsed.mode).toBe('ai');
    expect(parsed.result.location).toBe('A44');
    expect(parsed.extracted_fields.location).toBe('A44');
    expect(parsed.extracted_fields.time.timezone).toBe('Asia/Shanghai');
    expect(parsed.extracted_fields.time.start_at).not.toBeNull();
    expect(lastRequestInput).not.toBeNull();
    expect(lastRequestInput?.task).toBe('parse');
    expect(Array.isArray(lastRequestInput?.messages)).toBe(true);
    const messages = lastRequestInput?.messages as Array<{ content: string; role: string }>;
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('You are a bilingual AI planning assistant.');
    expect(messages[0]?.content).toContain('Return only a JSON object with these keys:');
    expect(messages[1]?.role).toBe('user');
    expect(messages[1]?.content).toBe('Meet my advisor tomorrow at 3 PM in A44');
  });

  it('calls AI even for short todo inputs that previously used the fast path', async () => {
    queuedPayload = {
      ambiguity_reason: null,
      confidence: 0.93,
      estimated_minutes: null,
      location: 'Jubilee Campus',
      needs_confirmation: false,
      priority: 'high',
      title: '\u5f00\u7ec4\u4f1a',
    };

    const parsed = await parseInputWithAi({
      locale: 'zh-CN',
      text: '\u5c3d\u5feb\u5728Jubilee Campus\u5f00\u7ec4\u4f1a',
      timezone: 'Asia/Shanghai',
    });

    expect(requestCount).toBe(1);
    expect(parsed.mode).toBe('ai');
    expect(parsed.result.title).toBe('\u5f00\u7ec4\u4f1a');
    expect(parsed.result.location).toBe('Jubilee Campus');
    expect(parsed.extracted_fields.priority).toBe('high');
  });
});
