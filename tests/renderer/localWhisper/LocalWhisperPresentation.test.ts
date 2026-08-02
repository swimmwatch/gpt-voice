import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LocalWhisperMainStatusSnapshot, LocalWhisperRendererSnapshot } from '@shared/localWhisper';
import {
  getLocalWhisperCheckAvailability,
  getLocalWhisperLoadAvailability,
  getLocalWhisperMainStatusPresentation,
  getLocalWhisperUnloadAvailability,
} from '@renderer/localWhisper/LocalWhisperPresentation';
import { FakeCoordinator, createSnapshotService } from '../../main/localWhisper/ipc/localWhisperIpcTestUtils';

function settingsSnapshot(): LocalWhisperRendererSnapshot {
  return createSnapshotService(new FakeCoordinator()).snapshot;
}

function mainStatus(runtime: LocalWhisperMainStatusSnapshot['runtime']): LocalWhisperMainStatusSnapshot {
  return Object.freeze({
    providerId: 'local-whisper',
    snapshotRevision: 1,
    runtime,
    failure: null,
    selectedButUnavailable: false,
  });
}

describe('Local Whisper action and main status presentation', () => {
  it('uses the six explicit compact main statuses without login or API concepts', () => {
    const baseline = settingsSnapshot().runtime;
    const cases = [
      ['Ready', 'Ready'],
      ['Busy', 'Busy'],
      ['ValidatedUnloaded', 'Validated · Unloaded'],
      ['NotReady', 'Not ready'],
      ['Planned', 'Planned'],
      ['Unsupported', 'Unsupported'],
    ] as const;
    for (const [operationalStatus, label] of cases) {
      const presentation = getLocalWhisperMainStatusPresentation(mainStatus({ ...baseline, operationalStatus }));
      assert.equal(presentation.label, label);
      assert.doesNotMatch(`${presentation.label} ${presentation.detail ?? ''}`, /login|api key|session/iu);
    }
  });

  it('enables load only for an exact validated unloaded configuration', () => {
    const baseline = settingsSnapshot();
    const readyToLoad = {
      ...baseline,
      runtime: {
        ...baseline.runtime,
        supportTier: 'Production' as const,
        runtimeSetup: 'Installed' as const,
        modelSetup: 'Installed' as const,
        capability: 'Validated' as const,
        residency: 'Unloaded' as const,
        activity: 'Idle' as const,
        canAttempt: true,
        blockingCode: null,
      },
      resources: null,
    };
    assert.equal(getLocalWhisperCheckAvailability(readyToLoad, false).enabled, true);
    assert.equal(getLocalWhisperLoadAvailability(readyToLoad, false).enabled, true);
    assert.equal(
      getLocalWhisperLoadAvailability(
        { ...readyToLoad, runtime: { ...readyToLoad.runtime, capability: 'Stale' } },
        false,
      ).enabled,
      false,
    );
    assert.match(
      getLocalWhisperLoadAvailability(
        {
          ...readyToLoad,
          resources: {
            success: false,
            failureCode: 'INSUFFICIENT_RAM',
            evidence: 'catalog',
            requiredRamBytes: 1,
            requiredVramBytes: 'notApplicable',
            freeRamBytes: 0,
            freeVramBytes: null,
          },
        },
        false,
      ).disabledReason ?? '',
      /INSUFFICIENT_RAM/u,
    );
  });

  it('shows unload only for loading, loaded, or task-owned failed residency and explains disabled controls', () => {
    const baseline = settingsSnapshot();
    const unloaded = { ...baseline, runtime: { ...baseline.runtime, residency: 'Unloaded' as const } };
    assert.equal(getLocalWhisperUnloadAvailability(unloaded, false).visible, false);
    const loaded = {
      ...baseline,
      runtime: { ...baseline.runtime, residency: 'Loaded' as const, activity: 'Idle' as const },
    };
    assert.equal(getLocalWhisperUnloadAvailability(loaded, false).enabled, true);
    const transcribing = { ...loaded, runtime: { ...loaded.runtime, activity: 'Transcribing' as const } };
    const blocked = getLocalWhisperUnloadAvailability(transcribing, false);
    assert.equal(blocked.enabled, false);
    assert.ok(blocked.disabledReason);
  });
});
