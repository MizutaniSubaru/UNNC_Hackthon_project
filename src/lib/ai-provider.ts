import { OpenAI } from 'openai';
import type { APIError } from 'openai/error';

const DEFAULT_MINIMAX_BASE_URL = 'https://api.minimaxi.com/v1';
const DEFAULT_MINIMAX_MODEL = 'MiniMax-M2.7';
const MINIMAX_MODEL_FALLBACKS = [
  'MiniMax-M2.7',
  'MiniMax-M2.7-highspeed',
  'MiniMax-M2.5',
  'MiniMax-M2.5-highspeed',
  'MiniMax-M2.1',
  'MiniMax-M2.1-highspeed',
  'MiniMax-M2',
] as const;

export type AiConfig = {
  apiKey: string | undefined;
  baseURL: string;
  candidateModels: string[];
  model: string;
};

function uniqueNonEmpty(values: string[]) {
  return values.filter((value, index, array) => Boolean(value) && array.indexOf(value) === index);
}

export function getAiConfig(): AiConfig {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL =
    process.env.MINIMAX_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_MINIMAX_BASE_URL;
  const model = process.env.MINIMAX_MODEL || process.env.OPENAI_MODEL || DEFAULT_MINIMAX_MODEL;

  return {
    apiKey,
    baseURL,
    candidateModels: uniqueNonEmpty([model, ...MINIMAX_MODEL_FALLBACKS]),
    model,
  };
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
