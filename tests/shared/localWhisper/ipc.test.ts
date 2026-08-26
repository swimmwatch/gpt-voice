import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LOCAL_WHISPER_AUTO_CPU_THREADS,
  LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
  createLocalWhisperRendererSafeFailure,
  isLocalWhisperMainResidencyCommand,
  isLocalWhisperMainResidencyCommandResult,
  isLocalWhisperProviderSelectionResult,
  isLocalWhisperPublicSettings,
  isLocalWhisperRendererSafeFailure,
  isLocalWhisperSettingsCommand,
  toLocalWhisperRevisionId,
} from '@shared/localWhisper';

const revision = toLocalWhisperRevisionId('revision-v1');
if (!revision) throw new Error('Invalid fixture revision');

const SETTINGS = Object.freeze({
  schemaVersion: LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
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

const MAIN_STATUS = Object.freeze({
  providerId: 'local-whisper' as const,
  snapshotRevision: 4,
  runtime: Object.freeze({
    supportTier: 'Production' as const,
    runtimeSetup: 'Installed' as const,
    modelSetup: 'Installed' as const,
    capability: 'Validated' as const,
    residency: 'Unloaded' as const,
    activity: 'Idle' as const,
    operationalStatus: 'ValidatedUnloaded' as const,
    canAttempt: true,
    blockingCode: null,
  }),
  failure: null,
  selectedButUnavailable: false,
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
    assert.equal(
      isLocalWhisperPublicSettings({
        ...SETTINGS,
        execution: { target: 'gpu', backend: 'cuda', deviceId: 'gpu-1', gpuCpuThreads: 'auto' },
      }),
      true,
    );
    assert.equal(
      isLocalWhisperPublicSettings({
        ...SETTINGS,
        execution: { target: 'gpu', backend: 'cuda', deviceId: 'gpu-1', gpuCpuThreads: 0 },
      }),
      false,
    );
    assert.equal(
      isLocalWhisperPublicSettings({
        ...SETTINGS,
        execution: { target: 'gpu', backend: 'cuda', deviceId: 'gpu-1', gpuCpuThreads: 'auto', cpuThreads: 2 },
      }),
      false,
    );
    const inherited = Object.create({ schemaVersion: LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION }) as Record<
      string,
      unknown
    >;
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
        committedProviderId: null,
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

  it('keeps main residency commands and results closed and positive-revisioned', () => {
    const validCommand = { kind: 'load', expectedSnapshotRevision: 4 } as const;
    assert.equal(isLocalWhisperMainResidencyCommand(validCommand), true);
    for (const command of [
      { ...validCommand, path: '/private/model' },
      { ...validCommand, expectedSnapshotRevision: 0 },
      { ...validCommand, expectedSnapshotRevision: -1 },
      { ...validCommand, expectedSnapshotRevision: 1.5 },
      { ...validCommand, expectedSnapshotRevision: Number.MAX_SAFE_INTEGER + 1 },
      { ...validCommand, kind: 'cancel' },
    ]) {
      assert.equal(isLocalWhisperMainResidencyCommand(command), false);
    }
    const inherited = Object.create({ kind: 'load' }) as Record<string, unknown>;
    inherited.expectedSnapshotRevision = 4;
    assert.equal(isLocalWhisperMainResidencyCommand(inherited), false);

    const failure = createLocalWhisperRendererSafeFailure('OPERATION_CONFLICT');
    assert.equal(
      isLocalWhisperMainResidencyCommandResult({
        success: true,
        command: 'load',
        snapshot: MAIN_STATUS,
        failure: null,
      }),
      true,
    );
    assert.equal(
      isLocalWhisperMainResidencyCommandResult({
        success: false,
        command: 'unload',
        snapshot: MAIN_STATUS,
        failure,
      }),
      true,
    );
    assert.equal(
      isLocalWhisperMainResidencyCommandResult({
        success: true,
        command: 'load',
        snapshot: MAIN_STATUS,
        failure,
      }),
      false,
    );
    assert.equal(
      isLocalWhisperMainResidencyCommandResult({
        success: false,
        command: 'load',
        snapshot: MAIN_STATUS,
        failure,
        stderr: 'private',
      }),
      false,
    );
  });
});
