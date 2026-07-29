import type {
  TranslationProviderId,
  TranslationSettings,
  TranslationSettingsSaveResult,
} from '@shared/translationProvider';

export interface TranslationSettingsViewState {
  readonly confirmedSettings: TranslationSettings;
  readonly error: string;
  readonly pendingRequestId: number | null;
  readonly settings: TranslationSettings;
}

export type TranslationSettingsViewAction =
  | {
      readonly type: 'snapshot';
      readonly settings: TranslationSettings;
    }
  | {
      readonly type: 'save-started';
      readonly candidate: TranslationSettings;
      readonly requestId: number;
    }
  | {
      readonly type: 'save-completed';
      readonly error: string;
      readonly requestId: number;
      readonly result: TranslationSettingsSaveResult;
    }
  | {
      readonly type: 'save-failed';
      readonly error: string;
      readonly requestId: number;
    };

export function getSelectedTranslationTarget(settings: TranslationSettings): string {
  return settings.targetLanguageByProvider[settings.providerId];
}

export function createTranslationSettingsCandidate(
  settings: TranslationSettings,
  targetLanguage: string,
): TranslationSettings {
  return {
    providerId: settings.providerId,
    targetLanguageByProvider: {
      ...settings.targetLanguageByProvider,
      [settings.providerId]: targetLanguage,
    },
  };
}

export function createTranslationProviderCandidate(
  settings: TranslationSettings,
  providerId: TranslationProviderId,
): TranslationSettings {
  return {
    providerId,
    targetLanguageByProvider: {
      ...settings.targetLanguageByProvider,
    },
  };
}

export function resolveTranslationSettingsSave(
  confirmed: TranslationSettings,
  result: TranslationSettingsSaveResult,
): TranslationSettings {
  return result.success ? result.settings : confirmed;
}

export function createTranslationSettingsViewState(settings: TranslationSettings): TranslationSettingsViewState {
  return {
    confirmedSettings: settings,
    error: '',
    pendingRequestId: null,
    settings,
  };
}

/** Keeps optimistic controls and the last authoritative settings snapshot in one pure state machine. */
export function reduceTranslationSettingsViewState(
  state: TranslationSettingsViewState,
  action: TranslationSettingsViewAction,
): TranslationSettingsViewState {
  switch (action.type) {
    case 'snapshot':
      return createTranslationSettingsViewState(action.settings);
    case 'save-started':
      if (state.pendingRequestId !== null) return state;
      return {
        ...state,
        error: '',
        pendingRequestId: action.requestId,
        settings: action.candidate,
      };
    case 'save-completed':
      if (state.pendingRequestId !== action.requestId) return state;
      if (!action.result.success) {
        return {
          ...state,
          error: action.result.error || action.error,
          pendingRequestId: null,
          settings: state.confirmedSettings,
        };
      }
      return createTranslationSettingsViewState(action.result.settings);
    case 'save-failed':
      if (state.pendingRequestId !== action.requestId) return state;
      return {
        ...state,
        error: action.error,
        pendingRequestId: null,
        settings: state.confirmedSettings,
      };
  }
}
