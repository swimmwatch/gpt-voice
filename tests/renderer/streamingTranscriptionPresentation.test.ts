import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  StreamingTranscriptionErrorCode,
  StreamingTranscriptionLifecycle,
  type StreamingTranscriptionError,
} from '@shared/streamingTranscription';
import { getSupportedLocales, setLocale, t } from '@main/i18n';
import {
  StreamingRecordingLocalErrorCode,
  type StreamingRecordingFailure,
} from '@renderer/audio/streamingTranscriptionQueue';
import { getStreamingTranscriptionFailureTranslationKey } from '@renderer/audio/streamingTranscriptionPresentation';

function createStreamingError(code: StreamingTranscriptionErrorCode): StreamingTranscriptionError {
  if (code === StreamingTranscriptionErrorCode.Cancelled) {
    return { lifecycle: StreamingTranscriptionLifecycle.Cancelled, code };
  }
  return { lifecycle: StreamingTranscriptionLifecycle.Failed, code };
}

function createIpcFailure(code: StreamingTranscriptionErrorCode): StreamingRecordingFailure {
  return { kind: 'ipc', error: createStreamingError(code), retryEligible: false };
}

describe('streaming transcription presentation', () => {
  afterEach(() => {
    setLocale('en');
  });

  it('maps every shared and local streaming failure to a fixed safe translation in every locale', () => {
    const failures: StreamingRecordingFailure[] = [
      ...Object.values(StreamingTranscriptionErrorCode).map(createIpcFailure),
      {
        kind: 'local',
        code: StreamingRecordingLocalErrorCode.InvalidAudio,
        retryEligible: false,
      },
      {
        kind: 'local',
        code: StreamingRecordingLocalErrorCode.QueueOverflow,
        retryEligible: true,
      },
    ];

    for (const locale of getSupportedLocales()) {
      setLocale(locale);
      for (const failure of failures) {
        const key = getStreamingTranscriptionFailureTranslationKey(failure);
        const message = t(key);
        const rawCode = failure.kind === 'ipc' ? failure.error.code : failure.code;

        assert.equal(typeof message, 'string', `${locale}:${key}`);
        assert.ok(message.trim(), `${locale}:${key}`);
        assert.notEqual(message.trim().toLowerCase(), rawCode, `${locale}:${key}`);
        assert.doesNotMatch(message, /(?:https?|wss?):\/\/|\d/u, `${locale}:${key}`);
      }
    }
  });

  it('groups only equivalent technical failures behind the same user-safe message', () => {
    assert.equal(
      getStreamingTranscriptionFailureTranslationKey(createIpcFailure(StreamingTranscriptionErrorCode.InvalidAudio)),
      getStreamingTranscriptionFailureTranslationKey(createIpcFailure(StreamingTranscriptionErrorCode.InvalidChunk)),
    );
    assert.equal(
      getStreamingTranscriptionFailureTranslationKey(
        createIpcFailure(StreamingTranscriptionErrorCode.InvalidOperation),
      ),
      getStreamingTranscriptionFailureTranslationKey(createIpcFailure(StreamingTranscriptionErrorCode.ProviderChanged)),
    );
    assert.notEqual(
      getStreamingTranscriptionFailureTranslationKey({
        kind: 'local',
        code: StreamingRecordingLocalErrorCode.QueueOverflow,
        retryEligible: true,
      }),
      getStreamingTranscriptionFailureTranslationKey({
        kind: 'ipc',
        error: createStreamingError(StreamingTranscriptionErrorCode.TransportFailure),
        retryEligible: true,
      }),
    );
  });
});
