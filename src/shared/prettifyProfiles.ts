export const PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION = 1 as const;
export const PRETTIFY_INSTRUCTION_CONTRACT_VERSION = 1 as const;

export const MAX_PRETTIFY_CUSTOM_PROFILES = 200;
export const MAX_PRETTIFY_PROFILE_NAME_CODE_POINTS = 64;
export const MAX_PRETTIFY_PROFILE_DESCRIPTION_CODE_POINTS = 240;
export const MAX_PRETTIFY_PROFILE_INSTRUCTION_CODE_POINTS = 4_000;

export const PRETTIFY_BUILT_IN_PROFILE_IDS = ['prompt-ready', 'polish', 'professional', 'natural'] as const;

export type PrettifyBuiltInProfileId = (typeof PRETTIFY_BUILT_IN_PROFILE_IDS)[number];
export type PrettifyCustomProfileId = `custom:${string}`;
export type PrettifyProfileId = PrettifyBuiltInProfileId | PrettifyCustomProfileId;
export type PrettifyProfileKind = 'built-in' | 'custom';

export type PrettifyBuiltInProfileNameKey =
  | 'prettify.profile.promptReady.name'
  | 'prettify.profile.polish.name'
  | 'prettify.profile.professional.name'
  | 'prettify.profile.natural.name';

export type PrettifyBuiltInProfileDescriptionKey =
  | 'prettify.profile.promptReady.description'
  | 'prettify.profile.polish.description'
  | 'prettify.profile.professional.description'
  | 'prettify.profile.natural.description';

export interface PrettifyBuiltInProfileMetadata {
  readonly descriptionKey: PrettifyBuiltInProfileDescriptionKey;
  readonly id: PrettifyBuiltInProfileId;
  readonly kind: 'built-in';
  readonly nameKey: PrettifyBuiltInProfileNameKey;
}

export const PRETTIFY_BUILT_IN_PROFILE_METADATA: readonly PrettifyBuiltInProfileMetadata[] = Object.freeze([
  Object.freeze({
    descriptionKey: 'prettify.profile.promptReady.description',
    id: 'prompt-ready',
    kind: 'built-in',
    nameKey: 'prettify.profile.promptReady.name',
  }),
  Object.freeze({
    descriptionKey: 'prettify.profile.polish.description',
    id: 'polish',
    kind: 'built-in',
    nameKey: 'prettify.profile.polish.name',
  }),
  Object.freeze({
    descriptionKey: 'prettify.profile.professional.description',
    id: 'professional',
    kind: 'built-in',
    nameKey: 'prettify.profile.professional.name',
  }),
  Object.freeze({
    descriptionKey: 'prettify.profile.natural.description',
    id: 'natural',
    kind: 'built-in',
    nameKey: 'prettify.profile.natural.name',
  }),
]);

declare const VALIDATED_PRETTIFY_PROFILE_INSTRUCTION: unique symbol;

export type ValidatedPrettifyProfileInstruction = string & {
  readonly [VALIDATED_PRETTIFY_PROFILE_INSTRUCTION]: true;
};

export interface PrettifyCustomProfile {
  readonly description?: string;
  readonly id: PrettifyCustomProfileId;
  readonly instruction: ValidatedPrettifyProfileInstruction;
  readonly name: string;
}

export interface PrettifyProfileCatalog {
  readonly chooserOrder: readonly PrettifyProfileId[];
  readonly customProfiles: readonly PrettifyCustomProfile[];
  readonly defaultProfileId: PrettifyProfileId;
  readonly schemaVersion: typeof PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION;
}

export interface PrettifyProfileSearchItem {
  readonly description?: string;
  readonly name: string;
}

export type PrettifyProfileValidationCode =
  | 'capacity-exceeded'
  | 'duplicate-id'
  | 'duplicate-name'
  | 'empty'
  | 'invalid-default'
  | 'invalid-id'
  | 'invalid-order'
  | 'invalid-type'
  | 'too-long'
  | 'unknown-property'
  | 'unsupported-version';

export type PrettifyProfileValidationField =
  | 'catalog'
  | 'chooserOrder'
  | 'customProfiles'
  | 'customProfiles.description'
  | 'customProfiles.id'
  | 'customProfiles.instruction'
  | 'customProfiles.name'
  | 'defaultProfileId'
  | 'schemaVersion';

/** Content-free failure returned by strict Prettify profile validation. */
export class PrettifyProfileValidationError extends Error {
  public constructor(
    public readonly code: PrettifyProfileValidationCode,
    public readonly field: PrettifyProfileValidationField,
  ) {
    super(`Prettify profile validation failed: ${field} (${code})`);
    this.name = 'PrettifyProfileValidationError';
  }
}

const CUSTOM_PROFILE_ID_PATTERN = /^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const CATALOG_PROPERTY_NAMES = ['chooserOrder', 'customProfiles', 'defaultProfileId', 'schemaVersion'] as const;
const CUSTOM_PROFILE_PROPERTY_NAMES = ['description', 'id', 'instruction', 'name'] as const;

function fail(code: PrettifyProfileValidationCode, field: PrettifyProfileValidationField): never {
  throw new PrettifyProfileValidationError(code, field);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertOnlyProperties(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: PrettifyProfileValidationField,
): void {
  for (const property of Reflect.ownKeys(value)) {
    if (typeof property !== 'string' || !allowed.includes(property)) {
      fail('unknown-property', field);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, property);
    if (!descriptor || !('value' in descriptor)) fail('invalid-type', field);
  }
}

function readOwnValue(
  value: Record<string, unknown>,
  property: string,
  field: PrettifyProfileValidationField,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  if (!descriptor || !('value' in descriptor)) fail('invalid-type', field);
  return descriptor.value;
}

function hasOwnValue(value: Record<string, unknown>, property: string): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  return Boolean(descriptor && 'value' in descriptor);
}

function countCodePoints(value: string): number {
  return Array.from(value).length;
}

export function isPrettifyBuiltInProfileId(value: unknown): value is PrettifyBuiltInProfileId {
  return typeof value === 'string' && (PRETTIFY_BUILT_IN_PROFILE_IDS as readonly string[]).includes(value);
}

export function isPrettifyCustomProfileId(value: unknown): value is PrettifyCustomProfileId {
  return typeof value === 'string' && CUSTOM_PROFILE_ID_PATTERN.test(value);
}

export function isPrettifyProfileId(value: unknown): value is PrettifyProfileId {
  return isPrettifyBuiltInProfileId(value) || isPrettifyCustomProfileId(value);
}

export function getPrettifyBuiltInProfileMetadata(id: PrettifyBuiltInProfileId): PrettifyBuiltInProfileMetadata {
  const metadata = PRETTIFY_BUILT_IN_PROFILE_METADATA.find((profile) => profile.id === id);
  if (!metadata) throw new Error('Unknown built-in Prettify profile ID');
  return metadata;
}

export function normalizePrettifyCustomProfileNameForUniqueness(value: string): string {
  return value.trim().normalize('NFKC').toLowerCase();
}

export function normalizePrettifyProfileInstruction(value: unknown): ValidatedPrettifyProfileInstruction {
  if (typeof value !== 'string') fail('invalid-type', 'customProfiles.instruction');
  const normalizedLength = countCodePoints(value.trim());
  if (normalizedLength === 0) fail('empty', 'customProfiles.instruction');
  if (normalizedLength > MAX_PRETTIFY_PROFILE_INSTRUCTION_CODE_POINTS) {
    fail('too-long', 'customProfiles.instruction');
  }
  return value as ValidatedPrettifyProfileInstruction;
}

function normalizeCustomProfile(value: unknown): PrettifyCustomProfile {
  if (!isPlainRecord(value)) fail('invalid-type', 'customProfiles');
  assertOnlyProperties(value, CUSTOM_PROFILE_PROPERTY_NAMES, 'customProfiles');

  const id = readOwnValue(value, 'id', 'customProfiles.id');
  if (!isPrettifyCustomProfileId(id)) fail('invalid-id', 'customProfiles.id');

  const rawName = readOwnValue(value, 'name', 'customProfiles.name');
  if (typeof rawName !== 'string') fail('invalid-type', 'customProfiles.name');
  const name = rawName.trim();
  if (countCodePoints(name) === 0) fail('empty', 'customProfiles.name');
  if (countCodePoints(name) > MAX_PRETTIFY_PROFILE_NAME_CODE_POINTS) {
    fail('too-long', 'customProfiles.name');
  }

  let description: string | undefined;
  if (hasOwnValue(value, 'description')) {
    const rawDescription = readOwnValue(value, 'description', 'customProfiles.description');
    if (typeof rawDescription !== 'string') fail('invalid-type', 'customProfiles.description');
    const trimmedDescription = rawDescription.trim();
    if (countCodePoints(trimmedDescription) > MAX_PRETTIFY_PROFILE_DESCRIPTION_CODE_POINTS) {
      fail('too-long', 'customProfiles.description');
    }
    if (trimmedDescription) description = trimmedDescription;
  }

  const instruction = normalizePrettifyProfileInstruction(
    readOwnValue(value, 'instruction', 'customProfiles.instruction'),
  );

  return Object.freeze({
    ...(description === undefined ? {} : { description }),
    id,
    instruction,
    name,
  });
}

export function normalizePrettifyProfileCatalog(value: unknown): PrettifyProfileCatalog {
  if (!isPlainRecord(value)) fail('invalid-type', 'catalog');
  assertOnlyProperties(value, CATALOG_PROPERTY_NAMES, 'catalog');

  const schemaVersion = readOwnValue(value, 'schemaVersion', 'schemaVersion');
  if (schemaVersion !== PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION) {
    fail('unsupported-version', 'schemaVersion');
  }

  const rawCustomProfiles = readOwnValue(value, 'customProfiles', 'customProfiles');
  if (!Array.isArray(rawCustomProfiles)) fail('invalid-type', 'customProfiles');
  if (rawCustomProfiles.length > MAX_PRETTIFY_CUSTOM_PROFILES) {
    fail('capacity-exceeded', 'customProfiles');
  }

  const customProfiles: PrettifyCustomProfile[] = [];
  const customIds = new Set<PrettifyCustomProfileId>();
  const customNames = new Set<string>();
  for (const rawProfile of rawCustomProfiles) {
    const profile = normalizeCustomProfile(rawProfile);
    if (customIds.has(profile.id)) fail('duplicate-id', 'customProfiles.id');
    const normalizedName = normalizePrettifyCustomProfileNameForUniqueness(profile.name);
    if (customNames.has(normalizedName)) fail('duplicate-name', 'customProfiles.name');
    customIds.add(profile.id);
    customNames.add(normalizedName);
    customProfiles.push(profile);
  }

  const validProfileIds = new Set<PrettifyProfileId>([...PRETTIFY_BUILT_IN_PROFILE_IDS, ...customIds]);
  const defaultProfileId = readOwnValue(value, 'defaultProfileId', 'defaultProfileId');
  if (typeof defaultProfileId !== 'string' || !validProfileIds.has(defaultProfileId as PrettifyProfileId)) {
    fail('invalid-default', 'defaultProfileId');
  }

  const rawChooserOrder = readOwnValue(value, 'chooserOrder', 'chooserOrder');
  if (!Array.isArray(rawChooserOrder) || rawChooserOrder.length !== validProfileIds.size) {
    fail('invalid-order', 'chooserOrder');
  }
  const chooserOrder: PrettifyProfileId[] = [];
  const orderedIds = new Set<PrettifyProfileId>();
  for (const rawId of rawChooserOrder) {
    if (typeof rawId !== 'string' || !validProfileIds.has(rawId as PrettifyProfileId)) {
      fail('invalid-order', 'chooserOrder');
    }
    const profileId = rawId as PrettifyProfileId;
    if (orderedIds.has(profileId)) fail('invalid-order', 'chooserOrder');
    orderedIds.add(profileId);
    chooserOrder.push(profileId);
  }

  return Object.freeze({
    chooserOrder: Object.freeze(chooserOrder),
    customProfiles: Object.freeze(customProfiles),
    defaultProfileId: defaultProfileId as PrettifyProfileId,
    schemaVersion,
  });
}

export function isValidPrettifyProfileCatalog(value: unknown): boolean {
  try {
    normalizePrettifyProfileCatalog(value);
    return true;
  } catch {
    return false;
  }
}

export function normalizePrettifyProfileSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{Diacritic}/gu, '');
}

export function matchesPrettifyProfileSearchQuery(item: PrettifyProfileSearchItem, query: string): boolean {
  const terms = normalizePrettifyProfileSearchText(query).trim().split(/\s+/u).filter(Boolean);
  if (terms.length === 0) return true;
  const searchableText = normalizePrettifyProfileSearchText(`${item.name}\n${item.description ?? ''}`);
  return terms.every((term) => searchableText.includes(term));
}

export function filterPrettifyProfilesBySearchQuery<T extends PrettifyProfileSearchItem>(
  profiles: readonly T[],
  query: string,
): T[] {
  return profiles.filter((profile) => matchesPrettifyProfileSearchQuery(profile, query));
}
