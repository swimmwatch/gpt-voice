import { ensureBackgroundBrowser, getActiveProvider, isBgReady } from '../browser';
import { t } from '../i18n';
import { createLogger } from '../logger';
import { addTranscriptionHistoryEntry } from './transcriptionHistoryStorage';
import { presentNotificationError } from '@shared/notifications';

const log = createLogger('transcribe');

export async function transcribeAudio(
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<{ success: boolean; text?: string; error?: string; raw?: string }> {
  const requestedAt = new Date().toISOString();

  try {
    log.info('Starting transcription, audio size:', buffer.byteLength, 'bytes', 'mime:', mimeType || 'unknown');

    await ensureBackgroundBrowser({ includeTranslate: false });
    const provider = getActiveProvider();
    if (!isBgReady() || !provider?.isReady()) {
      return { success: false, error: t('error.notLoggedIn') };
    }

    const result = await provider.transcribe(buffer, mimeType);
    if (result.success && result.text) {
      try {
        addTranscriptionHistoryEntry({
          requestedAt,
          providerId: provider.info.id,
          providerName: provider.info.name,
          text: result.text,
        });
      } catch (historyError: unknown) {
        log.warn('Failed to save transcription history entry:', {
          textLength: result.text.length,
          ...presentNotificationError(historyError, { context: 'transcription' }).safeLogMetadata,
        });
      }
    }

    return result;
  } catch (error: unknown) {
    log.error('Transcription error:', presentNotificationError(error, { context: 'transcription' }).safeLogMetadata);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
