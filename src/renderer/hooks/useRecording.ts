import { useRef, useCallback } from 'react';
import rendererLog from 'electron-log/renderer';
import { prepareTranscriptionAudio } from '../audioEncoding';
import { DEFAULT_TRANSCRIPTION_MIME_TYPE, PREFERRED_RECORDING_MIME_TYPES } from '../../shared/transcriptionConstants';

const log = rendererLog.scope('recording');

interface UseRecordingOptions {
  setStatus: (status: string) => void;
  setIsRecording: (recording: boolean) => void;
  setIsPaused: (paused: boolean) => void;
  translateRef: React.RefObject<boolean>;
  targetLangRef: React.RefObject<string>;
  t: (key: string, params?: Record<string, string>) => string;
}

export function useRecording({
  setStatus,
  setIsRecording,
  setIsPaused,
  translateRef,
  targetLangRef,
  t,
}: UseRecordingOptions) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const getSupportedRecordingMimeType = useCallback(() => {
    return PREFERRED_RECORDING_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';
  }, []);

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
            let finalText = result.text;
            let translationFailed = false;

            if (translateRef.current) {
              setStatus(t('status.translating'));
              const tr = await window.electronAPI.translateText(result.text, targetLangRef.current);
              log.info('Translation result:', {
                success: tr.success,
                textLength: tr.text?.length ?? 0,
                error: tr.error,
              });
              if (tr.success && tr.text) {
                finalText = tr.text;
              } else {
                log.error('Translation failed:', tr.error);
                setStatus(t('status.translationFailed'));
                window.electronAPI.showNotification(t('notification.textCopiedNoTranslation'), result.text);
                translationFailed = true;
              }
            }

            if (translationFailed) return;

            log.info('Copied transcription to clipboard, text length:', finalText.length);
            setStatus(t('status.copiedToClipboard'));
            window.electronAPI.showNotification(t('notification.textCopied'), finalText);
          } else {
            log.error('Transcription failed:', result.error, (result as Record<string, unknown>).raw);
            setStatus(t('status.transcriptionFailed'));
          }
        } catch (err) {
          setStatus(t('status.transcriptionError'));
          log.error('Transcribe error:', err);
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
    }
  }, [getSupportedRecordingMimeType, setIsPaused, setIsRecording, setStatus, translateRef, targetLangRef, t]);

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
    setStatus(t('status.recordingCancelled'));
    log.info('Cancelled by user');
  }, [setIsRecording, setIsPaused, setStatus, t]);

  return { startRecording, stopRecording, pauseRecording, resumeRecording, cancelRecording };
}
