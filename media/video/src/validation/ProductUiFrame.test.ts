import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const videoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const productUiFrame = fs.readFileSync(path.join(videoRoot, 'src/product-ui/ProductUiFrame.tsx'), 'utf8');
const productUiCss = fs.readFileSync(path.join(videoRoot, 'src/product-ui/product-ui.css'), 'utf8');

test('ProductUiFrame keeps the canonical Command Dock slot structure', () => {
  for (const component of [
    'MainToolbar',
    'PrettifyModelMemoryRow',
    'RecordingControls',
    'TranslateSection',
    'ProviderSettingsModalView',
  ]) {
    assert.match(productUiFrame, new RegExp(`<${component}`));
  }
  assert.match(productUiFrame, /data-slot="product-ui-frame"/);
});

test('ProductUiFrame uses inert callbacks and disables ambient interaction and motion', () => {
  assert.match(productUiFrame, /const inertCallback = \(\): void => undefined/);
  assert.doesNotMatch(productUiFrame, /window\.electronAPI|navigator\.|fetch\s*\(/);
  assert.match(productUiCss, /pointer-events: none/);
  assert.match(productUiCss, /animation: none !important/);
  assert.match(productUiCss, /transition: none !important/);
  assert.match(productUiCss, /--video-spinner-rotation/);
});

test('ProductUiFrame prevents an auto-focused tooltip from appearing in the recorded provider dialog', () => {
  assert.match(productUiFrame, /showCloseTooltip=\{false\}/);
});
