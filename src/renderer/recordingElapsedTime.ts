import { useEffect, useRef, useState } from 'react';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';

export const CAPTURED_AUDIO_DURATION_TICK_MS = 1_000;

export interface CapturedAudioElapsedState {
  readonly capturedMs: number;
  readonly recordingStartedAtMs: number | null;
}

export interface CapturedAudioClock {
  clearInterval(handle: number): void;
  now(): number;
  setInterval(callback: () => void, intervalMs: number): number;
}

const browserClock: CapturedAudioClock = {
  clearInterval: (handle) => window.clearInterval(handle),
  now: () => window.performance.now(),
  setInterval: (callback, intervalMs) => window.setInterval(callback, intervalMs),
};

/** Creates the renderer-local duration state for a single recording session. */
export function createCapturedAudioElapsedState(): CapturedAudioElapsedState {
  return { capturedMs: 0, recordingStartedAtMs: null };
}

/** Advances duration only for captured audio, never during pause or processing. */
export function transitionCapturedAudioElapsedState(
  state: CapturedAudioElapsedState,
  nextLifecycle: RecordingLifecycleState,
  nowMs: number,
): CapturedAudioElapsedState {
  if (nextLifecycle === 'idle') return createCapturedAudioElapsedState();

  const capturedMs = getCapturedAudioElapsedMs(state, nowMs);
  return nextLifecycle === 'recording'
    ? { capturedMs, recordingStartedAtMs: state.recordingStartedAtMs ?? nowMs }
    : { capturedMs, recordingStartedAtMs: null };
}

/** Reads a monotonic rendered duration without persisting or publishing it. */
export function getCapturedAudioElapsedMs(state: CapturedAudioElapsedState, nowMs: number): number {
  if (state.recordingStartedAtMs === null) return state.capturedMs;
  return state.capturedMs + Math.max(0, nowMs - state.recordingStartedAtMs);
}

export function formatCapturedAudioDuration(elapsedMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, elapsedMs) / CAPTURED_AUDIO_DURATION_TICK_MS);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

/** Owns lifecycle-bound captured-audio timing in the renderer only. */
export function useCapturedAudioElapsedTime(
  lifecycle: RecordingLifecycleState,
  clock: CapturedAudioClock = browserClock,
): string {
  const elapsedStateRef = useRef(createCapturedAudioElapsedState());
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const nowMs = clock.now();
    elapsedStateRef.current = transitionCapturedAudioElapsedState(elapsedStateRef.current, lifecycle, nowMs);
    setElapsedMs(getCapturedAudioElapsedMs(elapsedStateRef.current, nowMs));
    if (lifecycle !== 'recording') return undefined;

    const handle = clock.setInterval(() => {
      setElapsedMs(getCapturedAudioElapsedMs(elapsedStateRef.current, clock.now()));
    }, CAPTURED_AUDIO_DURATION_TICK_MS);
    return () => clock.clearInterval(handle);
  }, [clock, lifecycle]);

  return formatCapturedAudioDuration(elapsedMs);
}
