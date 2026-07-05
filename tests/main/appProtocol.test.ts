import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAppUrl } from '@main/appProtocol';

describe('appProtocol', () => {
  it('builds the default app URL', () => {
    assert.equal(getAppUrl(), 'app://gpt-voice/index.html');
  });

  it('strips leading slashes from app URL paths', () => {
    assert.equal(getAppUrl('/settings.html'), 'app://gpt-voice/settings.html');
  });

  it('preserves nested app URL paths', () => {
    assert.equal(getAppUrl('assets/icon.png'), 'app://gpt-voice/assets/icon.png');
  });
});
