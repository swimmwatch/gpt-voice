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
    assert.match(component, /<Tooltip>/u);
    assert.match(component, /<TooltipTrigger asChild>/u);
    assert.match(component, /className="command-dock-hotkey-action-tooltip-trigger"/u);
    assert.match(component, /<TooltipContent>\{tooltip\}<\/TooltipContent>/u);
    assert.match(component, /data-visual-state=\{visualState\}/u);
    assert.doesNotMatch(component, /data-registration-state/u);
    assert.match(component, /readonly accelerator: string \| null;/u);
    assert.match(component, /readonly registration: HotkeyRuntimeSnapshotEntry \| null;/u);
    assert.match(component, /getHotkeyActionButtonRegistrationPresentation/u);
    assert.match(component, /tooltip: actionLabel/u);
    assert.match(component, /useLayoutEffect\(\(\) => \{[\s\S]*?getHotkeyActionButtonVisualTransition/u);
    assert.match(component, /disabled=\{unavailable\}/u);
    assert.match(component, /aria-busy=\{busy \|\| undefined\}/u);
    assert.doesNotMatch(component, /\btitle=/u);
    assert.doesNotMatch(component, /aria-pressed=/u);
    assert.match(styles, /width: var\(--dock-action-key-width, 114px\);/u);
    assert.match(styles, /height: 32px;/u);
    assert.match(
      styles,
      /command-dock-hotkey-action-tooltip-trigger \{[\s\S]*?width: var\(--dock-action-key-width, 114px\);/u,
    );
    assert.match(styles, /--hotkey-press-travel: 3px;/u);
    assert.doesNotMatch(component, /registration-marker|marker:/u);
    assert.doesNotMatch(styles, /registration-marker/u);
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
    assert.match(styles, /command-dock-hotkey-action__face \{[\s\S]*?inset: var\(--hotkey-press-travel\) 1px 0;/u);
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
    assert.match(styles, /padding: 0 4px var\(--hotkey-action-bevel-depth\);/u);
    assert.match(styles, /inset: 0;/u);
    assert.match(styles, /data-keyboard-pressed='true'\] \.command-dock-hotkey-action__legend/u);
    assert.match(styles, /transform: none;/u);
  });

  it('mounts the approved graphite key through the same visual owner in production and the demo', () => {
    const component = readProjectFile('src/renderer/components/HotkeyActionButton.tsx');
    const demo = readProjectFile('src/renderer/ProviderHotkeyDemo.tsx');
    const demoStyles = readProjectFile('src/renderer/styles/providerHotkeyDemo.css');
    const production = readProjectFile('src/renderer/App.tsx');
    const styles = readProjectFile('src/renderer/styles/hotkeyActionButton.css');

    assert.match(component, /import '@renderer\/styles\/hotkeyActionButton\.css';/u);
    assert.match(production, /import HotkeyActionButton from '\.\/components\/HotkeyActionButton';/u);
    assert.match(demo, /import HotkeyActionButton from '@renderer\/components\/HotkeyActionButton';/u);
    assert.equal((production.match(/<HotkeyActionButton\b/gu) ?? []).length, 3);
    assert.equal((demo.match(/<HotkeyActionButton\b/gu) ?? []).length, 3);
    assert.doesNotMatch(demoStyles, /\bcommand-dock-hotkey-action\b/u);
    assert.match(styles, /background: #3a3d3f;/u);
    assert.match(styles, /inset 1px -3px 0 2px #292c2d,/u);
    assert.match(styles, /inset: var\(--hotkey-press-travel\) 1px 0;/u);
    assert.match(styles, /:disabled\[data-visual-state='disabled'\] \.command-dock-hotkey-action__face/u);
  });

  it('keeps registration truth separate from provider readiness without rendering it in the tooltip', () => {
    const component = readProjectFile('src/renderer/components/HotkeyActionButton.tsx');
    const integration = readProjectFile('src/renderer/useProviderHotkeyHomeIntegration.ts');

    assert.match(component, /getHotkeyActionButtonRegistrationPresentation/u);
    assert.match(component, /tooltip: actionLabel/u);
    assert.doesNotMatch(component, /getHotkey(?:Status|Authority|Failure)TranslationKey/u);
    assert.match(component, /disabled=\{unavailable\}/u);
    assert.match(integration, /prettify: hotkeyRuntimeState !== null/u);
    assert.match(integration, /translation: hotkeyRuntimeState !== null/u);
    assert.match(integration, /voice: hotkeyRuntimeState !== null/u);
    assert.doesNotMatch(integration, /DEFAULT_[A-Z_]+_HOTKEY/u);
  });
});
