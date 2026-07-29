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

  it('routes CloakBrowser saves through the state-owning recoverable reset service', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const resetService = readProjectFile('src/main/services/cloakBrowserSettingsReset.ts');
    const handler = ipc.slice(
      ipc.indexOf("this.trustedIpc.handle('save-cloakbrowser-settings'"),
      ipc.indexOf("this.trustedIpc.handle('save-provider-settings'"),
    );

    const validation = resetService.indexOf('assertValidCloakBrowserSettingsInput');
    const prepare = resetService.indexOf('this.dependencies.settings.prepare');
    const reset = resetService.indexOf('this.dependencies.translation.reset');
    const release = resetService.indexOf('this.releaseBackgroundBrowser');
    const initialize = resetService.indexOf('this.initializeBackgroundBrowser');
    const persist = resetService.indexOf('prepared.persist');
    const warm = resetService.indexOf('this.warmSelectedTranslationProvider');

    assert.match(handler, /dependencies\.cloakBrowserSettingsReset\.save\(settings\)/u);
    assert.doesNotMatch(
      handler,
      /translationRuntime\.shutdown|backgroundBrowserService\.restart|preparedSettings\.persist/u,
    );
    assert.equal(validation >= 0, true);
    assert.equal(validation < prepare, true);
    assert.equal(prepare < reset, true);
    assert.equal(reset < release, true);
    assert.equal(release < initialize, true);
    assert.equal(initialize < persist, true);
    assert.equal(persist < warm, true);
    assert.match(resetService, /export class CloakBrowserSettingsResetService/u);
    assert.doesNotMatch(resetService, /translation\.shutdown/u);
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

  it('clears Translation listeners only in final shutdown, never reusable reset', () => {
    const translation = readProjectFile('src/main/services/translation.ts');
    const reset = translation.slice(translation.indexOf('async reset()'), translation.indexOf('async shutdown()'));
    const shutdown = translation.slice(translation.indexOf('async shutdown()'));

    assert.doesNotMatch(reset, /connectionListeners\.clear/u);
    assert.match(shutdown, /connectionListeners\.clear\(\)/u);
    assert.equal(translation.match(/connectionListeners\.clear\(\)/gu)?.length, 1);
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
