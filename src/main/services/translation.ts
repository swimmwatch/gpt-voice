import { ensureBackgroundBrowser, getTranslatePage, isBgReady } from '../browser';
import { writeClipboardText } from '../electronRuntime';
import { createLogger } from '../logger';

const log = createLogger('translate');

let currentTargetLang = 'en';

export async function translateText(
  text: string,
  targetLang: string,
): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    log.info('Starting translation, text length:', text.length, 'target:', targetLang);

    await ensureBackgroundBrowser();
    const translatePage = getTranslatePage();
    if (!isBgReady() || !translatePage) {
      return { success: false, error: 'Background browser not available' };
    }

    // Only navigate if the target language changed
    if (targetLang !== currentTargetLang) {
      const url = `https://translate.google.ru/?sl=auto&tl=${encodeURIComponent(targetLang)}&op=translate`;
      await translatePage.goto(url, { waitUntil: 'networkidle' });
      currentTargetLang = targetLang;
      log.info('Google Translate language changed to:', targetLang);
    }

    const sourceArea = translatePage.locator('textarea.er8xn');
    await sourceArea.waitFor({ timeout: 10000 });
    await sourceArea.fill(text);
    log.info('Text entered, waiting for translation...');

    const resultSelector = '.ryNqvb';
    await translatePage.waitForSelector(resultSelector, { timeout: 15000 });
    await translatePage.waitForTimeout(1500);

    const translated = await translatePage.evaluate((sel: string) => {
      const spans = document.querySelectorAll(sel);
      return Array.from(spans)
        .map((s) => s.textContent || '')
        .join('');
    }, resultSelector);

    log.info('Translation result length:', translated.length);

    if (translated) {
      writeClipboardText(translated);
      return { success: true, text: translated };
    }
    return { success: false, error: 'No translation result found on page' };
  } catch (err: unknown) {
    log.error('Error:', err instanceof Error ? err.message : err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
