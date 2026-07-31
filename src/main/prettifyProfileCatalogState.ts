/* eslint-disable max-classes-per-file -- the state owner and its content-free allocation error share one domain boundary. */
import {
  MAX_PRETTIFY_CUSTOM_PROFILES,
  PRETTIFY_BUILT_IN_PROFILE_IDS,
  PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
  isPrettifyBuiltInProfileId,
  isPrettifyCustomProfileId,
  normalizePrettifyCustomProfile,
  normalizePrettifyCustomProfileNameForUniqueness,
  normalizePrettifyProfileCatalog,
  normalizePrettifyProfileInstruction,
  type PrettifyCustomProfile,
  type PrettifyCustomProfileId,
  type PrettifyProfileCatalog,
  type PrettifyProfileId,
} from '@shared/prettifyProfiles';
import { DEFAULT_PRETTIFY_PROMPT, LEGACY_DEFAULT_PRETTIFY_PROMPTS } from '@shared/prettifySettings';
import { getPrettifyBuiltInProfileDefinition } from './services/prettifyProfileInstruction';

const MIGRATED_PRETTIFY_PROFILE_NAME = 'Migrated Prettify prompt';
const PRETTIFY_PROFILE_ID_ALLOCATION_ATTEMPT_LIMIT = 64;

export const PRETTIFY_PROFILE_ID_ALLOCATION_INVALID_FORBIDDEN_IDS =
  'prettify-profile-id-allocation-invalid-forbidden-ids';
export const PRETTIFY_PROFILE_ID_ALLOCATION_EXHAUSTED = 'prettify-profile-id-allocation-exhausted';

export const PRETTIFY_PROFILE_CATALOG_REPAIR_NOTIFICATION_KEYS = Object.freeze({
  body: 'notification.prettifyProfileCatalogRepairedBody',
  title: 'notification.prettifyProfileCatalogRepaired',
} as const);

export interface PrettifyProfileCatalogRepairNotice {
  readonly repaired: true;
}

export interface PrettifyProfileCatalogStateDependencies {
  readonly generateUuid: () => string;
}

export type PersistPrettifyProfileCatalog = (catalog: PrettifyProfileCatalog, legacyPromptProjection: string) => void;

interface ResolvedPrettifyProfileCatalog {
  readonly catalog: PrettifyProfileCatalog;
  readonly legacyPromptProjection: string;
  readonly repaired: boolean;
  readonly requiresPersistence: boolean;
}

/** Content-free failure returned by process-owned custom profile ID allocation. */
export class PrettifyProfileIdAllocationError extends Error {
  public constructor(
    public readonly code:
      typeof PRETTIFY_PROFILE_ID_ALLOCATION_EXHAUSTED | typeof PRETTIFY_PROFILE_ID_ALLOCATION_INVALID_FORBIDDEN_IDS,
  ) {
    super(code);
    this.name = 'PrettifyProfileIdAllocationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createFreshCatalog(): PrettifyProfileCatalog {
  return normalizePrettifyProfileCatalog({
    chooserOrder: [...PRETTIFY_BUILT_IN_PROFILE_IDS],
    customProfiles: [],
    defaultProfileId: 'prompt-ready',
    schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
  });
}

export function getPrettifyProfileCatalogLegacyPromptProjection(catalog: PrettifyProfileCatalog): string {
  if (isPrettifyBuiltInProfileId(catalog.defaultProfileId)) {
    return getPrettifyBuiltInProfileDefinition(catalog.defaultProfileId).instruction;
  }
  const profile = catalog.customProfiles.find(({ id }) => id === catalog.defaultProfileId);
  if (!profile) {
    throw new Error('prettify-profile-catalog-invalid-default');
  }
  return profile.instruction;
}

function normalizeChooserOrder(
  value: unknown,
  customProfiles: readonly PrettifyCustomProfile[],
): readonly PrettifyProfileId[] {
  const validIds = new Set<PrettifyProfileId>([
    ...PRETTIFY_BUILT_IN_PROFILE_IDS,
    ...customProfiles.map(({ id }) => id),
  ]);
  const seen = new Set<PrettifyProfileId>();
  const normalized: PrettifyProfileId[] = [];
  if (Array.isArray(value)) {
    for (const candidate of value) {
      if (
        typeof candidate !== 'string' ||
        !validIds.has(candidate as PrettifyProfileId) ||
        seen.has(candidate as PrettifyProfileId)
      ) {
        continue;
      }
      const profileId = candidate as PrettifyProfileId;
      seen.add(profileId);
      normalized.push(profileId);
    }
  }
  for (const profileId of PRETTIFY_BUILT_IN_PROFILE_IDS) {
    if (!seen.has(profileId)) normalized.push(profileId);
  }
  for (const { id } of customProfiles) {
    if (!seen.has(id)) normalized.push(id);
  }
  return normalized;
}

function salvageCustomProfiles(value: unknown): readonly PrettifyCustomProfile[] {
  if (!Array.isArray(value)) return [];
  const profiles: PrettifyCustomProfile[] = [];
  const ids = new Set<PrettifyCustomProfileId>();
  const names = new Set<string>();
  for (const candidate of value) {
    if (profiles.length >= MAX_PRETTIFY_CUSTOM_PROFILES) break;
    try {
      const profile = normalizePrettifyCustomProfile(candidate);
      const normalizedName = normalizePrettifyCustomProfileNameForUniqueness(profile.name);
      if (ids.has(profile.id) || names.has(normalizedName)) continue;
      ids.add(profile.id);
      names.add(normalizedName);
      profiles.push(profile);
    } catch {
      // Corrupt records are isolated; valid records retain their relative order.
    }
  }
  return profiles;
}

function salvageCatalog(value: unknown): PrettifyProfileCatalog {
  const record = isRecord(value) ? value : {};
  const customProfiles = salvageCustomProfiles(record.customProfiles);
  const customIds = new Set(customProfiles.map(({ id }) => id));
  const defaultProfileId =
    typeof record.defaultProfileId === 'string' &&
    (isPrettifyBuiltInProfileId(record.defaultProfileId) ||
      customIds.has(record.defaultProfileId as PrettifyCustomProfileId))
      ? (record.defaultProfileId as PrettifyProfileId)
      : 'prompt-ready';
  return normalizePrettifyProfileCatalog({
    chooserOrder: normalizeChooserOrder(record.chooserOrder, customProfiles),
    customProfiles,
    defaultProfileId,
    schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
  });
}

function isCanonicalCatalogInput(value: unknown, catalog: PrettifyProfileCatalog): boolean {
  try {
    return JSON.stringify(value) === JSON.stringify(catalog);
  } catch {
    return false;
  }
}

function isRecognizedLegacyPrompt(value: string): boolean {
  return value === DEFAULT_PRETTIFY_PROMPT || LEGACY_DEFAULT_PRETTIFY_PROMPTS.includes(value);
}

/** Owns one process graph's normalized profile catalog and issued custom IDs. */
export class PrettifyProfileCatalogState {
  private catalog = createFreshCatalog();
  private readonly issuedIds = new Set<PrettifyCustomProfileId>();
  private pendingRepairNotice: PrettifyProfileCatalogRepairNotice | null = null;

  public constructor(private readonly dependencies: PrettifyProfileCatalogStateDependencies) {}

  public getSnapshot(): PrettifyProfileCatalog {
    return this.catalog;
  }

  public resetToFreshCatalog(): PrettifyProfileCatalog {
    this.catalog = createFreshCatalog();
    this.pendingRepairNotice = null;
    return this.getSnapshot();
  }

  public consumeRepairNotice(): PrettifyProfileCatalogRepairNotice | null {
    const notice = this.pendingRepairNotice;
    this.pendingRepairNotice = null;
    return notice;
  }

  public load(
    persistedCatalog: unknown,
    legacyPrompt: unknown,
    persist: PersistPrettifyProfileCatalog,
  ): PrettifyProfileCatalog {
    const resolved =
      persistedCatalog === undefined
        ? this.migrateLegacyCatalog(legacyPrompt)
        : this.resolvePersistedCatalog(persistedCatalog, legacyPrompt);
    if (resolved.requiresPersistence) {
      persist(resolved.catalog, resolved.legacyPromptProjection);
    }
    this.catalog = resolved.catalog;
    if (resolved.repaired) {
      this.pendingRepairNotice = Object.freeze({ repaired: true });
    }
    return this.getSnapshot();
  }

  public save(candidate: unknown, persist: PersistPrettifyProfileCatalog): PrettifyProfileCatalog {
    const catalog = normalizePrettifyProfileCatalog(candidate);
    const legacyPromptProjection = getPrettifyProfileCatalogLegacyPromptProjection(catalog);
    persist(catalog, legacyPromptProjection);
    this.catalog = catalog;
    return this.getSnapshot();
  }

  public allocateCustomProfileId(additionalForbiddenIds: unknown): PrettifyCustomProfileId {
    const forbiddenIds = this.validateAdditionalForbiddenIds(additionalForbiddenIds);
    const occupiedIds = new Set<PrettifyCustomProfileId>([
      ...this.catalog.customProfiles.map(({ id }) => id),
      ...this.issuedIds,
      ...forbiddenIds,
    ]);
    for (let attempt = 0; attempt < PRETTIFY_PROFILE_ID_ALLOCATION_ATTEMPT_LIMIT; attempt += 1) {
      const candidate = `custom:${this.dependencies.generateUuid()}`;
      if (!isPrettifyCustomProfileId(candidate) || occupiedIds.has(candidate)) continue;
      this.issuedIds.add(candidate);
      return candidate;
    }
    throw new PrettifyProfileIdAllocationError(PRETTIFY_PROFILE_ID_ALLOCATION_EXHAUSTED);
  }

  private migrateLegacyCatalog(legacyPrompt: unknown): ResolvedPrettifyProfileCatalog {
    if (typeof legacyPrompt !== 'string' || !legacyPrompt.trim() || isRecognizedLegacyPrompt(legacyPrompt)) {
      const catalog = normalizePrettifyProfileCatalog({
        chooserOrder: [...PRETTIFY_BUILT_IN_PROFILE_IDS],
        customProfiles: [],
        defaultProfileId: 'polish',
        schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
      });
      return {
        catalog,
        legacyPromptProjection: getPrettifyProfileCatalogLegacyPromptProjection(catalog),
        repaired: typeof legacyPrompt === 'string' && !isRecognizedLegacyPrompt(legacyPrompt),
        requiresPersistence: true,
      };
    }

    let profile: PrettifyCustomProfile;
    try {
      const instruction = normalizePrettifyProfileInstruction(legacyPrompt);
      profile = normalizePrettifyCustomProfile({
        id: this.allocateCustomProfileId([]),
        instruction,
        name: MIGRATED_PRETTIFY_PROFILE_NAME,
      });
    } catch {
      const catalog = normalizePrettifyProfileCatalog({
        chooserOrder: [...PRETTIFY_BUILT_IN_PROFILE_IDS],
        customProfiles: [],
        defaultProfileId: 'polish',
        schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
      });
      return {
        catalog,
        legacyPromptProjection: getPrettifyProfileCatalogLegacyPromptProjection(catalog),
        repaired: true,
        requiresPersistence: true,
      };
    }
    const catalog = normalizePrettifyProfileCatalog({
      chooserOrder: [...PRETTIFY_BUILT_IN_PROFILE_IDS, profile.id],
      customProfiles: [profile],
      defaultProfileId: profile.id,
      schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
    });
    return {
      catalog,
      legacyPromptProjection: legacyPrompt,
      repaired: false,
      requiresPersistence: true,
    };
  }

  private resolvePersistedCatalog(persistedCatalog: unknown, legacyPrompt: unknown): ResolvedPrettifyProfileCatalog {
    let catalog: PrettifyProfileCatalog;
    let repaired: boolean;
    try {
      catalog = normalizePrettifyProfileCatalog(persistedCatalog);
      repaired = !isCanonicalCatalogInput(persistedCatalog, catalog);
    } catch {
      catalog = salvageCatalog(persistedCatalog);
      repaired = true;
    }
    const legacyPromptProjection = getPrettifyProfileCatalogLegacyPromptProjection(catalog);
    const projectionMismatch = legacyPrompt !== legacyPromptProjection;
    return {
      catalog,
      legacyPromptProjection,
      repaired: repaired || projectionMismatch,
      requiresPersistence: repaired || projectionMismatch,
    };
  }

  private validateAdditionalForbiddenIds(value: unknown): ReadonlySet<PrettifyCustomProfileId> {
    if (!Array.isArray(value) || value.length > MAX_PRETTIFY_CUSTOM_PROFILES) {
      throw new PrettifyProfileIdAllocationError(PRETTIFY_PROFILE_ID_ALLOCATION_INVALID_FORBIDDEN_IDS);
    }
    const ids = new Set<PrettifyCustomProfileId>();
    for (const candidate of value) {
      if (!isPrettifyCustomProfileId(candidate) || ids.has(candidate)) {
        throw new PrettifyProfileIdAllocationError(PRETTIFY_PROFILE_ID_ALLOCATION_INVALID_FORBIDDEN_IDS);
      }
      ids.add(candidate);
    }
    return ids;
  }
}

export interface PrettifyProfileCatalogRepairNoticeDependencies {
  readonly notice: PrettifyProfileCatalogRepairNotice | null;
  readonly notify: (title: string, body: string) => void;
  readonly translate: (
    key:
      | typeof PRETTIFY_PROFILE_CATALOG_REPAIR_NOTIFICATION_KEYS.body
      | typeof PRETTIFY_PROFILE_CATALOG_REPAIR_NOTIFICATION_KEYS.title,
  ) => string;
}

export function presentPendingPrettifyProfileCatalogRepairNotice({
  notice,
  notify,
  translate,
}: PrettifyProfileCatalogRepairNoticeDependencies): boolean {
  if (!notice) return false;
  try {
    notify(
      translate(PRETTIFY_PROFILE_CATALOG_REPAIR_NOTIFICATION_KEYS.title),
      translate(PRETTIFY_PROFILE_CATALOG_REPAIR_NOTIFICATION_KEYS.body),
    );
  } catch {
    // A repair notice is informational and must never block startup.
  }
  return true;
}
