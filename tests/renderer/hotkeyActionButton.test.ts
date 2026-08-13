import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('HotkeyActionButton source and style contract', () => {
  it('keeps one semantic button with fixed stationary outer geometry and layered visual parts', () => {
    const component = readProjectFile('src/renderer/components/HotkeyActionButton.tsx');
    const styles = readProjectFile('src/renderer/styles/hotkeyActionButton.css');

    assert.match(component, /<button[\s\S]*type="button"/u);
    assert.match(component, /command-dock-hotkey-action__shadow/u);
    assert.match(component, /command-dock-hotkey-action__bevel/u);
    assert.match(component, /command-dock-hotkey-action__face/u);
    assert.match(component, /command-dock-hotkey-action__legend/u);
    assert.match(component, /data-visual-state=\{visualState\}/u);
    assert.match(component, /disabled=\{unavailable\}/u);
    assert.match(component, /aria-busy=\{busy \|\| undefined\}/u);
    assert.doesNotMatch(component, /aria-pressed=/u);
    assert.match(styles, /width: var\(--dock-action-key-width, 114px\);/u);
    assert.match(styles, /height: 32px;/u);
    assert.match(styles, /--hotkey-press-travel: 3px;/u);
    assert.doesNotMatch(
      styles,
      /\.command-dock-hotkey-action\s*\{[^}]*\btransform:/u,
      'the outer grid cell must not move',
    );
  });

  it('uses the same layered press treatment for pointer and keyboard input while the shadow remains behind the key', () => {
    const component = readProjectFile('src/renderer/components/HotkeyActionButton.tsx');
    const styles = readProjectFile('src/renderer/styles/hotkeyActionButton.css');

    assert.match(component, /const KEYBOARD_ACTIVATION_KEYS = new Set\(\['Enter', ' '\]\);/u);
    assert.match(component, /data-keyboard-pressed=\{keyboardPressed \|\| undefined\}/u);
    assert.match(component, /data-pointer-pressed=\{pointerPressed \|\| undefined\}/u);
    assert.match(component, /onPointerDown=/u);
    assert.match(component, /onPointerUp=\{clearPressedState\}/u);
    assert.match(component, /onKeyDown=/u);
    assert.match(component, /onKeyUp=/u);
    assert.match(styles, /not\(:disabled\):active \.command-dock-hotkey-action__face/u);
    assert.match(styles, /data-keyboard-pressed='true'\] \.command-dock-hotkey-action__face/u);
    assert.match(styles, /data-pointer-pressed='true'\] \.command-dock-hotkey-action__face/u);
    assert.match(
      styles,
      /command-dock-hotkey-action__face \{[\s\S]*?inset: var\(--hotkey-press-travel\) 1px var\(--hotkey-action-pressed-bevel-depth\);/u,
    );
    assert.match(styles, /command-dock-hotkey-action__bevel \{[\s\S]*?inset: var\(--hotkey-press-travel\) 1px 0;/u);
    assert.match(
      styles,
      /The shadow stays full-size[\s\S]*?command-dock-hotkey-action__shadow \{[\s\S]*?transform: translateY\(4px\);/u,
    );
    assert.match(styles, /transition-duration: 110ms;/u);
  });

  it('clears interrupted input and keeps disabled keys visually inert but lowered', () => {
    const component = readProjectFile('src/renderer/components/HotkeyActionButton.tsx');
    const styles = readProjectFile('src/renderer/styles/hotkeyActionButton.css');

    assert.match(component, /onBlur=\{clearPressedState\}/u);
    assert.match(component, /onLostPointerCapture=\{clearPressedState\}/u);
    assert.match(component, /onPointerCancel=\{clearPressedState\}/u);
    assert.match(component, /return \(\) => window\.clearTimeout\(lockTimer\);/u);
    assert.match(component, /window\.clearTimeout\(releaseTimerRef\.current\);/u);
    assert.match(component, /key=\{String\(unavailable\)\}/u);
    assert.match(styles, /not\(:disabled\):hover/u);
    assert.match(styles, /not\(:disabled\):active/u);
    assert.doesNotMatch(styles, /text-shadow:/u);
    assert.match(
      styles,
      /:disabled\[data-visual-state='disabled'\] \.command-dock-hotkey-action__face \{[\s\S]*?background: #282b2c;/u,
    );
    assert.match(
      styles,
      /:disabled\[data-visual-state='disabled'\] \.command-dock-hotkey-action__bevel \{[\s\S]*?background: #121415;/u,
    );
    assert.match(
      styles,
      /:disabled\[data-visual-state='disabled'\] \.command-dock-hotkey-action__shadow \{[\s\S]*?background: rgb\(0 0 0 \/ 44%\);/u,
    );
  });

  it('keeps reusable key styling out of demo layout CSS and respects reduced-motion preferences', () => {
    const demoStyles = readProjectFile('src/renderer/styles/providerHotkeyDemo.css');
    const styles = readProjectFile('src/renderer/styles/hotkeyActionButton.css');

    assert.doesNotMatch(demoStyles, /command-dock-hotkey-action__face/u);
    assert.doesNotMatch(demoStyles, /command-dock-hotkey-action:active/u);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/u);
    assert.match(styles, /data-keyboard-pressed='true'\] \.command-dock-hotkey-action__face/u);
    assert.match(styles, /inset: 0 0 var\(--hotkey-action-bevel-depth\);/u);
    assert.match(styles, /data-keyboard-pressed='true'\] \.command-dock-hotkey-action__legend/u);
    assert.match(styles, /transform: none;/u);
  });
});
