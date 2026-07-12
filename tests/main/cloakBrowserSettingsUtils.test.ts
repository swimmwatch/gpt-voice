import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCloakBrowserSettingsView,
  getCloakBrowserSettingsInputError,
  getSystemTimezone,
  normalizeCloakBrowserSettingsInput,
} from '@main/cloakBrowserSettingsUtils';
import { shouldWarnSocks5ProxyAuth } from '@shared/cloakBrowserSettings';

describe('cloakBrowserSettingsUtils', () => {
  it('normalizes default CloakBrowser settings', () => {
    const settings = normalizeCloakBrowserSettingsInput({}, '12345');

    assert.equal(settings.humanize, true);
    assert.equal(settings.humanPreset, 'careful');
    assert.equal(settings.backgroundMode, 'hidden');
    assert.equal(settings.fingerprintSeed, '12345');
    assert.equal(settings.locale, 'en-US');
    assert.equal(settings.timezone, getSystemTimezone());
    assert.deepEqual(settings.proxy, {
      enabled: false,
      server: '',
      bypass: '',
      username: '',
      geoip: false,
    });
  });

  it('trims and preserves valid proxy settings', () => {
    const settings = normalizeCloakBrowserSettingsInput(
      {
        proxy: {
          enabled: true,
          server: '  socks5://127.0.0.1:1080  ',
          bypass: '  .example.com  ',
          username: '  user  ',
          geoip: true,
        },
      },
      '12345',
    );

    assert.deepEqual(settings.proxy, {
      enabled: true,
      server: 'socks5://127.0.0.1:1080',
      bypass: '.example.com',
      username: 'user',
      geoip: true,
    });
  });

  it('rejects invalid fingerprint seeds', () => {
    assert.throws(() => normalizeCloakBrowserSettingsInput({ fingerprintSeed: 'abc123' }, '12345'), /digits only/);
  });

  it('sanitizes invalid persisted fingerprint seeds when requested', () => {
    const settings = normalizeCloakBrowserSettingsInput({ fingerprintSeed: 'legacy-value' }, '12345', {
      sanitizeInvalidFingerprintSeed: true,
    });

    assert.equal(settings.fingerprintSeed, '12345');
  });

  it('regenerates invalid fallback fingerprint seeds', () => {
    const settings = normalizeCloakBrowserSettingsInput({}, 'legacy-value');

    assert.match(settings.fingerprintSeed, /^\d+$/);
  });

  it('rejects invalid locale and timezone values', () => {
    assert.throws(() => normalizeCloakBrowserSettingsInput({ locale: 'not a locale' }, '12345'), /BCP 47/);
    assert.throws(() => normalizeCloakBrowserSettingsInput({ timezone: 'Mars/Olympus' }, '12345'), /IANA/);
  });

  it('rejects enabled proxies without a valid safe server URL', () => {
    assert.throws(
      () => normalizeCloakBrowserSettingsInput({ proxy: { enabled: true } }, '12345'),
      /Proxy server is required/,
    );
    assert.throws(
      () =>
        normalizeCloakBrowserSettingsInput({ proxy: { enabled: true, server: 'ftp://proxy.example.com' } }, '12345'),
      /http, https, or socks5/,
    );
    assert.throws(
      () =>
        normalizeCloakBrowserSettingsInput(
          { proxy: { enabled: true, server: 'http://user:pass@proxy.example.com' } },
          '12345',
        ),
      /credentials/,
    );
  });

  it('allows disabled proxies to keep incomplete server values', () => {
    const settings = normalizeCloakBrowserSettingsInput(
      { proxy: { enabled: false, server: 'not a complete url' } },
      '12345',
    );

    assert.equal(settings.proxy.enabled, false);
    assert.equal(settings.proxy.server, 'not a complete url');
  });

  it('creates renderer-safe views without exposing proxy passwords', () => {
    const settings = normalizeCloakBrowserSettingsInput(
      { proxy: { enabled: true, server: 'http://proxy:8080' } },
      '12345',
    );
    const view = createCloakBrowserSettingsView(settings, true);

    assert.equal(view.proxy.hasPassword, true);
    assert.equal('password' in view.proxy, false);
  });

  it('warns when SOCKS5 proxy auth is configured', () => {
    assert.equal(shouldWarnSocks5ProxyAuth({ enabled: true, server: 'socks5://proxy:1080', username: 'user' }), true);
    assert.equal(shouldWarnSocks5ProxyAuth({ enabled: true, server: 'socks5://proxy:1080', hasPassword: true }), true);
    assert.equal(
      shouldWarnSocks5ProxyAuth({
        enabled: true,
        server: 'socks5://proxy:1080',
        hasPassword: true,
        clearPassword: true,
      }),
      false,
    );
    assert.equal(shouldWarnSocks5ProxyAuth({ enabled: true, server: 'http://proxy:8080', username: 'user' }), false);
  });

  it('rejects malformed write payloads while keeping read normalization available for legacy data', () => {
    assert.equal(getCloakBrowserSettingsInputError('invalid'), 'CloakBrowser settings must be an object');
    assert.equal(getCloakBrowserSettingsInputError({ humanize: 'yes' }), 'Humanize must be a boolean');
    assert.equal(getCloakBrowserSettingsInputError({ humanPreset: 'fast' }), 'Select a supported human preset');
    assert.equal(
      getCloakBrowserSettingsInputError({ fingerprintSeed: 'not-a-seed' }),
      'Fingerprint seed must contain digits only',
    );
    assert.equal(getCloakBrowserSettingsInputError({ proxy: [] }), 'Proxy settings must be an object');
    assert.equal(
      getCloakBrowserSettingsInputError({ proxy: { clearPassword: 'yes' } }),
      'Proxy password clear flag must be a boolean',
    );
  });
});
