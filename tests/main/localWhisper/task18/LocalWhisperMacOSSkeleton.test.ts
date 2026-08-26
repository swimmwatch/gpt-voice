import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LocalWhisperMetalCapabilityAdapter } from '@main/localWhisper/capability/LocalWhisperCapabilityAdapters';
import { LocalWhisperCoordinator } from '@main/localWhisper/coordinator/LocalWhisperCoordinator';
import { createDeferredLocalWhisperEnvironment } from '@main/localWhisper/ipc/createDeferredLocalWhisperEnvironment';
import { LocalWhisperSnapshotService } from '@main/localWhisper/ipc/LocalWhisperSnapshotService';
import { LocalWhisperPackagedResourceResolver } from '@main/localWhisper/packaging/LocalWhisperPackagedResourceResolver';
import {
  getLocalWhisperCheckAvailability,
  getLocalWhisperLoadAvailability,
} from '@renderer/localWhisper/LocalWhisperPresentation';

describe('macOS arm64 Local Whisper planned-only skeleton', () => {
  it('returns PLANNED_UNAVAILABLE before catalog, helper, worker, allocation, load, or transcription authority', async () => {
    let resourceReads = 0;
    const resolver = new LocalWhisperPackagedResourceResolver({
      platform: 'darwin',
      resourcesPath: '/Applications/GPT-Voice.app/Contents/Resources',
      readFile: async () => {
        resourceReads += 1;
        throw new Error('macOS resources must not be read');
      },
    });
    assert.deepEqual(await resolver.resolve(), { availability: 'planned', code: 'PLANNED_UNAVAILABLE' });
    assert.equal(resourceReads, 0);
    assert.deepEqual(new LocalWhisperMetalCapabilityAdapter().evaluate(), {
      success: false,
      code: 'PLANNED_UNAVAILABLE',
    });

    const environment = createDeferredLocalWhisperEnvironment({
      platform: 'darwin',
      architecture: 'arm64',
      logicalProcessorCount: 10,
      nextRequestId: () => 'macos-planned-request',
    });
    const coordinator = new LocalWhisperCoordinator(environment.coordinator);
    const snapshots = new LocalWhisperSnapshotService(coordinator, environment.facts);

    assert.equal(snapshots.snapshot.settings.execution.target, 'gpu');
    assert.equal(snapshots.snapshot.settings.execution.backend, 'metal');
    assert.equal(
      snapshots.snapshot.options.find(({ group, selected }) => group === 'backend' && selected)?.reason,
      'PLANNED_UNAVAILABLE',
    );
    assert.equal(
      snapshots.snapshot.options.find(({ group, id }) => group === 'target' && id === 'cpu')?.available,
      false,
    );

    const compatibility = await coordinator.checkCompatibility();
    assert.equal(compatibility.success, false);
    if (!compatibility.success) assert.equal(compatibility.error.code, 'PLANNED_UNAVAILABLE');
    assert.equal(snapshots.snapshot.runtime.supportTier, 'Planned');
    assert.equal(snapshots.snapshot.runtime.operationalStatus, 'Planned');
    assert.equal(getLocalWhisperCheckAvailability(snapshots.snapshot, false).enabled, false);
    assert.equal(getLocalWhisperLoadAvailability(snapshots.snapshot, false).enabled, false);
    assert.equal(snapshots.snapshot.artifacts.length, 0);
    assert.deepEqual(await environment.managedFolder.open(), {
      success: false,
      code: 'PLANNED_UNAVAILABLE',
    });
    const load = await coordinator.loadNow();
    assert.equal(load.success, false);
    if (!load.success) assert.equal(load.error.code, 'PLANNED_UNAVAILABLE');
    assert.notEqual(snapshots.snapshot.runtime.residency, 'Loaded');
    assert.notEqual(snapshots.snapshot.runtime.operationalStatus, 'Ready');

    snapshots.dispose();
    await coordinator.shutdown();
  });
});
