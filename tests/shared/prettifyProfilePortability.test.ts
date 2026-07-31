import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_PRETTIFY_PROFILE_PORTABLE_BYTES,
  normalizePrettifyProfilePortableDocument,
  parsePrettifyProfilePortableDocument,
  PRETTIFY_PROFILE_PORTABLE_SCHEMA,
  PRETTIFY_PROFILE_PORTABLE_VERSION,
  PrettifyProfilePortabilityValidationError,
  serializePrettifyProfilePortableDocument,
  type PrettifyProfilePortabilityValidationCode,
} from '@shared/prettifyProfilePortability';
import {
  MAX_PRETTIFY_CUSTOM_PROFILES,
  MAX_PRETTIFY_PROFILE_DESCRIPTION_CODE_POINTS,
  MAX_PRETTIFY_PROFILE_INSTRUCTION_CODE_POINTS,
  MAX_PRETTIFY_PROFILE_NAME_CODE_POINTS,
} from '@shared/prettifyProfiles';

const FIRST_CUSTOM_ID = 'custom:00000000-0000-0000-0000-000000000001';
const SECOND_CUSTOM_ID = 'custom:00000000-0000-0000-0000-000000000002';

function createProfile(
  id = FIRST_CUSTOM_ID,
  name = 'Focused',
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id,
    instruction: 'Preserve the requested task.',
    name,
    ...overrides,
  };
}

function createDocument(
  profiles: readonly unknown[] = [createProfile()],
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    profiles,
    schema: PRETTIFY_PROFILE_PORTABLE_SCHEMA,
    version: PRETTIFY_PROFILE_PORTABLE_VERSION,
    ...overrides,
  };
}

function encode(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function getValidationError(callback: () => unknown): PrettifyProfilePortabilityValidationError {
  try {
    callback();
  } catch (error: unknown) {
    assert.ok(error instanceof PrettifyProfilePortabilityValidationError);
    return error;
  }
  assert.fail('Expected portable profile validation to fail');
}

describe('prettify profile portability document', () => {
  it('serializes only the exact portable schema in explicit profile order', () => {
    const output = serializePrettifyProfilePortableDocument([
      createProfile(SECOND_CUSTOM_ID, 'Second', {
        description: '  Optional description.  ',
        instruction: 'Second instruction.',
      }),
      createProfile(FIRST_CUSTOM_ID, 'First'),
    ]);

    assert.equal(
      output,
      `${JSON.stringify(
        {
          schema: 'gpt-voice.prettify-profiles',
          version: 1,
          profiles: [
            {
              id: SECOND_CUSTOM_ID,
              name: 'Second',
              description: 'Optional description.',
              instruction: 'Second instruction.',
            },
            {
              id: FIRST_CUSTOM_ID,
              name: 'First',
              instruction: 'Preserve the requested task.',
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    assert.doesNotMatch(
      output,
      /chooserOrder|defaultProfileId|provider|model|hotkey|credential|path|timestamp|machine/iu,
    );
  });

  it('parses UTF-8 into a deeply immutable normalized document', () => {
    const document = parsePrettifyProfilePortableDocument(
      encode(
        createDocument([
          createProfile(FIRST_CUSTOM_ID, '  Focused  ', {
            description: '  Chooser copy.  ',
            instruction: '  Preserve these instruction bytes.  ',
          }),
        ]),
      ),
    );

    assert.deepEqual(document, {
      profiles: [
        {
          description: 'Chooser copy.',
          id: FIRST_CUSTOM_ID,
          instruction: '  Preserve these instruction bytes.  ',
          name: 'Focused',
        },
      ],
      schema: PRETTIFY_PROFILE_PORTABLE_SCHEMA,
      version: PRETTIFY_PROFILE_PORTABLE_VERSION,
    });
    assert.equal(Object.isFrozen(document), true);
    assert.equal(Object.isFrozen(document.profiles), true);
    assert.equal(Object.isFrozen(document.profiles[0]), true);
  });

  it('rejects an oversized byte sequence before decode or JSON parsing', () => {
    const oversizedInvalidUtf8 = new Uint8Array(MAX_PRETTIFY_PROFILE_PORTABLE_BYTES + 1).fill(0xff);
    assert.equal(
      getValidationError(() => parsePrettifyProfilePortableDocument(oversizedInvalidUtf8)).code,
      'too-large',
    );
  });

  it('rejects invalid UTF-8, invalid JSON, and non-byte input with stable codes', () => {
    const cases: readonly [() => unknown, PrettifyProfilePortabilityValidationCode][] = [
      [() => parsePrettifyProfilePortableDocument(new Uint8Array([0xc3, 0x28])), 'invalid-encoding'],
      [() => parsePrettifyProfilePortableDocument(new TextEncoder().encode('{')), 'invalid-json'],
      [() => parsePrettifyProfilePortableDocument('private source'), 'invalid-shape'],
    ];

    for (const [callback, code] of cases) {
      assert.equal(getValidationError(callback).code, code);
    }
  });

  it('strictly rejects root and profile shape, schema, version, IDs, and duplicates', () => {
    const cases: readonly [unknown, PrettifyProfilePortabilityValidationCode][] = [
      [null, 'invalid-shape'],
      [[], 'invalid-shape'],
      [{ ...createDocument(), extra: true }, 'invalid-shape'],
      [createDocument(undefined, { schema: 'other' }), 'unsupported-schema'],
      [createDocument(undefined, { version: 2 }), 'unsupported-version'],
      [createDocument([], { profiles: {} }), 'invalid-shape'],
      [createDocument([{ ...createProfile(), extra: true }]), 'invalid-profile'],
      [createDocument([createProfile('prompt-ready')]), 'invalid-profile'],
      [createDocument([createProfile('custom:not-a-uuid')]), 'invalid-profile'],
      [createDocument([createProfile(), createProfile(FIRST_CUSTOM_ID, 'Other')]), 'duplicate-id'],
      [
        createDocument([createProfile(FIRST_CUSTOM_ID, 'Ｆocused'), createProfile(SECOND_CUSTOM_ID, 'focused')]),
        'duplicate-name',
      ],
    ];

    for (const [value, code] of cases) {
      assert.equal(getValidationError(() => normalizePrettifyProfilePortableDocument(value)).code, code);
    }
  });

  it('enforces packet 01 code-point limits and the 200-record file bound', () => {
    assert.doesNotThrow(() =>
      normalizePrettifyProfilePortableDocument(
        createDocument([
          createProfile(FIRST_CUSTOM_ID, '😀'.repeat(MAX_PRETTIFY_PROFILE_NAME_CODE_POINTS), {
            description: '😀'.repeat(MAX_PRETTIFY_PROFILE_DESCRIPTION_CODE_POINTS),
            instruction: ` ${'😀'.repeat(MAX_PRETTIFY_PROFILE_INSTRUCTION_CODE_POINTS)} `,
          }),
        ]),
      ),
    );
    assert.equal(
      getValidationError(() =>
        normalizePrettifyProfilePortableDocument(
          createDocument([createProfile(FIRST_CUSTOM_ID, '😀'.repeat(MAX_PRETTIFY_PROFILE_NAME_CODE_POINTS + 1))]),
        ),
      ).code,
      'invalid-profile',
    );

    const tooMany = Array.from({ length: MAX_PRETTIFY_CUSTOM_PROFILES + 1 }, (_, index) =>
      createProfile(`custom:00000000-0000-0000-0000-${String(index).padStart(12, '0')}`, `Profile ${index}`),
    );
    assert.equal(
      getValidationError(() => normalizePrettifyProfilePortableDocument(createDocument(tooMany))).code,
      'too-many-profiles',
    );
  });

  it('keeps validation errors content-free', () => {
    const error = getValidationError(() =>
      normalizePrettifyProfilePortableDocument(
        createDocument([
          createProfile(FIRST_CUSTOM_ID, 'private-profile-name', {
            instruction: 'private instruction body',
            privateValue: '/home/alice/private.json',
          }),
        ]),
      ),
    );

    assert.doesNotMatch(error.message, /private-profile-name|private instruction body|home|alice/u);
  });
});
