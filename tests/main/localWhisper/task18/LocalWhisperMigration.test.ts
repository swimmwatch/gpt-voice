import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LOCAL_WHISPER_SETTINGS_DOCUMENT_SCHEMA_VERSION,
  LOCAL_WHISPER_SETTINGS_SUPPORTED_PRIOR_DOCUMENT_SCHEMA_VERSIONS,
  migrateLocalWhisperSettingsDocument,
} from '@main/localWhisper/settings/LocalWhisperSettingsRepository';
import { LegacyVoiceProviderCompatibilityFixture } from '../../../fixtures/local-whisper/migration/LegacyVoiceProviderCompatibilityFixture';

describe('Local Whisper migration and preceding-provider compatibility', () => {
  it('migrates every repository-supported prior document schema only in memory', () => {
    assert.deepEqual(LOCAL_WHISPER_SETTINGS_SUPPORTED_PRIOR_DOCUMENT_SCHEMA_VERSIONS, [0, 1]);
    const legacy = {
      namespace: 'local-whisper',
      schemaVersion: 0,
      configuration: {
        engine: 'whisperCpp',
        runtimeRevision: 'runtime-v1',
        model: { family: 'base', revision: 'model-v1', variant: 'full' },
        language: 'auto',
        initialPrompt: 'private prompt',
        decoding: { strategy: 'greedy', temperatureHundredths: 0 },
        execution: { target: 'cpu', backend: 'cpu', cpuThreads: 'auto' },
      },
    };
    const before = structuredClone(legacy);

    const migrated = migrateLocalWhisperSettingsDocument(legacy);

    assert.deepEqual(legacy, before);
    assert.equal(migrated?.schemaVersion, LOCAL_WHISPER_SETTINGS_DOCUMENT_SCHEMA_VERSION);
    assert.equal((migrated?.settings as Record<string, unknown>).schemaVersion, 2);
    assert.deepEqual(migrated?.dependentSelections, { values: { 'threads:whisperCpp:gpu': 'auto' } });
    assert.equal('configuration' in (migrated ?? {}), false);
  });

  it('keeps unknown Local Whisper namespaces inert and recovers through the legacy chooser', async () => {
    const fixture = new LegacyVoiceProviderCompatibilityFixture();
    const namespacesBefore = [...fixture.namespaces.entries()];

    assert.equal(fixture.selectedProviderId, 'local-whisper');
    assert.deepEqual(fixture.availableProviderIds, ['chatgpt', 'openai-api', 'claude-web']);
    const result = await fixture.selection.select('chatgpt');

    assert.deepEqual(result, { success: true, committedProviderId: 'chatgpt', readinessRevision: 1 });
    assert.equal(fixture.selectedProviderId, 'chatgpt');
    assert.equal(fixture.saveCount, 1);
    assert.equal(fixture.localExecutionCount, 0);
    assert.equal(fixture.localDeletionCount, 0);
    assert.deepEqual([...fixture.namespaces.entries()], namespacesBefore);
  });
});
