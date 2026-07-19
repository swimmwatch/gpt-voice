import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('App Settings section IPC contract', () => {
  it('validates optional section requests inside the trusted IPC wrapper', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const preload = readProjectFile('src/main/preload.ts');
    const rendererTypes = readProjectFile('src/renderer/types.d.ts');
    const handler = ipc.slice(ipc.indexOf("handle('open-app-settings'"), ipc.indexOf("handle('open-about'"));

    assert.match(handler, /isAppSettingsSectionId\(section\)/u);
    assert.match(handler, /showSettingsWindow\(section\)/u);
    assert.match(ipc, /assertTrustedSender\(event\)/u);
    assert.match(preload, /openAppSettings: \(section\?: AppSettingsSectionId\)/u);
    assert.match(preload, /ipcRenderer\.invoke\('open-app-settings', section\)/u);
    assert.match(preload, /onMainEvent<\[AppSettingsSectionId\]>\('app-settings-section-requested'/u);
    assert.match(rendererTypes, /openAppSettings: \(section\?: AppSettingsSectionId\)/u);
    assert.match(rendererTypes, /setPrettifySettings:[\s\S]*?error\?: string/u);
  });

  it('opens a new window at the requested section and switches an existing window', () => {
    const windowSource = readProjectFile('src/main/window.ts');

    assert.match(windowSource, /settingsWindow\.webContents\.send\('app-settings-section-requested', section\)/u);
    assert.match(windowSource, /settingsUrl\.searchParams\.set\('section', section\)/u);
  });

  it('broadcasts saved Prettify snapshots to the main and open Settings windows', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const broadcaster = ipc.slice(
      ipc.indexOf('function sendPrettifySettingsChanged'),
      ipc.indexOf('function getHotkeySettingsSnapshot'),
    );
    const appSettings = readProjectFile('src/renderer/AppSettingsWindow.tsx');

    assert.match(broadcaster, /getMainWindow\(\)\?\.webContents\.send\('prettify-settings-changed'/u);
    assert.match(broadcaster, /getSettingsWindow\(\)\?\.webContents\.send\('prettify-settings-changed'/u);
    assert.match(appSettings, /onPrettifySettingsChanged\(\(snapshot\)/u);
    assert.match(appSettings, /applyExternalPrettifyProviderSelection\(current, snapshot\.providerId\)/u);
  });

  it('broadcasts application-language changes through the typed preload contract', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const preload = readProjectFile('src/main/preload.ts');
    const rendererTypes = readProjectFile('src/renderer/types.d.ts');
    const i18nProvider = readProjectFile('src/renderer/hooks/useI18n.tsx');

    assert.match(ipc, /broadcastLocaleChanged\(locale\)/u);
    assert.match(preload, /onMainEvent<\[AppLocaleId\]>\('locale-changed'/u);
    assert.match(rendererTypes, /onLocaleChanged: \(callback: \(locale: AppLocaleId\) => void\) => \(\) => void/u);
    assert.match(i18nProvider, /window\.electronAPI\.onLocaleChanged/u);
    assert.match(i18nProvider, /window\.electronAPI\.getTranslations\(\)/u);
  });
});
