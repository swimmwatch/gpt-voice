import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('provider hotkey browser demo', () => {
  it('uses the production home composition with the fixed 620 by 292 viewport fixture', () => {
    const demo = readProjectFile('src/renderer/ProviderHotkeyDemo.tsx');
    const styles = readProjectFile('src/renderer/styles/providerHotkeyDemo.css');

    assert.match(demo, /<MainToolbar\b/u);
    assert.match(demo, /<MainPrettifyProviderBand\b/u);
    assert.match(demo, /<TranslateSection\b/u);
    assert.match(demo, /<RecordingControls\b/u);
    assert.match(demo, /<HotkeyActionButton\b/u);
    assert.match(demo, /data-demo="provider-hotkeys"/u);
    assert.match(demo, /data-fixture=\{fixtureId\}/u);
    assert.match(styles, /width: 620px;/u);
    assert.match(styles, /height: 292px;/u);
    assert.match(styles, /overflow: hidden;/u);
    assert.doesNotMatch(styles, /command-dock-hotkey-action__(?:face|bevel|shadow|legend)/u);
    assert.doesNotMatch(styles, /command-dock-hotkey-action:(?:active|hover)/u);
  });

  it('uses deterministic provider data, all review fixtures, and a controlled local clock', () => {
    const demo = readProjectFile('src/renderer/ProviderHotkeyDemo.tsx');
    const recordingControls = readProjectFile('src/renderer/components/RecordingControls.tsx');

    assert.match(demo, /voice: 'F9'/u);
    assert.match(demo, /prettify: 'Ctrl \+ Shift \+ F12'/u);
    assert.match(demo, /translation: 'Ctrl \+ F11'/u);
    assert.match(demo, /stop: 'F10'/u);
    assert.match(demo, /cancel: 'Esc'/u);
    assert.match(demo, /name: 'Local Whisper'/u);
    assert.match(demo, /model: 'gpt-5\.6-luna'/u);
    assert.match(demo, /providerId: 'google'/u);
    assert.match(demo, /targetLanguage: 'en'/u);
    assert.match(demo, /id: 'idle'/u);
    assert.match(demo, /id: 'starting'/u);
    assert.match(demo, /id: 'recording'/u);
    assert.match(demo, /id: 'paused'/u);
    assert.match(demo, /id: 'stopping'/u);
    assert.match(demo, /id: 'transcribing'/u);
    assert.match(demo, /id: 'retrying'/u);
    assert.match(demo, /id: 'prettify'/u);
    assert.match(demo, /id: 'translation'/u);
    assert.match(demo, /id: 'unknown-owner'/u);
    assert.match(demo, /id: 'priority-status'/u);
    assert.match(demo, /const \[transientLockedOwner, setTransientLockedOwner\]/u);
    assert.match(demo, /transientLockedOwner !== null/u);
    assert.match(demo, /fixture\.activeOwner !== null && fixture\.activeOwner !== owner/u);
    assert.match(demo, /locked=\{isLocked\('voice'\)\}/u);
    assert.match(demo, /locked=\{isLocked\('prettify'\)\}/u);
    assert.match(demo, /locked=\{isLocked\('translation'\)\}/u);
    assert.match(demo, /callbacksRef\.current\.forEach\(\(callback\) => callback\(\)\)/u);
    assert.match(demo, /elapsedClock=\{clock\}/u);
    assert.match(recordingControls, /readonly elapsedClock\?: CapturedAudioClock;/u);
    assert.match(recordingControls, /useCapturedAudioElapsedTime\(state, elapsedClock\)/u);
  });

  it('renders the exact available-only contextual action matrix without byte placeholders', () => {
    const demo = readProjectFile('src/renderer/ProviderHotkeyDemo.tsx');

    assert.match(demo, /case 'starting':[\s\S]*?createContextualAction\('cancel', 'voice'/u);
    assert.match(demo, /case 'recording':[\s\S]*?'pause'[\s\S]*?'stop'[\s\S]*?'cancel'/u);
    assert.match(demo, /case 'paused':[\s\S]*?'resume'[\s\S]*?'stop'[\s\S]*?'cancel'/u);
    assert.match(
      demo,
      /case 'transcribing':[\s\S]*?case 'retrying':[\s\S]*?createContextualAction\('cancel', 'voice'/u,
    );
    assert.match(demo, /case 'prettify':[\s\S]*?createContextualAction\('cancel', 'prettify'/u);
    assert.match(demo, /case 'translation':[\s\S]*?createContextualAction\('cancel', 'translation'/u);
    assert.match(demo, /case 'stopping':[\s\S]*?return \[\];/u);
    assert.match(demo, /case 'priority-status':[\s\S]*?status: translatedStatus\('status\.copiedToClipboard'\)/u);
    assert.doesNotMatch(demo, /(?:megabytes|\bMB\b|\bbytes\b|data-slot="[^"]*byte)/iu);
  });

  it('uses no desktop, browser, provider, persistence, or network capability in the fixture', () => {
    const demo = readProjectFile('src/renderer/ProviderHotkeyDemo.tsx');
    const entry = readProjectFile('src/renderer/entries/providerHotkeyDemo.tsx');

    assert.doesNotMatch(
      demo,
      /electronAPI|useDesktopApi|fetch\(|XMLHttpRequest|navigator\.media|clipboard|localStorage|sessionStorage|WebSocket|Notification/u,
    );
    assert.doesNotMatch(entry, /<DesktopApiProvider\b|ElectronAPI|inertDesktopApi|window\.electronAPI/u);
    assert.match(entry, /SelectOpenCoordinatorProvider/u);
    assert.match(entry, /document\.body\.dataset\.providerHotkeyDemo = 'true'/u);
  });

  it('keeps fixture controls isolated and keyboard-accessible without changing the default review surface', () => {
    const demo = readProjectFile('src/renderer/ProviderHotkeyDemo.tsx');
    const styles = readProjectFile('src/renderer/styles/providerHotkeyDemo.css');

    assert.match(demo, /aria-label=\{t\('providerHotkeyDemo\.fixtureControls'\)\}/u);
    assert.match(demo, /aria-label=\{t\('providerHotkeyDemo\.fixture'\)\}/u);
    assert.match(demo, /name="fixture"/u);
    assert.match(demo, /t\('providerHotkeyDemo\.advanceClock'\)/u);
    assert.match(demo, /t\('providerHotkeyDemo\.clearLock'\)/u);
    assert.match(styles, /\.provider-hotkey-demo-controls \{/u);
    assert.match(styles, /\.provider-hotkey-demo-controls:focus-within \{/u);
    assert.match(styles, /clip-path: inset\(50%\);/u);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/u);
  });
});
