import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('translation runtime lifecycle integration', () => {
  it('removes the legacy Google translator from the persistent voice browser', () => {
    const browser = readProjectFile('src/main/browser.ts');
    const config = readProjectFile('src/main/config.ts');
    const translation = readProjectFile('src/main/services/translation.ts');

    assert.doesNotMatch(
      browser,
      /translatePage|translateTargetLang|includeTranslate|ensureTranslateBrowser|translate\.google/u,
    );
    assert.doesNotMatch(browser, /translationUtils|BrowserNavigationService\.GoogleTranslate/u);
    assert.doesNotMatch(config, /currentTargetLang|getLegacyGoogleTarget|synchronizeLegacy/u);
    assert.doesNotMatch(translation, /playwright-core|translationUtils|getTranslatePage/u);
    assert.match(translation, /export class TranslationRuntime/u);
    assert.doesNotMatch(
      translation,
      /\btranslationRuntime\b|\btranslationProviderRegistry\b|\bgetTranslationSettingsSnapshot\b/u,
    );
  });

  it('closes translation contexts before restarting or persisting CloakBrowser settings', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const handler = ipc.slice(
      ipc.indexOf("this.trustedIpc.handle('save-cloakbrowser-settings'"),
      ipc.indexOf("this.trustedIpc.handle('save-provider-settings'"),
    );

    const validation = handler.indexOf('assertValidCloakBrowserSettingsInput');
    const prepare = handler.indexOf('dependencies.cloakBrowserSettings.prepare');
    const shutdown = handler.indexOf('dependencies.translationRuntime.shutdown');
    const restart = handler.indexOf('dependencies.backgroundBrowserService.restart');
    const persist = handler.indexOf('preparedSettings.persist');

    assert.equal(validation >= 0, true);
    assert.equal(validation < prepare, true);
    assert.equal(prepare < shutdown, true);
    assert.equal(shutdown < restart, true);
    assert.equal(restart < persist, true);
    assert.match(handler, /if \(!translationShutdown\.success\)/u);
    assert.match(handler, /settings: dependencies\.cloakBrowserSettings\.getView\(\)/u);
    assert.match(handler, /error: dependencies\.localization\.translate\('error\.translationCleanupFailed'\)/u);
    assert.doesNotMatch(handler, /failedProviderIds.*error\.message/su);
  });

  it('invalidates translation contexts before persistent browser shutdown during quit', () => {
    const application = readProjectFile('src/main/mainProcessApplication.ts');
    const cleanup = application.slice(application.indexOf('private async runQuitCleanup'));

    assert.match(cleanup, /this\.dependencies\.translationRuntime\.shutdown\(\)/u);
    assert.match(cleanup, /failedProviderIds: translationShutdown\.failedProviderIds/u);
    assert.equal(
      cleanup.indexOf('translationRuntime.shutdown') < cleanup.indexOf('backgroundBrowserService.shutdown'),
      true,
    );
    assert.doesNotMatch(cleanup, /translationShutdown.*error\.message/su);
  });

  it('keeps the trusted direct translation IPC signature without accepting a provider override', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const handler = ipc.slice(
      ipc.indexOf("this.trustedIpc.handle('translate-text'"),
      ipc.indexOf("this.trustedIpc.handle('get-transcription-history'"),
    );

    assert.match(handler, /text: string, targetLang: string/u);
    assert.match(handler, /dependencies\.translationRuntime\.translateText\(text, targetLang\)/u);
    assert.doesNotMatch(handler, /providerId|translationProviderRegistry|getProvider/u);
  });
});
