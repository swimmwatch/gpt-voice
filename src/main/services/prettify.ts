import { createLogger } from '@main/logger';
import { runPrettify, type TextProcessingResult } from '@main/services/prettifyProviders';
import { getPrettifySettingsView } from '@main/services/prettifySettingsStorage';
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
  } catch (err: unknown) {
    log.error('Error:', err instanceof Error ? err.message : err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
