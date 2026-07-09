import { useRef, useCallback } from 'react';
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
import { DEFAULT_TRANSCRIPTION_MIME_TYPE, PREFERRED_RECORDING_MIME_TYPES } from '@shared/transcriptionConstants';
import { getNotificationErrorMessage, type SystemNotificationOptions } from '@shared/notifications';
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
  setStatus: (status: string) => void;
  setIsRecording: (recording: boolean) => void;
  setIsPaused: (paused: boolean) => void;
  notifyStatus?: (status: string) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

export function useRecording({ setStatus, setIsRecording, setIsPaused, notifyStatus, t }: UseRecordingOptions) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const retryStateRef = useRef(createRecordingRetryState());
  const recordingLifecycleStateRef = useRef<RecordingLifecycleState>('idle');

  const getSupportedRecordingMimeType = useCallback(() => {
    return PREFERRED_RECORDING_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';
  }, []);

  const showRecognitionErrorNotification = useCallback(
    (error: unknown, fallback: string, options?: SystemNotificationOptions) => {
      showTranscriptionFailureNotification(window.electronAPI, t, error, fallback, options);
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
      setIsRecording(state === 'starting' || state === 'recording' || state === 'paused' || state === 'stopping');
      setIsPaused(state === 'paused');
      void window.electronAPI.setRecordingLifecycleState(state).catch((error: unknown) => {
        log.warn('Failed to update recording lifecycle state:', getNotificationErrorMessage(error));
      });
    },
    [setIsPaused, setIsRecording],
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

  const submitTranscriptionAudio = useCallback(
    async (audio: TranscriptionAudioPayload, retry: boolean) => {
      setStatus(t(retry ? 'status.resendingTranscription' : 'status.transcribing'));

      try {
        const result = await window.electronAPI.transcribeAudio(audio.buffer, audio.mimeType);
        log.info('Transcription result:', {
          success: result.success,
          textLength: result.text?.length ?? 0,
          error: result.error,
        });
        if (result.success && result.text) {
          log.info('Copied transcription to clipboard, text length:', result.text.length);
          setStatus(t('status.copiedToClipboard'));
          showTranscriptionSuccessNotification(window.electronAPI, t, result.text);
          return;
        }

        log.error('Transcription failed:', result.error, (result as Record<string, unknown>).raw);
        setStatus(t('status.transcriptionFailed'));
        showRecognitionErrorNotification(result.error, t('status.transcriptionFailed'), { sound: 'error' });
      } catch (err) {
        setStatus(t('status.transcriptionError'));
        log.error('Transcribe error:', err);
        showRecognitionErrorNotification(err, t('status.transcriptionError'), { sound: 'error' });
      }
    },
    [setStatus, showRecognitionErrorNotification, t],
  );

  const startRecording = useCallback(async () => {
    if (!canStartRecording(recordingLifecycleStateRef.current)) {
      return;
    }

    setRecordingLifecycle('starting');
    try {
      clearLastTranscriptionAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (recordingLifecycleStateRef.current !== 'starting') {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      const selectedMimeType = getSupportedRecordingMimeType();
      const mediaRecorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
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
        } catch (err) {
          setStatus(t('status.transcriptionError'));
          log.error('Transcribe error:', err);
          showRecognitionErrorNotification(err, t('status.transcriptionError'));
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          mediaRecorderRef.current = null;
          setRecordingLifecycle('idle');
          reportRetryableTranscriptionAudio();
        }
      };

      mediaRecorder.start();
      setRecordingLifecycle('recording');
      setStatus(t('status.recording'));
    } catch (err) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      mediaRecorderRef.current = null;
      if (recordingLifecycleStateRef.current !== 'starting') {
        return;
      }

      setRecordingLifecycle('idle');
      void window.electronAPI.recordingStartFailed();
      setStatus(t('status.microphoneError'));
      log.error('Microphone error:', err);
      showRecognitionErrorNotification(err, t('status.microphoneError'));
    }
  }, [
    clearLastTranscriptionAudio,
    getSupportedRecordingMimeType,
    rememberLastTranscriptionAudio,
    reportRetryableTranscriptionAudio,
    setRecordingLifecycle,
    setStatus,
    showRecognitionErrorNotification,
    submitTranscriptionAudio,
    t,
  ]);

  const resendLastTranscription = useCallback(async () => {
    const retry = beginRetryTranscription(retryStateRef.current, recordingLifecycleStateRef.current);
    if (!retry) {
      return;
    }

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
    if (!canStopRecording(recordingLifecycleStateRef.current)) {
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
  }, [setRecordingLifecycle, setStatus, t]);

  const pauseRecording = useCallback(() => {
    if (!canPauseRecording(recordingLifecycleStateRef.current)) {
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingLifecycle('paused');
      setStatus(t('status.paused'));
      log.info('Paused');
    }
  }, [setRecordingLifecycle, setStatus, t]);

  const resumeRecording = useCallback(() => {
    if (!canResumeRecording(recordingLifecycleStateRef.current)) {
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingLifecycle('recording');
      setStatus(t('status.recording'));
      log.info('Resumed');
    }
  }, [setRecordingLifecycle, setStatus, t]);

  const cancelRecording = useCallback(() => {
    if (!canCancelRecording(recordingLifecycleStateRef.current)) {
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
    setRecordingLifecycle('idle');
    const status = t('status.recordingCancelled');
    setStatus(status);
    notifyStatus?.(status);
    log.info('Cancelled by user');
  }, [notifyStatus, setRecordingLifecycle, setStatus, t]);

  return {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    resendLastTranscription,
  };
}
