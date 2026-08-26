import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const HELPER_PATH = path.join(PROJECT_ROOT, 'scripts/hotkeys/qualification/windowsGlobalShortcutConflictHolder.mjs');

test('Windows conflict helper owns one synthetic binding and emits bounded status only', () => {
  const source = fs.readFileSync(HELPER_PATH, 'utf8');

  assert.match(source, /const CONFLICT_ACCELERATOR = 'Ctrl\+Shift\+F10';/u);
  assert.match(source, /WINDOWS_HOTKEY_QUALIFICATION_PRIVATE_ROOT/u);
  assert.match(source, /globalShortcut\.unregister\(CONFLICT_ACCELERATOR\)/u);
  assert.match(source, /process\.stdout\.write\(STATUS_(?:CONFIGURATION_INVALID|REGISTERED|REJECTED)\)/u);
  assert.doesNotMatch(source, /(?:exec|spawn|taskkill|Get-Process|child_process)/u);
});
