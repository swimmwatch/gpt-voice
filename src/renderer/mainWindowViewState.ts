import type { RecordingLifecycleState } from '@shared/recordingLifecycle';

export enum RecordingWorkspacePrimaryAction {
  Busy = 'busy',
  Record = 'record',
  Stop = 'stop',
}

export enum RecordingWorkspaceSecondaryAction {
  Cancel = 'cancel',
  Pause = 'pause',
  Resume = 'resume',
}

export enum RecordingWorkspaceStatus {
  Idle = 'idle',
  Paused = 'paused',
  Processing = 'processing',
  Recording = 'recording',
}

interface RecordingWorkspacePrimaryControl {
  action: RecordingWorkspacePrimaryAction;
  disabled: boolean;
  labelKey: string;
}

interface RecordingWorkspaceStatusControl {
  kind: RecordingWorkspaceStatus;
  labelKey: string;
}

export interface RecordingWorkspaceViewState {
  primary: RecordingWorkspacePrimaryControl;
  secondaryActions: RecordingWorkspaceSecondaryAction[];
  status: RecordingWorkspaceStatusControl;
}

const IDLE_VIEW_STATE: RecordingWorkspaceViewState = {
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
};

const STARTING_VIEW_STATE: RecordingWorkspaceViewState = {
  primary: {
    action: RecordingWorkspacePrimaryAction.Busy,
    disabled: true,
    labelKey: 'recording.starting',
  },
  secondaryActions: [RecordingWorkspaceSecondaryAction.Cancel],
  status: {
    kind: RecordingWorkspaceStatus.Processing,
    labelKey: 'recording.starting',
  },
};

const RECORDING_VIEW_STATE: RecordingWorkspaceViewState = {
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
};

const PAUSED_VIEW_STATE: RecordingWorkspaceViewState = {
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
};

function createProcessingViewState(labelKey: string, secondaryActions: RecordingWorkspaceSecondaryAction[] = []) {
  return {
    primary: {
      action: RecordingWorkspacePrimaryAction.Busy,
      disabled: true,
      labelKey,
    },
    secondaryActions,
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
