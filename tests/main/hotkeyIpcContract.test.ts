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

  it('routes validated state queries through trusted windows and keeps mutations Settings-only', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const shared = readProjectFile('src/shared/hotkeyIpc.ts');
    const preload = readProjectFile('src/main/preloadApi.ts');
    const rendererTypes = readProjectFile('src/renderer/types.d.ts');

    assert.match(shared, /HOTKEY_IPC_CHANNELS/u);
    assert.match(shared, /isHotkeyRuntimeState/u);
    assert.match(shared, /isHotkeyMutationResponse/u);
    assert.match(shared, /isHotkeyTestResponse/u);
    assert.match(ipc, /trustedIpc\.handle\(HOTKEY_IPC_CHANNELS\.snapshotQuery/u);
    assert.match(ipc, /handleSettingsWindow\(HOTKEY_IPC_CHANNELS\.set/u);
    assert.match(ipc, /handleSettingsWindow\(HOTKEY_IPC_CHANNELS\.clear/u);
    assert.match(ipc, /handleSettingsWindow\(\s*HOTKEY_IPC_CHANNELS\.test/u);
    assert.match(ipc, /isHotkeySetRequest\(request\)/u);
    assert.match(ipc, /isHotkeyClearRequest\(request\)/u);
    assert.match(ipc, /isHotkeyTestRequest\(request\)/u);
    assert.match(ipc, /hotkeyRegistrationService\.set\(request\.target, request\.accelerator\)/u);
    assert.match(ipc, /hotkeyRegistrationService\.clear\(request\.target\)/u);
    assert.match(ipc, /hotkeyRegistrationService\.test\(request\.target\)/u);
    assert.match(ipc, /cancelHotkeyTest\(sender\)/u);
    assert.match(ipc, /settingsWindow\.once\('closed', cancel\)/u);
    assert.match(ipc, /sender\.once\('destroyed', cancel\)/u);
    assert.match(ipc, /hotkeyRegistrationService\.cancelTest\(\)/u);
    assert.doesNotMatch(ipc, /shortcutController\.register\(/u);
    assert.doesNotMatch(ipc, /dependencies\.config\.persistHotkey\(/u);
    assert.match(preload, /isHotkeyRuntimeState\(state\)/u);
    assert.match(preload, /isHotkeyMutationResponse\(response\)/u);
    assert.match(preload, /isHotkeyTestResponse\(response\)/u);
    assert.match(rendererTypes, /getHotkeyRuntimeState: \(\) => Promise<HotkeyRuntimeState>/u);
    assert.match(rendererTypes, /setHotkey: \(request: HotkeySetRequest\)/u);
    assert.match(rendererTypes, /clearHotkey: \(request: HotkeyClearRequest\)/u);
    assert.match(rendererTypes, /testHotkey: \(request: HotkeyTestRequest\)/u);

    assert.doesNotMatch(ipc, /hotkey-settings-chang(?:ed|ED)/u);
    assert.doesNotMatch(preload, /hotkey-settings-chang(?:ed|ED)/u);
    assert.doesNotMatch(rendererTypes, /setHotkeyCapture(?:Active|ACTIVE)/u);
  });
});
