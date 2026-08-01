import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LocalWhisperVoiceProvider,
  type LocalWhisperProviderReadiness,
} from '@main/providers/LocalWhisperVoiceProvider';
import { LocalWhisperTranscriptionDispatch } from '@main/services/localWhisperTranscriptionDispatch';
import {
  createTranscriptionResultCache,
  createTranscriptionResultCacheKey,
} from '@main/services/transcriptionResultCache';
import type { TextActionResultCache } from '@main/services/textActionCache';
import { RecordingVoiceProviderAudit } from './voiceAuditTestUtils';
import { RecordingTranscriptionHistoryRepository } from '../repositories/recordingTranscriptionHistoryRepository';
import {
  createLocalWhisperActionFailure,
  createLocalWhisperActionSuccess,
  createLocalWhisperRendererSafeFailure,
  type LocalWhisperFailureCode,
  type LocalWhisperRuntimeSnapshot,
} from '@shared/localWhisper';
import {
  READY_LOCAL_WHISPER_SNAPSHOT,
  RecordingLocalWhisperCoordinator,
  createCanonicalLocalWhisperWav,
} from './localWhisperTestUtils';

interface DispatchHarness {
  readonly audio: ArrayBuffer;
  readonly cache: TextActionResultCache;
  readonly clipboard: string[];
  readonly coordinator: RecordingLocalWhisperCoordinator;
  readonly dispatch: LocalWhisperTranscriptionDispatch;
  readonly events: string[];
  readonly history: RecordingTranscriptionHistoryRepository;
  readonly logs: unknown[][];
  readonly provider: LocalWhisperVoiceProvider;
  readonly seedCache: (text: string) => void;
}

function createHarness(audio = createCanonicalLocalWhisperWav()): DispatchHarness {
  const events: string[] = [];
  const coordinator = new RecordingLocalWhisperCoordinator(events);
  const provider = new LocalWhisperVoiceProvider(coordinator);
  const backingCache = createTranscriptionResultCache();
  const cache: TextActionResultCache = {
    clear: () => backingCache.clear(),
    get: (key) => {
      events.push('cache-read');
      return backingCache.get(key);
    },
    set: (key, value) => {
      events.push('cache-write');
      backingCache.set(key, value);
    },
    size: () => backingCache.size(),
  };
  const clipboard: string[] = [];
  const history = new RecordingTranscriptionHistoryRepository();
  const logs: unknown[][] = [];
  const dispatch = new LocalWhisperTranscriptionDispatch({
    audit: new RecordingVoiceProviderAudit(),
    cache,
    historyRepository: history,
    logger: {
      error: (...args) => logs.push(args),
      info: (...args) => logs.push(args),
      warn: (...args) => logs.push(args),
    },
    writeClipboardText: (text) => {
      events.push('clipboard');
      clipboard.push(text);
    },
  });
  const seedCache = (text: string): void => {
    backingCache.set(
      createTranscriptionResultCacheKey({
        audio,
        mimeType: 'audio/wav',
        providerContext: coordinator.cacheContext,
        providerId: provider.info.id,
      }),
      text,
    );
  };
  return { audio, cache, clipboard, coordinator, dispatch, events, history, logs, provider, seedCache };
}

function withSnapshot(
  snapshot: LocalWhisperRuntimeSnapshot,
  failure: LocalWhisperFailureCode | null = snapshot.blockingCode,
): LocalWhisperProviderReadiness {
  return Object.freeze({
    snapshot,
    failure: failure === null ? null : createLocalWhisperRendererSafeFailure(failure),
  });
}

async function run(harness: DispatchHarness) {
  return await harness.dispatch.transcribe(harness.provider, harness.audio, 'audio/wav', '2026-08-01T00:00:00.000Z');
}

describe('LocalWhisperTranscriptionDispatch', () => {
  it('orders capture, eligibility, cache lookup, coordinator transcription, and completion on a miss', async () => {
    const harness = createHarness();

    const result = await run(harness);

    assert.deepEqual(result, { success: true, text: 'local transcript' });
    assert.deepEqual(harness.events, [
      'capture',
      'eligibility',
      'cache-read',
      'transcribe',
      'clipboard',
      'cache-write',
    ]);
    assert.deepEqual(harness.clipboard, ['local transcript']);
    assert.equal(harness.history.addedEntries.length, 1);
    assert.equal(
      harness.coordinator.lastEligibilityRequest?.dispatch,
      harness.coordinator.lastTranscriptionRequest?.dispatch,
    );
    assert.deepEqual(harness.coordinator.lastTranscriptionRequest?.dispatch.epochs, {
      provider: 1,
      configuration: 2,
      inventory: 3,
    });
  });

  it('rejects malformed WAV classes before coordinator and cache access', async () => {
    const fixtures: ArrayBuffer[] = [];
    const invalidRiff = createCanonicalLocalWhisperWav();
    new Uint8Array(invalidRiff)[0] = 0;
    fixtures.push(invalidRiff);
    fixtures.push(createCanonicalLocalWhisperWav().slice(0, 43));
    const compressed = createCanonicalLocalWhisperWav();
    new DataView(compressed).setUint16(20, 3, true);
    fixtures.push(compressed);
    const stereo = createCanonicalLocalWhisperWav();
    new DataView(stereo).setUint16(22, 2, true);
    fixtures.push(stereo);
    const wrongRate = createCanonicalLocalWhisperWav();
    new DataView(wrongRate).setUint32(24, 44_100, true);
    fixtures.push(wrongRate);
    const wrongBits = createCanonicalLocalWhisperWav();
    new DataView(wrongBits).setUint16(34, 24, true);
    fixtures.push(wrongBits);
    const inconsistentData = createCanonicalLocalWhisperWav();
    new DataView(inconsistentData).setUint32(40, 1_024, true);
    fixtures.push(inconsistentData);
    const inconsistentRiff = createCanonicalLocalWhisperWav();
    new DataView(inconsistentRiff).setUint32(4, 1, true);
    fixtures.push(inconsistentRiff);
    const trailing = new Uint8Array(49);
    trailing.set(new Uint8Array(createCanonicalLocalWhisperWav()), 0);
    fixtures.push(trailing.buffer);

    for (const fixture of fixtures) {
      const harness = createHarness(fixture);
      const result = await run(harness);
      assert.equal(result.success, false);
      assert.equal(result.failure?.code, 'AUDIO_FORMAT_UNSUPPORTED');
      assert.deepEqual(harness.coordinator.calls, []);
      assert.deepEqual(harness.events, []);
      assert.equal(harness.cache.size(), 0);
      assert.deepEqual(harness.clipboard, []);
      assert.equal(harness.history.addedEntries.length, 0);
    }
  });

  it('returns exact eligibility failures before a seeded cache can be read', async () => {
    const codes: readonly LocalWhisperFailureCode[] = [
      'UNSUPPORTED_PLATFORM',
      'RUNTIME_MISSING',
      'RUNTIME_INCOMPATIBLE',
      'RUNTIME_CORRUPT',
      'MODEL_BLOCKED',
      'DEVICE_NOT_FOUND',
      'INSUFFICIENT_RAM',
      'INSUFFICIENT_VRAM',
      'WARMUP_FAILED',
    ];
    for (const code of codes) {
      const harness = createHarness();
      harness.seedCache('must-not-be-read');
      harness.coordinator.eligibilityResult = createLocalWhisperActionFailure(
        'checkCompatibility',
        code,
        READY_LOCAL_WHISPER_SNAPSHOT,
      );

      const result = await run(harness);

      assert.equal(result.success, false);
      assert.equal(result.failure?.code, code);
      assert.deepEqual(harness.events, ['capture', 'eligibility']);
      assert.deepEqual(harness.clipboard, []);
      assert.equal(harness.history.addedEntries.length, 0);
    }
  });

  it('blocks structural invalidity and conflicts through canAttempt without invoking eligibility', async () => {
    for (const code of ['INVALID_SETTINGS', 'OPERATION_CONFLICT'] as const) {
      const harness = createHarness();
      const snapshot: LocalWhisperRuntimeSnapshot = Object.freeze({
        ...READY_LOCAL_WHISPER_SNAPSHOT,
        operationalStatus: 'NotReady',
        canAttempt: false,
        blockingCode: code,
      });
      harness.coordinator.readiness = withSnapshot(snapshot, code);
      harness.seedCache('must-not-be-read');

      const result = await run(harness);

      assert.equal(result.failure?.code, code);
      assert.deepEqual(harness.events, ['capture']);
    }
  });

  it('serves eligible Loaded and ValidatedUnloaded cache hits without coordinator transcription', async () => {
    for (const state of [
      READY_LOCAL_WHISPER_SNAPSHOT,
      Object.freeze({
        ...READY_LOCAL_WHISPER_SNAPSHOT,
        residency: 'Unloaded' as const,
        operationalStatus: 'ValidatedUnloaded' as const,
      }),
    ]) {
      const harness = createHarness();
      harness.coordinator.readiness = withSnapshot(state, null);
      harness.seedCache('cached local transcript');

      const result = await run(harness);

      assert.deepEqual(result, { success: true, text: 'cached local transcript' });
      assert.deepEqual(harness.events, ['capture', 'eligibility', 'cache-read', 'clipboard']);
      assert.equal(harness.coordinator.calls.includes('transcribe'), false);
      assert.deepEqual(harness.clipboard, ['cached local transcript']);
      assert.equal(harness.history.addedEntries.length, 1);
    }
  });

  it('keeps coordinator failure, cancellation, and empty output free of success mutations', async () => {
    const outcomes = [
      createLocalWhisperActionFailure('transcribe', 'TRANSCRIPTION_FAILED', READY_LOCAL_WHISPER_SNAPSHOT),
      createLocalWhisperActionFailure('transcribe', 'CANCELLED', READY_LOCAL_WHISPER_SNAPSHOT),
      createLocalWhisperActionSuccess('transcribe', READY_LOCAL_WHISPER_SNAPSHOT, '   '),
    ];
    for (const outcome of outcomes) {
      const harness = createHarness();
      harness.coordinator.transcriptionResult = outcome;

      const result = await run(harness);

      assert.equal(result.success, false);
      assert.deepEqual(harness.clipboard, []);
      assert.equal(harness.history.addedEntries.length, 0);
      assert.equal(harness.cache.size(), 0);
      assert.equal(harness.events.includes('cache-write'), false);
    }
  });

  it('logs only stable metadata when the coordinator throws a private native error', async () => {
    const harness = createHarness();
    harness.coordinator.transcribe = async () => {
      throw new Error('private prompt /home/private https://private.invalid argv=secret');
    };

    const result = await run(harness);

    assert.equal(result.failure?.code, 'TRANSCRIPTION_FAILED');
    assert.doesNotMatch(JSON.stringify(harness.logs), /private prompt|home\/private|private\.invalid|argv=secret/u);
    assert.deepEqual(harness.clipboard, []);
    assert.equal(harness.history.addedEntries.length, 0);
  });
});
