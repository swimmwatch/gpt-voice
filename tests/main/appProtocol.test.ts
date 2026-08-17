import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { getAppProtocolContentType, getAppProtocolFilePath, getAppUrl } from '@main/appProtocol';
import { APP_ICON_ASSET_PATH } from '@shared/appAssets';

describe('appProtocol', () => {
  it('builds the default app URL', () => {
    assert.equal(getAppUrl(), 'app://gpt-voice/index.html');
  });

  it('strips leading slashes from app URL paths', () => {
    assert.equal(getAppUrl('/settings.html'), 'app://gpt-voice/settings.html');
  });

  it('preserves nested app URL paths', () => {
    assert.equal(getAppUrl(APP_ICON_ASSET_PATH), 'app://gpt-voice/assets/icon.png');
  });

  it('serves the app icon from the current app assets instead of a renderer-bundled copy', () => {
    const appRoot = path.resolve('app', 'dist');
    const appIconPath = path.resolve('app', 'resources', 'assets', 'icon.png');
    assert.equal(getAppProtocolFilePath(APP_ICON_ASSET_PATH, appRoot, appIconPath), appIconPath);
    assert.equal(getAppProtocolFilePath('renderer.js', appRoot, appIconPath), path.join(appRoot, 'renderer.js'));
  });

  it('recognizes nested renderer JavaScript and CSS chunks', () => {
    const appRoot = path.resolve('app', 'dist');
    const appIconPath = path.resolve('app', 'resources', 'assets', 'icon.png');
    const javaScriptPath = path.join(appRoot, 'renderer', 'main.123456.js');
    const stylePath = path.join(appRoot, 'renderer', 'main.123456.css');
    assert.equal(getAppProtocolFilePath('renderer/main.123456.js', appRoot, appIconPath), javaScriptPath);
    assert.equal(getAppProtocolContentType(javaScriptPath), 'text/javascript; charset=utf-8');
    assert.equal(getAppProtocolContentType(stylePath), 'text/css; charset=utf-8');
  });
});
