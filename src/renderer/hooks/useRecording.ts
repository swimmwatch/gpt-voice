import { useRef, useCallback } from 'react';
import rendererLog from 'electron-log/renderer';
import { prepareTranscriptionAudio } from '../audioEncoding';
import { DEFAULT_TRANSCRIPTION_MIME_TYPE, PREFERRED_RECORDING_MIME_TYPES } from '@shared/transcriptionConstants';

const log = rendererLog.scope('recording');
const NOTIFICATION_BODY_MAX_CHARS = 120;

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

  const getSupportedRecordingMimeType = useCallback(() => {
    return PREFERRED_RECORDING_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';
  }, []);

  const showRecognitionErrorNotification = useCallback(
    (error: unknown, fallback: string) => {
      void window.electronAPI.showNotification(
        t('notification.transcriptionFailed'),
        formatNotificationBody(error, fallback),
      );
    },
    [t],
  );

  const startRecording = useCallback(async () => {
    try {
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

          const result = await window.electronAPI.transcribeAudio(audio.buffer, audio.mimeType);
          log.info('Transcription result:', {
            success: result.success,
            textLength: result.text?.length ?? 0,
            error: result.error,
          });
          if (result.success && result.text) {
            log.info('Copied transcription to clipboard, text length:', result.text.length);
            setStatus(t('status.copiedToClipboard'));
            window.electronAPI.showNotification(t('notification.textCopied'), result.text);
          } else {
            log.error('Transcription failed:', result.error, (result as Record<string, unknown>).raw);
            setStatus(t('status.transcriptionFailed'));
            showRecognitionErrorNotification(result.error, t('status.transcriptionFailed'));
          }
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
  }, [getSupportedRecordingMimeType, setIsPaused, setIsRecording, setStatus, showRecognitionErrorNotification, t]);

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

  return { startRecording, stopRecording, pauseRecording, resumeRecording, cancelRecording };
}

function formatNotificationBody(error: unknown, fallback: string): string {
  const message = getErrorMessage(error) || fallback;
  const singleLine = message.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= NOTIFICATION_BODY_MAX_CHARS) {
    return singleLine;
  }
  return `${singleLine.slice(0, NOTIFICATION_BODY_MAX_CHARS - 3)}...`;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error.trim();
  }
  if (error instanceof Error) {
    return error.message.trim();
  }
  return '';
}
