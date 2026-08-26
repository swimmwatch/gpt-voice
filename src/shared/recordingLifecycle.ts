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

export const VOICE_RECORDING_IPC_CHANNELS = Object.freeze({
  requestStart: 'request-recording-start',
  startRejected: 'recording-start-rejected',
});

export const VOICE_RECORDING_START_REJECTION_REASONS = ['provider-not-connected'] as const;

export type VoiceRecordingStartRejectionReason = (typeof VOICE_RECORDING_START_REJECTION_REASONS)[number];

export type VoiceRecordingStartResult =
  Readonly<{ accepted: true }> | Readonly<{ accepted: false; reason?: VoiceRecordingStartRejectionReason }>;

export function isRecordingLifecycleState(value: unknown): value is RecordingLifecycleState {
  return typeof value === 'string' && RECORDING_LIFECYCLE_STATES.includes(value as RecordingLifecycleState);
}

export function isVoiceRecordingStartRejectionReason(value: unknown): value is VoiceRecordingStartRejectionReason {
  return (
    typeof value === 'string' &&
    VOICE_RECORDING_START_REJECTION_REASONS.includes(value as VoiceRecordingStartRejectionReason)
  );
}

export function isVoiceRecordingStartResult(value: unknown): value is VoiceRecordingStartResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Readonly<Record<string, unknown>>;
  if (candidate.accepted === true) return Object.keys(candidate).length === 1;
  return (
    candidate.accepted === false &&
    (Object.keys(candidate).length === 1 ||
      (Object.keys(candidate).length === 2 && isVoiceRecordingStartRejectionReason(candidate.reason)))
  );
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
  return (
    state === 'starting' ||
    state === 'recording' ||
    state === 'paused' ||
    state === 'transcribing' ||
    state === 'retrying'
  );
}

export function isRecordingLifecycleBusy(state: RecordingLifecycleState): boolean {
  return state !== 'idle';
}
