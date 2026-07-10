import type { RecordingLifecycleState } from '@shared/recordingLifecycle';

export type TrayIconState = 'idle' | 'recording' | 'paused' | 'processing' | 'prettifying';

export const TRAY_ICON_FILENAMES: Record<TrayIconState, string> = {
  idle: 'tray-icon-idle.png',
  recording: 'tray-icon-recording.png',
  paused: 'tray-icon-paused.png',
  processing: 'tray-icon-processing.png',
  prettifying: 'tray-icon-prettifying.png',
};

export function getTrayIconFilename(state: TrayIconState): string {
  return TRAY_ICON_FILENAMES[state];
}

export function getTrayIconStateForRecordingLifecycle(state: RecordingLifecycleState): TrayIconState {
  if (state === 'paused') return 'paused';
  if (state === 'transcribing' || state === 'retrying') return 'processing';
  if (state === 'starting' || state === 'recording' || state === 'stopping') return 'recording';
  return 'idle';
}
