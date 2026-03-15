import { ensureBackgroundBrowser, getActiveProvider, isBgReady } from '../browser';
import { t } from '../i18n';
import { createLogger } from '../logger';

const log = createLogger('transcribe');

export async function transcribeAudio(
  buffer: ArrayBuffer,
): Promise<{ success: boolean; text?: string; error?: string; raw?: string }> {
  try {
    log.info('Starting transcription, audio size:', buffer.byteLength, 'bytes');

    await ensureBackgroundBrowser();
    const provider = getActiveProvider();
    if (!isBgReady() || !provider?.getPage()) {
      return { success: false, error: t('error.notLoggedIn') };
    }

    return provider.transcribe(buffer);
  } catch (err: unknown) {
    log.error('Error:', err instanceof Error ? err.message : err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
