import { afterEach, describe, expect, it } from 'bun:test';
import { getAiConfig, getAiMaxCompletionTokens, isRetryableModelError } from '@/lib/ai-provider';

const ORIGINAL_ENV = {
  MINIMAX_MODEL: process.env.MINIMAX_MODEL,
  MINIMAX_PARSE_MAX_COMPLETION_TOKENS: process.env.MINIMAX_PARSE_MAX_COMPLETION_TOKENS,
  MINIMAX_PARSE_MODEL: process.env.MINIMAX_PARSE_MODEL,
  MINIMAX_SEARCH_INTENT_MAX_COMPLETION_TOKENS:
    process.env.MINIMAX_SEARCH_INTENT_MAX_COMPLETION_TOKENS,
  MINIMAX_SEARCH_INTENT_MODEL: process.env.MINIMAX_SEARCH_INTENT_MODEL,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
};

afterEach(() => {
  process.env.MINIMAX_MODEL = ORIGINAL_ENV.MINIMAX_MODEL;
  process.env.MINIMAX_PARSE_MAX_COMPLETION_TOKENS = ORIGINAL_ENV.MINIMAX_PARSE_MAX_COMPLETION_TOKENS;
  process.env.MINIMAX_PARSE_MODEL = ORIGINAL_ENV.MINIMAX_PARSE_MODEL;
  process.env.MINIMAX_SEARCH_INTENT_MAX_COMPLETION_TOKENS =
    ORIGINAL_ENV.MINIMAX_SEARCH_INTENT_MAX_COMPLETION_TOKENS;
  process.env.MINIMAX_SEARCH_INTENT_MODEL = ORIGINAL_ENV.MINIMAX_SEARCH_INTENT_MODEL;
  process.env.OPENAI_MODEL = ORIGINAL_ENV.OPENAI_MODEL;
});

describe('ai provider config', () => {
  it('does not default parse fallback candidates to highspeed models', () => {
    delete process.env.MINIMAX_PARSE_MODEL;
    process.env.MINIMAX_MODEL = 'MiniMax-M2.7';
    delete process.env.OPENAI_MODEL;

    const config = getAiConfig('parse');

    expect(config.model).toBe('MiniMax-M2.7');
    expect(config.candidateModels).not.toContain('MiniMax-M2.7-highspeed');
  });

  it('normalizes an explicitly configured parse highspeed model to its non-highspeed pair', () => {
    process.env.MINIMAX_PARSE_MODEL = 'MiniMax-M2.7-highspeed';
    process.env.MINIMAX_MODEL = 'MiniMax-M2.5-highspeed';

    const config = getAiConfig('parse');

    expect(config.model).toBe('MiniMax-M2.7');
    expect(config.candidateModels).toContain('MiniMax-M2.7');
    expect(config.candidateModels).not.toContain('MiniMax-M2.7-highspeed');
    expect(config.candidateModels).not.toContain('MiniMax-M2.5-highspeed');
  });

  it('uses a larger default completion token budget for parse', () => {
    delete process.env.MINIMAX_PARSE_MAX_COMPLETION_TOKENS;

    expect(getAiMaxCompletionTokens('parse')).toBe(512);
  });

  it('prefers non-highspeed search models before highspeed fallbacks', () => {
    delete process.env.MINIMAX_SEARCH_INTENT_MODEL;
    process.env.MINIMAX_MODEL = 'MiniMax-M2.7-highspeed';

    const config = getAiConfig('search-intent');
    const firstHighspeedIndex = config.candidateModels.findIndex((model) =>
      model.includes('highspeed')
    );
    const lastStandardIndex = config.candidateModels.findLastIndex(
      (model) => !model.includes('highspeed')
    );

    expect(config.model).toBe('MiniMax-M2.5');
    expect(config.candidateModels[0]).toBe('MiniMax-M2.5');
    expect(firstHighspeedIndex).toBeGreaterThan(lastStandardIndex);
  });

  it('treats unsupported model errors as retryable', () => {
    expect(
      isRetryableModelError(new Error('500 your current token plan not support model, MiniMax-M2.7-highspeed (2061)'))
    ).toBe(true);
  });
});
