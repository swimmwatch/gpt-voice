import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LocalWhisperMainStatusIndicator from '@renderer/localWhisper/components/LocalWhisperMainStatusIndicator';
import {
  createLocalWhisperRendererSafeFailure,
  type LocalWhisperMainStatusSnapshot,
  type LocalWhisperRendererSnapshot,
} from '@shared/localWhisper';
import { TooltipProvider } from '@renderer/components/ui/tooltip';
import {
  getLocalWhisperCheckAvailability,
  getLocalWhisperLoadAvailability,
  getLocalWhisperMainResidencyControl,
  getLocalWhisperMainStatusPresentation,
  getLocalWhisperUnloadAvailability,
  formatLocalWhisperBytes,
  getLatestLocalWhisperArtifactProgress,
  isLocalWhisperArtifactProgressActive,
  isLocalWhisperPlatformUnavailable,
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
  it('formats zero-byte transfer progress accurately and distinguishes active progress from terminal history', () => {
    assert.equal(formatLocalWhisperBytes(0), '0 MiB');
    const baseline = settingsSnapshot().progress[0];
    assert.ok(baseline);
    assert.equal(isLocalWhisperArtifactProgressActive({ ...baseline, state: 'Downloading' }), true);
    assert.equal(isLocalWhisperArtifactProgressActive({ ...baseline, state: 'Deleting' }), true);
    assert.equal(isLocalWhisperArtifactProgressActive({ ...baseline, state: 'Failed' }), false);
    assert.equal(isLocalWhisperArtifactProgressActive({ ...baseline, state: 'Installed' }), false);
    const latest = { ...baseline, operationId: 'operation-id-0002', state: 'Downloading' as const };
    assert.equal(
      getLatestLocalWhisperArtifactProgress([baseline, latest], baseline.artifactId)?.operationId,
      'operation-id-0002',
    );
  });

  it('keeps an authenticated Linux target usable before the coordinator has completed its first preflight', () => {
    const baseline = settingsSnapshot();
    const cpuTarget = Object.freeze({
      group: 'target' as const,
      id: 'cpu',
      label: 'CPU',
      available: true,
      tier: 'Production' as const,
      reason: null,
      selected: true,
      selectedButUnavailable: false,
      default: true,
      remembered: false,
      saved: true,
      recommended: true,
      compatibility: Object.freeze({
        target: null,
        backend: null,
        modelFamily: null,
        modelVariant: null,
        eligibleBackends: Object.freeze([]),
      }),
    });
    const transientBaseline = {
      ...baseline,
      runtime: { ...baseline.runtime, supportTier: 'Unsupported' as const },
      options: Object.freeze([...baseline.options, cpuTarget]),
    };
    assert.equal(isLocalWhisperPlatformUnavailable(transientBaseline), false);
    assert.equal(isLocalWhisperPlatformUnavailable({ ...transientBaseline, options: Object.freeze([]) }), true);
  });

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

  it('derives the complete main residency control matrix without optimistic status changes', () => {
    const baseline = settingsSnapshot().runtime;
    assert.deepEqual(getLocalWhisperMainResidencyControl(null, null), {
      action: 'load',
      enabled: false,
      pending: true,
      labelKey: 'localWhisper.main.loadingStatus',
      reasonKey: 'localWhisper.main.loadingStatus',
      reasonCode: null,
    });

    const eligible = mainStatus({
      ...baseline,
      capability: 'Unchecked',
      residency: 'Unloaded',
      operationalStatus: 'NotReady',
      canAttempt: true,
      blockingCode: null,
    });
    assert.deepEqual(getLocalWhisperMainResidencyControl(eligible, null), {
      action: 'load',
      enabled: true,
      pending: false,
      labelKey: 'localWhisper.main.loadModel',
      reasonKey: null,
      reasonCode: null,
    });
    assert.equal(
      getLocalWhisperMainResidencyControl(
        { ...eligible, failure: { ...createLocalWhisperRendererSafeFailure('WORKER_START_FAILED') } },
        null,
      ).enabled,
      true,
    );

    const cases = [
      [
        mainStatus({ ...baseline, residency: 'Loading', operationalStatus: 'Busy' }),
        null,
        ['load', false, true, 'localWhisper.main.loadingModel'],
      ],
      [
        mainStatus({ ...baseline, residency: 'Loaded', activity: 'Idle', operationalStatus: 'Ready' }),
        null,
        ['unload', true, false, 'localWhisper.main.freeModel'],
      ],
      [
        mainStatus({ ...baseline, residency: 'Loaded', activity: 'Transcribing', operationalStatus: 'Busy' }),
        null,
        ['unload', false, false, 'localWhisper.main.freeModel'],
      ],
      [
        mainStatus({ ...baseline, residency: 'Unloading', operationalStatus: 'Busy' }),
        null,
        ['unload', false, true, 'localWhisper.main.freeingModel'],
      ],
      [
        mainStatus({ ...baseline, residency: 'Failed', operationalStatus: 'NotReady' }),
        null,
        ['load', false, false, 'localWhisper.main.loadModel'],
      ],
      [eligible, 'load', ['load', false, true, 'localWhisper.main.loadingModel']],
      [eligible, 'unload', ['unload', false, true, 'localWhisper.main.freeingModel']],
    ] as const;
    for (const [snapshot, pendingAction, expected] of cases) {
      const presentation = getLocalWhisperMainResidencyControl(snapshot, pendingAction);
      assert.deepEqual(
        [presentation.action, presentation.enabled, presentation.pending, presentation.labelKey],
        expected,
      );
    }

    const setupRequired = getLocalWhisperMainResidencyControl(
      mainStatus({
        ...baseline,
        runtimeSetup: 'Missing',
        modelSetup: 'Missing',
        residency: 'Unloaded',
        operationalStatus: 'NotReady',
        canAttempt: false,
      }),
      null,
    );
    assert.equal(setupRequired.enabled, false);
    assert.equal(setupRequired.reasonKey, 'localWhisper.main.setupRequired');
  });

  it('renders unsupported Local Whisper status as a borderless icon without visible status text', () => {
    const baseline = settingsSnapshot().runtime;
    const markup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(LocalWhisperMainStatusIndicator, {
          snapshot: mainStatus({ ...baseline, operationalStatus: 'Unsupported' }),
        }),
      ),
    );

    assert.match(markup, /provider-status-badge/u);
    assert.match(markup, /border-0/u);
    assert.match(markup, /bg-transparent/u);
    assert.match(markup, /lucide-circle-off/u);
    assert.match(markup, /aria-label="Unsupported\./u);
    assert.doesNotMatch(markup, />Unsupported</u);
  });

  it('presents catalog unavailability as not ready without an unsupported label', () => {
    const baseline = settingsSnapshot().runtime;
    const presentation = getLocalWhisperMainStatusPresentation(
      mainStatus({
        ...baseline,
        supportTier: 'Production',
        operationalStatus: 'NotReady',
        blockingCode: 'CATALOG_UNAVAILABLE',
      }),
    );
    assert.equal(presentation.label, 'Not ready');
    assert.match(presentation.detail ?? '', /CATALOG_UNAVAILABLE/u);
    assert.doesNotMatch(`${presentation.label} ${presentation.detail ?? ''}`, /unsupported/iu);
  });

  it('presents an installed unloaded provider as available for automatic loading', () => {
    const baseline = settingsSnapshot().runtime;
    const snapshot = mainStatus({
      ...baseline,
      supportTier: 'Production',
      runtimeSetup: 'Installed',
      modelSetup: 'Installed',
      capability: 'Unchecked',
      residency: 'Unloaded',
      operationalStatus: 'NotReady',
      canAttempt: true,
      blockingCode: null,
    });
    const presentation = getLocalWhisperMainStatusPresentation(snapshot);
    const markup = renderToStaticMarkup(
      createElement(TooltipProvider, null, createElement(LocalWhisperMainStatusIndicator, { snapshot })),
    );

    assert.equal(presentation.label, 'Available on demand');
    assert.equal(presentation.tone, 'ready');
    assert.match(presentation.detail ?? '', /loaded when transcription starts/u);
    assert.match(markup, /lucide-circle-check/u);
    assert.doesNotMatch(markup, /lucide-circle-off/u);
  });

  it('keeps a validated unloaded provider in a ready tone for lazy loading', () => {
    const baseline = settingsSnapshot().runtime;
    const presentation = getLocalWhisperMainStatusPresentation(
      mainStatus({
        ...baseline,
        residency: 'Unloaded',
        operationalStatus: 'ValidatedUnloaded',
      }),
    );

    assert.equal(presentation.label, 'Validated · Unloaded');
    assert.equal(presentation.tone, 'ready');
    assert.match(presentation.detail ?? '', /load when transcription starts/u);
  });

  it('enables load after a successful probe or for an exact validated unloaded configuration', () => {
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
        { ...readyToLoad, runtime: { ...readyToLoad.runtime, capability: 'EstimateOnly' } },
        false,
      ).enabled,
      true,
    );
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
