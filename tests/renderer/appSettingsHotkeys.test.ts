import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('App Settings hotkeys', () => {
  it('renders the ordered quick Prettify target through the existing generic row', () => {
    const section = readProjectFile('src/renderer/components/settings/ShortcutsSection.tsx');
    const modal = readProjectFile('src/renderer/components/HotkeyModal.tsx');

    assert.match(section, /HOTKEY_TARGETS\.map\(\(target\)/u);
    assert.match(section, /label=\{t\(`hotkey\.\$\{target\}`\)\}/u);
    assert.doesNotMatch(section, /prettifyQuick/u);
    assert.match(modal, /type HotkeyTarget/u);
    assert.match(modal, /t\(`hotkey\.\$\{target\}`\)/u);
  });

  it('reads the quick value without adding a second enable toggle', () => {
    const settingsWindow = readProjectFile('src/renderer/AppSettingsWindow.tsx');
    const section = readProjectFile('src/renderer/components/settings/ShortcutsSection.tsx');

    assert.match(settingsWindow, /case 'prettifyQuick':\s+return hotkeySettings\.prettifyQuickHotkey;/u);
    assert.match(section, /target === 'prettify'\s+\? textActionSettings\.prettifyEnabled/u);
    assert.doesNotMatch(section, /target === 'prettifyQuick'/u);
  });
});
