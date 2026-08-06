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
    assert.equal((windowSource.match(/backgroundColor: INITIAL_WINDOW_BACKGROUND_COLOR,/gu) || []).length, 5);
    assert.equal((windowSource.match(/show: true,/gu) || []).length, 5);
    assert.doesNotMatch(windowSource, /showWhenReady\(/u);
    assert.match(rendererTemplate, /background: #181a1b;/u);
    assert.match(rendererTemplate, /color-scheme: dark;/u);
    assert.match(rendererTemplate, /id="window-startup-loader"/u);
    assert.match(
      rendererTemplate,
      /#window-startup-spinner \{[\s\S]*?width: 48px;[\s\S]*?height: 48px;[\s\S]*?border: 4px solid #737679;/u,
    );
    assert.match(rendererTemplate, /cursor: progress;/u);
  });

  it('creates provider-bound resizable settings windows and includes them in trusted senders', () => {
    const windowSource = readFileSync(WINDOW_SOURCE_PATH, 'utf8');

    assert.match(windowSource, /providerSettingsWindowController\.getWindows\(\)/u);
    assert.match(windowSource, /getAppUrl\('provider-settings\.html'\)/u);
    assert.match(windowSource, /searchParams\.set\('providerId', providerId\)/u);
    assert.match(windowSource, /const PROVIDER_SETTINGS_CONTENT_WIDTH = 560;/u);
    assert.match(windowSource, /const PROVIDER_SETTINGS_CONTENT_HEIGHT = 680;/u);
    assert.match(windowSource, /const LOCAL_WHISPER_SETTINGS_CONTENT_WIDTH = 912;/u);
    assert.match(windowSource, /const LOCAL_WHISPER_SETTINGS_CONTENT_HEIGHT = 820;/u);
    assert.match(
      windowSource,
      /width: isLocalWhisperSettings \? LOCAL_WHISPER_SETTINGS_CONTENT_WIDTH : PROVIDER_SETTINGS_CONTENT_WIDTH,/u,
    );
    assert.match(
      windowSource,
      /height: isLocalWhisperSettings \? LOCAL_WHISPER_SETTINGS_CONTENT_HEIGHT : PROVIDER_SETTINGS_CONTENT_HEIGHT,/u,
    );
    assert.match(
      windowSource,
      /minWidth: PROVIDER_SETTINGS_MIN_WIDTH,[\s\S]*minHeight: PROVIDER_SETTINGS_MIN_HEIGHT,/u,
    );
    assert.match(windowSource, /resizable: true,/u);
  });
});
