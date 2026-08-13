import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('hotkey IPC contract', () => {
  it('restricts provider-home commands to a validated main frame and bounded payload', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const shared = readProjectFile('src/shared/providerHomeAction.ts');

    assert.match(ipc, /handleMainWindow\(/u);
    assert.match(ipc, /isTrustedMainFrame\(event\.sender, frame\)/u);
    assert.match(ipc, /PROVIDER_HOME_ACTION_IPC_CHANNELS\.snapshotQuery/u);
    assert.match(ipc, /PROVIDER_HOME_ACTION_IPC_CHANNELS\.command/u);
    assert.match(ipc, /isProviderHomeActionCommand\(command\)/u);
    assert.match(ipc, /providerHomeActionDispatcher\.dispatch\(command, 'provider-home'\)/u);
    assert.match(shared, /PROVIDER_HOME_ACTIONS = \['voice', 'prettify', 'translation'\]/u);
    assert.match(shared, /isProviderHomeTextAction/u);
    assert.match(shared, /Object\.keys\(candidate\)\.length === 2/u);
  });

  it('persists the quick Prettify target through the validated existing handler', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const handler = ipc.slice(ipc.indexOf("handle('set-hotkey'"), ipc.indexOf("handle('get-translate-settings'"));

    assert.match(handler, /isHotkeyTarget\(key\)/u);
    assert.match(
      handler,
      /getHotkeyConflict\(\s*target,\s*normalizedHotkey,\s*dependencies\.config\.getHotkeySettings\(\),\s*dependencies\.platform/u,
    );
    assert.match(handler, /target === 'prettifyQuick'/u);
    assert.match(handler, /setHotkeys\(\{ prettifyQuickHotkey: normalizedHotkey \}\)/u);
    assert.match(handler, /dependencies\.config\.save\(\)/u);
    assert.match(handler, /dependencies\.shortcutController\.register\(\)/u);
    assert.match(handler, /hotkey-settings-changed/u);
  });

  it('reuses the typed preload and renderer declarations without adding a channel', () => {
    const preload = readProjectFile('src/main/preloadApi.ts');
    const rendererTypes = readProjectFile('src/renderer/types.d.ts');

    assert.match(preload, /key: HotkeyTarget,[\s\S]*?hotkey: string/u);
    assert.match(preload, /ipcRenderer\.invoke\('set-hotkey', key, hotkey\)/u);
    assert.match(rendererTypes, /setHotkey: \([\s\S]*?key: HotkeyTarget,[\s\S]*?hotkey: string/u);
    assert.doesNotMatch(preload, /prettify-quick/u);
    assert.doesNotMatch(rendererTypes, /prettify-quick/u);
  });
});
