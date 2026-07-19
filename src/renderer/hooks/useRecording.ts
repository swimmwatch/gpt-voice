import { useCallback, useEffect, useRef } from 'react';
import rendererLog from 'electron-log/renderer';
import { prepareTranscriptionAudio, type TranscriptionAudioPayload } from '../audioEncoding';
import {
  beginRetryTranscription,
  clearRetryableTranscriptionAudio,
  createRecordingRetryState,
  finishRetryTranscription,
  isRetryTranscriptionAvailable,
  storeRetryableTranscriptionAudio,
} from '../recordingRetryState';
import { showTranscriptionFailureNotification, showTranscriptionSuccessNotification } from '../recordingNotifications';
import { translatedStatus, type RendererStatus } from '../statusPresentation';
import { useStreamingRecordingController } from './useStreamingRecordingController';
import { DEFAULT_TRANSCRIPTION_MIME_TYPE, PREFERRED_RECORDING_MIME_TYPES } from '@shared/transcriptionConstants';
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
  notifyStatus?: (status: RendererStatus) => void;
  setRecordingState: (state: RecordingLifecycleState) => void;
  setStatus: (status: RendererStatus) => void;
  t: (key: string, params?: Record<string, string>) => string;
  transcriptionMode: VoiceTranscriptionMode;
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
  const recordingGenerationRef = useRef(0);

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
      setStatus(translatedStatus('status.copiedToClipboard'));
      showTranscriptionSuccessNotification(window.electronAPI, t, text);
    },
    [setStatus, t],
  );

  const submitTranscriptionAudio = useCallback(
    async (audio: TranscriptionAudioPayload, retry: boolean) => {
      setStatus(translatedStatus(retry ? 'status.resendingTranscription' : 'status.transcribing'));

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
        setStatus(translatedStatus('status.transcriptionFailed'));
      } catch (error) {
        const presented = showRecognitionErrorNotification(error, t('status.transcriptionError'), { sound: 'error' });
        setStatus(translatedStatus('status.transcriptionError'));
        log.error('Transcribe error:', presented.safeLogMetadata);
      }
    },
    [setStatus, showRecognitionErrorNotification, showSuccessfulTranscription, t],
  );

  const streamingRecording = useStreamingRecordingController({
    clearRetryAudio: clearLastTranscriptionAudio,
    notifyStatus,
    recordingGenerationRef,
    recordingLifecycleStateRef,
    recordingModeRef,
    rememberRetryAudio: rememberLastTranscriptionAudio,
    reportRetryableAudio: reportRetryableTranscriptionAudio,
    setRecordingLifecycle,
    setStatus,
    showRecognitionError: showRecognitionErrorNotification,
    showSuccessfulTranscription,
    streamRef,
    t,
  });

  const startRecording = useCallback(async () => {
    if (!canStartRecording(recordingLifecycleStateRef.current)) return;

    const generation = recordingGenerationRef.current + 1;
    recordingGenerationRef.current = generation;
    recordingModeRef.current = transcriptionMode;
    setRecordingLifecycle('starting');
    try {
      clearLastTranscriptionAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (recordingGenerationRef.current !== generation || recordingLifecycleStateRef.current !== 'starting') {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      if (transcriptionMode === 'streaming') {
        await streamingRecording.start(stream, generation);
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

        setStatus(translatedStatus('status.transcribing'));
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
          setStatus(translatedStatus('status.transcriptionError'));
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
      setStatus(translatedStatus('status.recording'));
    } catch (error) {
      if (recordingGenerationRef.current !== generation) return;
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
      setStatus(translatedStatus('status.microphoneError'));
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
    streamingRecording,
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
      streamingRecording.stop();
      return;
    }

    if (
      mediaRecorderRef.current &&
      (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')
    ) {
      setRecordingLifecycle('stopping');
      mediaRecorderRef.current.stop();
      setStatus(translatedStatus('status.stopping'));
    }
  }, [setRecordingLifecycle, setStatus, streamingRecording]);

  const pauseRecording = useCallback(() => {
    if (!canPauseRecording(recordingLifecycleStateRef.current)) return;

    if (recordingModeRef.current === 'streaming') {
      streamingRecording.pause();
      return;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingLifecycle('paused');
      setStatus(translatedStatus('status.paused'));
      log.info('Paused');
    }
  }, [setRecordingLifecycle, setStatus, streamingRecording]);

  const resumeRecording = useCallback(() => {
    if (!canResumeRecording(recordingLifecycleStateRef.current)) return;

    if (recordingModeRef.current === 'streaming') {
      streamingRecording.resume();
      return;
    }

    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingLifecycle('recording');
      setStatus(translatedStatus('status.recording'));
      log.info('Resumed');
    }
  }, [setRecordingLifecycle, setStatus, streamingRecording]);

  const cancelRecording = useCallback(() => {
    if (!canCancelRecording(recordingLifecycleStateRef.current)) return;
    if (recordingModeRef.current === 'streaming') {
      streamingRecording.cancel(true);
      return;
    }

    recordingGenerationRef.current += 1;

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
    const status = translatedStatus('status.recordingCancelled');
    setStatus(status);
    notifyStatus?.(status);
    log.info('Cancelled by user');
  }, [notifyStatus, setRecordingLifecycle, setStatus, streamingRecording]);

  const cancelStreamingForProviderChange = useCallback(() => {
    streamingRecording.cancelForProviderChange();
  }, [streamingRecording]);

  useEffect(() => {
    return () => {
      recordingGenerationRef.current += 1;
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = null;
        if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
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
