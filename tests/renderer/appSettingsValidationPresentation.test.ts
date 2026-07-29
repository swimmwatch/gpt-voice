import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { I18nService } from '@main/i18n';
import { APP_SETTINGS_VALIDATION_ERROR_CODES, createAppSettingsValidationError } from '@renderer/appSettingsUtils';
import { presentAppSettingsValidationError } from '@renderer/appSettingsValidationPresentation';

const localization = new I18nService();

describe('App Settings validation presentation', () => {
  it('presents every typed validation error in every supported locale', () => {
    for (const locale of localization.getSupportedLocales()) {
      localization.setLocale(locale);
      for (const code of APP_SETTINGS_VALIDATION_ERROR_CODES) {
        const message = presentAppSettingsValidationError(
          createAppSettingsValidationError(code, { max: '600', min: '15' }),
          localization.translate,
        );
        assert.ok(message?.trim(), `${locale}:${code}`);
        assert.equal(message?.includes('appSettings.validation.'), false, `${locale}:${code}`);
      }
    }
    localization.setLocale('en');
  });

  it('renders range parameters at presentation time', () => {
    localization.setLocale('en');
    assert.equal(
      presentAppSettingsValidationError(
        createAppSettingsValidationError('prettify-cli-timeout-range', { min: '15', max: '600' }),
        localization.translate,
      ),
      'Timeout must be an integer between 15 and 600 seconds.',
    );
  });
});
