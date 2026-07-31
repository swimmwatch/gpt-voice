import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PRETTIFY_PROFILE_ID_ALLOCATION_EXHAUSTED,
  PRETTIFY_PROFILE_ID_ALLOCATION_INVALID_FORBIDDEN_IDS,
  PrettifyProfileCatalogState,
  PrettifyProfileIdAllocationError,
  getPrettifyProfileCatalogLegacyPromptProjection,
  presentPendingPrettifyProfileCatalogRepairNotice,
  type PersistPrettifyProfileCatalog,
} from '@main/prettifyProfileCatalogState';
import { getPrettifyBuiltInProfileDefinition } from '@main/services/prettifyProfileInstruction';
import {
  PRETTIFY_BUILT_IN_PROFILE_IDS,
  PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
  normalizePrettifyProfileCatalog,
  type PrettifyProfileCatalog,
} from '@shared/prettifyProfiles';
import { DEFAULT_PRETTIFY_PROMPT, LEGACY_DEFAULT_PRETTIFY_PROMPTS } from '@shared/prettifySettings';

const FIRST_UUID = '00000000-0000-0000-0000-000000000001';
const SECOND_UUID = '00000000-0000-0000-0000-000000000002';
const THIRD_UUID = '00000000-0000-0000-0000-000000000003';
const FIRST_CUSTOM_ID = `custom:${FIRST_UUID}` as const;
const SECOND_CUSTOM_ID = `custom:${SECOND_UUID}` as const;
const THIRD_CUSTOM_ID = `custom:${THIRD_UUID}` as const;

function createState(uuids: readonly string[] = [FIRST_UUID]): PrettifyProfileCatalogState {
  let index = 0;
  return new PrettifyProfileCatalogState({
    generateUuid: () => uuids[Math.min(index++, uuids.length - 1)] ?? FIRST_UUID,
  });
}

function createCustomCatalog(
  defaultProfileId: typeof FIRST_CUSTOM_ID | 'prompt-ready' = FIRST_CUSTOM_ID,
): PrettifyProfileCatalog {
  return normalizePrettifyProfileCatalog({
    chooserOrder: [...PRETTIFY_BUILT_IN_PROFILE_IDS, FIRST_CUSTOM_ID],
    customProfiles: [
      {
        id: FIRST_CUSTOM_ID,
        instruction: '  Preserve this instruction byte-for-byte.  ',
        name: 'Migrated Prettify prompt',
      },
    ],
    defaultProfileId,
    schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
  });
}

function capturePersistedCatalog(): {
  readonly calls: Array<{ catalog: PrettifyProfileCatalog; projection: string }>;
  readonly persist: PersistPrettifyProfileCatalog;
} {
  const calls: Array<{ catalog: PrettifyProfileCatalog; projection: string }> = [];
  return {
    calls,
    persist: (catalog, projection) => calls.push({ catalog, projection }),
  };
}

describe('PrettifyProfileCatalogState', () => {
  it('starts with an immutable Prompt-ready catalog and matching projection', () => {
    const state = createState();
    const catalog = state.getSnapshot();

    assert.deepEqual(catalog.chooserOrder, PRETTIFY_BUILT_IN_PROFILE_IDS);
    assert.equal(catalog.defaultProfileId, 'prompt-ready');
    assert.equal(catalog.customProfiles.length, 0);
    assert.equal(Object.isFrozen(catalog), true);
    assert.equal(Object.isFrozen(catalog.chooserOrder), true);
    assert.equal(
      getPrettifyProfileCatalogLegacyPromptProjection(catalog),
      getPrettifyBuiltInProfileDefinition('prompt-ready').instruction,
    );
  });

  it('migrates every recognized legacy default to Polish exactly once', () => {
    for (const legacyPrompt of [DEFAULT_PRETTIFY_PROMPT, ...LEGACY_DEFAULT_PRETTIFY_PROMPTS]) {
      const state = createState();
      const persisted = capturePersistedCatalog();
      const catalog = state.load(undefined, legacyPrompt, persisted.persist);

      assert.equal(catalog.defaultProfileId, 'polish');
      assert.equal(catalog.customProfiles.length, 0);
      assert.equal(persisted.calls.length, 1);
      assert.equal(persisted.calls[0]?.projection, getPrettifyBuiltInProfileDefinition('polish').instruction);

      const reloaded = createState();
      const repeatedPersistence = capturePersistedCatalog();
      reloaded.load(catalog, persisted.calls[0]?.projection, repeatedPersistence.persist);
      assert.equal(repeatedPersistence.calls.length, 0);
    }
  });

  it('migrates one custom prompt byte-for-byte and never duplicates it on reload', () => {
    const legacyPrompt = '  Keep my custom prompt exactly.  \n';
    const state = createState();
    const persisted = capturePersistedCatalog();

    const catalog = state.load(undefined, legacyPrompt, persisted.persist);

    assert.equal(catalog.defaultProfileId, FIRST_CUSTOM_ID);
    assert.equal(catalog.customProfiles.length, 1);
    assert.equal(catalog.customProfiles[0]?.name, 'Migrated Prettify prompt');
    assert.equal(catalog.customProfiles[0]?.instruction, legacyPrompt);
    assert.equal(persisted.calls[0]?.projection, legacyPrompt);

    const reloaded = createState([SECOND_UUID]);
    const repeatedPersistence = capturePersistedCatalog();
    const repeated = reloaded.load(catalog, legacyPrompt, repeatedPersistence.persist);
    assert.equal(repeated.customProfiles.length, 1);
    assert.equal(repeated.customProfiles[0]?.id, FIRST_CUSTOM_ID);
    assert.equal(repeatedPersistence.calls.length, 0);
  });

  it('salvages valid profiles and order while repairing duplicates and an invalid default', () => {
    const state = createState();
    const persisted = capturePersistedCatalog();
    const corruptCatalog = {
      chooserOrder: ['unknown', SECOND_CUSTOM_ID, 'natural', SECOND_CUSTOM_ID, 'prompt-ready'],
      customProfiles: [
        {
          id: FIRST_CUSTOM_ID,
          instruction: 'First',
          name: 'First',
        },
        {
          id: FIRST_CUSTOM_ID,
          instruction: 'Duplicate ID',
          name: 'Second',
        },
        {
          id: SECOND_CUSTOM_ID,
          instruction: 'Duplicate name',
          name: ' first ',
        },
        {
          id: SECOND_CUSTOM_ID,
          instruction: 'Second',
          name: 'Second',
        },
        {
          id: 'custom:not-a-uuid',
          instruction: 'Invalid',
          name: 'Invalid',
        },
      ],
      defaultProfileId: THIRD_CUSTOM_ID,
      schemaVersion: 999,
    };

    const catalog = state.load(corruptCatalog, 'stale projection', persisted.persist);

    assert.deepEqual(
      catalog.customProfiles.map(({ id }) => id),
      [FIRST_CUSTOM_ID, SECOND_CUSTOM_ID],
    );
    assert.equal(catalog.defaultProfileId, 'prompt-ready');
    assert.deepEqual(catalog.chooserOrder, [
      SECOND_CUSTOM_ID,
      'natural',
      'prompt-ready',
      'polish',
      'professional',
      FIRST_CUSTOM_ID,
    ]);
    assert.equal(persisted.calls.length, 1);
    assert.deepEqual(state.consumeRepairNotice(), { repaired: true });
    assert.equal(state.consumeRepairNotice(), null);
  });

  it('publishes a saved catalog and projection only after persistence succeeds', () => {
    const state = createState();
    const previous = state.getSnapshot();
    const candidate = createCustomCatalog();

    assert.throws(
      () =>
        state.save(candidate, () => {
          throw new Error('synthetic persistence failure');
        }),
      /synthetic persistence failure/u,
    );
    assert.equal(state.getSnapshot(), previous);

    const persisted = capturePersistedCatalog();
    const saved = state.save(candidate, persisted.persist);
    assert.equal(saved.defaultProfileId, FIRST_CUSTOM_ID);
    assert.equal(persisted.calls[0]?.projection, candidate.customProfiles[0]?.instruction);
  });

  it('rejects deleting a custom default unless the same candidate selects a replacement', () => {
    const state = createState();
    state.save(createCustomCatalog(), () => undefined);
    const invalidCandidate = {
      chooserOrder: [...PRETTIFY_BUILT_IN_PROFILE_IDS],
      customProfiles: [],
      defaultProfileId: FIRST_CUSTOM_ID,
      schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
    };

    assert.throws(() => state.save(invalidCandidate, () => undefined));
    assert.equal(state.getSnapshot().defaultProfileId, FIRST_CUSTOM_ID);

    const replacement = {
      ...invalidCandidate,
      defaultProfileId: 'prompt-ready',
    };
    assert.equal(state.save(replacement, () => undefined).defaultProfileId, 'prompt-ready');
  });

  it('allocates reserved collision-safe IDs across catalog, draft, and process state', () => {
    const state = createState([FIRST_UUID, SECOND_UUID, THIRD_UUID]);
    state.save(createCustomCatalog('prompt-ready'), () => undefined);

    assert.equal(state.allocateCustomProfileId([SECOND_CUSTOM_ID]), THIRD_CUSTOM_ID);
    assert.throws(
      () => state.allocateCustomProfileId([]),
      (error: unknown) =>
        error instanceof PrettifyProfileIdAllocationError && error.code === PRETTIFY_PROFILE_ID_ALLOCATION_EXHAUSTED,
    );
    assert.throws(
      () => state.allocateCustomProfileId([SECOND_CUSTOM_ID, SECOND_CUSTOM_ID]),
      (error: unknown) =>
        error instanceof PrettifyProfileIdAllocationError &&
        error.code === PRETTIFY_PROFILE_ID_ALLOCATION_INVALID_FORBIDDEN_IDS,
    );
  });

  it('rejects malformed, duplicate, and over-limit additional forbidden ID lists before allocation', () => {
    let allocationCalls = 0;
    const state = new PrettifyProfileCatalogState({
      generateUuid: () => {
        allocationCalls += 1;
        return FIRST_UUID;
      },
    });
    const tooManyIds = Array.from(
      { length: 201 },
      (_, index) => `custom:00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
    );

    for (const value of [null, [FIRST_CUSTOM_ID, FIRST_CUSTOM_ID], ['prompt-ready'], tooManyIds]) {
      assert.throws(
        () => state.allocateCustomProfileId(value),
        (error: unknown) =>
          error instanceof PrettifyProfileIdAllocationError &&
          error.code === PRETTIFY_PROFILE_ID_ALLOCATION_INVALID_FORBIDDEN_IDS,
      );
    }
    assert.equal(allocationCalls, 0);
  });

  it('retains at most the first 200 valid custom records during corrupt-state salvage', () => {
    const state = createState();
    const persisted = capturePersistedCatalog();
    const customProfiles = Array.from({ length: 201 }, (_, index) => ({
      id: `custom:00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
      instruction: `Instruction ${index}`,
      name: `Profile ${index}`,
    }));

    const catalog = state.load(
      {
        chooserOrder: [],
        customProfiles,
        defaultProfileId: customProfiles[200]?.id,
        schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
      },
      'stale projection',
      persisted.persist,
    );

    assert.equal(catalog.customProfiles.length, 200);
    assert.equal(catalog.customProfiles[0]?.name, 'Profile 0');
    assert.equal(catalog.customProfiles[199]?.name, 'Profile 199');
    assert.equal(catalog.defaultProfileId, 'prompt-ready');
    assert.deepEqual(catalog.chooserOrder.slice(0, 4), PRETTIFY_BUILT_IN_PROFILE_IDS);
    assert.equal(catalog.chooserOrder.length, 204);
  });

  it('returns a stable content-free exhaustion error without publishing catalog state', () => {
    const state = createState(['not-a-uuid']);
    const previous = state.getSnapshot();

    assert.throws(
      () => state.allocateCustomProfileId([]),
      (error: unknown) =>
        error instanceof PrettifyProfileIdAllocationError &&
        error.code === PRETTIFY_PROFILE_ID_ALLOCATION_EXHAUSTED &&
        !error.message.includes('not-a-uuid'),
    );
    assert.equal(state.getSnapshot(), previous);
  });

  it('presents one bounded repair notice and ignores notification failures', () => {
    const notifications: string[][] = [];
    assert.equal(
      presentPendingPrettifyProfileCatalogRepairNotice({
        notice: { repaired: true },
        notify: (title, body) => notifications.push([title, body]),
        translate: (key) => key,
      }),
      true,
    );
    assert.deepEqual(notifications, [
      ['notification.prettifyProfileCatalogRepaired', 'notification.prettifyProfileCatalogRepairedBody'],
    ]);
    assert.equal(
      presentPendingPrettifyProfileCatalogRepairNotice({
        notice: { repaired: true },
        notify: () => {
          throw new Error('synthetic notification failure');
        },
        translate: (key) => key,
      }),
      true,
    );
    assert.equal(
      presentPendingPrettifyProfileCatalogRepairNotice({
        notice: null,
        notify: () => undefined,
        translate: (key) => key,
      }),
      false,
    );
  });
});
