import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTrayIconFilename, getTrayIconStateForRecordingLifecycle, type TrayIconState } from '@main/trayIconState';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';

describe('trayIconState', () => {
  it('maps recording lifecycle states to tray icon states', () => {
    const cases: Array<[RecordingLifecycleState, TrayIconState]> = [
      ['idle', 'idle'],
      ['starting', 'recording'],
      ['recording', 'recording'],
      ['paused', 'paused'],
      ['stopping', 'recording'],
      ['transcribing', 'processing'],
      ['retrying', 'processing'],
    ];

    for (const [lifecycleState, trayIconState] of cases) {
      assert.equal(getTrayIconStateForRecordingLifecycle(lifecycleState), trayIconState);
    }
  });

  it('returns packaged tray icon filenames for every tray state', () => {
    assert.deepEqual(
      {
        idle: getTrayIconFilename('idle'),
        recording: getTrayIconFilename('recording'),
        paused: getTrayIconFilename('paused'),
        processing: getTrayIconFilename('processing'),
      },
      {
        idle: 'tray-icon-idle.png',
        recording: 'tray-icon-recording.png',
        paused: 'tray-icon-paused.png',
        processing: 'tray-icon-processing.png',
      },
    );
  });
});
