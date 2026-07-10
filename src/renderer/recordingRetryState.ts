import { canStartRecording, type RecordingLifecycleState } from '@shared/recordingLifecycle';
import type { TranscriptionAudioPayload } from './audioEncoding';

export interface RecordingRetryState {
  audio: TranscriptionAudioPayload | null;
  isResending: boolean;
}

export interface BeginRetryTranscriptionResult {
  audio: TranscriptionAudioPayload;
  state: RecordingRetryState;
}

export function createRecordingRetryState(): RecordingRetryState {
  return {
    audio: null,
    isResending: false,
  };
}

export function storeRetryableTranscriptionAudio(
  state: RecordingRetryState,
  audio: TranscriptionAudioPayload,
): RecordingRetryState {
  return {
    ...state,
    audio: audio.buffer.byteLength > 0 ? audio : null,
    isResending: false,
  };
}

export function clearRetryableTranscriptionAudio(state: RecordingRetryState): RecordingRetryState {
  return {
    ...state,
    audio: null,
    isResending: false,
  };
}

export function isRetryTranscriptionAvailable(
  state: RecordingRetryState,
  lifecycleState: RecordingLifecycleState,
): boolean {
  return hasRetryableTranscriptionAudio(state) && canStartRecording(lifecycleState);
}

export function hasRetryableTranscriptionAudio(state: RecordingRetryState): boolean {
  return Boolean(state.audio) && !state.isResending;
}

export function beginRetryTranscription(
  state: RecordingRetryState,
  lifecycleState: RecordingLifecycleState,
): BeginRetryTranscriptionResult | null {
  if (!state.audio || !isRetryTranscriptionAvailable(state, lifecycleState)) {
    return null;
  }

  return {
    audio: state.audio,
    state: {
      ...state,
      isResending: true,
    },
  };
}

export function finishRetryTranscription(state: RecordingRetryState): RecordingRetryState {
  return {
    ...state,
    isResending: false,
  };
}
