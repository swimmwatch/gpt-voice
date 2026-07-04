import type { PrettifyTextOptions } from './BaseVoiceProvider';

export type OpenAIReasoningEffort = 'none' | 'low' | 'medium';

export interface OpenAIResponsesPrettifyRequestBody {
  model: string;
  instructions: string;
  input: string;
  reasoning?: {
    effort: OpenAIReasoningEffort;
  };
}

interface BuildOpenAIResponsesPrettifyRequestBodyOptions {
  input: string;
  model: string;
  prompt: string;
  reasoning: PrettifyTextOptions['reasoning'];
  includeReasoning?: boolean;
}

const KNOWN_REASONING_MODEL_PATTERNS = [/^gpt-5(?:[.-]|$)/, /^o(?:1|3|4)(?:[.-]|$)/];

export function getOpenAIReasoningEffort(reasoning: PrettifyTextOptions['reasoning']): OpenAIReasoningEffort {
  if (reasoning === 'extended') return 'medium';
  if (reasoning === 'standard') return 'low';
  return 'none';
}

export function isKnownOpenAIReasoningModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return KNOWN_REASONING_MODEL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildOpenAIResponsesPrettifyRequestBody({
  input,
  model,
  prompt,
  reasoning,
  includeReasoning = isKnownOpenAIReasoningModel(model),
}: BuildOpenAIResponsesPrettifyRequestBodyOptions): OpenAIResponsesPrettifyRequestBody {
  const body: OpenAIResponsesPrettifyRequestBody = {
    model,
    instructions: prompt,
    input,
  };

  if (includeReasoning) {
    body.reasoning = {
      effort: getOpenAIReasoningEffort(reasoning),
    };
  }

  return body;
}

function extractOpenAIErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } };
    return typeof parsed.error?.message === 'string' ? parsed.error.message : body;
  } catch {
    return body;
  }
}

export function isUnsupportedOpenAIReasoningResponse(status: number, body: string): boolean {
  if (status !== 400) return false;

  const message = extractOpenAIErrorMessage(body).toLowerCase();
  const mentionsReasoning = message.includes('reasoning') || message.includes('effort');
  const looksUnsupported =
    message.includes('unsupported') ||
    message.includes('not support') ||
    message.includes('unknown parameter') ||
    message.includes('invalid') ||
    message.includes('unrecognized');

  return mentionsReasoning && looksUnsupported;
}
