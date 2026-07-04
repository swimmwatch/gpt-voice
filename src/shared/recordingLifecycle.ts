export const RECORDING_LIFECYCLE_STATES = [
  'idle',
  'starting',
  'recording',
  'paused',
  'stopping',
  'transcribing',
  'retrying',
] as const;

export type RecordingLifecycleState = (typeof RECORDING_LIFECYCLE_STATES)[number];

export function isRecordingLifecycleState(value: unknown): value is RecordingLifecycleState {
  return typeof value === 'string' && RECORDING_LIFECYCLE_STATES.includes(value as RecordingLifecycleState);
}

export function canStartRecording(state: RecordingLifecycleState): boolean {
  return state === 'idle';
}

export function canStopRecording(state: RecordingLifecycleState): boolean {
  return state === 'recording' || state === 'paused';
}

export function canPauseRecording(state: RecordingLifecycleState): boolean {
  return state === 'recording';
}

export function canResumeRecording(state: RecordingLifecycleState): boolean {
  return state === 'paused';
}

export function canCancelRecording(state: RecordingLifecycleState): boolean {
  return state === 'recording' || state === 'paused';
}

export function isRecordingLifecycleBusy(state: RecordingLifecycleState): boolean {
  return state !== 'idle';
}
