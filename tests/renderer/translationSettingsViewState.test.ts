import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createTranslationProviderCandidate,
  createTranslationSettingsCandidate,
  createTranslationSettingsViewState,
  doesTranslationConnectionMatchSettings,
  getSelectedTranslationTarget,
  reduceTranslationSettingsViewState,
  resolveTranslationSettingsSave,
} from '@renderer/translationSettingsViewState';
import type { TranslationSettings } from '@shared/translationProvider';
import {
  TRANSLATION_PROVIDER_CONNECTION_DETAILS,
  TRANSLATION_PROVIDER_CONNECTION_STATUSES,
} from '@shared/translationProvider';

function createSettings(): TranslationSettings {
  return {
    providerId: 'bing',
    targetLanguageByProvider: {
      google: 'ru',
      bing: 'uk',
      yandex: 'be',
    },
  };
}

describe('translation settings renderer state', () => {
  it('builds complete provider and target candidates without losing remembered targets', () => {
    const confirmed = createSettings();
    const providerCandidate = createTranslationProviderCandidate(confirmed, 'yandex');
    const targetCandidate = createTranslationSettingsCandidate(providerCandidate, 'en');

    assert.equal(getSelectedTranslationTarget(confirmed), 'uk');
    assert.deepEqual(providerCandidate, {
      providerId: 'yandex',
      targetLanguageByProvider: {
        google: 'ru',
        bing: 'uk',
        yandex: 'be',
      },
    });
    assert.deepEqual(targetCandidate, {
      providerId: 'yandex',
      targetLanguageByProvider: {
        google: 'ru',
        bing: 'uk',
        yandex: 'en',
      },
    });
    assert.deepEqual(confirmed, createSettings());
  });

  it('accepts only connection state for the current provider and target selection', () => {
    const settings = createSettings();

    assert.equal(
      doesTranslationConnectionMatchSettings(
        {
          detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready,
          providerId: 'bing',
          status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected,
          targetLanguage: 'uk',
        },
        settings,
      ),
      true,
    );
    assert.equal(
      doesTranslationConnectionMatchSettings(
        {
          detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready,
          providerId: 'google',
          status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected,
          targetLanguage: 'ru',
        },
        settings,
      ),
      false,
    );
  });

  it('shows one optimistic candidate and adopts only its authoritative success snapshot', () => {
    const confirmed = createSettings();
    const candidate = createTranslationProviderCandidate(confirmed, 'google');
    const authoritative: TranslationSettings = {
      providerId: 'google',
      targetLanguageByProvider: {
        google: 'en',
        bing: 'uk',
        yandex: 'be',
      },
    };
    const initial = createTranslationSettingsViewState(confirmed);
    const saving = reduceTranslationSettingsViewState(initial, {
      candidate,
      requestId: 7,
      type: 'save-started',
    });

    assert.equal(saving.settings, candidate);
    assert.equal(saving.confirmedSettings, confirmed);
    assert.equal(saving.pendingRequestId, 7);
    assert.equal(
      reduceTranslationSettingsViewState(saving, {
        candidate: createTranslationProviderCandidate(confirmed, 'yandex'),
        requestId: 8,
        type: 'save-started',
      }),
      saving,
    );

    const saved = reduceTranslationSettingsViewState(saving, {
      error: 'fallback',
      requestId: 7,
      result: { settings: authoritative, success: true },
      type: 'save-completed',
    });
    assert.deepEqual(saved, createTranslationSettingsViewState(authoritative));
  });

  it('rolls returned and thrown failures back to the last confirmed snapshot', () => {
    const confirmed = createSettings();
    const candidate = createTranslationProviderCandidate(confirmed, 'google');
    const saving = reduceTranslationSettingsViewState(createTranslationSettingsViewState(confirmed), {
      candidate,
      requestId: 3,
      type: 'save-started',
    });

    const rejected = reduceTranslationSettingsViewState(saving, {
      error: 'fallback',
      requestId: 3,
      result: {
        error: 'safe localized error',
        settings: candidate,
        success: false,
      },
      type: 'save-completed',
    });
    assert.equal(rejected.settings, confirmed);
    assert.equal(rejected.confirmedSettings, confirmed);
    assert.equal(rejected.error, 'safe localized error');
    assert.equal(rejected.pendingRequestId, null);

    const thrown = reduceTranslationSettingsViewState(saving, {
      error: 'localized fallback',
      requestId: 3,
      type: 'save-failed',
    });
    assert.equal(thrown.settings, confirmed);
    assert.equal(thrown.error, 'localized fallback');
    assert.equal(thrown.pendingRequestId, null);
  });

  it('ignores stale completions and still supports the compatibility save resolver', () => {
    const confirmed = createSettings();
    const candidate = createTranslationProviderCandidate(confirmed, 'google');
    const saving = reduceTranslationSettingsViewState(createTranslationSettingsViewState(confirmed), {
      candidate,
      requestId: 11,
      type: 'save-started',
    });
    const stale = reduceTranslationSettingsViewState(saving, {
      error: 'stale error',
      requestId: 10,
      result: { settings: candidate, success: true },
      type: 'save-completed',
    });

    assert.equal(stale, saving);
    assert.equal(resolveTranslationSettingsSave(confirmed, { settings: candidate, success: true }), candidate);
    assert.equal(
      resolveTranslationSettingsSave(confirmed, {
        error: 'safe localized error',
        settings: candidate,
        success: false,
      }),
      confirmed,
    );
  });
});
