import { useRef, useCallback } from 'react';
import rendererLog from 'electron-log/renderer';
import { prepareTranscriptionAudio, type TranscriptionAudioPayload } from '../audioEncoding';
import { showTranscriptionFailureNotification, showTranscriptionSuccessNotification } from '../recordingNotifications';
import { DEFAULT_TRANSCRIPTION_MIME_TYPE, PREFERRED_RECORDING_MIME_TYPES } from '@shared/transcriptionConstants';
import { getNotificationErrorMessage, type SystemNotificationOptions } from '@shared/notifications';

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
  const failedTranscriptionAudioRef = useRef<TranscriptionAudioPayload | null>(null);
  const retryTranscriptionInFlightRef = useRef(false);

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

  const clearFailedTranscriptionAudio = useCallback(() => {
    failedTranscriptionAudioRef.current = null;
    reportRetryTranscriptionAvailability(false);
  }, [reportRetryTranscriptionAvailability]);

  const rememberFailedTranscriptionAudio = useCallback(
    (audio: TranscriptionAudioPayload) => {
      if (audio.buffer.byteLength === 0) {
        failedTranscriptionAudioRef.current = null;
        reportRetryTranscriptionAvailability(false);
        return;
      }

      failedTranscriptionAudioRef.current = audio;
      if (!retryTranscriptionInFlightRef.current) {
        reportRetryTranscriptionAvailability(true);
      }
    },
    [reportRetryTranscriptionAvailability],
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
          clearFailedTranscriptionAudio();
          log.info('Copied transcription to clipboard, text length:', result.text.length);
          setStatus(t('status.copiedToClipboard'));
          showTranscriptionSuccessNotification(window.electronAPI, t, result.text);
          return;
        }

        rememberFailedTranscriptionAudio(audio);
        log.error('Transcription failed:', result.error, (result as Record<string, unknown>).raw);
        setStatus(t('status.transcriptionFailed'));
        showRecognitionErrorNotification(result.error, t('status.transcriptionFailed'), { sound: 'error' });
      } catch (err) {
        rememberFailedTranscriptionAudio(audio);
        setStatus(t('status.transcriptionError'));
        log.error('Transcribe error:', err);
        showRecognitionErrorNotification(err, t('status.transcriptionError'), { sound: 'error' });
      }
    },
    [clearFailedTranscriptionAudio, rememberFailedTranscriptionAudio, setStatus, showRecognitionErrorNotification, t],
  );

  const startRecording = useCallback(async () => {
    try {
      clearFailedTranscriptionAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        }
      };

      mediaRecorder.start();
      setStatus(t('status.recording'));
    } catch (err) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      mediaRecorderRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
      void window.electronAPI.recordingStartFailed();
      setStatus(t('status.microphoneError'));
      log.error('Microphone error:', err);
      showRecognitionErrorNotification(err, t('status.microphoneError'));
    }
  }, [
    clearFailedTranscriptionAudio,
    getSupportedRecordingMimeType,
    setIsPaused,
    setIsRecording,
    setStatus,
    showRecognitionErrorNotification,
    submitTranscriptionAudio,
    t,
  ]);

  const retryLastFailedTranscription = useCallback(async () => {
    const audio = failedTranscriptionAudioRef.current;
    if (!audio || retryTranscriptionInFlightRef.current) {
      return;
    }

    retryTranscriptionInFlightRef.current = true;
    reportRetryTranscriptionAvailability(false);
    try {
      await submitTranscriptionAudio(audio, true);
    } finally {
      retryTranscriptionInFlightRef.current = false;
      if (failedTranscriptionAudioRef.current) {
        reportRetryTranscriptionAvailability(true);
      }
    }
  }, [reportRetryTranscriptionAvailability, submitTranscriptionAudio]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')
    ) {
      mediaRecorderRef.current.stop();
      setStatus(t('status.stopping'));
    }
  }, [setStatus, t]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      setStatus(t('status.paused'));
      log.info('Paused');
    }
  }, [setIsPaused, setStatus, t]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      setStatus(t('status.recording'));
      log.info('Resumed');
    }
  }, [setIsPaused, setStatus, t]);

  const cancelRecording = useCallback(() => {
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
    setIsRecording(false);
    setIsPaused(false);
    const status = t('status.recordingCancelled');
    setStatus(status);
    notifyStatus?.(status);
    log.info('Cancelled by user');
  }, [notifyStatus, setIsRecording, setIsPaused, setStatus, t]);

  return {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    retryLastFailedTranscription,
  };
}
