import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterPrettifyProfilesBySearchQuery,
  getPrettifyBuiltInProfileMetadata,
  isPrettifyBuiltInProfileId,
  isPrettifyCustomProfileId,
  isValidPrettifyProfileCatalog,
  MAX_PRETTIFY_CUSTOM_PROFILES,
  MAX_PRETTIFY_PROFILE_DESCRIPTION_CODE_POINTS,
  MAX_PRETTIFY_PROFILE_INSTRUCTION_CODE_POINTS,
  MAX_PRETTIFY_PROFILE_NAME_CODE_POINTS,
  matchesPrettifyProfileSearchQuery,
  normalizePrettifyCustomProfileNameForUniqueness,
  normalizePrettifyProfileCatalog,
  PRETTIFY_BUILT_IN_PROFILE_IDS,
  PRETTIFY_BUILT_IN_PROFILE_METADATA,
  PRETTIFY_INSTRUCTION_CONTRACT_VERSION,
  PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
  PrettifyProfileValidationError,
  type PrettifyProfileValidationCode,
} from '@shared/prettifyProfiles';

const FIRST_CUSTOM_ID = 'custom:00000000-0000-0000-0000-000000000001';
const SECOND_CUSTOM_ID = 'custom:00000000-0000-0000-0000-000000000002';
const CANONICAL_ORDER = [...PRETTIFY_BUILT_IN_PROFILE_IDS] as const;

function createCatalog(
  customProfiles: readonly Record<string, unknown>[] = [],
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    chooserOrder: [...CANONICAL_ORDER, ...customProfiles.map((profile) => profile.id)],
    customProfiles,
    defaultProfileId: 'prompt-ready',
    schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
    ...overrides,
  };
}

function createCustomProfile(
  id = FIRST_CUSTOM_ID,
  name = 'Focused',
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id,
    instruction: 'Keep the requested task focused.',
    name,
    ...overrides,
  };
}

function getValidationError(value: unknown): PrettifyProfileValidationError {
  try {
    normalizePrettifyProfileCatalog(value);
  } catch (error: unknown) {
    assert.ok(error instanceof PrettifyProfileValidationError);
    return error;
  }
  assert.fail('Expected Prettify profile validation to fail');
}

describe('prettifyProfiles', () => {
  it('defines the exact immutable built-in catalog and contract versions', () => {
    assert.equal(PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION, 1);
    assert.equal(PRETTIFY_INSTRUCTION_CONTRACT_VERSION, 1);
    assert.deepEqual(PRETTIFY_BUILT_IN_PROFILE_IDS, ['prompt-ready', 'polish', 'professional', 'natural']);
    assert.deepEqual(
      PRETTIFY_BUILT_IN_PROFILE_METADATA.map(({ id, kind }) => ({ id, kind })),
      PRETTIFY_BUILT_IN_PROFILE_IDS.map((id) => ({ id, kind: 'built-in' })),
    );
    assert.equal(Object.isFrozen(PRETTIFY_BUILT_IN_PROFILE_METADATA), true);
    assert.equal(PRETTIFY_BUILT_IN_PROFILE_METADATA.every(Object.isFrozen), true);
    assert.equal(getPrettifyBuiltInProfileMetadata('prompt-ready').nameKey, 'prettify.profile.promptReady.name');
  });

  it('recognizes only exact built-in and canonical lowercase custom IDs', () => {
    assert.equal(isPrettifyBuiltInProfileId('natural'), true);
    assert.equal(isPrettifyBuiltInProfileId('translate'), false);
    assert.equal(isPrettifyCustomProfileId(FIRST_CUSTOM_ID), true);
    assert.equal(isPrettifyCustomProfileId('custom:00000000-0000-0000-0000-00000000000A'), false);
    assert.equal(isPrettifyCustomProfileId('custom:focused'), false);
    assert.equal(isPrettifyCustomProfileId('prompt-ready'), false);
  });

  it('normalizes valid custom metadata while preserving instruction bytes and mixed order', () => {
    const instruction = '  Preserve this instruction.\nExactly.  ';
    const catalog = normalizePrettifyProfileCatalog(
      createCatalog(
        [
          createCustomProfile(FIRST_CUSTOM_ID, '  Focused  ', {
            description: '  Short chooser subtitle.  ',
            instruction,
          }),
        ],
        {
          chooserOrder: ['prompt-ready', FIRST_CUSTOM_ID, 'natural', 'polish', 'professional'],
          defaultProfileId: FIRST_CUSTOM_ID,
        },
      ),
    );

    assert.equal(catalog.defaultProfileId, FIRST_CUSTOM_ID);
    assert.deepEqual(catalog.chooserOrder, ['prompt-ready', FIRST_CUSTOM_ID, 'natural', 'polish', 'professional']);
    assert.deepEqual(catalog.customProfiles[0], {
      description: 'Short chooser subtitle.',
      id: FIRST_CUSTOM_ID,
      instruction,
      name: 'Focused',
    });
    assert.equal(Object.isFrozen(catalog), true);
    assert.equal(Object.isFrozen(catalog.chooserOrder), true);
    assert.equal(Object.isFrozen(catalog.customProfiles), true);
    assert.equal(Object.isFrozen(catalog.customProfiles[0]), true);
  });

  it('omits an empty normalized optional description', () => {
    const catalog = normalizePrettifyProfileCatalog(
      createCatalog([createCustomProfile(FIRST_CUSTOM_ID, 'Focused', { description: '   ' })]),
    );

    assert.equal('description' in catalog.customProfiles[0], false);
  });

  it('enforces Unicode code-point boundaries rather than UTF-16 code units', () => {
    const valid = createCustomProfile(FIRST_CUSTOM_ID, '😀'.repeat(MAX_PRETTIFY_PROFILE_NAME_CODE_POINTS), {
      description: '😀'.repeat(MAX_PRETTIFY_PROFILE_DESCRIPTION_CODE_POINTS),
      instruction: ` ${'😀'.repeat(MAX_PRETTIFY_PROFILE_INSTRUCTION_CODE_POINTS)} `,
    });
    assert.equal(isValidPrettifyProfileCatalog(createCatalog([valid])), true);

    assert.equal(
      getValidationError(
        createCatalog([createCustomProfile(FIRST_CUSTOM_ID, '😀'.repeat(MAX_PRETTIFY_PROFILE_NAME_CODE_POINTS + 1))]),
      ).field,
      'customProfiles.name',
    );
    assert.equal(
      getValidationError(
        createCatalog([
          createCustomProfile(FIRST_CUSTOM_ID, 'Focused', {
            description: '😀'.repeat(MAX_PRETTIFY_PROFILE_DESCRIPTION_CODE_POINTS + 1),
          }),
        ]),
      ).field,
      'customProfiles.description',
    );
    assert.equal(
      getValidationError(
        createCatalog([
          createCustomProfile(FIRST_CUSTOM_ID, 'Focused', {
            instruction: '😀'.repeat(MAX_PRETTIFY_PROFILE_INSTRUCTION_CODE_POINTS + 1),
          }),
        ]),
      ).field,
      'customProfiles.instruction',
    );
  });

  it('enforces the custom-profile capacity', () => {
    const customProfiles = Array.from({ length: MAX_PRETTIFY_CUSTOM_PROFILES + 1 }, (_, index) =>
      createCustomProfile(`custom:00000000-0000-0000-0000-${String(index).padStart(12, '0')}`, `Profile ${index}`),
    );

    const error = getValidationError(createCatalog(customProfiles));
    assert.equal(error.code, 'capacity-exceeded');
    assert.equal(error.field, 'customProfiles');
  });

  it('uses NFKC and case-insensitive custom-name uniqueness without removing accents', () => {
    assert.equal(normalizePrettifyCustomProfileNameForUniqueness('  Ｆocused  '), 'focused');
    const duplicate = createCatalog([
      createCustomProfile(FIRST_CUSTOM_ID, 'Ｆocused'),
      createCustomProfile(SECOND_CUSTOM_ID, 'focused'),
    ]);
    assert.equal(getValidationError(duplicate).code, 'duplicate-name');

    const accentDistinct = createCatalog([
      createCustomProfile(FIRST_CUSTOM_ID, 'Resume'),
      createCustomProfile(SECOND_CUSTOM_ID, 'Résumé'),
    ]);
    assert.equal(isValidPrettifyProfileCatalog(accentDistinct), true);
  });

  it('strictly rejects malformed catalogs, records, IDs, defaults, and orders', () => {
    const validProfile = createCustomProfile();
    const cases: readonly [unknown, PrettifyProfileValidationCode][] = [
      [null, 'invalid-type'],
      [[], 'invalid-type'],
      [{ ...createCatalog(), extra: true }, 'unknown-property'],
      [createCatalog([], { schemaVersion: 2 }), 'unsupported-version'],
      [createCatalog([], { customProfiles: {} }), 'invalid-type'],
      [createCatalog([{ ...validProfile, extra: true }]), 'unknown-property'],
      [createCatalog([createCustomProfile('prompt-ready')]), 'invalid-id'],
      [createCatalog([createCustomProfile('custom:not-a-uuid')]), 'invalid-id'],
      [createCatalog([createCustomProfile(FIRST_CUSTOM_ID, '')]), 'empty'],
      [createCatalog([createCustomProfile(FIRST_CUSTOM_ID, 'Focused', { description: 1 })]), 'invalid-type'],
      [createCatalog([createCustomProfile(FIRST_CUSTOM_ID, 'Focused', { instruction: '   ' })]), 'empty'],
      [
        createCatalog([createCustomProfile(FIRST_CUSTOM_ID), createCustomProfile(FIRST_CUSTOM_ID, 'Another')]),
        'duplicate-id',
      ],
      [createCatalog([validProfile], { defaultProfileId: SECOND_CUSTOM_ID }), 'invalid-default'],
      [createCatalog([validProfile], { chooserOrder: [...CANONICAL_ORDER] }), 'invalid-order'],
      [
        createCatalog([validProfile], {
          chooserOrder: ['prompt-ready', FIRST_CUSTOM_ID, 'natural', 'polish', 'polish'],
        }),
        'invalid-order',
      ],
      [
        createCatalog([validProfile], {
          chooserOrder: ['prompt-ready', FIRST_CUSTOM_ID, 'natural', 'polish', SECOND_CUSTOM_ID],
        }),
        'invalid-order',
      ],
    ];

    for (const [value, expectedCode] of cases) {
      assert.equal(getValidationError(value).code, expectedCode);
    }
  });

  it('keeps validation errors content-free', () => {
    const privateName = 'private-profile-name';
    const privateInstruction = 'private instruction body';
    const error = getValidationError(
      createCatalog([
        createCustomProfile(FIRST_CUSTOM_ID, privateName, {
          instruction: privateInstruction,
          unexpectedPrivateField: 'private-value',
        }),
      ]),
    );

    assert.equal(error.code, 'unknown-property');
    assert.doesNotMatch(error.message, /private-profile-name|private instruction body|private-value/u);
  });

  it('matches normalized multi-term name and description search without sorting', () => {
    const profiles = [
      { id: 'first', name: 'Résumé Builder', description: 'Detailed AI prompt' },
      { id: 'second', name: 'Natural', description: 'Dictation cleanup' },
      { id: 'third', name: 'Professional', description: 'Résumé for work' },
    ] as const;

    assert.equal(matchesPrettifyProfileSearchQuery(profiles[0], 'resume PROMPT'), true);
    assert.equal(matchesPrettifyProfileSearchQuery(profiles[0], 'resume missing'), false);
    assert.deepEqual(
      filterPrettifyProfilesBySearchQuery(profiles, 'resume').map((profile) => profile.id),
      ['first', 'third'],
    );
    assert.deepEqual(
      filterPrettifyProfilesBySearchQuery(profiles, '   ').map((profile) => profile.id),
      ['first', 'second', 'third'],
    );
  });
});
