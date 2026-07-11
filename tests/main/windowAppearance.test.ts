import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const WINDOW_SOURCE_PATH = path.join(PROJECT_ROOT, 'src/main/window.ts');
const RENDERER_TEMPLATE_PATH = path.join(PROJECT_ROOT, 'src/renderer/index.html');

describe('window appearance', () => {
  it('shows every renderer window immediately with a graphite startup shell', () => {
    const windowSource = readFileSync(WINDOW_SOURCE_PATH, 'utf8');
    const rendererTemplate = readFileSync(RENDERER_TEMPLATE_PATH, 'utf8');

    assert.match(windowSource, /const INITIAL_WINDOW_BACKGROUND_COLOR = '#181a1b';/u);
    assert.equal((windowSource.match(/backgroundColor: INITIAL_WINDOW_BACKGROUND_COLOR,/gu) || []).length, 4);
    assert.equal((windowSource.match(/show: true,/gu) || []).length, 4);
    assert.doesNotMatch(windowSource, /showWhenReady\(/u);
    assert.match(rendererTemplate, /background: #181a1b;/u);
    assert.match(rendererTemplate, /color-scheme: dark;/u);
    assert.match(rendererTemplate, /id="window-startup-loader"/u);
    assert.match(rendererTemplate, /cursor: progress;/u);
  });
});
