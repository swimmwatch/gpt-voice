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
    assert.match(section, /target === 'prettifyQuick'/u);
    assert.match(modal, /type HotkeyTarget/u);
    assert.match(modal, /t\(`hotkey\.\$\{target\}`\)/u);
  });

  it('projects every row from the revisioned runtime snapshot and keeps the quick enable toggle independent', () => {
    const settingsWindow = readProjectFile('src/renderer/AppSettingsWindow.tsx');
    const section = readProjectFile('src/renderer/components/settings/ShortcutsSection.tsx');

    assert.match(settingsWindow, /desktopApi\.onHotkeyRuntimeStateChanged\(acceptRuntimeState\)/u);
    assert.match(settingsWindow, /desktopApi\s*\.getHotkeyRuntimeState\(\)/u);
    assert.match(settingsWindow, /nextState\.revision >= currentState\.revision/u);
    assert.match(section, /getHotkeyRuntimeSnapshotEntry\(hotkeyRuntimeState, target\)/u);
    assert.match(section, /entry=\{entry\}/u);
    assert.doesNotMatch(settingsWindow, /hotkeySettings\.(?:hotkey|prettifyQuickHotkey)/u);
    assert.match(section, /target === 'prettify'\s+\? textActionSettings\.prettifyEnabled/u);
    assert.match(section, /target === 'prettifyQuick'\s+\? textActionSettings\.prettifyQuickEnabled/u);
    assert.match(
      section,
      /target === 'prettifyQuick'\s+\? \(enabled\) => onTextActionEnabledChange\('prettifyQuickEnabled', enabled\)/u,
    );
  });

  it('keeps Apply transactional and groups authoritative row actions in an accessible menu', () => {
    const settingsWindow = readProjectFile('src/renderer/AppSettingsWindow.tsx');
    const section = readProjectFile('src/renderer/components/settings/ShortcutsSection.tsx');
    const row = readProjectFile('src/renderer/components/HotkeyRow.tsx');
    const modal = readProjectFile('src/renderer/components/HotkeyModal.tsx');

    assert.match(settingsWindow, /desktopApi\.setHotkey\(\{ accelerator: newHotkey, target: hotkeyTarget \}\)/u);
    assert.match(settingsWindow, /desktopApi\.clearHotkey\(\{ target \}\)/u);
    assert.match(settingsWindow, /desktopApi\.testHotkey\(\{ target \}\)/u);
    assert.match(settingsWindow, /<p aria-live="polite" className="sr-only">/u);
    assert.match(section, /const isTestWaiting = hotkeyTestState\?\.result === 'waiting';/u);
    assert.match(row, /getHotkeyAssignedAccelerator\(entry\)/u);
    assert.match(row, /canRemoveHotkey\(entry\)/u);
    assert.match(row, /canTestHotkey\(entry\)/u);
    assert.match(row, /accelerator: assignedAccelerator \?\? '', target: label/u);
    assert.match(row, /<DropdownMenuTrigger asChild>/u);
    assert.match(row, /<MoreHorizontal aria-hidden="true" \/>/u);
    assert.match(row, /<DropdownMenuContent align="end" className="w-44">/u);
    assert.match(row, /<DropdownMenuItem disabled=\{controlsDisabled\} onSelect=\{onChangeClick\}>/u);
    assert.match(row, /disabled=\{controlsDisabled \|\| isTestActionDisabled\}/u);
    assert.match(row, /<DropdownMenuSeparator \/>/u);
    assert.match(row, /className="flex w-9 shrink-0 justify-center"/u);
    assert.match(row, /\{t\('hotkey\.test'\)\}/u);
    assert.doesNotMatch(row, /testResult === 'waiting' \? t\('hotkey\.testing'\)/u);
    assert.match(row, /aria-label=\{description\}/u);
    assert.doesNotMatch(row, /changeButtonRef|testButtonRef/u);
    assert.doesNotMatch(row, /getHotkey(?:Authority|Failure|Status)TranslationKey/u);
    assert.match(modal, /onApply: \(hotkey: string\) => Promise<boolean>;/u);
    assert.match(modal, /if \(await onApply\(pendingHotkey\)\) restoreFocus\(\);/u);
    assert.match(modal, /if \(isApplying\) return;/u);
    assert.doesNotMatch(`${settingsWindow}\n${section}\n${modal}`, /setHotkeyCaptureActive/u);
    assert.doesNotMatch(modal, /aria-live/u);
  });

  it('keeps unassigned and failed action keys visually empty without registration markers', () => {
    const actionButton = readProjectFile('src/renderer/components/HotkeyActionButton.tsx');

    assert.match(actionButton, /case 'failed':[\s\S]*?legend: null,/u);
    assert.match(actionButton, /case 'unassigned':[\s\S]*?legend: null,/u);
    assert.doesNotMatch(actionButton, /marker|registration-marker/u);
  });
});
