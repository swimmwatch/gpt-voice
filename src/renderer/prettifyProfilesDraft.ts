import {
  normalizePrettifyCustomProfile,
  normalizePrettifyProfileCatalog,
  type PrettifyCustomProfile,
  type PrettifyCustomProfileId,
  type PrettifyProfileCatalog,
  type PrettifyProfileId,
} from '@shared/prettifyProfiles';
import type { PrettifyProfileCatalogSettingsSnapshot } from '@shared/prettifyProfileCatalogIpc';

export interface PrettifyProfilesDraftState {
  readonly baseline: PrettifyProfileCatalog;
  readonly builtInProfiles: PrettifyProfileCatalogSettingsSnapshot['builtInProfiles'];
  readonly draft: PrettifyProfileCatalog;
}

export type PrettifyProfilesDraftAction =
  | { readonly catalog: PrettifyProfileCatalog; readonly type: 'replace-draft' }
  | { readonly catalog: PrettifyProfileCatalog; readonly type: 'reconcile-saved' }
  | { readonly profile: PrettifyCustomProfile; readonly type: 'create' }
  | { readonly profile: PrettifyCustomProfile; readonly type: 'update' }
  | { readonly profileId: PrettifyCustomProfileId; readonly type: 'delete' }
  | {
      readonly profileId: PrettifyCustomProfileId;
      readonly replacementDefaultProfileId: PrettifyProfileId;
      readonly type: 'delete-and-replace-default';
    }
  | { readonly profileId: PrettifyProfileId; readonly type: 'set-default' }
  | { readonly chooserOrder: readonly PrettifyProfileId[]; readonly type: 'reorder' };

export type PrettifyProfilesDraftControllerAction =
  | PrettifyProfilesDraftAction
  | { readonly snapshot: PrettifyProfileCatalogSettingsSnapshot; readonly type: 'initialize' };

export function arePrettifyProfileCatalogsEqual(left: PrettifyProfileCatalog, right: PrettifyProfileCatalog): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function replaceCustomProfile(catalog: PrettifyProfileCatalog, profile: PrettifyCustomProfile): PrettifyProfileCatalog {
  if (!catalog.customProfiles.some(({ id }) => id === profile.id)) {
    throw new Error('Prettify profile draft update target is unavailable');
  }
  return normalizePrettifyProfileCatalog({
    ...catalog,
    customProfiles: catalog.customProfiles.map((candidate) => (candidate.id === profile.id ? profile : candidate)),
  });
}

function createCustomProfile(catalog: PrettifyProfileCatalog, profile: PrettifyCustomProfile): PrettifyProfileCatalog {
  const normalizedProfile = normalizePrettifyCustomProfile(profile);
  return normalizePrettifyProfileCatalog({
    ...catalog,
    chooserOrder: [...catalog.chooserOrder, normalizedProfile.id],
    customProfiles: [...catalog.customProfiles, normalizedProfile],
  });
}

function deleteCustomProfile(
  catalog: PrettifyProfileCatalog,
  profileId: PrettifyCustomProfileId,
  replacementDefaultProfileId?: PrettifyProfileId,
): PrettifyProfileCatalog {
  if (!catalog.customProfiles.some(({ id }) => id === profileId)) {
    throw new Error('Prettify profile draft delete target is unavailable');
  }
  const deletingDefault = catalog.defaultProfileId === profileId;
  if (deletingDefault && !replacementDefaultProfileId) {
    throw new Error('Prettify profile draft default replacement is required');
  }
  return normalizePrettifyProfileCatalog({
    ...catalog,
    chooserOrder: catalog.chooserOrder.filter((id) => id !== profileId),
    customProfiles: catalog.customProfiles.filter(({ id }) => id !== profileId),
    defaultProfileId: deletingDefault ? replacementDefaultProfileId : catalog.defaultProfileId,
  });
}

export function createPrettifyProfilesDraftState(
  snapshot: PrettifyProfileCatalogSettingsSnapshot,
): PrettifyProfilesDraftState {
  const catalog = normalizePrettifyProfileCatalog(snapshot.catalog);
  return Object.freeze({
    baseline: catalog,
    builtInProfiles: Object.freeze(snapshot.builtInProfiles.map((profile) => Object.freeze({ ...profile }))),
    draft: catalog,
  });
}

export function prettifyProfilesDraftReducer(
  state: PrettifyProfilesDraftState,
  action: PrettifyProfilesDraftAction,
): PrettifyProfilesDraftState {
  switch (action.type) {
    case 'replace-draft':
      return Object.freeze({ ...state, draft: normalizePrettifyProfileCatalog(action.catalog) });
    case 'reconcile-saved': {
      const catalog = normalizePrettifyProfileCatalog(action.catalog);
      return Object.freeze({ ...state, baseline: catalog, draft: catalog });
    }
    case 'create':
      return Object.freeze({ ...state, draft: createCustomProfile(state.draft, action.profile) });
    case 'update':
      return Object.freeze({
        ...state,
        draft: replaceCustomProfile(state.draft, normalizePrettifyCustomProfile(action.profile)),
      });
    case 'delete':
      return Object.freeze({ ...state, draft: deleteCustomProfile(state.draft, action.profileId) });
    case 'delete-and-replace-default':
      return Object.freeze({
        ...state,
        draft: deleteCustomProfile(state.draft, action.profileId, action.replacementDefaultProfileId),
      });
    case 'set-default':
      return Object.freeze({
        ...state,
        draft: normalizePrettifyProfileCatalog({
          ...state.draft,
          defaultProfileId: action.profileId,
        }),
      });
    case 'reorder':
      return Object.freeze({
        ...state,
        draft: normalizePrettifyProfileCatalog({
          ...state.draft,
          chooserOrder: action.chooserOrder,
        }),
      });
  }
}

export function prettifyProfilesDraftControllerReducer(
  state: PrettifyProfilesDraftState | null,
  action: PrettifyProfilesDraftControllerAction,
): PrettifyProfilesDraftState | null {
  if (action.type === 'initialize') return createPrettifyProfilesDraftState(action.snapshot);
  if (!state) return state;
  return prettifyProfilesDraftReducer(state, action);
}
