import type { RecordingLifecycleState } from '@shared/recordingLifecycle';

export enum RecordingWorkspaceStatus {
  Idle = 'idle',
  Paused = 'paused',
  Processing = 'processing',
  Recording = 'recording',
}

interface RecordingWorkspaceStatusControl {
  kind: RecordingWorkspaceStatus;
  labelKey: string;
}

export interface RecordingWorkspaceViewState {
  status: RecordingWorkspaceStatusControl;
}

const IDLE_VIEW_STATE: RecordingWorkspaceViewState = {
  status: {
    kind: RecordingWorkspaceStatus.Idle,
    labelKey: 'indicator.ready',
  },
};

const STARTING_VIEW_STATE: RecordingWorkspaceViewState = {
  status: {
    kind: RecordingWorkspaceStatus.Processing,
    labelKey: 'recording.starting',
  },
};

const RECORDING_VIEW_STATE: RecordingWorkspaceViewState = {
  status: {
    kind: RecordingWorkspaceStatus.Recording,
    labelKey: 'indicator.recording',
  },
};

const PAUSED_VIEW_STATE: RecordingWorkspaceViewState = {
  status: {
    kind: RecordingWorkspaceStatus.Paused,
    labelKey: 'indicator.paused',
  },
};

function createProcessingViewState(labelKey: string) {
  return {
    status: {
      kind: RecordingWorkspaceStatus.Processing,
      labelKey,
    },
  } satisfies RecordingWorkspaceViewState;
}

export function getRecordingWorkspaceViewState(state: RecordingLifecycleState): RecordingWorkspaceViewState {
  switch (state) {
    case 'starting':
      return STARTING_VIEW_STATE;
    case 'recording':
      return RECORDING_VIEW_STATE;
    case 'paused':
      return PAUSED_VIEW_STATE;
    case 'stopping':
      return createProcessingViewState('status.stopping');
    case 'transcribing':
      return createProcessingViewState('status.transcribing');
    case 'retrying':
      return createProcessingViewState('status.resendingTranscription');
    case 'idle':
      return IDLE_VIEW_STATE;
  }
}
