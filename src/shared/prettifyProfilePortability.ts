import {
  MAX_PRETTIFY_CUSTOM_PROFILES,
  normalizePrettifyCustomProfile,
  normalizePrettifyCustomProfileNameForUniqueness,
  type PrettifyCustomProfile,
  type PrettifyCustomProfileId,
  type PrettifyProfileCatalog,
} from './prettifyProfiles';

export const PRETTIFY_PROFILE_PORTABLE_SCHEMA = 'gpt-voice.prettify-profiles' as const;
export const PRETTIFY_PROFILE_PORTABLE_VERSION = 1 as const;
export const MAX_PRETTIFY_PROFILE_PORTABLE_BYTES = 4 * 1024 * 1024;

export const PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS = Object.freeze({
  applyImport: 'prettify-profile-portability:apply-import',
  export: 'prettify-profile-portability:export',
  import: 'prettify-profile-portability:import',
} as const);

const PORTABLE_DOCUMENT_PROPERTY_NAMES = ['profiles', 'schema', 'version'] as const;

export type PrettifyPortableProfile = PrettifyCustomProfile;

export interface PrettifyProfilePortableDocument {
  readonly profiles: readonly PrettifyPortableProfile[];
  readonly schema: typeof PRETTIFY_PROFILE_PORTABLE_SCHEMA;
  readonly version: typeof PRETTIFY_PROFILE_PORTABLE_VERSION;
}

export type PrettifyProfilePortabilityValidationCode =
  | 'duplicate-id'
  | 'duplicate-name'
  | 'invalid-encoding'
  | 'invalid-json'
  | 'invalid-profile'
  | 'invalid-shape'
  | 'too-large'
  | 'too-many-profiles'
  | 'unsupported-schema'
  | 'unsupported-version';

/** Content-free failure returned by strict portable-document validation. */
export class PrettifyProfilePortabilityValidationError extends Error {
  public constructor(public readonly code: PrettifyProfilePortabilityValidationCode) {
    super(`Prettify profile portability validation failed: ${code}`);
    this.name = 'PrettifyProfilePortabilityValidationError';
  }
}

export type PrettifyProfileImportConflictKind = 'dual-target' | 'id' | 'name' | 'same-target';
export type PrettifyProfileImportAction = 'rename' | 'replace' | 'skip';

export interface PrettifyProfileImportConflict {
  readonly allowedActions: readonly PrettifyProfileImportAction[];
  readonly importedProfileId: PrettifyCustomProfileId;
  readonly kind: PrettifyProfileImportConflictKind;
  readonly localProfileIds: readonly PrettifyCustomProfileId[];
  readonly replaceUnavailableReason?: string;
}

export type PrettifyProfileImportDecision =
  | {
      readonly action: 'rename';
      readonly importedProfileId: PrettifyCustomProfileId;
      readonly name: string;
    }
  | {
      readonly action: 'replace' | 'skip';
      readonly importedProfileId: PrettifyCustomProfileId;
    };

export interface PrettifyProfileExportRequest {
  readonly confirmedPlaintext: true;
  readonly draft: PrettifyProfileCatalog;
  readonly profileIds: readonly PrettifyCustomProfileId[];
}

export interface PrettifyProfileImportRequest {
  readonly draft: PrettifyProfileCatalog;
}

export interface PrettifyProfileImportApplyRequest {
  readonly decisions: readonly PrettifyProfileImportDecision[];
  readonly draft: PrettifyProfileCatalog;
  readonly profiles: readonly PrettifyPortableProfile[];
}

export type PrettifyProfilePortabilityFailureCode =
  'invalid-document' | 'invalid-plan' | 'invalid-request' | 'read-failed' | 'window-unavailable' | 'write-failed';

export type PrettifyProfileExportResult =
  | { readonly status: 'saved' }
  | { readonly status: 'cancelled' }
  | { readonly code: PrettifyProfilePortabilityFailureCode; readonly status: 'failed' };

export type PrettifyProfileImportResult =
  | {
      readonly conflicts: readonly PrettifyProfileImportConflict[];
      readonly profiles: readonly PrettifyPortableProfile[];
      readonly status: 'ready';
    }
  | { readonly status: 'cancelled' }
  | { readonly code: PrettifyProfilePortabilityFailureCode; readonly status: 'failed' };

export type PrettifyProfileImportApplyResult =
  | { readonly draft: PrettifyProfileCatalog; readonly status: 'applied' }
  | { readonly status: 'unchanged' }
  | { readonly code: PrettifyProfilePortabilityFailureCode; readonly status: 'failed' };

function fail(code: PrettifyProfilePortabilityValidationCode): never {
  throw new PrettifyProfilePortabilityValidationError(code);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactProperties(value: Record<string, unknown>, expected: readonly string[]): void {
  const properties = Reflect.ownKeys(value);
  if (
    properties.length !== expected.length ||
    properties.some((property) => typeof property !== 'string' || !expected.includes(property))
  ) {
    fail('invalid-shape');
  }
  for (const property of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, property);
    if (!descriptor || !('value' in descriptor)) fail('invalid-shape');
  }
}

function readOwnValue(value: Record<string, unknown>, property: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  if (!descriptor || !('value' in descriptor)) fail('invalid-shape');
  return descriptor.value;
}

export function normalizePrettifyPortableProfiles(value: unknown): readonly PrettifyPortableProfile[] {
  if (!Array.isArray(value)) fail('invalid-shape');
  if (value.length > MAX_PRETTIFY_CUSTOM_PROFILES) fail('too-many-profiles');

  const profiles: PrettifyPortableProfile[] = [];
  const ids = new Set<PrettifyCustomProfileId>();
  const names = new Set<string>();
  for (const candidate of value) {
    let profile: PrettifyCustomProfile;
    try {
      profile = normalizePrettifyCustomProfile(candidate);
    } catch {
      fail('invalid-profile');
    }
    if (ids.has(profile.id)) fail('duplicate-id');
    const normalizedName = normalizePrettifyCustomProfileNameForUniqueness(profile.name);
    if (names.has(normalizedName)) fail('duplicate-name');
    ids.add(profile.id);
    names.add(normalizedName);
    profiles.push(profile);
  }
  return Object.freeze(profiles);
}

export function normalizePrettifyProfilePortableDocument(value: unknown): PrettifyProfilePortableDocument {
  if (!isPlainRecord(value)) fail('invalid-shape');
  assertExactProperties(value, PORTABLE_DOCUMENT_PROPERTY_NAMES);

  if (readOwnValue(value, 'schema') !== PRETTIFY_PROFILE_PORTABLE_SCHEMA) {
    fail('unsupported-schema');
  }
  if (readOwnValue(value, 'version') !== PRETTIFY_PROFILE_PORTABLE_VERSION) {
    fail('unsupported-version');
  }
  const profiles = normalizePrettifyPortableProfiles(readOwnValue(value, 'profiles'));
  return Object.freeze({
    profiles,
    schema: PRETTIFY_PROFILE_PORTABLE_SCHEMA,
    version: PRETTIFY_PROFILE_PORTABLE_VERSION,
  });
}

export function parsePrettifyProfilePortableDocument(bytes: unknown): PrettifyProfilePortableDocument {
  if (!(bytes instanceof Uint8Array)) fail('invalid-shape');
  if (bytes.byteLength > MAX_PRETTIFY_PROFILE_PORTABLE_BYTES) fail('too-large');

  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail('invalid-encoding');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    fail('invalid-json');
  }
  return normalizePrettifyProfilePortableDocument(parsed);
}

export function serializePrettifyProfilePortableDocument(profiles: unknown): string {
  const normalizedProfiles = normalizePrettifyPortableProfiles(profiles);
  const document = {
    schema: PRETTIFY_PROFILE_PORTABLE_SCHEMA,
    version: PRETTIFY_PROFILE_PORTABLE_VERSION,
    profiles: normalizedProfiles.map(({ description, id, instruction, name }) => ({
      id,
      name,
      ...(description === undefined ? {} : { description }),
      instruction,
    })),
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}
