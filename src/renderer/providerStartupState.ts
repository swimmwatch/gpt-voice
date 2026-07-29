import {
  TRANSLATION_PROVIDER_CONNECTION_DETAILS,
  TRANSLATION_PROVIDER_CONNECTION_STATUSES,
  type TranslationProviderConnectionState,
} from '@shared/translationProvider';

export interface InitialProviderStartupState {
  readonly prettifyPending: boolean;
  readonly translationConnection: TranslationProviderConnectionState | null;
  readonly translationSettingsPending: boolean;
  readonly voicePending: boolean;
}

export const FAILED_INITIAL_TRANSLATION_CONNECTION_STATE: TranslationProviderConnectionState = Object.freeze({
  detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.UnexpectedFailure,
  providerId: null,
  status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
  targetLanguage: null,
});

export function isTranslationProviderInitializationPending(state: TranslationProviderConnectionState | null): boolean {
  return (
    state === null ||
    state.status === TRANSLATION_PROVIDER_CONNECTION_STATUSES.Checking ||
    state.detail === TRANSLATION_PROVIDER_CONNECTION_DETAILS.NotStarted
  );
}

export function isInitialProviderStartupPending(state: InitialProviderStartupState): boolean {
  return (
    state.voicePending ||
    state.prettifyPending ||
    state.translationSettingsPending ||
    isTranslationProviderInitializationPending(state.translationConnection)
  );
}
