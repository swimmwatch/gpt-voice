import type {
  PrettifyBuiltInProfileId,
  PrettifyCustomProfileId,
  PrettifyProfileCatalog,
  ValidatedPrettifyProfileInstruction,
} from './prettifyProfiles';

export const PRETTIFY_PROFILE_CATALOG_IPC_CHANNELS = Object.freeze({
  allocateCustomId: 'prettify-profile-catalog:allocate-custom-id',
  get: 'prettify-profile-catalog:get',
  save: 'prettify-profile-catalog:save',
} as const);

export interface PrettifyBuiltInProfileSettingsDefinition {
  readonly id: PrettifyBuiltInProfileId;
  readonly instruction: ValidatedPrettifyProfileInstruction;
}

export interface PrettifyProfileCatalogSettingsSnapshot {
  readonly builtInProfiles: readonly PrettifyBuiltInProfileSettingsDefinition[];
  readonly catalog: PrettifyProfileCatalog;
}

export interface PrettifyCustomProfileIdAllocationRequest {
  readonly forbiddenCustomProfileIds: readonly PrettifyCustomProfileId[];
}

export type PrettifyCustomProfileIdAllocationResult =
  | {
      readonly profileId: PrettifyCustomProfileId;
      readonly success: true;
    }
  | {
      readonly code: 'allocation-exhausted' | 'invalid-request';
      readonly success: false;
    };

export type PrettifyProfileCatalogSaveFailureCode = 'invalid-catalog' | 'save-failed';

export type PrettifyProfileCatalogSaveResult =
  | {
      readonly catalog: PrettifyProfileCatalog;
      readonly success: true;
    }
  | {
      readonly code: PrettifyProfileCatalogSaveFailureCode;
      readonly success: false;
    };
