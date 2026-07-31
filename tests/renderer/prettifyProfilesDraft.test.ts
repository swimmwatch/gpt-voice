import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  arePrettifyProfileCatalogsEqual,
  createPrettifyProfilesDraftState,
  prettifyProfilesDraftReducer,
} from '@renderer/prettifyProfilesDraft';
import {
  PRETTIFY_BUILT_IN_PROFILE_IDS,
  PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
  normalizePrettifyProfileInstruction,
  type PrettifyCustomProfile,
  type PrettifyProfileCatalog,
} from '@shared/prettifyProfiles';

const FIRST_ID = 'custom:00000000-0000-4000-8000-000000000001' as const;
const SECOND_ID = 'custom:00000000-0000-4000-8000-000000000002' as const;

function customProfile(
  id: typeof FIRST_ID | typeof SECOND_ID,
  name: string,
  instruction = 'Rewrite the selected text.',
): PrettifyCustomProfile {
  return {
    description: `${name} description`,
    id,
    instruction: normalizePrettifyProfileInstruction(instruction),
    name,
  };
}

function catalog(customProfiles: readonly PrettifyCustomProfile[] = []): PrettifyProfileCatalog {
  return {
    chooserOrder: [...PRETTIFY_BUILT_IN_PROFILE_IDS, ...customProfiles.map(({ id }) => id)],
    customProfiles: [...customProfiles],
    defaultProfileId: 'prompt-ready',
    schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
  };
}

function state(customProfiles: readonly PrettifyCustomProfile[] = []) {
  return createPrettifyProfilesDraftState({
    builtInProfiles: PRETTIFY_BUILT_IN_PROFILE_IDS.map((id) => ({
      id,
      instruction: normalizePrettifyProfileInstruction(`Built-in ${id} instruction.`),
    })),
    catalog: catalog(customProfiles),
  });
}

describe('Prettify profiles transactional draft', () => {
  it('loads one immutable baseline and detects complete catalog equality', () => {
    const initial = state([customProfile(FIRST_ID, 'First')]);
    assert.equal(initial.baseline, initial.draft);
    assert.equal(arePrettifyProfileCatalogsEqual(initial.baseline, initial.draft), true);
    assert.equal(Object.isFrozen(initial.builtInProfiles), true);
  });

  it('creates and updates customs while preserving IDs and appending order', () => {
    const initial = state();
    const created = prettifyProfilesDraftReducer(initial, {
      profile: customProfile(FIRST_ID, 'First'),
      type: 'create',
    });
    assert.deepEqual(created.draft.chooserOrder, [...PRETTIFY_BUILT_IN_PROFILE_IDS, FIRST_ID]);
    assert.equal(created.baseline.customProfiles.length, 0);

    const updated = prettifyProfilesDraftReducer(created, {
      profile: customProfile(FIRST_ID, 'Renamed', 'Use concise wording.'),
      type: 'update',
    });
    assert.equal(updated.draft.customProfiles[0]?.id, FIRST_ID);
    assert.equal(updated.draft.customProfiles[0]?.name, 'Renamed');
    assert.deepEqual(updated.draft.chooserOrder, created.draft.chooserOrder);
  });

  it('reorders mixed profiles without changing the current default', () => {
    const initial = state([customProfile(FIRST_ID, 'First')]);
    const reordered = prettifyProfilesDraftReducer(initial, {
      chooserOrder: [FIRST_ID, ...PRETTIFY_BUILT_IN_PROFILE_IDS],
      type: 'reorder',
    });
    assert.deepEqual(reordered.draft.chooserOrder, [FIRST_ID, ...PRETTIFY_BUILT_IN_PROFILE_IDS]);
    assert.equal(reordered.draft.defaultProfileId, 'prompt-ready');
  });

  it('requires an atomic replacement before deleting the custom default', () => {
    const initial = prettifyProfilesDraftReducer(state([customProfile(FIRST_ID, 'First')]), {
      profileId: FIRST_ID,
      type: 'set-default',
    });
    assert.throws(
      () => prettifyProfilesDraftReducer(initial, { profileId: FIRST_ID, type: 'delete' }),
      /default replacement/u,
    );

    const deleted = prettifyProfilesDraftReducer(initial, {
      profileId: FIRST_ID,
      replacementDefaultProfileId: 'polish',
      type: 'delete-and-replace-default',
    });
    assert.equal(deleted.draft.defaultProfileId, 'polish');
    assert.equal(deleted.draft.customProfiles.length, 0);
    assert.equal(deleted.draft.chooserOrder.includes(FIRST_ID), false);
  });

  it('replaces the draft after import and reconciles only authoritative saved catalogs', () => {
    const initial = state([customProfile(FIRST_ID, 'First')]);
    const importedCatalog = catalog([customProfile(FIRST_ID, 'First'), customProfile(SECOND_ID, 'Second')]);
    const imported = prettifyProfilesDraftReducer(initial, {
      catalog: importedCatalog,
      type: 'replace-draft',
    });
    assert.equal(imported.draft.customProfiles.length, 2);
    assert.equal(imported.baseline.customProfiles.length, 1);

    const reconciled = prettifyProfilesDraftReducer(imported, {
      catalog: importedCatalog,
      type: 'reconcile-saved',
    });
    assert.equal(reconciled.baseline, reconciled.draft);
    assert.equal(arePrettifyProfileCatalogsEqual(reconciled.baseline, reconciled.draft), true);
  });
});
