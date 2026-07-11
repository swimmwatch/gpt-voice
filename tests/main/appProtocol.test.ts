import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
    assert.equal(
      getAppProtocolFilePath(APP_ICON_ASSET_PATH, '/app/dist', '/app/resources/assets/icon.png'),
      '/app/resources/assets/icon.png',
    );
    assert.equal(
      getAppProtocolFilePath('renderer.js', '/app/dist', '/app/resources/assets/icon.png'),
      '/app/dist/renderer.js',
    );
  });

  it('recognizes nested renderer JavaScript chunks', () => {
    assert.equal(
      getAppProtocolFilePath('assets/main.123456.js', '/app/dist', '/app/resources/assets/icon.png'),
      '/app/dist/assets/main.123456.js',
    );
    assert.equal(getAppProtocolContentType('/app/dist/assets/main.123456.js'), 'text/javascript; charset=utf-8');
  });
});
