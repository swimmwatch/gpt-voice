import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StatusCodes } from 'http-status-codes';
import { setLocale } from '@main/i18n';
import {
  getTranscriptionRetryAfterSeconds,
  parseRateLimitedTranscribeResponse,
} from '@main/providers/transcriptionErrors';

describe('transcriptionErrors', () => {
  afterEach(() => {
    setLocale('en');
  });

  it('returns null for non-rate-limit responses', () => {
    assert.equal(
      parseRateLimitedTranscribeResponse({
        status: StatusCodes.INTERNAL_SERVER_ERROR,
        body: JSON.stringify({ detail: 'Temporary provider failure' }),
      }),
      null,
    );
  });

  it('returns a concise generic rate-limit error', () => {
    const body = JSON.stringify({ error: { message: 'Provider-specific rate limit details' } });

    assert.deepEqual(
      parseRateLimitedTranscribeResponse({
        status: StatusCodes.TOO_MANY_REQUESTS,
        body,
      }),
      {
        success: false,
        error: 'Too many requests. Try again later.',
        raw: body,
      },
    );
  });

  it('returns a concise retry-after rate-limit error', () => {
    const body = JSON.stringify({
      detail: {
        detail: 'Transcription is temporarily unavailable. Please try again shortly.',
        retry_after_seconds: 30,
      },
    });

    assert.deepEqual(
      parseRateLimitedTranscribeResponse({
        status: StatusCodes.TOO_MANY_REQUESTS,
        body,
      }),
      {
        success: false,
        error: 'Too many requests. Try again in 30s.',
        raw: body,
      },
    );
  });

  it('rounds fractional retry-after seconds up', () => {
    const body = JSON.stringify({ error: { retry_after_seconds: 1.2 } });

    assert.equal(
      parseRateLimitedTranscribeResponse({
        status: StatusCodes.TOO_MANY_REQUESTS,
        body,
      })?.error,
      'Too many requests. Try again in 2s.',
    );
  });

  it('prefers a sanitized response retry-after duration over provider body details', () => {
    const body = JSON.stringify({ error: { retry_after_seconds: 90, message: 'synthetic provider details' } });

    assert.equal(
      parseRateLimitedTranscribeResponse({
        status: StatusCodes.TOO_MANY_REQUESTS,
        body,
        retryAfter: '12.2',
      })?.error,
      'Too many requests. Try again in 13s.',
    );
  });

  it('parses an HTTP-date retry-after value against an injected clock', () => {
    const nowMs = Date.parse('2026-07-20T12:00:00.000Z');

    assert.equal(
      getTranscriptionRetryAfterSeconds(
        {
          body: '{}',
          retryAfter: 'Mon, 20 Jul 2026 12:00:15 GMT',
        },
        nowMs,
      ),
      15,
    );
  });
});
