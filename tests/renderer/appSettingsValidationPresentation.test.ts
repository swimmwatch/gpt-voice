import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getSupportedLocales, setLocale, t } from '@main/i18n';
import { APP_SETTINGS_VALIDATION_ERROR_CODES, createAppSettingsValidationError } from '@renderer/appSettingsUtils';
import { presentAppSettingsValidationError } from '@renderer/appSettingsValidationPresentation';

describe('App Settings validation presentation', () => {
  it('presents every typed validation error in every supported locale', () => {
    for (const locale of getSupportedLocales()) {
      setLocale(locale);
      for (const code of APP_SETTINGS_VALIDATION_ERROR_CODES) {
        const message = presentAppSettingsValidationError(
          createAppSettingsValidationError(code, { max: '600', min: '15' }),
          t,
        );
        assert.ok(message?.trim(), `${locale}:${code}`);
        assert.equal(message?.includes('appSettings.validation.'), false, `${locale}:${code}`);
      }
    }
    setLocale('en');
  });

  it('renders range parameters at presentation time', () => {
    setLocale('en');
    assert.equal(
      presentAppSettingsValidationError(
        createAppSettingsValidationError('prettify-cli-timeout-range', { min: '15', max: '600' }),
        t,
      ),
      'Timeout must be an integer between 15 and 600 seconds.',
    );
  });
});
