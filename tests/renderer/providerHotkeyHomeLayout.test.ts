import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

function getCssRule(styles: string, selector: string): string {
  const start = styles.lastIndexOf(`${selector} {`);
  const end = styles.indexOf('\n}', start);
  return start < 0 || end < 0 ? '' : styles.slice(start, end + 2);
}

describe('provider hotkey home layout', () => {
  it('uses the exact 620 by 292 non-resizable main-window content contract', () => {
    const windowSource = readProjectFile('src/main/window.ts');

    assert.match(windowSource, /MAIN_WINDOW_CONTENT_WIDTH = 620/u);
    assert.match(windowSource, /MAIN_WINDOW_CONTENT_HEIGHT = 292/u);
    assert.match(windowSource, /useContentSize: true/u);
    assert.match(windowSource, /resizable: false/u);
    assert.match(windowSource, /PROVIDER_SETTINGS_CONTENT_WIDTH = 560/u);
    assert.match(windowSource, /LOCAL_WHISPER_SETTINGS_CONTENT_WIDTH = 912/u);
  });

  it('fills the compact content box with the prescribed rows and borders without a scroll dock', () => {
    const styles = readProjectFile('src/renderer/styles/globals.css');
    const dock = getCssRule(styles, '.command-dock');
    const toolbar = getCssRule(styles, '.command-dock-toolbar');
    const prettify = getCssRule(styles, '.command-dock-prettify-band');
    const translation = getCssRule(styles, '.command-dock-language-band');
    const footer = getCssRule(styles, '.command-dock-status-band');

    assert.match(dock, /display: grid;/u);
    assert.match(dock, /grid-template-rows: 117px 60px 60px 54px;/u);
    assert.match(dock, /height: 100%;/u);
    assert.match(dock, /overflow: hidden;/u);
    assert.match(dock, /border-width: 1px 1px 0;/u);
    assert.doesNotMatch(dock, /overflow-y: auto|flex-direction|min-height: 420px/u);
    assert.match(toolbar, /height: 117px;/u);
    assert.match(toolbar, /grid-template-rows: 60px 57px;/u);
    assert.match(prettify, /height: 60px;/u);
    assert.match(translation, /height: 60px;/u);
    assert.match(footer, /height: 54px;/u);
    assert.match(
      styles,
      /\.command-dock-header-band,[\s\S]*?\.command-dock-status-band \{[\s\S]*?border-bottom: 1px solid var\(--dock-border\);/u,
    );
  });

  it('puts every unchanged 114 by 32 provider key in one shared action column before stable controls', () => {
    const styles = readProjectFile('src/renderer/styles/globals.css');
    const hotkeyStyles = readProjectFile('src/renderer/styles/hotkeyActionButton.css');

    assert.match(styles, /--dock-action-key-width: 114px;/u);
    for (const selector of [
      '.command-dock-provider-band > .command-dock-hotkey-action',
      '.command-dock-prettify-layout > .command-dock-hotkey-action',
      '.command-dock-language-band > .command-dock-hotkey-action',
    ]) {
      const rule = getCssRule(styles, selector);
      assert.match(rule, /grid-column: 4;/u, selector);
      assert.match(rule, /grid-row: 1;/u, selector);
      assert.match(rule, /justify-self: start;/u, selector);
    }
    assert.match(
      styles,
      /\.command-dock-provider-band \{[\s\S]*?22px 147px minmax\(0, 1fr\)[\s\S]*?var\(--dock-action-key-width\) var\(--dock-provider-controls-width\);/u,
    );
    assert.match(
      styles,
      /\.command-dock-prettify-layout \{[\s\S]*?22px 147px minmax\(0, 1fr\)[\s\S]*?var\(--dock-action-key-width\) var\(--dock-provider-controls-width\);/u,
    );
    assert.match(
      styles,
      /\.command-dock-language-band \{[\s\S]*?22px 147px minmax\(0, 1fr\)[\s\S]*?var\(--dock-action-key-width\) var\(--dock-provider-controls-width\);/u,
    );
    assert.match(hotkeyStyles, /width: var\(--dock-action-key-width, 114px\);/u);
    assert.match(hotkeyStyles, /height: 32px;/u);
  });

  it('bounds status detail and at most three action tiles in the fixed footer without byte placeholders', () => {
    const controls = readProjectFile('src/renderer/components/RecordingControls.tsx');
    const styles = readProjectFile('src/renderer/styles/globals.css');
    const footer = getCssRule(styles, '.command-dock-status-band');
    const detail = getCssRule(styles, '.command-dock-status-detail');

    assert.match(footer, /grid-template-columns: max-content minmax\(0, 1fr\) max-content;/u);
    assert.match(detail, /overflow: hidden;/u);
    assert.match(detail, /text-overflow: ellipsis;/u);
    assert.match(detail, /white-space: nowrap;/u);
    assert.match(controls, /contextualActions\.map/u);
    assert.doesNotMatch(controls, /(?:megabytes|MB|bytes)/iu);
    assert.doesNotMatch(controls, /placeholder/u);
  });

  it('keeps the compact startup screen complete, including visible Retry', () => {
    const loadingScreen = readProjectFile('src/renderer/components/LoadingScreen.tsx');

    assert.match(loadingScreen, /max-w-\[592px\]/u);
    assert.match(loadingScreen, /grid-cols-4 gap-2/u);
    assert.match(loadingScreen, /data-slot="startup-status"/u);
    assert.match(loadingScreen, /data-slot="startup-progress"/u);
    assert.match(loadingScreen, /onClick=\{onRetry\}/u);
    assert.match(loadingScreen, /disabled=\{isRetryPending\}/u);
  });
});
