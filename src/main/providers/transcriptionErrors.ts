import { StatusCodes } from 'http-status-codes';
import type { TranscriptionResult } from './BaseVoiceProvider';
import { t } from '../i18n';

interface TranscribeHttpResponse {
  status: number;
  body: string;
}

export function parseRateLimitedTranscribeResponse(resp: TranscribeHttpResponse): TranscriptionResult | null {
  if (resp.status !== Number(StatusCodes.TOO_MANY_REQUESTS)) {
    return null;
  }

  const retryAfterSeconds = getRetryAfterSeconds(resp.body);
  return {
    success: false,
    error: retryAfterSeconds
      ? t('error.rateLimitedRetryAfter', { seconds: String(retryAfterSeconds) })
      : t('error.rateLimited'),
    raw: resp.body,
  };
}

function getRetryAfterSeconds(body: string): number | null {
  let result: unknown;
  try {
    result = JSON.parse(body);
  } catch {
    return null;
  }

  return getNestedRetryAfterSeconds(result, 0);
}

function getNestedRetryAfterSeconds(value: unknown, depth: number): number | null {
  if (!value || typeof value !== 'object' || depth > 4) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const direct = normalizeRetryAfterSeconds(record.retry_after_seconds);
  if (direct !== null) {
    return direct;
  }

  for (const child of Object.values(record)) {
    const nested = getNestedRetryAfterSeconds(child, depth + 1);
    if (nested !== null) {
      return nested;
    }
  }

  return null;
}

function normalizeRetryAfterSeconds(value: unknown): number | null {
  const seconds = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return Math.ceil(seconds);
}
