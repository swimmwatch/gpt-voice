import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('HotkeyActionButton', () => {
  it('uses stationary semantic button geometry with the original graphite key face', () => {
    const component = readProjectFile('src/renderer/components/HotkeyActionButton.tsx');
    const styles = readProjectFile('src/renderer/styles/hotkeyActionButton.css');

    assert.match(component, /@renderer\/styles\/hotkeyActionButton\.css/u);
    assert.match(component, /command-dock-hotkey-action__face/u);
    assert.match(component, /const unavailable = disabled \|\| busy;/u);
    assert.match(styles, /width: var\(--dock-action-key-width, 114px\);/u);
    assert.match(styles, /height: 32px;/u);
    assert.match(styles, /--hotkey-press-travel: 3px;/u);
  });

  it('moves and compresses the face while the fixed-depth shadow overlaps it on press', () => {
    const component = readProjectFile('src/renderer/components/HotkeyActionButton.tsx');
    const styles = readProjectFile('src/renderer/styles/hotkeyActionButton.css');

    assert.match(component, /const KEYBOARD_ACTIVATION_KEYS = new Set\(\['Enter', ' '\]\);/u);
    assert.match(styles, /inset 1px -3px 0 2px #292c2d,/u);
    assert.match(
      styles,
      /\.command-dock-hotkey-action::before \{[\s\S]*inset: -1px;[\s\S]*transform: translateY\(4px\);/u,
    );
    assert.match(styles, /inset: var\(--hotkey-press-travel\) 1px 0;/u);
    assert.match(styles, /inset 1px -1px 0 2px #292c2d,/u);
    assert.match(styles, /data-keyboard-pressed='true'\]::before \{[\s\S]*transform: translateY\(1px\);/u);
    assert.match(styles, /transform: translateY\(1\.5px\);/u);
    assert.doesNotMatch(styles, /\.command-dock-hotkey-action:active\s*\{[\s\S]*?transform:/u);
  });

  it('clears keyboard feedback on blur or unmount and keeps demo CSS layout-only', () => {
    const component = readProjectFile('src/renderer/components/HotkeyActionButton.tsx');
    const demoStyles = readProjectFile('src/renderer/styles/providerHotkeyDemo.css');

    assert.match(component, /useEffect\([\s\S]*window\.clearTimeout\(releaseTimerRef\.current\);/u);
    assert.match(component, /onBlur=\{\(\) => \{[\s\S]*clearKeyboardRelease\(\);[\s\S]*setKeyboardPressed\(false\);/u);
    assert.doesNotMatch(demoStyles, /command-dock-hotkey-action__face/u);
    assert.doesNotMatch(demoStyles, /command-dock-hotkey-action:active/u);
  });

  it('keeps disabled buttons visually inert while matching pressed geometry', () => {
    const styles = readProjectFile('src/renderer/styles/hotkeyActionButton.css');

    assert.match(styles, /not\(:disabled\):hover/u);
    assert.match(styles, /not\(:disabled\):active/u);
    assert.match(styles, /not\(:disabled\)\[data-keyboard-pressed='true'\]/u);
    assert.doesNotMatch(styles, /text-shadow:/u);
    assert.match(
      styles,
      /command-dock-hotkey-action:disabled .command-dock-hotkey-action__face \{[\s\S]*inset: var\(--hotkey-press-travel\) 1px 0;[\s\S]*padding: 0 4px 1px;[\s\S]*background: #282b2c;[\s\S]*transition: none;/u,
    );
    assert.match(
      styles,
      /command-dock-hotkey-action:disabled .command-dock-hotkey-action__legend \{[\s\S]*transform: translateY\(1\.5px\);[\s\S]*transition: none;/u,
    );
    assert.match(
      styles,
      /command-dock-hotkey-action:disabled::before \{[\s\S]*background: rgb\(0 0 0 \/ 44%\);[\s\S]*transform: translateY\(1px\);[\s\S]*transition: none;/u,
    );
  });

  it('removes positional motion while retaining the pressed shadow treatment for reduced motion', () => {
    const styles = readProjectFile('src/renderer/styles/hotkeyActionButton.css');

    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/u);
    assert.match(styles, /data-keyboard-pressed='true'\] \.command-dock-hotkey-action__face \{[\s\S]*inset: 0;/u);
    assert.match(
      styles,
      /data-keyboard-pressed='true'\] \.command-dock-hotkey-action__legend \{[\s\S]*transform: none;/u,
    );
  });
});
