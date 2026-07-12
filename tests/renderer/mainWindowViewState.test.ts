import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getRecordingWorkspaceViewState,
  RecordingWorkspacePrimaryAction,
  RecordingWorkspaceSecondaryAction,
  RecordingWorkspaceStatus,
} from '@renderer/mainWindowViewState';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';

describe('mainWindowViewState', () => {
  it('shows a single enabled Record command while idle', () => {
    assert.deepEqual(getRecordingWorkspaceViewState('idle'), {
      primary: {
        action: RecordingWorkspacePrimaryAction.Record,
        disabled: false,
        labelKey: 'recording.startCommand',
      },
      secondaryActions: [],
      status: {
        kind: RecordingWorkspaceStatus.Idle,
        labelKey: 'indicator.ready',
      },
    });
  });

  it('shows Stop, Pause, and Cancel while recording', () => {
    assert.deepEqual(getRecordingWorkspaceViewState('recording'), {
      primary: {
        action: RecordingWorkspacePrimaryAction.Stop,
        disabled: false,
        labelKey: 'recording.stop',
      },
      secondaryActions: [RecordingWorkspaceSecondaryAction.Pause, RecordingWorkspaceSecondaryAction.Cancel],
      status: {
        kind: RecordingWorkspaceStatus.Recording,
        labelKey: 'indicator.recording',
      },
    });
  });

  it('replaces Pause with Resume while paused', () => {
    assert.deepEqual(getRecordingWorkspaceViewState('paused'), {
      primary: {
        action: RecordingWorkspacePrimaryAction.Stop,
        disabled: false,
        labelKey: 'recording.stop',
      },
      secondaryActions: [RecordingWorkspaceSecondaryAction.Resume, RecordingWorkspaceSecondaryAction.Cancel],
      status: {
        kind: RecordingWorkspaceStatus.Paused,
        labelKey: 'indicator.paused',
      },
    });
  });

  it('shows a disabled Stop command while recording starts', () => {
    assert.deepEqual(getRecordingWorkspaceViewState('starting'), {
      primary: {
        action: RecordingWorkspacePrimaryAction.Stop,
        disabled: true,
        labelKey: 'recording.stop',
      },
      secondaryActions: [RecordingWorkspaceSecondaryAction.Cancel],
      status: {
        kind: RecordingWorkspaceStatus.Processing,
        labelKey: 'recording.starting',
      },
    });
  });

  it('prevents duplicate recording commands while stopping, transcribing, or retrying', () => {
    const expected = [
      {
        primaryLabelKey: 'status.stopping',
        secondaryActions: [],
      },
      {
        primaryLabelKey: 'status.transcribing',
        secondaryActions: [],
      },
      {
        primaryLabelKey: 'status.resendingTranscription',
        secondaryActions: [],
      },
    ] as const;

    const busyLifecycleStates: RecordingLifecycleState[] = ['stopping', 'transcribing', 'retrying'];

    for (const [index, lifecycleState] of busyLifecycleStates.entries()) {
      const state = getRecordingWorkspaceViewState(lifecycleState);
      const expectation = expected[index];

      assert.equal(state.primary.action, RecordingWorkspacePrimaryAction.Busy);
      assert.equal(state.primary.disabled, true);
      assert.equal(state.primary.labelKey, expectation?.primaryLabelKey);
      assert.deepEqual(state.secondaryActions, expectation?.secondaryActions);
      assert.equal(state.status.kind, RecordingWorkspaceStatus.Processing);
    }
  });
});
