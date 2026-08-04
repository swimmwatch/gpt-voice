import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LOCAL_WHISPER_AUTO_CPU_THREADS,
  createLocalWhisperRendererSafeFailure,
  isLocalWhisperProviderSelectionResult,
  isLocalWhisperPublicSettings,
  isLocalWhisperRendererSafeFailure,
  isLocalWhisperSettingsCommand,
  toLocalWhisperRevisionId,
} from '@shared/localWhisper';

const revision = toLocalWhisperRevisionId('revision-v1');
if (!revision) throw new Error('Invalid fixture revision');

const SETTINGS = Object.freeze({
  schemaVersion: 1,
  engine: 'whisperCpp',
  runtimeRevision: revision,
  model: Object.freeze({ family: 'base', revision, variant: 'full' }),
  language: 'auto',
  decoding: Object.freeze({ strategy: 'greedy', temperatureHundredths: 0 }),
  execution: Object.freeze({
    target: 'cpu',
    backend: 'cpu',
    cpuThreads: LOCAL_WHISPER_AUTO_CPU_THREADS,
  }),
});

describe('Local Whisper IPC decoders', () => {
  it('accepts only closed public settings without prompt or unsafe nested values', () => {
    assert.equal(isLocalWhisperPublicSettings(SETTINGS), true);
    assert.equal(isLocalWhisperPublicSettings({ ...SETTINGS, initialPrompt: 'private' }), false);
    assert.equal(isLocalWhisperPublicSettings({ ...SETTINGS, executable: '/tmp/worker' }), false);
    assert.equal(
      isLocalWhisperPublicSettings({ ...SETTINGS, execution: { target: 'cpu', backend: 'cpu', cpuThreads: 1.5 } }),
      false,
    );
    const inherited = Object.create({ schemaVersion: 1 }) as Record<string, unknown>;
    Object.assign(inherited, SETTINGS);
    assert.equal(isLocalWhisperPublicSettings(inherited), false);
  });

  it('bounds prompt mutations and rejects forged command fields', () => {
    const base = {
      expectedSnapshotRevision: 1,
      expectedConfigurationEpoch: 2,
      expectedInventoryEpoch: 3,
    };
    assert.equal(
      isLocalWhisperSettingsCommand({
        kind: 'save',
        candidate: SETTINGS,
        promptMutation: { kind: 'replace', value: 'valid prompt' },
        ...base,
      }),
      true,
    );
    assert.equal(
      isLocalWhisperSettingsCommand({
        kind: 'save',
        candidate: SETTINGS,
        promptMutation: { kind: 'replace', value: '\0' },
        ...base,
      }),
      false,
    );
    assert.equal(isLocalWhisperSettingsCommand({ kind: 'load', ...base, argv: ['--model', '/tmp/x'] }), false);
    assert.equal(isLocalWhisperSettingsCommand({ kind: 'load', ...base, expectedInventoryEpoch: Number.NaN }), false);
    assert.equal(isLocalWhisperSettingsCommand({ kind: 'cancelArtifact', operationId: 'operation-id-0001' }), true);
    assert.equal(
      isLocalWhisperSettingsCommand({ kind: 'cancelArtifact', operationId: 'operation-id-0001', ...base }),
      false,
    );
  });

  it('accepts only descriptor-consistent safe failures and typed provider selection', () => {
    const failure = createLocalWhisperRendererSafeFailure('OPERATION_CONFLICT');
    assert.equal(isLocalWhisperRendererSafeFailure(failure), true);
    assert.equal(isLocalWhisperRendererSafeFailure({ ...failure, retryable: false }), false);
    assert.equal(
      isLocalWhisperProviderSelectionResult({
        success: false,
        committedProviderId: 'chatgpt',
        readinessRevision: 4,
        error: failure,
      }),
      true,
    );
    assert.equal(
      isLocalWhisperProviderSelectionResult({
        success: false,
        committedProviderId: 'chatgpt',
        readinessRevision: 4,
        error: 'raw failure',
      }),
      false,
    );
  });
});
