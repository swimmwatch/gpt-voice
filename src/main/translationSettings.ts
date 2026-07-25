/* eslint-disable max-classes-per-file -- validation and state ownership share one closed settings contract. */
import type * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';

import {
  DEFAULT_TRANSLATION_SETTINGS,
  TRANSLATION_PROVIDER_IDS,
  TRANSLATION_PROVIDER_INFO,
  getTranslationLanguage,
  isTranslationProviderId,
  type TranslationProviderId,
  type TranslationSettings,
} from '@shared/translationProvider';

export const TRANSLATION_SETTINGS_REPAIR_NOTIFICATION_KEYS = {
  body: 'notification.translationSettingsRepairedBody',
  title: 'notification.translationSettingsRepaired',
} as const;

export { DEFAULT_TRANSLATION_SETTINGS };

export type TranslationSettingsRepairCategory = 'legacyMigration' | 'provider' | 'shape' | 'target';

export interface TranslationSettingsRepairNotice {
  readonly categories: readonly TranslationSettingsRepairCategory[];
  readonly providers: readonly TranslationProviderId[];
}

export interface NormalizedTranslationSettings {
  readonly notice?: TranslationSettingsRepairNotice;
  readonly repaired: boolean;
  readonly settings: TranslationSettings;
}

export interface AtomicFileSystem {
  renameSync(oldPath: fs.PathLike, newPath: fs.PathLike): void;
  rmSync(path: fs.PathLike, options?: fs.RmDirOptions): void;
  writeFileSync(file: fs.PathOrFileDescriptor, data: string, options?: fs.WriteFileOptions): void;
}

export interface AtomicWriteDependencies {
  readonly createTemporaryPath?: (filePath: string) => string;
  readonly fileSystem: AtomicFileSystem;
}

/** Closed validation failure used to distinguish rejected IPC input from persistence errors. */
export class TranslationSettingsValidationError extends Error {
  constructor() {
    super('Invalid translation settings');
    this.name = 'TranslationSettingsValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function createImmutableTranslationSettings(settings: TranslationSettings): TranslationSettings {
  return Object.freeze({
    providerId: settings.providerId,
    targetLanguageByProvider: Object.freeze({
      google: settings.targetLanguageByProvider.google,
      bing: settings.targetLanguageByProvider.bing,
      yandex: settings.targetLanguageByProvider.yandex,
    }),
  });
}

export function assertValidTranslationSettings(value: unknown): asserts value is TranslationSettings {
  if (!isRecord(value) || !hasExactKeys(value, ['providerId', 'targetLanguageByProvider'])) {
    throw new TranslationSettingsValidationError();
  }
  if (!isTranslationProviderId(value.providerId) || !isRecord(value.targetLanguageByProvider)) {
    throw new TranslationSettingsValidationError();
  }
  if (!hasExactKeys(value.targetLanguageByProvider, TRANSLATION_PROVIDER_IDS)) {
    throw new TranslationSettingsValidationError();
  }
  for (const providerId of TRANSLATION_PROVIDER_IDS) {
    const targetLanguage = value.targetLanguageByProvider[providerId];
    if (
      typeof targetLanguage !== 'string' ||
      targetLanguage.trim().length === 0 ||
      !getTranslationLanguage(providerId, targetLanguage)
    ) {
      throw new TranslationSettingsValidationError();
    }
  }
}

function createRepairNotice(
  categories: ReadonlySet<TranslationSettingsRepairCategory>,
  providers: ReadonlySet<TranslationProviderId>,
): TranslationSettingsRepairNotice | undefined {
  if (categories.size === 0) return undefined;
  return Object.freeze({
    categories: Object.freeze([...categories].sort()),
    providers: Object.freeze(TRANSLATION_PROVIDER_IDS.filter((providerId) => providers.has(providerId))),
  });
}

function getMigratedTarget(providerId: TranslationProviderId, legacyTargetLanguage: unknown): string {
  return typeof legacyTargetLanguage === 'string' && getTranslationLanguage(providerId, legacyTargetLanguage)
    ? legacyTargetLanguage
    : TRANSLATION_PROVIDER_INFO[providerId].defaultTargetLanguage;
}

export function normalizePersistedTranslationSettings(
  value: unknown,
  legacyTargetLanguage?: unknown,
): NormalizedTranslationSettings {
  const categories = new Set<TranslationSettingsRepairCategory>();
  const providers = new Set<TranslationProviderId>();

  if (value === undefined) {
    categories.add('legacyMigration');
    for (const providerId of TRANSLATION_PROVIDER_IDS) providers.add(providerId);
    const settings = createImmutableTranslationSettings({
      providerId: 'google',
      targetLanguageByProvider: {
        google: getMigratedTarget('google', legacyTargetLanguage),
        bing: getMigratedTarget('bing', legacyTargetLanguage),
        yandex: getMigratedTarget('yandex', legacyTargetLanguage),
      },
    });
    return {
      notice: createRepairNotice(categories, providers),
      repaired: true,
      settings,
    };
  }

  const root = isRecord(value) ? value : {};
  if (!isRecord(value) || !hasExactKeys(root, ['providerId', 'targetLanguageByProvider'])) {
    categories.add('shape');
  }

  const providerId = isTranslationProviderId(root.providerId) ? root.providerId : 'google';
  if (!isTranslationProviderId(root.providerId)) categories.add('provider');

  const targets = isRecord(root.targetLanguageByProvider) ? root.targetLanguageByProvider : {};
  if (!isRecord(root.targetLanguageByProvider) || !hasExactKeys(targets, TRANSLATION_PROVIDER_IDS)) {
    categories.add('shape');
  }

  const targetLanguageByProvider = {} as Record<TranslationProviderId, string>;
  for (const currentProviderId of TRANSLATION_PROVIDER_IDS) {
    const candidate = targets[currentProviderId];
    if (
      typeof candidate === 'string' &&
      candidate.trim().length > 0 &&
      getTranslationLanguage(currentProviderId, candidate)
    ) {
      targetLanguageByProvider[currentProviderId] = candidate;
      continue;
    }
    targetLanguageByProvider[currentProviderId] = TRANSLATION_PROVIDER_INFO[currentProviderId].defaultTargetLanguage;
    categories.add('target');
    providers.add(currentProviderId);
  }

  const settings = createImmutableTranslationSettings({
    providerId,
    targetLanguageByProvider,
  });
  const notice = createRepairNotice(categories, providers);
  return {
    ...(notice ? { notice } : {}),
    repaired: categories.size > 0,
    settings,
  };
}

/** In-memory authoritative settings state with persistence-before-publication semantics. */
export class TranslationSettingsState {
  private pendingRepairNotice: TranslationSettingsRepairNotice | null = null;
  private settings = DEFAULT_TRANSLATION_SETTINGS;

  getLegacyGoogleTarget(): string {
    return this.settings.targetLanguageByProvider.google;
  }

  getSnapshot(): TranslationSettings {
    return createImmutableTranslationSettings(this.settings);
  }

  load(
    value: unknown,
    legacyTargetLanguage: unknown,
    persist: (settings: TranslationSettings) => void,
  ): NormalizedTranslationSettings {
    const normalized = normalizePersistedTranslationSettings(value, legacyTargetLanguage);
    if (normalized.repaired) persist(normalized.settings);
    this.settings = normalized.settings;
    this.pendingRepairNotice = normalized.notice ?? null;
    return normalized;
  }

  save(candidate: unknown, persist: (settings: TranslationSettings) => void): TranslationSettings {
    assertValidTranslationSettings(candidate);
    const next = createImmutableTranslationSettings(candidate);
    persist(next);
    this.settings = next;
    return this.getSnapshot();
  }

  consumeRepairNotice(): TranslationSettingsRepairNotice | null {
    const notice = this.pendingRepairNotice;
    this.pendingRepairNotice = null;
    return notice;
  }
}

export function writeTextFileAtomically(
  filePath: string,
  contents: string,
  { createTemporaryPath = (target) => `${target}.${randomUUID()}.tmp`, fileSystem }: AtomicWriteDependencies,
): void {
  const temporaryPath = createTemporaryPath(filePath);
  try {
    fileSystem.writeFileSync(temporaryPath, contents, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    fileSystem.renameSync(temporaryPath, filePath);
  } catch (error: unknown) {
    try {
      fileSystem.rmSync(temporaryPath, { force: true });
    } catch {
      // Preserve the original persistence error and never expose temporary-path details.
    }
    throw error;
  }
}

export interface TranslationSettingsRepairNoticeDependencies {
  readonly consume: () => TranslationSettingsRepairNotice | null;
  readonly notify: (title: string, body: string) => void;
  readonly translate: (
    key:
      | typeof TRANSLATION_SETTINGS_REPAIR_NOTIFICATION_KEYS.body
      | typeof TRANSLATION_SETTINGS_REPAIR_NOTIFICATION_KEYS.title,
  ) => string;
}

export function presentPendingTranslationSettingsRepairNotice({
  consume,
  notify,
  translate,
}: TranslationSettingsRepairNoticeDependencies): boolean {
  if (!consume()) return false;
  try {
    notify(
      translate(TRANSLATION_SETTINGS_REPAIR_NOTIFICATION_KEYS.title),
      translate(TRANSLATION_SETTINGS_REPAIR_NOTIFICATION_KEYS.body),
    );
  } catch {
    // A repair notice is informational and must never block startup.
  }
  return true;
}
