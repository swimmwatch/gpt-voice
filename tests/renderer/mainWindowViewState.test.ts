import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getRecordingWorkspaceViewState, RecordingWorkspaceStatus } from '@renderer/mainWindowViewState';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';

describe('mainWindowViewState', () => {
  it('retains only lifecycle status presentation for every recording state', () => {
    const expected: Readonly<Record<RecordingLifecycleState, { kind: RecordingWorkspaceStatus; labelKey: string }>> = {
      idle: { kind: RecordingWorkspaceStatus.Idle, labelKey: 'indicator.ready' },
      paused: { kind: RecordingWorkspaceStatus.Paused, labelKey: 'indicator.paused' },
      recording: { kind: RecordingWorkspaceStatus.Recording, labelKey: 'indicator.recording' },
      retrying: { kind: RecordingWorkspaceStatus.Processing, labelKey: 'status.resendingTranscription' },
      starting: { kind: RecordingWorkspaceStatus.Processing, labelKey: 'recording.starting' },
      stopping: { kind: RecordingWorkspaceStatus.Processing, labelKey: 'status.stopping' },
      transcribing: { kind: RecordingWorkspaceStatus.Processing, labelKey: 'status.transcribing' },
    };

    for (const [lifecycle, status] of Object.entries(expected) as [
      RecordingLifecycleState,
      (typeof expected)[RecordingLifecycleState],
    ][]) {
      assert.deepEqual(getRecordingWorkspaceViewState(lifecycle), { status });
    }
  });
});
