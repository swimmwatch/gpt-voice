import { useCallback, useEffect, useRef } from 'react';
import rendererLog from 'electron-log/renderer';
import { prepareTranscriptionAudio, type TranscriptionAudioPayload } from '../audioEncoding';
import { startLivePcmCapture } from '../audio/livePcmCaptureBrowser';
import type { LivePcmCaptureSession } from '../audio/livePcmCaptureSession';
import {
  StreamingRecordingLocalErrorCode,
  StreamingTranscriptionQueue,
  type StreamingRecordingFailure,
} from '../audio/streamingTranscriptionQueue';
import { getStreamingTranscriptionFailureTranslationKey } from '../audio/streamingTranscriptionPresentation';
import {
  beginRetryTranscription,
  clearRetryableTranscriptionAudio,
  createRecordingRetryState,
  finishRetryTranscription,
  isRetryTranscriptionAvailable,
  storeRetryableTranscriptionAudio,
} from '../recordingRetryState';
import { showTranscriptionFailureNotification, showTranscriptionSuccessNotification } from '../recordingNotifications';
import {
  DEFAULT_TRANSCRIPTION_MIME_TYPE,
  PREFERRED_RECORDING_MIME_TYPES,
  WAV_TRANSCRIPTION_MIME_TYPE,
} from '@shared/transcriptionConstants';
import type { VoiceTranscriptionMode } from '@shared/voiceProvider';
import {
  getNotificationErrorMessage,
  type PresentedNotificationError,
  type SystemNotificationOptions,
} from '@shared/notifications';
import {
  canCancelRecording,
  canPauseRecording,
  canResumeRecording,
  canStartRecording,
  canStopRecording,
  type RecordingLifecycleState,
} from '@shared/recordingLifecycle';

const log = rendererLog.scope('recording');

interface UseRecordingOptions {
  notifyStatus?: (status: string) => void;
  setRecordingState: (state: RecordingLifecycleState) => void;
  setStatus: (status: string) => void;
  t: (key: string, params?: Record<string, string>) => string;
  transcriptionMode: VoiceTranscriptionMode;
}

function createLiveTranscriptionAudio(recordingWav: ArrayBuffer): TranscriptionAudioPayload {
  return {
    buffer: recordingWav,
    mimeType: WAV_TRANSCRIPTION_MIME_TYPE,
    transcoded: false,
  };
}

/** Coordinates audio capture, shortcut state, retry behavior, and recording notifications. */
export function useRecording({
  setStatus,
  setRecordingState,
  notifyStatus,
  t,
  transcriptionMode,
}: UseRecordingOptions) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const retryStateRef = useRef(createRecordingRetryState());
  const recordingLifecycleStateRef = useRef<RecordingLifecycleState>('idle');
  const recordingModeRef = useRef<VoiceTranscriptionMode | null>(null);
  const streamingCaptureRef = useRef<LivePcmCaptureSession | null>(null);
  const streamingCapturePromiseRef = useRef<Promise<LivePcmCaptureSession> | null>(null);
  const streamingFinalizingRef = useRef(false);
  const streamingQueueRef = useRef<StreamingTranscriptionQueue | null>(null);
  const unmountedRef = useRef(false);

  const getSupportedRecordingMimeType = useCallback(() => {
    return PREFERRED_RECORDING_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';
  }, []);

  const showRecognitionErrorNotification = useCallback(
    (error: unknown, fallback: string, options?: SystemNotificationOptions): PresentedNotificationError => {
      return showTranscriptionFailureNotification(window.electronAPI, t, error, fallback, options);
    },
    [t],
  );

  const reportRetryTranscriptionAvailability = useCallback((available: boolean) => {
    void window.electronAPI.setRetryTranscriptionAvailable(available).catch((error: unknown) => {
      log.warn('Failed to update retry transcription availability:', getNotificationErrorMessage(error));
    });
  }, []);

  const setRecordingLifecycle = useCallback(
    (state: RecordingLifecycleState) => {
      recordingLifecycleStateRef.current = state;
      setRecordingState(state);
      void window.electronAPI.setRecordingLifecycleState(state).catch((error: unknown) => {
        log.warn('Failed to update recording lifecycle state:', getNotificationErrorMessage(error));
      });
    },
    [setRecordingState],
  );

  const reportRetryableTranscriptionAudio = useCallback(() => {
    reportRetryTranscriptionAvailability(
      isRetryTranscriptionAvailable(retryStateRef.current, recordingLifecycleStateRef.current),
    );
  }, [reportRetryTranscriptionAvailability]);

  const clearLastTranscriptionAudio = useCallback(() => {
    retryStateRef.current = clearRetryableTranscriptionAudio(retryStateRef.current);
    reportRetryableTranscriptionAudio();
  }, [reportRetryableTranscriptionAudio]);

  const rememberLastTranscriptionAudio = useCallback(
    (audio: TranscriptionAudioPayload) => {
      retryStateRef.current = storeRetryableTranscriptionAudio(retryStateRef.current, audio);
      reportRetryableTranscriptionAudio();
    },
    [reportRetryableTranscriptionAudio],
  );

  const showSuccessfulTranscription = useCallback(
    (text: string) => {
      log.info('Copied transcription to clipboard, text length:', text.length);
      setStatus(t('status.copiedToClipboard'));
      showTranscriptionSuccessNotification(window.electronAPI, t, text);
    },
    [setStatus, t],
  );

  const showStreamingFailure = useCallback(
    (failure: StreamingRecordingFailure) => {
      const message = t(getStreamingTranscriptionFailureTranslationKey(failure));
      const presented = showRecognitionErrorNotification(undefined, message, {
        sound: 'error',
      });
      log.error('Streaming transcription failed:', {
        errorCode: failure.kind === 'ipc' ? failure.error.code : failure.code,
        retryEligible: failure.retryEligible,
      });
      setStatus(presented.userMessage);
    },
    [setStatus, showRecognitionErrorNotification, t],
  );

  const submitTranscriptionAudio = useCallback(
    async (audio: TranscriptionAudioPayload, retry: boolean) => {
      setStatus(t(retry ? 'status.resendingTranscription' : 'status.transcribing'));

      try {
        const result = await window.electronAPI.transcribeAudio(audio.buffer, audio.mimeType);
        log.info('Transcription result:', {
          success: result.success,
          textLength: result.text?.length ?? 0,
        });
        if (result.success && result.text) {
          showSuccessfulTranscription(result.text);
          return;
        }

        const presented = showRecognitionErrorNotification(result.error, t('status.transcriptionFailed'), {
          sound: 'error',
        });
        log.error('Transcription failed:', {
          ...presented.safeLogMetadata,
          hasRawResponse: Boolean((result as Record<string, unknown>).raw),
        });
        setStatus(presented.userMessage);
      } catch (error) {
        const presented = showRecognitionErrorNotification(error, t('status.transcriptionError'), { sound: 'error' });
        setStatus(presented.userMessage);
        log.error('Transcribe error:', presented.safeLogMetadata);
      }
    },
    [setStatus, showRecognitionErrorNotification, showSuccessfulTranscription, t],
  );

  const clearStreamingOperation = useCallback((queue: StreamingTranscriptionQueue) => {
    if (streamingQueueRef.current !== queue) return;
    streamingQueueRef.current = null;
    streamingCaptureRef.current = null;
    streamingCapturePromiseRef.current = null;
    streamingFinalizingRef.current = false;
    recordingModeRef.current = null;
    streamRef.current = null;
  }, []);

  const finalizeStreamingFailure = useCallback(
    async (queue: StreamingTranscriptionQueue, failure: StreamingRecordingFailure) => {
      if (unmountedRef.current || streamingQueueRef.current !== queue || streamingFinalizingRef.current) {
        return;
      }

      streamingFinalizingRef.current = true;
      setRecordingLifecycle('stopping');
      setStatus(t('status.stopping'));
      const capturePromise = streamingCapturePromiseRef.current;
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
      if (streamingQueueRef.current !== queue || unmountedRef.current) return;
      if (retryAudio) rememberLastTranscriptionAudio(retryAudio);
      else clearLastTranscriptionAudio();
      showStreamingFailure(failure);
      clearStreamingOperation(queue);
      setRecordingLifecycle('idle');
      reportRetryableTranscriptionAudio();
    },
    [
      clearLastTranscriptionAudio,
      clearStreamingOperation,
      rememberLastTranscriptionAudio,
      reportRetryableTranscriptionAudio,
      setRecordingLifecycle,
      setStatus,
      showStreamingFailure,
      t,
    ],
  );

  const startStreamingRecording = useCallback(
    async (stream: MediaStream) => {
      let queueReference: StreamingTranscriptionQueue | null = null;
      const queue = new StreamingTranscriptionQueue({
        client: window.electronAPI,
        onFailure: (failure) => {
          queueMicrotask(() => {
            if (queueReference) void finalizeStreamingFailure(queueReference, failure);
          });
        },
      });
      queueReference = queue;
      streamingQueueRef.current = queue;
      streamingFinalizingRef.current = false;
      recordingModeRef.current = 'streaming';

      const capturePromise = startLivePcmCapture(stream, {
        onFrame: (frame) => {
          queue.enqueueFrame(frame);
        },
        onError: () => {
          void finalizeStreamingFailure(queue, {
            kind: 'local',
            code: StreamingRecordingLocalErrorCode.InvalidAudio,
            retryEligible: false,
          });
        },
      });
      streamingCapturePromiseRef.current = capturePromise;

      try {
        const capture = await capturePromise;
        streamingCaptureRef.current = capture;
        if (streamingQueueRef.current !== queue || recordingLifecycleStateRef.current !== 'starting') {
          await capture.cancel();
          void queue.cancel();
          return;
        }
        if (streamingFinalizingRef.current) return;
        setRecordingLifecycle('recording');
        setStatus(t('status.recording'));
      } catch (error: unknown) {
        void queue.cancel();
        if (streamingQueueRef.current !== queue) return;
        clearStreamingOperation(queue);
        if (recordingLifecycleStateRef.current !== 'starting') return;
        setRecordingLifecycle('idle');
        void window.electronAPI.recordingStartFailed();
        const presented = showRecognitionErrorNotification(error, t('status.microphoneError'));
        setStatus(presented.userMessage);
        log.error('Microphone error:', presented.safeLogMetadata);
      }
    },
    [
      clearStreamingOperation,
      finalizeStreamingFailure,
      setRecordingLifecycle,
      setStatus,
      showRecognitionErrorNotification,
      t,
    ],
  );

  const finishStreamingRecording = useCallback(
    async (queue: StreamingTranscriptionQueue) => {
      if (streamingQueueRef.current !== queue || streamingFinalizingRef.current) return;
      streamingFinalizingRef.current = true;
      let retryAudio: TranscriptionAudioPayload | null = null;

      try {
        const capture = await streamingCapturePromiseRef.current;
        if (!capture) throw new Error('Streaming capture is unavailable');
        const finished = await capture.finish();
        retryAudio = createLiveTranscriptionAudio(finished.recordingWav);
        rememberLastTranscriptionAudio(retryAudio);
        setRecordingLifecycle('transcribing');
        setStatus(t('status.transcribing'));

        const result = await queue.finish(finished.finalChunk, finished.recordingWav);
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
          if (!result.retryEligible) clearLastTranscriptionAudio();
          showStreamingFailure(failure);
        }
      } catch (error: unknown) {
        void queue.cancel();
        if (!retryAudio) clearLastTranscriptionAudio();
        const presented = showRecognitionErrorNotification(error, t('status.transcriptionError'), {
          sound: 'error',
        });
        setStatus(presented.userMessage);
        log.error('Streaming transcription error:', presented.safeLogMetadata);
      } finally {
        if (streamingQueueRef.current === queue) {
          clearStreamingOperation(queue);
          setRecordingLifecycle('idle');
          reportRetryableTranscriptionAudio();
        }
      }
    },
    [
      clearLastTranscriptionAudio,
      clearStreamingOperation,
      rememberLastTranscriptionAudio,
      reportRetryableTranscriptionAudio,
      setRecordingLifecycle,
      setStatus,
      showRecognitionErrorNotification,
      showStreamingFailure,
      showSuccessfulTranscription,
      t,
    ],
  );

  const cancelStreamingRecording = useCallback(
    (notifyUser: boolean) => {
      const queue = streamingQueueRef.current;
      if (!queue || recordingModeRef.current !== 'streaming') return;
      streamingFinalizingRef.current = true;
      const capturePromise = streamingCapturePromiseRef.current;
      void queue.cancel();
      void capturePromise?.then((capture) => capture.cancel()).catch(() => undefined);
      clearStreamingOperation(queue);
      setRecordingLifecycle('idle');
      clearLastTranscriptionAudio();
      if (notifyUser) {
        const status = t('status.recordingCancelled');
        setStatus(status);
        notifyStatus?.(status);
        log.info('Cancelled by user');
      }
    },
    [clearLastTranscriptionAudio, clearStreamingOperation, notifyStatus, setRecordingLifecycle, setStatus, t],
  );

  const startRecording = useCallback(async () => {
    if (!canStartRecording(recordingLifecycleStateRef.current)) return;

    setRecordingLifecycle('starting');
    try {
      clearLastTranscriptionAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (recordingLifecycleStateRef.current !== 'starting') {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      if (transcriptionMode === 'streaming') {
        await startStreamingRecording(stream);
        return;
      }

      recordingModeRef.current = 'batch';
      const selectedMimeType = getSupportedRecordingMimeType();
      const mediaRecorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setRecordingLifecycle('transcribing');
        const mimeType = mediaRecorder.mimeType || selectedMimeType || DEFAULT_TRANSCRIPTION_MIME_TYPE;
        const blob = new Blob(chunksRef.current, { type: mimeType });

        setStatus(t('status.transcribing'));
        try {
          const audio = await prepareTranscriptionAudio(blob);
          log.info('Prepared transcription audio:', {
            sourceMimeType: mimeType,
            sourceBytes: blob.size,
            uploadMimeType: audio.mimeType,
            uploadBytes: audio.buffer.byteLength,
            transcoded: audio.transcoded,
            fallbackReason: audio.fallbackReason,
          });
          rememberLastTranscriptionAudio(audio);
          await submitTranscriptionAudio(audio, false);
        } catch (error) {
          const presented = showRecognitionErrorNotification(error, t('status.transcriptionError'));
          setStatus(presented.userMessage);
          log.error('Transcription audio preparation error:', presented.safeLogMetadata);
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          mediaRecorderRef.current = null;
          recordingModeRef.current = null;
          setRecordingLifecycle('idle');
          reportRetryableTranscriptionAudio();
        }
      };

      mediaRecorder.start();
      setRecordingLifecycle('recording');
      setStatus(t('status.recording'));
    } catch (error) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      mediaRecorderRef.current = null;
      recordingModeRef.current = null;
      if (recordingLifecycleStateRef.current !== 'starting') return;

      setRecordingLifecycle('idle');
      void window.electronAPI.recordingStartFailed();
      const presented = showRecognitionErrorNotification(error, t('status.microphoneError'));
      setStatus(presented.userMessage);
      log.error('Microphone error:', presented.safeLogMetadata);
    }
  }, [
    clearLastTranscriptionAudio,
    getSupportedRecordingMimeType,
    rememberLastTranscriptionAudio,
    reportRetryableTranscriptionAudio,
    setRecordingLifecycle,
    setStatus,
    showRecognitionErrorNotification,
    startStreamingRecording,
    submitTranscriptionAudio,
    t,
    transcriptionMode,
  ]);

  const resendLastTranscription = useCallback(async () => {
    const retry = beginRetryTranscription(retryStateRef.current, recordingLifecycleStateRef.current);
    if (!retry) return;

    retryStateRef.current = retry.state;
    reportRetryableTranscriptionAudio();
    setRecordingLifecycle('retrying');
    try {
      await submitTranscriptionAudio(retry.audio, true);
    } finally {
      retryStateRef.current = finishRetryTranscription(retryStateRef.current);
      setRecordingLifecycle('idle');
      reportRetryableTranscriptionAudio();
    }
  }, [reportRetryableTranscriptionAudio, setRecordingLifecycle, submitTranscriptionAudio]);

  const stopRecording = useCallback(() => {
    if (!canStopRecording(recordingLifecycleStateRef.current)) return;

    if (recordingModeRef.current === 'streaming') {
      const queue = streamingQueueRef.current;
      if (!queue) return;
      setRecordingLifecycle('stopping');
      setStatus(t('status.stopping'));
      void finishStreamingRecording(queue);
      return;
    }

    if (
      mediaRecorderRef.current &&
      (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')
    ) {
      setRecordingLifecycle('stopping');
      mediaRecorderRef.current.stop();
      setStatus(t('status.stopping'));
    }
  }, [finishStreamingRecording, setRecordingLifecycle, setStatus, t]);

  const pauseRecording = useCallback(() => {
    if (!canPauseRecording(recordingLifecycleStateRef.current)) return;

    if (recordingModeRef.current === 'streaming') {
      streamingCaptureRef.current?.pause();
      setRecordingLifecycle('paused');
      setStatus(t('status.paused'));
      log.info('Paused');
      return;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingLifecycle('paused');
      setStatus(t('status.paused'));
      log.info('Paused');
    }
  }, [setRecordingLifecycle, setStatus, t]);

  const resumeRecording = useCallback(() => {
    if (!canResumeRecording(recordingLifecycleStateRef.current)) return;

    if (recordingModeRef.current === 'streaming') {
      streamingCaptureRef.current?.resume();
      setRecordingLifecycle('recording');
      setStatus(t('status.recording'));
      log.info('Resumed');
      return;
    }

    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingLifecycle('recording');
      setStatus(t('status.recording'));
      log.info('Resumed');
    }
  }, [setRecordingLifecycle, setStatus, t]);

  const cancelRecording = useCallback(() => {
    if (!canCancelRecording(recordingLifecycleStateRef.current)) return;
    if (recordingModeRef.current === 'streaming') {
      cancelStreamingRecording(true);
      return;
    }

    if (
      mediaRecorderRef.current &&
      (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')
    ) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    recordingModeRef.current = null;
    setRecordingLifecycle('idle');
    const status = t('status.recordingCancelled');
    setStatus(status);
    notifyStatus?.(status);
    log.info('Cancelled by user');
  }, [cancelStreamingRecording, notifyStatus, setRecordingLifecycle, setStatus, t]);

  const cancelStreamingForProviderChange = useCallback(() => {
    if (recordingModeRef.current === 'streaming') cancelStreamingRecording(false);
  }, [cancelStreamingRecording]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      const queue = streamingQueueRef.current;
      if (queue) {
        streamingFinalizingRef.current = true;
        void queue.cancel();
        void streamingCapturePromiseRef.current?.then((capture) => capture.cancel()).catch(() => undefined);
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = null;
        if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamingQueueRef.current = null;
      streamingCaptureRef.current = null;
      streamingCapturePromiseRef.current = null;
      mediaRecorderRef.current = null;
      streamRef.current = null;
    };
  }, []);

  return {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    cancelStreamingForProviderChange,
    resendLastTranscription,
  };
}
