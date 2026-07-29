import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AppConfigSnapshot } from '@main/config';
import { type ProviderAuditFamily } from '@main/providerAudit';
import { PROVIDER_AUDIT_PROVIDER_MAPPINGS, isProviderAuditProviderId } from '@main/providerAudit/mappings';
import { DiagnosticsEnvironmentSnapshotProvider } from '@main/services/diagnosticsManifest';
import { DIAGNOSTICS_ARCHIVE_VOICE_PROVIDER_IDS } from '@shared/diagnosticsArchive';
import { PRETTIFY_PROVIDER_IDS, type KnownPrettifyProviderId } from '@shared/prettifySettings';
import { TRANSLATION_PROVIDER_IDS, type TranslationProviderId } from '@shared/translationProvider';
import { TestAppConfigStore } from './appConfigTestUtils';
import { VoiceProviderRegistryFixture } from './providers/voiceProviderRegistryFixture';

const RUNTIME_VERSIONS = Object.freeze({
  cloakBrowser: '0.4.12',
  electron: '43.1.1',
  node: '24.0.0',
  playwright: '1.61.1',
});

interface DiagnosticsProviderSelections {
  readonly prettify?: KnownPrettifyProviderId;
  readonly translation?: TranslationProviderId;
  readonly voice?: string;
}

class DiagnosticsProviderConfig {
  private readonly snapshot: AppConfigSnapshot;

  public constructor(selections: DiagnosticsProviderSelections) {
    const baseline = new TestAppConfigStore().getSnapshot();
    this.snapshot = Object.freeze({
      ...baseline,
      prettifySettings: Object.freeze({
        ...baseline.prettifySettings,
        providerId: selections.prettify ?? baseline.prettifySettings.providerId,
      }),
      provider: selections.voice ?? baseline.provider,
      translationSettings: Object.freeze({
        ...baseline.translationSettings,
        providerId: selections.translation ?? baseline.translationSettings.providerId,
      }),
    });
  }

  public getSnapshot(): AppConfigSnapshot {
    return this.snapshot;
  }
}

describe('provider audit registry integration', () => {
  it('keeps every current provider exhaustive across registries, audit mappings, and manifests', () => {
    const voiceRegistry = new VoiceProviderRegistryFixture().registry;
    const providerIdsByFamily = {
      voice: voiceRegistry.getAvailableProviders().map(({ id }) => id),
      prettify: [...PRETTIFY_PROVIDER_IDS],
      translation: [...TRANSLATION_PROVIDER_IDS],
    } as const satisfies Readonly<Record<ProviderAuditFamily, readonly string[]>>;

    assert.deepEqual(providerIdsByFamily.voice, DIAGNOSTICS_ARCHIVE_VOICE_PROVIDER_IDS);

    for (const family of ['voice', 'prettify', 'translation'] as const satisfies readonly ProviderAuditFamily[]) {
      assert.deepEqual(Object.keys(PROVIDER_AUDIT_PROVIDER_MAPPINGS[family]), providerIdsByFamily[family]);
      for (const providerId of providerIdsByFamily[family]) {
        assert.equal(isProviderAuditProviderId(family, providerId), true, `${family}:${providerId}`);
      }
    }
  });

  it('selects every registered provider through the closed manifest adapter without raw settings', () => {
    for (const providerId of DIAGNOSTICS_ARCHIVE_VOICE_PROVIDER_IDS) {
      const snapshot = new DiagnosticsEnvironmentSnapshotProvider({
        architecture: 'x64',
        backgroundBrowser: {
          getStatus: () => ({ providerId, ready: true }),
        },
        config: new DiagnosticsProviderConfig({ voice: providerId }),
        getAppVersion: () => '1.4.0',
        platform: 'linux',
        runtimeVersions: RUNTIME_VERSIONS,
      }).getSnapshot();

      assert.deepEqual(snapshot.providers.voice.registeredProviderIds, DIAGNOSTICS_ARCHIVE_VOICE_PROVIDER_IDS);
      assert.equal(snapshot.providers.voice.selectedProviderId, providerId);
      assert.equal(snapshot.providers.voice.ready, true);
    }

    for (const providerId of PRETTIFY_PROVIDER_IDS) {
      const snapshot = new DiagnosticsEnvironmentSnapshotProvider({
        architecture: 'x64',
        backgroundBrowser: {
          getStatus: () => ({ providerId: 'chatgpt', ready: true }),
        },
        config: new DiagnosticsProviderConfig({ prettify: providerId }),
        getAppVersion: () => '1.4.0',
        platform: 'linux',
        runtimeVersions: RUNTIME_VERSIONS,
      }).getSnapshot();

      assert.deepEqual(snapshot.providers.prettify.registeredProviderIds, PRETTIFY_PROVIDER_IDS);
      assert.equal(snapshot.providers.prettify.selectedProviderId, providerId);
      assert.equal(snapshot.providers.prettify.readinessKnown, false);
    }

    for (const providerId of TRANSLATION_PROVIDER_IDS) {
      const snapshot = new DiagnosticsEnvironmentSnapshotProvider({
        architecture: 'x64',
        backgroundBrowser: {
          getStatus: () => ({ providerId: 'chatgpt', ready: true }),
        },
        config: new DiagnosticsProviderConfig({ translation: providerId }),
        getAppVersion: () => '1.4.0',
        platform: 'linux',
        runtimeVersions: RUNTIME_VERSIONS,
      }).getSnapshot();

      assert.deepEqual(snapshot.providers.translation.registeredProviderIds, TRANSLATION_PROVIDER_IDS);
      assert.equal(snapshot.providers.translation.selectedProviderId, providerId);
      assert.equal(snapshot.providers.translation.readinessKnown, false);
    }
  });
});
