import type { PrettifyProfileId, PrettifyProfileKind } from './prettifyProfiles';
import type { AppLocaleId } from './appLocale';

declare const PRETTIFY_PROFILE_CHOOSER_OPERATION_TOKEN: unique symbol;

export type PrettifyProfileChooserOperationToken = string & {
  readonly [PRETTIFY_PROFILE_CHOOSER_OPERATION_TOKEN]: true;
};

export const PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS = Object.freeze({
  apply: 'prettify-profile-chooser:apply',
  cancel: 'prettify-profile-chooser:cancel',
  getLocale: 'prettify-profile-chooser:get-locale',
  getTranslations: 'prettify-profile-chooser:get-translations',
  load: 'prettify-profile-chooser:load',
  localeChanged: 'prettify-profile-chooser:locale-changed',
  manageProfiles: 'prettify-profile-chooser:manage-profiles',
  ready: 'prettify-profile-chooser:ready',
} as const);

export interface PrettifyProfileChooserProfileSummary {
  readonly description?: string;
  readonly id: PrettifyProfileId;
  readonly isDefault: boolean;
  readonly kind: PrettifyProfileKind;
  readonly name: string;
}

export interface PrettifyProfileChooserRequest {
  readonly profiles: readonly PrettifyProfileChooserProfileSummary[];
  readonly sourceText: string;
}

export interface PrettifyProfileChooserPayload extends PrettifyProfileChooserRequest {
  readonly token: PrettifyProfileChooserOperationToken;
}

export type PrettifyProfileChooserOutcome =
  | { readonly type: 'apply'; readonly profileId: PrettifyProfileId }
  | { readonly type: 'cancel' }
  | { readonly type: 'close' }
  | { readonly type: 'manageProfiles' };

export interface PrettifyProfileChooserAPI {
  readonly apply: (token: PrettifyProfileChooserOperationToken, profileId: PrettifyProfileId) => Promise<void>;
  readonly cancel: (token: PrettifyProfileChooserOperationToken) => Promise<void>;
  readonly getLocale: () => Promise<AppLocaleId>;
  readonly getTranslations: () => Promise<Record<string, string>>;
  readonly loadPayload: () => Promise<PrettifyProfileChooserPayload>;
  readonly manageProfiles: (token: PrettifyProfileChooserOperationToken) => Promise<void>;
  readonly onLocaleChanged: (callback: (locale: AppLocaleId) => void) => () => void;
  readonly ready: (token: PrettifyProfileChooserOperationToken) => Promise<void>;
}
