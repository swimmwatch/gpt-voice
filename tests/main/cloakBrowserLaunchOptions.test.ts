import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCloakBrowserContextOptions } from '@main/cloakBrowserLaunchOptions';
import type { CloakBrowserSettingsWithSecret } from '@main/cloakBrowserSettings';

const baseSettings: CloakBrowserSettingsWithSecret = {
  humanize: true,
  humanPreset: 'careful',
  backgroundMode: 'hidden',
  fingerprintSeed: '12345',
  locale: 'en-US',
  timezone: 'Europe/Moscow',
  proxy: {
    enabled: false,
    server: '',
    bypass: '',
    username: '',
    geoip: false,
    password: '',
  },
};

describe('cloakBrowserLaunchOptions', () => {
  it('builds hidden humanized background context options by default', () => {
    const options = buildCloakBrowserContextOptions(baseSettings, 'background');

    assert.equal(options.headless, true);
    assert.equal(options.humanize, true);
    assert.equal(options.humanPreset, 'careful');
    assert.deepEqual(options.args, ['--fingerprint=12345']);
    assert.equal(options.locale, 'en-US');
    assert.equal(options.timezone, 'Europe/Moscow');
    assert.equal('userAgent' in options, false);
  });

  it('keeps login contexts visible regardless of background mode', () => {
    const options = buildCloakBrowserContextOptions({ ...baseSettings, backgroundMode: 'visible' }, 'login');

    assert.equal(options.headless, false);
  });

  it('allows visible background contexts by explicit opt-in', () => {
    const options = buildCloakBrowserContextOptions({ ...baseSettings, backgroundMode: 'visible' }, 'background');

    assert.equal(options.headless, false);
  });

  it('passes proxy credentials separately and lets GeoIP own locale and timezone', () => {
    const options = buildCloakBrowserContextOptions(
      {
        ...baseSettings,
        proxy: {
          enabled: true,
          server: 'socks5://proxy.example.com:1080',
          bypass: '.example.com',
          username: 'user',
          password: 'secret',
          geoip: true,
        },
      },
      'background',
    );

    assert.deepEqual(options.proxy, {
      server: 'socks5://proxy.example.com:1080',
      bypass: '.example.com',
      username: 'user',
      password: 'secret',
    });
    assert.equal(options.geoip, true);
    assert.equal('locale' in options, false);
    assert.equal('timezone' in options, false);
  });
});
