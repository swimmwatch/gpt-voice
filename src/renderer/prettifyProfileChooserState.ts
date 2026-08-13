import {
  isPrettifyProfileId,
  matchesPrettifyProfileSearchQuery,
  type PrettifyProfileId,
} from '@shared/prettifyProfiles';
import type {
  PrettifyProfileChooserOperationToken,
  PrettifyProfileChooserPayload,
  PrettifyProfileChooserProfileSummary,
} from '@shared/prettifyProfileChooser';

const INVALID_CHOOSER_PAYLOAD_ERROR = 'invalid-prettify-profile-chooser-payload';
const PAYLOAD_PROPERTIES = new Set(['profiles', 'sourceText', 'token']);
const PROFILE_PROPERTIES = new Set(['description', 'id', 'isDefault', 'kind', 'name']);

type ProfileMove = 'first' | 'last' | 'next' | 'previous';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyProperties(value: Readonly<Record<string, unknown>>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((property) => allowed.has(property));
}

function failInvalidPayload(): never {
  throw new Error(INVALID_CHOOSER_PAYLOAD_ERROR);
}

function normalizeProfileSummary(value: unknown): PrettifyProfileChooserProfileSummary {
  if (!isPlainRecord(value) || !hasOnlyProperties(value, PROFILE_PROPERTIES)) failInvalidPayload();
  if (!isPrettifyProfileId(value.id)) failInvalidPayload();
  if (value.kind !== 'built-in' && value.kind !== 'custom') failInvalidPayload();
  if (typeof value.name !== 'string' || !value.name.trim()) failInvalidPayload();
  if (value.description !== undefined && typeof value.description !== 'string') failInvalidPayload();
  if (typeof value.isDefault !== 'boolean') failInvalidPayload();

  return Object.freeze({
    ...(value.description === undefined ? {} : { description: value.description }),
    id: value.id,
    isDefault: value.isDefault,
    kind: value.kind,
    name: value.name,
  });
}

export function readPrettifyProfileChooserOperationToken(
  value: unknown,
): PrettifyProfileChooserOperationToken | undefined {
  if (!isPlainRecord(value) || typeof value.token !== 'string' || !value.token) return undefined;
  return value.token as PrettifyProfileChooserOperationToken;
}

export function normalizePrettifyProfileChooserPayload(value: unknown): PrettifyProfileChooserPayload {
  if (!isPlainRecord(value) || !hasOnlyProperties(value, PAYLOAD_PROPERTIES)) failInvalidPayload();
  const token = readPrettifyProfileChooserOperationToken(value);
  if (!token || typeof value.sourceText !== 'string' || !Array.isArray(value.profiles)) failInvalidPayload();

  const profiles = value.profiles.map(normalizeProfileSummary);
  const profileIds = new Set<PrettifyProfileId>();
  for (const profile of profiles) {
    if (profileIds.has(profile.id)) failInvalidPayload();
    profileIds.add(profile.id);
  }
  if (profiles.filter((profile) => profile.isDefault).length !== 1) failInvalidPayload();

  return Object.freeze({
    profiles: Object.freeze(profiles),
    sourceText: value.sourceText,
    token,
  });
}

export function filterPrettifyProfileChooserProfiles(
  profiles: readonly PrettifyProfileChooserProfileSummary[],
  query: string,
): readonly PrettifyProfileChooserProfileSummary[] {
  return profiles.filter((profile) => matchesPrettifyProfileSearchQuery(profile, query));
}

export function resolveDefaultPrettifyProfileChooserSelection(
  profiles: readonly PrettifyProfileChooserProfileSummary[],
): PrettifyProfileId | undefined {
  return profiles.find((profile) => profile.isDefault)?.id;
}

export function resolveVisiblePrettifyProfileChooserSelection(
  visibleProfiles: readonly PrettifyProfileChooserProfileSummary[],
  selectedProfileId: PrettifyProfileId | undefined,
): PrettifyProfileId | undefined {
  return visibleProfiles.some((profile) => profile.id === selectedProfileId) ? selectedProfileId : undefined;
}

export function movePrettifyProfileChooserSelection(
  visibleProfiles: readonly PrettifyProfileChooserProfileSummary[],
  currentProfileId: PrettifyProfileId,
  move: ProfileMove,
): PrettifyProfileId | undefined {
  if (visibleProfiles.length === 0) return undefined;
  if (move === 'first') return visibleProfiles[0]?.id;
  if (move === 'last') return visibleProfiles[visibleProfiles.length - 1]?.id;

  const currentIndex = visibleProfiles.findIndex((profile) => profile.id === currentProfileId);
  if (currentIndex < 0) {
    return move === 'next' ? visibleProfiles[0]?.id : visibleProfiles[visibleProfiles.length - 1]?.id;
  }
  const nextIndex =
    move === 'next' ? Math.min(currentIndex + 1, visibleProfiles.length - 1) : Math.max(currentIndex - 1, 0);
  return visibleProfiles[nextIndex]?.id;
}
