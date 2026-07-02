import type { Locator, Page } from 'playwright-core';
import {
  ensureTranslateBrowser,
  getTranslatePage,
  getTranslatePageTargetLang,
  setTranslatePageTargetLang,
} from '@main/browser';
import { createLogger } from '@main/logger';
import {
  buildGoogleTranslateUrl,
  createTranslationLogMetadata,
  GOOGLE_TRANSLATE_CLEAR_RESULT_TIMEOUT_MS,
  GOOGLE_TRANSLATE_NAVIGATION_TIMEOUT_MS,
  GOOGLE_TRANSLATE_RESULT_SELECTOR,
  GOOGLE_TRANSLATE_RESULT_TIMEOUT_MS,
  GOOGLE_TRANSLATE_SOURCE_SELECTOR,
  GOOGLE_TRANSLATE_SOURCE_TIMEOUT_MS,
  shouldNavigateGoogleTranslate,
  type TranslationLogMetadata,
} from '@main/services/translationUtils';

const log = createLogger('translate');

async function measureTranslationStep<T>(
  step: string,
  metadata: TranslationLogMetadata,
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await run();
  } finally {
    log.info('Translation step completed:', {
      step,
      elapsedMs: Date.now() - startedAt,
      ...metadata,
    });
  }
}

async function setGoogleTranslateSourceText(sourceArea: Locator, text: string): Promise<void> {
  await sourceArea.evaluate((element, value) => {
    const textarea = element as HTMLTextAreaElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

    textarea.focus();
    if (valueSetter) {
      valueSetter.call(textarea, value);
    } else {
      textarea.value = value;
    }

    const inputType = value ? 'insertText' : 'deleteContentBackward';
    try {
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType }));
    } catch {
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, text);
}

async function clearPreviousGoogleTranslateResult(page: Page, sourceArea: Locator): Promise<void> {
  await setGoogleTranslateSourceText(sourceArea, '');
  await page
    .waitForFunction(
      (selector) => {
        const translatedText = Array.from(document.querySelectorAll(selector))
          .map((element) => element.textContent || '')
          .join('')
          .trim();
        return translatedText.length === 0;
      },
      GOOGLE_TRANSLATE_RESULT_SELECTOR,
      { timeout: GOOGLE_TRANSLATE_CLEAR_RESULT_TIMEOUT_MS },
    )
    .catch(() => {});
}

async function readGoogleTranslateResult(page: Page): Promise<string> {
  return page.evaluate((selector) => {
    return Array.from(document.querySelectorAll(selector))
      .map((element) => element.textContent || '')
      .join('');
  }, GOOGLE_TRANSLATE_RESULT_SELECTOR);
}

async function waitForGoogleTranslateResult(page: Page): Promise<string> {
  await page.waitForFunction(
    (selector) => {
      const translatedText = Array.from(document.querySelectorAll(selector))
        .map((element) => element.textContent || '')
        .join('')
        .trim();
      return translatedText.length > 0;
    },
    GOOGLE_TRANSLATE_RESULT_SELECTOR,
    { timeout: GOOGLE_TRANSLATE_RESULT_TIMEOUT_MS },
  );
  return readGoogleTranslateResult(page);
}

export async function translateText(
  text: string,
  targetLang: string,
): Promise<{ success: boolean; text?: string; error?: string }> {
  const metadata = createTranslationLogMetadata(text, targetLang);

  try {
    log.info('Starting translation:', metadata);

    await measureTranslationStep('backgroundReady', metadata, () => ensureTranslateBrowser(metadata.targetLang));
    const translatePage = getTranslatePage();
    if (!translatePage || translatePage.isClosed()) {
      return { success: false, error: 'Translation browser not available' };
    }

    if (shouldNavigateGoogleTranslate(getTranslatePageTargetLang(), metadata.targetLang)) {
      await measureTranslationStep('languageNavigation', metadata, async () => {
        await translatePage.goto(buildGoogleTranslateUrl(metadata.targetLang), {
          waitUntil: 'domcontentloaded',
          timeout: GOOGLE_TRANSLATE_NAVIGATION_TIMEOUT_MS,
        });
        setTranslatePageTargetLang(metadata.targetLang);
      });
      log.info('Google Translate language changed:', { targetLang: metadata.targetLang });
    }

    const sourceArea = translatePage.locator(GOOGLE_TRANSLATE_SOURCE_SELECTOR);
    await measureTranslationStep('sourceReady', metadata, () =>
      sourceArea.waitFor({ timeout: GOOGLE_TRANSLATE_SOURCE_TIMEOUT_MS }),
    );
    await measureTranslationStep('textInsertion', metadata, async () => {
      await clearPreviousGoogleTranslateResult(translatePage, sourceArea);
      await setGoogleTranslateSourceText(sourceArea, text);
    });
    log.info('Text entered, waiting for translation:', metadata);

    const translated = await measureTranslationStep('resultReady', metadata, () =>
      waitForGoogleTranslateResult(translatePage),
    );

    log.info('Translation result length:', translated.length);

    if (translated) {
      return { success: true, text: translated };
    }
    return { success: false, error: 'No translation result found on page' };
  } catch (err: unknown) {
    log.error('Error:', err instanceof Error ? err.message : err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
