import { ensureBackgroundBrowser, getActiveProvider, isBgReady } from '@main/browser';
import { currentPrettifyPrompt, currentPrettifyReasoning } from '@main/config';
import { t } from '@main/i18n';
import { createLogger } from '@main/logger';
import type { TextProcessingResult } from '@main/providers';
import type { PrettifySettings } from '@shared/prettifySettings';

const log = createLogger('prettify');

export async function prettifyText(
  text: string,
  settings: PrettifySettings = {
    prompt: currentPrettifyPrompt,
    reasoning: currentPrettifyReasoning,
  },
): Promise<TextProcessingResult> {
  try {
    log.info('Starting text prettify:', { textLength: text.length, reasoning: settings.reasoning });

    await ensureBackgroundBrowser({ includeTranslate: false });
    const provider = getActiveProvider();
    if (!isBgReady() || !provider?.isReady()) {
      return { success: false, error: t('error.notLoggedIn') };
    }

    return provider.prettifyText(text, settings);
  } catch (err: unknown) {
    log.error('Error:', err instanceof Error ? err.message : err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
