import type { PrettifyProfileId, PrettifyProfileKind } from './prettifyProfiles';

export interface PrettifyProfileChooserProfileSummary {
  readonly description?: string;
  readonly id: PrettifyProfileId;
  readonly isDefault: boolean;
  readonly kind: PrettifyProfileKind;
  readonly name: string;
}

export interface PrettifyProfileChooserRequest {
  readonly initialProfileId?: PrettifyProfileId;
  readonly profiles: readonly PrettifyProfileChooserProfileSummary[];
  readonly sourceText: string;
}

export type PrettifyProfileChooserOutcome =
  | { readonly type: 'apply'; readonly profileId: PrettifyProfileId }
  | { readonly type: 'cancel' }
  | { readonly type: 'close' }
  | { readonly type: 'manageProfiles' };
