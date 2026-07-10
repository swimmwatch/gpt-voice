import { createLogger } from '@main/logger';
import { runPrettify, type TextProcessingResult } from '@main/services/prettifyProviders';
import { getPrettifySettingsView } from '@main/services/prettifySettingsStorage';
import { presentNotificationError } from '@shared/notifications';
import type { PrettifySettingsInput } from '@shared/prettifySettings';

const log = createLogger('prettify');

export type PrettifyTextSettings = PrettifySettingsInput & {
  signal?: AbortSignal;
};

export async function prettifyText(
  text: string,
  settings: PrettifyTextSettings = getPrettifySettingsView(),
): Promise<TextProcessingResult> {
  try {
    log.info('Starting text prettify:', { textLength: text.length });
    return runPrettify(text, settings, settings.signal);
  } catch (error: unknown) {
    log.error('Prettify error:', presentNotificationError(error, { context: 'prettify' }).safeLogMetadata);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
