import { ensureBackgroundBrowser, getActiveProvider, isBgReady } from '../browser';
import { t } from '../i18n';
import { createLogger } from '../logger';
import { addTranscriptionHistoryEntry } from './transcriptionHistoryStorage';

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
          error: historyError instanceof Error ? historyError.message : String(historyError),
        });
      }
    }

    return result;
  } catch (err: unknown) {
    log.error('Error:', err instanceof Error ? err.message : err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
