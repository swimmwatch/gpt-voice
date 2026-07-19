import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import rendererLog from 'electron-log/renderer';
import { startLivePcmCapture } from '@renderer/audio/livePcmCaptureBrowser';
import type { LivePcmCaptureSession } from '@renderer/audio/livePcmCaptureSession';
import {
  StreamingRecordingLocalErrorCode,
  StreamingTranscriptionQueue,
  type StreamingRecordingFailure,
} from '@renderer/audio/streamingTranscriptionQueue';
import { getStreamingTranscriptionFailureTranslationKey } from '@renderer/audio/streamingTranscriptionPresentation';
import type { TranscriptionAudioPayload } from '@renderer/audioEncoding';
import type { RendererStatus } from '@renderer/statusPresentation';
import { translatedStatus } from '@renderer/statusPresentation';
import type { PresentedNotificationError, SystemNotificationOptions } from '@shared/notifications';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';
import { WAV_TRANSCRIPTION_MIME_TYPE } from '@shared/transcriptionConstants';
import type { VoiceTranscriptionMode } from '@shared/voiceProvider';

const log = rendererLog.scope('recording');

interface UseStreamingRecordingControllerOptions {
  clearRetryAudio: () => void;
  notifyStatus?: (status: RendererStatus) => void;
  recordingGenerationRef: MutableRefObject<number>;
  recordingLifecycleStateRef: MutableRefObject<RecordingLifecycleState>;
  recordingModeRef: MutableRefObject<VoiceTranscriptionMode | null>;
  rememberRetryAudio: (audio: TranscriptionAudioPayload) => void;
  reportRetryableAudio: () => void;
  setRecordingLifecycle: (state: RecordingLifecycleState) => void;
  setStatus: (status: RendererStatus) => void;
  showRecognitionError: (
    error: unknown,
    fallback: string,
    options?: SystemNotificationOptions,
  ) => PresentedNotificationError;
  showSuccessfulTranscription: (text: string) => void;
  streamRef: MutableRefObject<MediaStream | null>;
  t: (key: string, params?: Record<string, string>) => string;
}

function createLiveTranscriptionAudio(recordingWav: ArrayBuffer): TranscriptionAudioPayload {
  return {
    buffer: recordingWav,
    mimeType: WAV_TRANSCRIPTION_MIME_TYPE,
    transcoded: false,
  };
}

/** Owns live PCM capture, serialized streaming, and terminal race handling. */
export function useStreamingRecordingController({
  clearRetryAudio,
  notifyStatus,
  recordingGenerationRef,
  recordingLifecycleStateRef,
  recordingModeRef,
  rememberRetryAudio,
  reportRetryableAudio,
  setRecordingLifecycle,
  setStatus,
  showRecognitionError,
  showSuccessfulTranscription,
  streamRef,
  t,
}: UseStreamingRecordingControllerOptions) {
  const captureRef = useRef<LivePcmCaptureSession | null>(null);
  const capturePromiseRef = useRef<Promise<LivePcmCaptureSession> | null>(null);
  const finalizingRef = useRef(false);
  const queueRef = useRef<StreamingTranscriptionQueue | null>(null);
  const unmountedRef = useRef(false);

  const clearOperation = useCallback(
    (queue: StreamingTranscriptionQueue) => {
      if (queueRef.current !== queue) return;
      queueRef.current = null;
      captureRef.current = null;
      capturePromiseRef.current = null;
      finalizingRef.current = false;
      recordingModeRef.current = null;
      streamRef.current = null;
    },
    [recordingModeRef, streamRef],
  );

  const showStreamingFailure = useCallback(
    (failure: StreamingRecordingFailure) => {
      const translationKey = getStreamingTranscriptionFailureTranslationKey(failure);
      showRecognitionError(undefined, t(translationKey), { sound: 'error' });
      log.error('Streaming transcription failed:', {
        errorCode: failure.kind === 'ipc' ? failure.error.code : failure.code,
        retryEligible: failure.retryEligible,
      });
      setStatus(translatedStatus(translationKey));
    },
    [setStatus, showRecognitionError, t],
  );

  const finalizeFailure = useCallback(
    async (queue: StreamingTranscriptionQueue, failure: StreamingRecordingFailure) => {
      if (unmountedRef.current || queueRef.current !== queue || finalizingRef.current) return;

      finalizingRef.current = true;
      setRecordingLifecycle('stopping');
      setStatus(translatedStatus('status.stopping'));
      const capturePromise = capturePromiseRef.current;
      let retryAudio: TranscriptionAudioPayload | null = null;
      try {
        const capture = await capturePromise;
        if (failure.retryEligible) {
          const finished = await capture?.finish();
          if (finished) retryAudio = createLiveTranscriptionAudio(finished.recordingWav);
        } else {
          await capture?.cancel();
        }
      } catch {
        retryAudio = null;
      }

      void queue.cancel();
      if (queueRef.current !== queue || unmountedRef.current) return;
      if (retryAudio) rememberRetryAudio(retryAudio);
      else clearRetryAudio();
      showStreamingFailure(failure);
      clearOperation(queue);
      setRecordingLifecycle('idle');
      reportRetryableAudio();
    },
    [
      clearOperation,
      clearRetryAudio,
      rememberRetryAudio,
      reportRetryableAudio,
      setRecordingLifecycle,
      setStatus,
      showStreamingFailure,
    ],
  );

  const start = useCallback(
    async (stream: MediaStream, generation: number): Promise<void> => {
      let queueReference: StreamingTranscriptionQueue | null = null;
      const queue = new StreamingTranscriptionQueue({
        client: window.electronAPI,
        onFailure: (failure) => {
          queueMicrotask(() => {
            if (queueReference) void finalizeFailure(queueReference, failure);
          });
        },
      });
      queueReference = queue;
      queueRef.current = queue;
      finalizingRef.current = false;
      recordingModeRef.current = 'streaming';

      const capturePromise = startLivePcmCapture(stream, {
        onFrame: (frame) => queue.enqueueFrame(frame),
        onError: () => {
          void finalizeFailure(queue, {
            kind: 'local',
            code: StreamingRecordingLocalErrorCode.InvalidAudio,
            retryEligible: false,
          });
        },
      });
      capturePromiseRef.current = capturePromise;

      try {
        const capture = await capturePromise;
        captureRef.current = capture;
        if (
          queueRef.current !== queue ||
          recordingGenerationRef.current !== generation ||
          recordingLifecycleStateRef.current !== 'starting'
        ) {
          await capture.cancel();
          void queue.cancel();
          return;
        }
        if (finalizingRef.current) return;
        setRecordingLifecycle('recording');
        setStatus(translatedStatus('status.recording'));
      } catch (error: unknown) {
        void queue.cancel();
        if (queueRef.current !== queue) return;
        clearOperation(queue);
        if (recordingLifecycleStateRef.current !== 'starting') return;
        setRecordingLifecycle('idle');
        void window.electronAPI.recordingStartFailed();
        const presented = showRecognitionError(error, t('status.microphoneError'));
        setStatus(translatedStatus('status.microphoneError'));
        log.error('Microphone error:', presented.safeLogMetadata);
      }
    },
    [
      clearOperation,
      finalizeFailure,
      recordingGenerationRef,
      recordingLifecycleStateRef,
      recordingModeRef,
      setRecordingLifecycle,
      setStatus,
      showRecognitionError,
      t,
    ],
  );

  const finish = useCallback(
    async (queue: StreamingTranscriptionQueue): Promise<void> => {
      if (queueRef.current !== queue || finalizingRef.current) return;
      const generation = recordingGenerationRef.current;
      const ownsRecording = (): boolean =>
        !unmountedRef.current && queueRef.current === queue && recordingGenerationRef.current === generation;
      finalizingRef.current = true;
      let retryAudio: TranscriptionAudioPayload | null = null;

      try {
        const capture = await capturePromiseRef.current;
        if (!ownsRecording()) return;
        if (!capture) throw new Error('Streaming capture is unavailable');
        const finished = await capture.finish();
        if (!ownsRecording()) return;
        retryAudio = createLiveTranscriptionAudio(finished.recordingWav);
        rememberRetryAudio(retryAudio);
        setRecordingLifecycle('transcribing');
        setStatus(translatedStatus('status.transcribing'));

        const result = await queue.finish(finished.finalChunk, finished.recordingWav);
        if (!ownsRecording()) return;
        log.info('Streaming transcription result:', {
          success: result.success,
          textLength: result.success ? result.text.length : 0,
        });
        if (result.success && result.text) {
          showSuccessfulTranscription(result.text);
        } else if (!result.success) {
          const failure: StreamingRecordingFailure = {
            kind: 'ipc',
            error: result.error,
            retryEligible: result.retryEligible,
          };
          if (!result.retryEligible) clearRetryAudio();
          showStreamingFailure(failure);
        }
      } catch (error: unknown) {
        void queue.cancel();
        if (!ownsRecording()) return;
        if (!retryAudio) clearRetryAudio();
        const presented = showRecognitionError(error, t('status.transcriptionError'), { sound: 'error' });
        setStatus(translatedStatus('status.transcriptionError'));
        log.error('Streaming transcription error:', presented.safeLogMetadata);
      } finally {
        if (queueRef.current === queue) {
          clearOperation(queue);
          setRecordingLifecycle('idle');
          reportRetryableAudio();
        }
      }
    },
    [
      clearOperation,
      clearRetryAudio,
      recordingGenerationRef,
      rememberRetryAudio,
      reportRetryableAudio,
      setRecordingLifecycle,
      setStatus,
      showRecognitionError,
      showStreamingFailure,
      showSuccessfulTranscription,
      t,
    ],
  );

  const stop = useCallback((): void => {
    const queue = queueRef.current;
    if (!queue) return;
    setRecordingLifecycle('stopping');
    setStatus(translatedStatus('status.stopping'));
    void finish(queue);
  }, [finish, setRecordingLifecycle, setStatus]);

  const pause = useCallback((): void => {
    captureRef.current?.pause();
    setRecordingLifecycle('paused');
    setStatus(translatedStatus('status.paused'));
    log.info('Paused');
  }, [setRecordingLifecycle, setStatus]);

  const resume = useCallback((): void => {
    captureRef.current?.resume();
    setRecordingLifecycle('recording');
    setStatus(translatedStatus('status.recording'));
    log.info('Resumed');
  }, [setRecordingLifecycle, setStatus]);

  const cancel = useCallback(
    (notifyUser: boolean): void => {
      const queue = queueRef.current;
      if (recordingModeRef.current !== 'streaming') return;
      recordingGenerationRef.current += 1;
      finalizingRef.current = true;
      const capturePromise = capturePromiseRef.current;
      if (queue) void queue.cancel();
      void capturePromise?.then((capture) => capture.cancel()).catch(() => undefined);
      if (queue) {
        clearOperation(queue);
      } else {
        captureRef.current = null;
        capturePromiseRef.current = null;
        finalizingRef.current = false;
        recordingModeRef.current = null;
        streamRef.current = null;
      }
      setRecordingLifecycle('idle');
      clearRetryAudio();
      if (notifyUser) {
        const status = translatedStatus('status.recordingCancelled');
        setStatus(status);
        notifyStatus?.(status);
        log.info('Cancelled by user');
      }
    },
    [
      clearOperation,
      clearRetryAudio,
      notifyStatus,
      recordingGenerationRef,
      recordingModeRef,
      setRecordingLifecycle,
      setStatus,
      streamRef,
    ],
  );

  const cancelForProviderChange = useCallback((): void => {
    if (recordingModeRef.current === 'streaming') cancel(false);
  }, [cancel, recordingModeRef]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      const queue = queueRef.current;
      if (queue) {
        finalizingRef.current = true;
        void queue.cancel();
        void capturePromiseRef.current?.then((capture) => capture.cancel()).catch(() => undefined);
      }
      queueRef.current = null;
      captureRef.current = null;
      capturePromiseRef.current = null;
    };
  }, []);

  return { cancel, cancelForProviderChange, pause, resume, start, stop };
}
