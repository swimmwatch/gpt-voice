/* eslint-disable max-classes-per-file -- state-owning settings and storage fakes form one service fixture. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DiagnosticCaptureSettingsService,
  type DiagnosticCaptureSettingsStorage,
  type DiagnosticCaptureSettingsStore,
} from '@main/services/diagnosticCaptureSettings';
import {
  DIAGNOSTIC_CAPTURE_CAUSE_CODES,
  type DiagnosticCaptureMaintenanceResult,
} from '@main/services/diagnosticCaptureStorage';
import {
  DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS,
  DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES,
  type DiagnosticCaptureCategory,
  type DiagnosticCaptureSettings,
} from '@shared/diagnosticCaptureSettings';

const ENABLED_SETTINGS: DiagnosticCaptureSettings = Object.freeze({
  capturePrettifyDiagnostics: true,
  captureTranslationDiagnostics: true,
});
const TRANSLATION_ONLY_SETTINGS: DiagnosticCaptureSettings = Object.freeze({
  capturePrettifyDiagnostics: false,
  captureTranslationDiagnostics: true,
});
const MAINTENANCE_SUCCESS = Object.freeze({
  affectedRows: 0,
  status: 'success',
}) satisfies DiagnosticCaptureMaintenanceResult;

class RecordingSettingsStore implements DiagnosticCaptureSettingsStore {
  public saveError: Error | null = null;
  public readonly saved: DiagnosticCaptureSettings[] = [];

  public constructor(private settings: DiagnosticCaptureSettings = DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS) {}

  public getDiagnosticCaptureSettings(): DiagnosticCaptureSettings {
    return Object.freeze({ ...this.settings });
  }

  public saveDiagnosticCaptureSettings(candidate: unknown): DiagnosticCaptureSettings {
    if (this.saveError) throw this.saveError;
    const settings = candidate as DiagnosticCaptureSettings;
    this.saved.push(settings);
    this.settings = Object.freeze({ ...settings });
    return this.getDiagnosticCaptureSettings();
  }
}

class RecordingSettingsStorage implements DiagnosticCaptureSettingsStorage {
  public maintenanceResult: DiagnosticCaptureMaintenanceResult = MAINTENANCE_SUCCESS;
  public readonly pruneAndPurgeCalls: Array<readonly DiagnosticCaptureCategory[]> = [];
  public pruneCalls = 0;
  public readonly purgeCalls: Array<readonly DiagnosticCaptureCategory[]> = [];
  public throwError: Error | null = null;

  public async prune(): Promise<DiagnosticCaptureMaintenanceResult> {
    this.throwIfConfigured();
    this.pruneCalls += 1;
    return this.maintenanceResult;
  }

  public async pruneAndPurge(
    categories: readonly DiagnosticCaptureCategory[],
  ): Promise<DiagnosticCaptureMaintenanceResult> {
    this.throwIfConfigured();
    this.pruneAndPurgeCalls.push([...categories]);
    return this.maintenanceResult;
  }

  public async purge(categories: readonly DiagnosticCaptureCategory[]): Promise<DiagnosticCaptureMaintenanceResult> {
    this.throwIfConfigured();
    this.purgeCalls.push([...categories]);
    return this.maintenanceResult;
  }

  private throwIfConfigured(): void {
    if (this.throwError) throw this.throwError;
  }
}

class DiagnosticCaptureSettingsHarness {
  public readonly service: DiagnosticCaptureSettingsService;
  public readonly settingsStore: RecordingSettingsStore;
  public readonly storage: RecordingSettingsStorage;

  public constructor(settings: DiagnosticCaptureSettings = DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS) {
    this.settingsStore = new RecordingSettingsStore(settings);
    this.storage = new RecordingSettingsStorage();
    this.service = new DiagnosticCaptureSettingsService(this.settingsStore, this.storage);
  }
}

describe('DiagnosticCaptureSettingsService', () => {
  it('returns the authoritative snapshot and rejects malformed mutations before storage work', async () => {
    const harness = new DiagnosticCaptureSettingsHarness(ENABLED_SETTINGS);

    assert.deepEqual(harness.service.getSettings(), ENABLED_SETTINGS);
    assert.deepEqual(await harness.service.setSettings({ settings: ENABLED_SETTINGS }), {
      errorCode: DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES.InvalidRequest,
      settings: ENABLED_SETTINGS,
      success: false,
    });
    assert.equal(harness.storage.pruneCalls, 0);
    assert.deepEqual(harness.storage.pruneAndPurgeCalls, []);
    assert.deepEqual(harness.settingsStore.saved, []);
  });

  it('performs no storage or config work for an exact no-op request', async () => {
    const harness = new DiagnosticCaptureSettingsHarness(TRANSLATION_ONLY_SETTINGS);

    assert.deepEqual(
      await harness.service.setSettings({
        confirmedPurgeCategories: [],
        settings: TRANSLATION_ONLY_SETTINGS,
      }),
      {
        settings: TRANSLATION_ONLY_SETTINGS,
        success: true,
      },
    );
    assert.equal(harness.storage.pruneCalls, 0);
    assert.deepEqual(harness.storage.pruneAndPurgeCalls, []);
    assert.deepEqual(harness.settingsStore.saved, []);
  });

  it('prunes before independently enabling categories and then persists the candidate', async () => {
    const harness = new DiagnosticCaptureSettingsHarness();

    assert.deepEqual(
      await harness.service.setSettings({
        confirmedPurgeCategories: [],
        settings: TRANSLATION_ONLY_SETTINGS,
      }),
      {
        settings: TRANSLATION_ONLY_SETTINGS,
        success: true,
      },
    );
    assert.equal(harness.storage.pruneCalls, 1);
    assert.deepEqual(harness.storage.pruneAndPurgeCalls, []);
    assert.deepEqual(harness.settingsStore.saved, [TRANSLATION_ONLY_SETTINGS]);
  });

  it('requires a unique confirmation set exactly matching every disable transition', async () => {
    const harness = new DiagnosticCaptureSettingsHarness(ENABLED_SETTINGS);
    const candidate = DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS;

    for (const confirmedPurgeCategories of [[], ['translation'], ['prettify']] as const) {
      assert.deepEqual(await harness.service.setSettings({ confirmedPurgeCategories, settings: candidate }), {
        errorCode: DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES.ConfirmationRequired,
        settings: ENABLED_SETTINGS,
        success: false,
      });
    }
    assert.deepEqual(
      await harness.service.setSettings({
        confirmedPurgeCategories: ['translation', 'prettify'],
        settings: candidate,
      }),
      {
        settings: candidate,
        success: true,
      },
    );
    assert.deepEqual(harness.storage.pruneAndPurgeCalls, [['translation', 'prettify']]);
    assert.deepEqual(harness.settingsStore.saved, [candidate]);
  });

  it('does not persist settings when transactional maintenance fails', async () => {
    const harness = new DiagnosticCaptureSettingsHarness(ENABLED_SETTINGS);
    harness.storage.maintenanceResult = {
      causeCode: DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable,
      status: 'failure',
    };

    assert.deepEqual(
      await harness.service.setSettings({
        confirmedPurgeCategories: ['prettify'],
        settings: TRANSLATION_ONLY_SETTINGS,
      }),
      {
        errorCode: DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES.StorageUnavailable,
        settings: ENABLED_SETTINGS,
        success: false,
      },
    );
    assert.deepEqual(harness.service.getSettings(), ENABLED_SETTINGS);
    assert.deepEqual(harness.settingsStore.saved, []);
  });

  it('reports save failure with the still-enabled authoritative snapshot after an authorized purge', async () => {
    const harness = new DiagnosticCaptureSettingsHarness(ENABLED_SETTINGS);
    harness.settingsStore.saveError = new Error('private-config-path-canary');

    const result = await harness.service.setSettings({
      confirmedPurgeCategories: ['prettify'],
      settings: TRANSLATION_ONLY_SETTINGS,
    });

    assert.deepEqual(result, {
      errorCode: DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES.SaveFailed,
      settings: ENABLED_SETTINGS,
      success: false,
    });
    assert.deepEqual(harness.storage.pruneAndPurgeCalls, [['prettify']]);
    assert.equal(JSON.stringify(result).includes('private-config-path-canary'), false);
  });

  it('maps confirmed category and all clears to idempotent purge requests without changing toggles', async () => {
    const harness = new DiagnosticCaptureSettingsHarness(ENABLED_SETTINGS);

    assert.deepEqual(await harness.service.clear({ confirmed: true, target: 'translation' }), { success: true });
    assert.deepEqual(await harness.service.clear({ confirmed: true, target: 'translation' }), { success: true });
    assert.deepEqual(await harness.service.clear({ confirmed: true, target: 'prettify' }), { success: true });
    assert.deepEqual(await harness.service.clear({ confirmed: true, target: 'all' }), { success: true });
    assert.deepEqual(harness.storage.purgeCalls, [
      ['translation'],
      ['translation'],
      ['prettify'],
      ['translation', 'prettify'],
    ]);
    assert.deepEqual(harness.service.getSettings(), ENABLED_SETTINGS);
    assert.equal(
      JSON.stringify(await harness.service.clear({ confirmed: true, target: 'all' })).includes('Rows'),
      false,
    );
  });

  it('returns closed failures for invalid, failed, and unexpectedly throwing clear operations', async () => {
    const harness = new DiagnosticCaptureSettingsHarness();

    assert.deepEqual(await harness.service.clear({ confirmed: false, target: 'all' }), {
      errorCode: DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES.InvalidRequest,
      success: false,
    });
    harness.storage.maintenanceResult = {
      causeCode: DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed,
      status: 'failure',
    };
    assert.deepEqual(await harness.service.clear({ confirmed: true, target: 'prettify' }), {
      errorCode: DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES.StorageFailed,
      success: false,
    });
    harness.storage.throwError = new Error('private-storage-message-canary');
    const unexpected = await harness.service.clear({ confirmed: true, target: 'translation' });
    assert.deepEqual(unexpected, {
      errorCode: DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES.StorageFailed,
      success: false,
    });
    assert.equal(JSON.stringify(unexpected).includes('private-storage-message-canary'), false);
  });
});
