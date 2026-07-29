import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FAILED_INITIAL_TRANSLATION_CONNECTION_STATE,
  isInitialProviderStartupPending,
  isTranslationProviderInitializationPending,
} from '@renderer/providerStartupState';
import {
  INITIAL_TRANSLATION_PROVIDER_CONNECTION_STATE,
  TRANSLATION_PROVIDER_CONNECTION_DETAILS,
  TRANSLATION_PROVIDER_CONNECTION_STATUSES,
  type TranslationProviderConnectionState,
} from '@shared/translationProvider';

const CONNECTED_TRANSLATION_STATE: TranslationProviderConnectionState = Object.freeze({
  detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready,
  providerId: 'google',
  status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected,
  targetLanguage: 'uk',
});

describe('initial provider startup state', () => {
  it('keeps Translation pending until initialization reaches a terminal state', () => {
    assert.equal(isTranslationProviderInitializationPending(null), true);
    assert.equal(isTranslationProviderInitializationPending(INITIAL_TRANSLATION_PROVIDER_CONNECTION_STATE), true);
    assert.equal(
      isTranslationProviderInitializationPending({
        detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.OpeningProvider,
        providerId: 'google',
        status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Checking,
        targetLanguage: 'uk',
      }),
      true,
    );
    assert.equal(isTranslationProviderInitializationPending(CONNECTED_TRANSLATION_STATE), false);
    assert.equal(isTranslationProviderInitializationPending(FAILED_INITIAL_TRANSLATION_CONNECTION_STATE), false);
  });

  it('waits for Voice, Prettify, and Translation together', () => {
    assert.equal(
      isInitialProviderStartupPending({
        prettifyPending: true,
        translationConnection: CONNECTED_TRANSLATION_STATE,
        translationSettingsPending: false,
        voicePending: false,
      }),
      true,
    );
    assert.equal(
      isInitialProviderStartupPending({
        prettifyPending: false,
        translationConnection: null,
        translationSettingsPending: false,
        voicePending: false,
      }),
      true,
    );
    assert.equal(
      isInitialProviderStartupPending({
        prettifyPending: false,
        translationConnection: CONNECTED_TRANSLATION_STATE,
        translationSettingsPending: false,
        voicePending: true,
      }),
      true,
    );
    assert.equal(
      isInitialProviderStartupPending({
        prettifyPending: false,
        translationConnection: CONNECTED_TRANSLATION_STATE,
        translationSettingsPending: true,
        voicePending: false,
      }),
      true,
    );
    assert.equal(
      isInitialProviderStartupPending({
        prettifyPending: false,
        translationConnection: CONNECTED_TRANSLATION_STATE,
        translationSettingsPending: false,
        voicePending: false,
      }),
      false,
    );
  });
});
