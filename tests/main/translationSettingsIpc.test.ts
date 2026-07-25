import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('translation settings IPC', () => {
  it('registers both channels through the trusted-sender wrapper', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const wrapper = ipc.slice(ipc.indexOf('function assertTrustedSender'), ipc.indexOf('function registerStreaming'));

    assert.match(wrapper, /assertTrustedSender\(event\)/u);
    assert.match(ipc, /handle\('get-translate-settings'/u);
    assert.match(ipc, /handle\('set-translate-settings'/u);
    assert.doesNotMatch(ipc, /ipcMain\.handle\('get-translate-settings'/u);
    assert.doesNotMatch(ipc, /ipcMain\.handle\('set-translate-settings'/u);
  });

  it('returns authoritative snapshots on success, validation rejection, and persistence failure', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const handlers = ipc.slice(
      ipc.indexOf("handle('set-translate-settings'"),
      ipc.indexOf("handle('get-prettify-settings'"),
    );

    assert.match(ipc, /handle\('get-translate-settings', \(\) => \{\s*return getTranslationSettingsSnapshot\(\)/u);
    assert.match(handlers, /const settings = saveTranslationSettings\(candidate\)/u);
    assert.match(handlers, /return \{ success: true, settings \}/u);
    assert.match(handlers, /TranslationSettingsValidationError/u);
    assert.match(handlers, /settings: getTranslationSettingsSnapshot\(\)/u);
    assert.match(handlers, /error\.translationSettingsInvalid/u);
    assert.match(handlers, /error\.translationSettingsSaveFailed/u);
    assert.doesNotMatch(handlers, /getErrorMessage\(error\)|candidate\s*[,}]/u);
  });

  it('keeps preload and renderer declarations synchronized on complete settings types', () => {
    const preload = readProjectFile('src/main/preload.ts');
    const rendererTypes = readProjectFile('src/renderer/types.d.ts');

    for (const source of [preload, rendererTypes]) {
      assert.match(source, /TranslationSettings/u);
      assert.match(source, /TranslationSettingsSaveResult/u);
      assert.match(source, /getTranslateSettings:[\s\S]*?Promise<TranslationSettings>/u);
      assert.match(
        source,
        /setTranslateSettings:[\s\S]*?settings: TranslationSettings[\s\S]*?Promise<TranslationSettingsSaveResult>/u,
      );
    }
    assert.match(preload, /ipcRenderer\.invoke\('set-translate-settings', settings\)/u);
    assert.doesNotMatch(preload, /getTranslateSettings:[\s\S]*?targetLang: string/u);
  });

  it('does not instantiate or fall back to a provider while validating settings', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const config = readProjectFile('src/main/config.ts');
    const settings = readProjectFile('src/main/translationSettings.ts');
    const handlers = ipc.slice(
      ipc.indexOf("handle('get-translate-settings'"),
      ipc.indexOf("handle('get-prettify-settings'"),
    );

    assert.doesNotMatch(handlers, /getProvider|translationProviderRegistry|launch/u);
    assert.doesNotMatch(config, /translationProviderRegistry|getProvider\(/u);
    assert.doesNotMatch(settings, /translationProviderRegistry|getProvider\(|launchCloak/u);
  });
});
