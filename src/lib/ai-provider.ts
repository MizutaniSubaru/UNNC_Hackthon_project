import { OpenAI } from 'openai';
import type { APIError } from 'openai/error';

const DEFAULT_MINIMAX_BASE_URL = 'https://api.minimaxi.com/v1';
const DEFAULT_MINIMAX_MODEL = 'MiniMax-M2.7';
const DEFAULT_JSON_TASK_MODEL = 'MiniMax-M2.7-highspeed';
const MINIMAX_MODEL_FALLBACKS = [
  'MiniMax-M2.7',
  'MiniMax-M2.7-highspeed',
  'MiniMax-M2.5',
  'MiniMax-M2.5-highspeed',
  'MiniMax-M2.1',
  'MiniMax-M2.1-highspeed',
  'MiniMax-M2',
] as const;

const TASK_MODEL_ENV_KEYS = {
  default: 'MINIMAX_MODEL',
  parse: 'MINIMAX_PARSE_MODEL',
  'search-intent': 'MINIMAX_SEARCH_INTENT_MODEL',
  'search-rerank': 'MINIMAX_SEARCH_RERANK_MODEL',
} as const;

const TASK_DEFAULT_MODELS = {
  default: DEFAULT_MINIMAX_MODEL,
  parse: DEFAULT_JSON_TASK_MODEL,
  'search-intent': DEFAULT_JSON_TASK_MODEL,
  'search-rerank': DEFAULT_JSON_TASK_MODEL,
} as const;

const TASK_MAX_COMPLETION_TOKENS = {
  parse: 256,
  'search-intent': 128,
  'search-rerank': 768,
} as const;

const TASK_MAX_TOKEN_ENV_KEYS = {
  parse: 'MINIMAX_PARSE_MAX_COMPLETION_TOKENS',
  'search-intent': 'MINIMAX_SEARCH_INTENT_MAX_COMPLETION_TOKENS',
  'search-rerank': 'MINIMAX_SEARCH_RERANK_MAX_COMPLETION_TOKENS',
} as const;

type AiJsonTask = keyof typeof TASK_MAX_COMPLETION_TOKENS;

export type AiTask = keyof typeof TASK_MODEL_ENV_KEYS;

export type AiConfig = {
  apiKey: string | undefined;
  baseURL: string;
  candidateModels: string[];
  model: string;
  task: AiTask;
};

type AiJsonMessage = {
  content: string;
  role: 'assistant' | 'system' | 'user';
};

type AiJsonMetrics = {
  cachedTokens?: number | null;
  completionTokens?: number | null;
  durationMs?: number;
  fastPath?: boolean;
  model?: string;
  outcome: 'error' | 'invalid_json' | 'no_api_key' | 'skip' | 'success';
  promptTokens?: number | null;
  reasoningTokens?: number | null;
  reason?: string;
  task: AiTask;
  totalTokens?: number | null;
};

function uniqueNonEmpty(values: string[]) {
  return values.filter((value, index, array) => Boolean(value) && array.indexOf(value) === index);
}

function getConfiguredGlobalModel() {
  return process.env.MINIMAX_MODEL || process.env.OPENAI_MODEL;
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function getTaskModel(task: AiTask) {
  if (task === 'default') {
    return getConfiguredGlobalModel() || TASK_DEFAULT_MODELS.default;
  }

  return (
    process.env[TASK_MODEL_ENV_KEYS[task]] ||
    getConfiguredGlobalModel() ||
    TASK_DEFAULT_MODELS[task]
  );
}

function getTaskFallbacks(task: AiTask) {
  if (task === 'default') {
    return [...MINIMAX_MODEL_FALLBACKS];
  }

  return [TASK_DEFAULT_MODELS[task], ...MINIMAX_MODEL_FALLBACKS];
}

function getUsageMetric(source: unknown, path: string[]) {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'number' && Number.isFinite(current) ? current : null;
}

export function getAiConfig(task: AiTask = 'default'): AiConfig {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL =
    process.env.MINIMAX_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_MINIMAX_BASE_URL;
  const configuredGlobalModel = getConfiguredGlobalModel();
  const model = getTaskModel(task);

  return {
    apiKey,
    baseURL,
    candidateModels: uniqueNonEmpty([model, configuredGlobalModel || '', ...getTaskFallbacks(task)]),
    model,
    task,
  };
}

export function getAiMaxCompletionTokens(task: AiJsonTask) {
  return readPositiveInt(
    process.env[TASK_MAX_TOKEN_ENV_KEYS[task]],
    TASK_MAX_COMPLETION_TOKENS[task]
  );
}

export function createAiClient(config = getAiConfig()) {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

export function isRetryableModelError(error: unknown) {
  const apiError = error as APIError;
  const message = apiError?.message || (error instanceof Error ? error.message : '');

  return (
    apiError?.status === 404 ||
    /not found the model|permission denied|unknown model|invalid model|model.*not.*found/i.test(
      message
    )
  );
}

export function sanitizeAiJsonContent(content: string | null | undefined) {
  if (!content) {
    return null;
  }

  let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    cleaned = fencedMatch[1].trim();
  }

  const objectStart = cleaned.indexOf('{');
  const objectEnd = cleaned.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    cleaned = cleaned.slice(objectStart, objectEnd + 1).trim();
  }

  return cleaned || null;
}

export function logAiJsonMetrics(metrics: AiJsonMetrics) {
  try {
    console.info(
      '[ai-json]',
      JSON.stringify({
        ...metrics,
        cachedTokens: metrics.cachedTokens ?? undefined,
        completionTokens: metrics.completionTokens ?? undefined,
        durationMs: metrics.durationMs ?? undefined,
        promptTokens: metrics.promptTokens ?? undefined,
        reasoningTokens: metrics.reasoningTokens ?? undefined,
        totalTokens: metrics.totalTokens ?? undefined,
      })
    );
  } catch {
    // Logging should never block the request path.
  }
}

export async function requestAiJson<T>(input: {
  maxCompletionTokens?: number;
  messages: AiJsonMessage[];
  parse: (content: string | null) => T | null;
  task: AiJsonTask;
}) {
  const aiConfig = getAiConfig(input.task);
  if (!aiConfig.apiKey) {
    logAiJsonMetrics({
      fastPath: false,
      outcome: 'no_api_key',
      reason: 'missing_api_key',
      task: input.task,
    });
    return null;
  }

  const openai = createAiClient(aiConfig);
  const maxCompletionTokens = input.maxCompletionTokens ?? getAiMaxCompletionTokens(input.task);
  let lastError: unknown = null;

  for (const candidate of aiConfig.candidateModels) {
    const startedAt = Date.now();

    try {
      const response = await openai.chat.completions.create({
        max_completion_tokens: maxCompletionTokens,
        messages: input.messages,
        model: candidate,
        response_format: { type: 'json_object' },
      });

      const payload = input.parse(sanitizeAiJsonContent(response.choices[0]?.message?.content));
      const usage = response.usage;
      const baseMetrics = {
        cachedTokens: getUsageMetric(usage, ['prompt_tokens_details', 'cached_tokens']),
        completionTokens: usage?.completion_tokens ?? null,
        durationMs: Date.now() - startedAt,
        model: candidate,
        promptTokens: usage?.prompt_tokens ?? null,
        reasoningTokens: getUsageMetric(usage, ['completion_tokens_details', 'reasoning_tokens']),
        task: input.task,
        totalTokens: usage?.total_tokens ?? null,
      } as const;

      if (payload !== null) {
        logAiJsonMetrics({
          ...baseMetrics,
          outcome: 'success',
        });
        return payload;
      }

      lastError = new Error('Model returned invalid JSON.');
      logAiJsonMetrics({
        ...baseMetrics,
        outcome: 'invalid_json',
      });
    } catch (error) {
      lastError = error;
      logAiJsonMetrics({
        durationMs: Date.now() - startedAt,
        model: candidate,
        outcome: 'error',
        reason: error instanceof Error ? error.message : 'Unknown error',
        task: input.task,
      });

      if (!isRetryableModelError(error)) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}
