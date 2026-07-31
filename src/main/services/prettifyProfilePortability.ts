import * as path from 'node:path';

import type {
  BrowserWindow,
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
} from 'electron';

import type { TranslationKey } from '../i18n';
import {
  MAX_PRETTIFY_PROFILE_PORTABLE_BYTES,
  normalizePrettifyPortableProfiles,
  parsePrettifyProfilePortableDocument,
  PrettifyProfilePortabilityValidationError,
  serializePrettifyProfilePortableDocument,
  type PrettifyPortableProfile,
  type PrettifyProfileExportRequest,
  type PrettifyProfileExportResult,
  type PrettifyProfileImportAction,
  type PrettifyProfileImportApplyResult,
  type PrettifyProfileImportConflict,
  type PrettifyProfileImportConflictKind,
  type PrettifyProfileImportDecision,
  type PrettifyProfileImportRequest,
  type PrettifyProfileImportResult,
  type PrettifyProfilePortabilityFailureCode,
} from '@shared/prettifyProfilePortability';
import {
  isPrettifyCustomProfileId,
  MAX_PRETTIFY_CUSTOM_PROFILES,
  normalizePrettifyCustomProfile,
  normalizePrettifyCustomProfileNameForUniqueness,
  normalizePrettifyProfileCatalog,
  type PrettifyCustomProfile,
  type PrettifyCustomProfileId,
  type PrettifyProfileCatalog,
} from '@shared/prettifyProfiles';
import type { SystemNotificationOptions } from '@shared/notifications';

const PRETTIFY_PROFILE_EXPORT_FILENAME = 'gpt-voice-prettify-profiles.json';
const PRETTIFY_PROFILE_JSON_EXTENSION = '.json';
const PRETTIFY_PROFILE_FILE_FILTER = Object.freeze({
  extensions: ['json'],
  name: 'JSON',
});
const PRETTIFY_PROFILE_EXPORT_DIALOG_PROPERTIES: NonNullable<SaveDialogOptions['properties']> = [
  'createDirectory',
  'showOverwriteConfirmation',
];
const PRETTIFY_PROFILE_IMPORT_DIALOG_PROPERTIES: NonNullable<OpenDialogOptions['properties']> = ['openFile'];
const PRIVATE_FILE_MODE = 0o600;

const EXPORT_SAVED_RESULT = Object.freeze({ status: 'saved' } as const);
const CANCELLED_RESULT = Object.freeze({ status: 'cancelled' } as const);
const UNCHANGED_RESULT = Object.freeze({ status: 'unchanged' } as const);
const RENAME_REPLACE_SKIP_ACTIONS = Object.freeze(['rename', 'replace', 'skip'] as const);
const RENAME_SKIP_ACTIONS = Object.freeze(['rename', 'skip'] as const);

type PrettifyProfilePortabilityOperation = 'apply-import' | 'export' | 'import';

export interface PrettifyProfilePortabilityDialog {
  showOpenDialog(parentWindow: BrowserWindow, options: OpenDialogOptions): Promise<OpenDialogReturnValue>;
  showSaveDialog(parentWindow: BrowserWindow, options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
}

export interface PrettifyProfilePortabilityFileSystem {
  pathExists(filePath: string): Promise<boolean>;
  readFileBounded(filePath: string, maxBytes: number): Promise<Uint8Array>;
  writeFileAtomically(filePath: string, contents: string, mode: number): Promise<void>;
}

export interface PrettifyProfilePortabilityLogger {
  warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

export interface PrettifyProfilePortabilityNotification {
  show(title: string, body: string, options?: SystemNotificationOptions): void;
}

export interface PrettifyProfilePortabilityServiceDependencies {
  readonly allocateCustomProfileId: (additionalForbiddenIds: unknown) => PrettifyCustomProfileId;
  readonly dialog: PrettifyProfilePortabilityDialog;
  readonly fileSystem: PrettifyProfilePortabilityFileSystem;
  readonly localization: {
    translate(key: TranslationKey): string;
  };
  readonly logger: PrettifyProfilePortabilityLogger;
  readonly notification: PrettifyProfilePortabilityNotification;
}

interface ImportConflictAnalysis {
  readonly importedProfileId: PrettifyCustomProfileId;
  readonly kind: PrettifyProfileImportConflictKind;
  readonly localProfileIds: readonly PrettifyCustomProfileId[];
}

interface ImportAnalysisEntry {
  readonly conflict: ImportConflictAnalysis | null;
  readonly profile: PrettifyPortableProfile;
}

interface NormalizedImportPlan {
  readonly decisions: ReadonlyMap<PrettifyCustomProfileId, PrettifyProfileImportDecision>;
  readonly draft: PrettifyProfileCatalog;
  readonly entries: readonly ImportAnalysisEntry[];
}

type ExportDestinationResult =
  { readonly status: 'cancelled' } | { readonly filePath: string; readonly status: 'selected' };

type ImportSourceResult = { readonly status: 'cancelled' } | { readonly filePath: string; readonly status: 'selected' };

function invalidRequest(): never {
  throw new TypeError('Invalid Prettify profile portability request');
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readExactRecord(value: unknown, expectedProperties: readonly string[]): Record<string, unknown> {
  if (!isPlainRecord(value)) invalidRequest();
  const properties = Reflect.ownKeys(value);
  if (
    properties.length !== expectedProperties.length ||
    properties.some((property) => typeof property !== 'string' || !expectedProperties.includes(property))
  ) {
    invalidRequest();
  }
  for (const property of expectedProperties) {
    const descriptor = Object.getOwnPropertyDescriptor(value, property);
    if (!descriptor || !('value' in descriptor)) invalidRequest();
  }
  return value;
}

function readOwnValue(value: Record<string, unknown>, property: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  if (!descriptor || !('value' in descriptor)) invalidRequest();
  return descriptor.value;
}

function normalizeDraft(value: unknown): PrettifyProfileCatalog {
  try {
    return normalizePrettifyProfileCatalog(value);
  } catch {
    invalidRequest();
  }
}

function normalizeExportRequest(value: unknown): PrettifyProfileExportRequest {
  const request = readExactRecord(value, ['confirmedPlaintext', 'draft', 'profileIds']);
  if (readOwnValue(request, 'confirmedPlaintext') !== true) invalidRequest();
  const draft = normalizeDraft(readOwnValue(request, 'draft'));
  const rawProfileIds = readOwnValue(request, 'profileIds');
  if (
    !Array.isArray(rawProfileIds) ||
    rawProfileIds.length === 0 ||
    rawProfileIds.length > MAX_PRETTIFY_CUSTOM_PROFILES
  ) {
    invalidRequest();
  }
  const profileIds: PrettifyCustomProfileId[] = [];
  const seenIds = new Set<PrettifyCustomProfileId>();
  for (const profileId of rawProfileIds) {
    if (!isPrettifyCustomProfileId(profileId) || seenIds.has(profileId)) invalidRequest();
    if (!draft.customProfiles.some(({ id }) => id === profileId)) invalidRequest();
    seenIds.add(profileId);
    profileIds.push(profileId);
  }
  return Object.freeze({
    confirmedPlaintext: true,
    draft,
    profileIds: Object.freeze(profileIds),
  });
}

function normalizeImportRequest(value: unknown): PrettifyProfileImportRequest {
  const request = readExactRecord(value, ['draft']);
  return Object.freeze({ draft: normalizeDraft(readOwnValue(request, 'draft')) });
}

function normalizeDecision(value: unknown): PrettifyProfileImportDecision {
  if (!isPlainRecord(value)) invalidRequest();
  const action = readOwnValue(value, 'action');
  if (action !== 'rename' && action !== 'replace' && action !== 'skip') invalidRequest();
  const expectedProperties =
    action === 'rename' ? ['action', 'importedProfileId', 'name'] : ['action', 'importedProfileId'];
  const decision = readExactRecord(value, expectedProperties);
  const importedProfileId = readOwnValue(decision, 'importedProfileId');
  if (!isPrettifyCustomProfileId(importedProfileId)) invalidRequest();
  if (action === 'rename') {
    const name = readOwnValue(decision, 'name');
    if (typeof name !== 'string') invalidRequest();
    return Object.freeze({ action, importedProfileId, name });
  }
  return Object.freeze({ action, importedProfileId });
}

function createFailureResult(code: PrettifyProfilePortabilityFailureCode): {
  readonly code: PrettifyProfilePortabilityFailureCode;
  readonly status: 'failed';
} {
  return Object.freeze({ code, status: 'failed' });
}

function isUsableAbsolutePath(filePath: unknown): filePath is string {
  return typeof filePath === 'string' && path.isAbsolute(filePath) && !filePath.includes('\0');
}

function createCustomProfileWithIdentity(
  profile: PrettifyPortableProfile,
  id: PrettifyCustomProfileId,
  name = profile.name,
): PrettifyCustomProfile {
  return normalizePrettifyCustomProfile({
    ...(profile.description === undefined ? {} : { description: profile.description }),
    id,
    instruction: profile.instruction,
    name,
  });
}

function catalogsEqual(first: PrettifyProfileCatalog, second: PrettifyProfileCatalog): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

/** Owns privileged portable-profile file flows and authoritative draft transformations. */
export class PrettifyProfilePortabilityService {
  public constructor(private readonly dependencies: PrettifyProfilePortabilityServiceDependencies) {}

  public async exportProfiles(settingsWindow: BrowserWindow, input: unknown): Promise<PrettifyProfileExportResult> {
    if (settingsWindow.isDestroyed()) return this.fail('export', 'window-unavailable');

    let request: PrettifyProfileExportRequest;
    try {
      request = normalizeExportRequest(input);
    } catch {
      return this.fail('export', 'invalid-request');
    }

    const selectedProfiles = request.profileIds.map((profileId) => {
      const profile = request.draft.customProfiles.find(({ id }) => id === profileId);
      if (!profile) invalidRequest();
      return profile;
    });
    let contents: string;
    try {
      contents = serializePrettifyProfilePortableDocument(selectedProfiles);
    } catch {
      return this.fail('export', 'invalid-request');
    }

    let destination: ExportDestinationResult;
    try {
      destination = await this.selectExportDestination(settingsWindow);
    } catch {
      this.notifyExportResult('failed');
      return this.fail('export', 'write-failed');
    }
    if (destination.status === 'cancelled') return CANCELLED_RESULT;
    if (settingsWindow.isDestroyed()) return this.fail('export', 'window-unavailable');

    try {
      await this.dependencies.fileSystem.writeFileAtomically(destination.filePath, contents, PRIVATE_FILE_MODE);
      this.notifyExportResult('saved');
      return EXPORT_SAVED_RESULT;
    } catch {
      this.notifyExportResult('failed');
      return this.fail('export', 'write-failed');
    }
  }

  public async importProfiles(settingsWindow: BrowserWindow, input: unknown): Promise<PrettifyProfileImportResult> {
    if (settingsWindow.isDestroyed()) return this.fail('import', 'window-unavailable');

    let request: PrettifyProfileImportRequest;
    try {
      request = normalizeImportRequest(input);
    } catch {
      return this.fail('import', 'invalid-request');
    }

    let source: ImportSourceResult;
    try {
      source = await this.selectImportSource(settingsWindow);
    } catch {
      this.notifyImportFailure();
      return this.fail('import', 'read-failed');
    }
    if (source.status === 'cancelled') return CANCELLED_RESULT;
    if (settingsWindow.isDestroyed()) return this.fail('import', 'window-unavailable');

    let profiles: readonly PrettifyPortableProfile[];
    try {
      const bytes = await this.dependencies.fileSystem.readFileBounded(
        source.filePath,
        MAX_PRETTIFY_PROFILE_PORTABLE_BYTES,
      );
      profiles = parsePrettifyProfilePortableDocument(bytes).profiles;
    } catch (error: unknown) {
      this.notifyImportFailure();
      const code = error instanceof PrettifyProfilePortabilityValidationError ? 'invalid-document' : 'read-failed';
      return this.fail('import', code);
    }

    const entries = this.analyzeImport(request.draft, profiles);
    const replaceUnavailableReason = this.dependencies.localization.translate(
      'prettify.profilePortability.replaceUnavailableDualConflict',
    );
    const conflicts = entries.flatMap(({ conflict }) =>
      conflict ? [this.createPublicConflict(conflict, replaceUnavailableReason)] : [],
    );
    return Object.freeze({
      conflicts: Object.freeze(conflicts),
      profiles,
      status: 'ready',
    });
  }

  public applyImport(settingsWindow: BrowserWindow, input: unknown): PrettifyProfileImportApplyResult {
    if (settingsWindow.isDestroyed()) return this.fail('apply-import', 'window-unavailable');

    try {
      const plan = this.normalizeImportPlan(input);
      return this.applyNormalizedImportPlan(plan);
    } catch {
      return this.fail('apply-import', 'invalid-plan');
    }
  }

  private normalizeImportPlan(input: unknown): NormalizedImportPlan {
    const request = readExactRecord(input, ['decisions', 'draft', 'profiles']);
    const draft = normalizeDraft(readOwnValue(request, 'draft'));
    const profiles = normalizePrettifyPortableProfiles(readOwnValue(request, 'profiles'));
    const entries = this.analyzeImport(draft, profiles);
    const rawDecisions = readOwnValue(request, 'decisions');
    if (!Array.isArray(rawDecisions) || rawDecisions.length > profiles.length) invalidRequest();

    const conflicts = new Map(
      entries.flatMap(({ conflict }) => (conflict ? [[conflict.importedProfileId, conflict] as const] : [])),
    );
    const decisions = new Map<PrettifyCustomProfileId, PrettifyProfileImportDecision>();
    for (const rawDecision of rawDecisions) {
      const decision = normalizeDecision(rawDecision);
      if (decisions.has(decision.importedProfileId)) invalidRequest();
      const conflict = conflicts.get(decision.importedProfileId);
      if (!conflict || !this.isActionAllowed(conflict, decision.action)) invalidRequest();
      decisions.set(decision.importedProfileId, decision);
    }
    if (decisions.size !== conflicts.size) invalidRequest();
    return Object.freeze({ decisions, draft, entries });
  }

  private applyNormalizedImportPlan(plan: NormalizedImportPlan): PrettifyProfileImportApplyResult {
    const replacementTargets = new Set<PrettifyCustomProfileId>();
    const renamedProfiles = new Map<PrettifyCustomProfileId, PrettifyCustomProfile>();
    let appendCount = 0;

    for (const { conflict, profile } of plan.entries) {
      if (!conflict) {
        appendCount += 1;
        continue;
      }
      const decision = plan.decisions.get(profile.id);
      if (!decision) invalidRequest();
      if (decision.action === 'skip') continue;
      if (decision.action === 'replace') {
        const targetId = conflict.localProfileIds[0];
        if (!targetId || conflict.localProfileIds.length !== 1 || replacementTargets.has(targetId)) {
          invalidRequest();
        }
        replacementTargets.add(targetId);
        continue;
      }
      if (decision.action !== 'rename') invalidRequest();
      const renamed = createCustomProfileWithIdentity(profile, profile.id, decision.name);
      renamedProfiles.set(profile.id, renamed);
      appendCount += 1;
    }

    if (plan.draft.customProfiles.length + appendCount > MAX_PRETTIFY_CUSTOM_PROFILES) invalidRequest();
    this.assertUniqueCandidateNames(plan, replacementTargets, renamedProfiles);

    const forbiddenIds = new Set<PrettifyCustomProfileId>(plan.draft.customProfiles.map(({ id }) => id));
    for (const { conflict, profile } of plan.entries) {
      if (!conflict) forbiddenIds.add(profile.id);
    }

    const replacements = new Map<PrettifyCustomProfileId, PrettifyCustomProfile>();
    const appendedProfiles: PrettifyCustomProfile[] = [];
    for (const { conflict, profile } of plan.entries) {
      if (!conflict) {
        appendedProfiles.push(profile);
        continue;
      }
      const decision = plan.decisions.get(profile.id);
      if (!decision || decision.action === 'skip') continue;
      if (decision.action === 'replace') {
        const targetId = conflict.localProfileIds[0];
        if (!targetId) invalidRequest();
        replacements.set(targetId, createCustomProfileWithIdentity(profile, targetId));
        continue;
      }

      const allocatedId = this.dependencies.allocateCustomProfileId([...forbiddenIds]);
      if (!isPrettifyCustomProfileId(allocatedId) || forbiddenIds.has(allocatedId)) invalidRequest();
      forbiddenIds.add(allocatedId);
      const renamed = renamedProfiles.get(profile.id);
      if (!renamed) invalidRequest();
      appendedProfiles.push(createCustomProfileWithIdentity(renamed, allocatedId));
    }

    const existingProfiles = plan.draft.customProfiles.map((profile) => replacements.get(profile.id) ?? profile);
    const nextDraft = normalizePrettifyProfileCatalog({
      chooserOrder: [...plan.draft.chooserOrder, ...appendedProfiles.map(({ id }) => id)],
      customProfiles: [...existingProfiles, ...appendedProfiles],
      defaultProfileId: plan.draft.defaultProfileId,
      schemaVersion: plan.draft.schemaVersion,
    });
    if (catalogsEqual(plan.draft, nextDraft)) return UNCHANGED_RESULT;
    return Object.freeze({ draft: nextDraft, status: 'applied' });
  }

  private assertUniqueCandidateNames(
    plan: NormalizedImportPlan,
    replacementTargets: ReadonlySet<PrettifyCustomProfileId>,
    renamedProfiles: ReadonlyMap<PrettifyCustomProfileId, PrettifyCustomProfile>,
  ): void {
    const names = new Set<string>();
    for (const profile of plan.draft.customProfiles) {
      if (replacementTargets.has(profile.id)) continue;
      names.add(normalizePrettifyCustomProfileNameForUniqueness(profile.name));
    }
    for (const { conflict, profile } of plan.entries) {
      const decision = conflict ? plan.decisions.get(profile.id) : undefined;
      if (decision?.action === 'skip') continue;
      const candidate = decision?.action === 'rename' ? renamedProfiles.get(profile.id) : profile;
      if (!candidate) invalidRequest();
      const normalizedName = normalizePrettifyCustomProfileNameForUniqueness(candidate.name);
      if (names.has(normalizedName)) invalidRequest();
      names.add(normalizedName);
    }
  }

  private analyzeImport(
    draft: PrettifyProfileCatalog,
    profiles: readonly PrettifyPortableProfile[],
  ): readonly ImportAnalysisEntry[] {
    const localById = new Map(draft.customProfiles.map((profile) => [profile.id, profile] as const));
    const localByName = new Map(
      draft.customProfiles.map(
        (profile) => [normalizePrettifyCustomProfileNameForUniqueness(profile.name), profile] as const,
      ),
    );

    return Object.freeze(
      profiles.map((profile) => {
        const idTarget = localById.get(profile.id);
        const nameTarget = localByName.get(normalizePrettifyCustomProfileNameForUniqueness(profile.name));
        let conflict: ImportConflictAnalysis | null = null;
        if (idTarget && nameTarget && idTarget.id !== nameTarget.id) {
          conflict = Object.freeze({
            importedProfileId: profile.id,
            kind: 'dual-target',
            localProfileIds: Object.freeze([idTarget.id, nameTarget.id]),
          });
        } else if (idTarget && nameTarget) {
          conflict = Object.freeze({
            importedProfileId: profile.id,
            kind: 'same-target',
            localProfileIds: Object.freeze([idTarget.id]),
          });
        } else if (idTarget) {
          conflict = Object.freeze({
            importedProfileId: profile.id,
            kind: 'id',
            localProfileIds: Object.freeze([idTarget.id]),
          });
        } else if (nameTarget) {
          conflict = Object.freeze({
            importedProfileId: profile.id,
            kind: 'name',
            localProfileIds: Object.freeze([nameTarget.id]),
          });
        }
        return Object.freeze({ conflict, profile });
      }),
    );
  }

  private createPublicConflict(
    conflict: ImportConflictAnalysis,
    replaceUnavailableReason: string,
  ): PrettifyProfileImportConflict {
    if (conflict.kind === 'dual-target') {
      return Object.freeze({
        allowedActions: RENAME_SKIP_ACTIONS,
        importedProfileId: conflict.importedProfileId,
        kind: conflict.kind,
        localProfileIds: conflict.localProfileIds,
        replaceUnavailableReason,
      });
    }
    return Object.freeze({
      allowedActions: RENAME_REPLACE_SKIP_ACTIONS,
      importedProfileId: conflict.importedProfileId,
      kind: conflict.kind,
      localProfileIds: conflict.localProfileIds,
    });
  }

  private isActionAllowed(conflict: ImportConflictAnalysis, action: PrettifyProfileImportAction): boolean {
    return action !== 'replace' || conflict.kind !== 'dual-target';
  }

  private async selectExportDestination(settingsWindow: BrowserWindow): Promise<ExportDestinationResult> {
    const baseOptions: SaveDialogOptions = {
      defaultPath: PRETTIFY_PROFILE_EXPORT_FILENAME,
      filters: [PRETTIFY_PROFILE_FILE_FILTER],
      properties: [...PRETTIFY_PROFILE_EXPORT_DIALOG_PROPERTIES],
      title: this.dependencies.localization.translate('prettify.profilePortability.exportDialogTitle'),
    };
    let options = baseOptions;
    for (;;) {
      const selection = await this.dependencies.dialog.showSaveDialog(settingsWindow, options);
      if (selection.canceled) return CANCELLED_RESULT;
      if (!isUsableAbsolutePath(selection.filePath)) throw new Error('Invalid export destination');
      const selectedPath = selection.filePath;
      const hasExtension = selectedPath.toLowerCase().endsWith(PRETTIFY_PROFILE_JSON_EXTENSION);
      const finalPath = hasExtension ? selectedPath : `${selectedPath}${PRETTIFY_PROFILE_JSON_EXTENSION}`;
      if (hasExtension || !(await this.dependencies.fileSystem.pathExists(finalPath))) {
        return Object.freeze({ filePath: finalPath, status: 'selected' });
      }
      options = { ...baseOptions, defaultPath: finalPath };
    }
  }

  private async selectImportSource(settingsWindow: BrowserWindow): Promise<ImportSourceResult> {
    const selection = await this.dependencies.dialog.showOpenDialog(settingsWindow, {
      filters: [PRETTIFY_PROFILE_FILE_FILTER],
      properties: [...PRETTIFY_PROFILE_IMPORT_DIALOG_PROPERTIES],
      title: this.dependencies.localization.translate('prettify.profilePortability.importDialogTitle'),
    });
    if (selection.canceled) return CANCELLED_RESULT;
    if (selection.filePaths.length !== 1 || !isUsableAbsolutePath(selection.filePaths[0])) {
      throw new Error('Invalid import source');
    }
    return Object.freeze({ filePath: selection.filePaths[0], status: 'selected' });
  }

  private fail(
    operation: PrettifyProfilePortabilityOperation,
    code: PrettifyProfilePortabilityFailureCode,
  ): { readonly code: PrettifyProfilePortabilityFailureCode; readonly status: 'failed' } {
    try {
      this.dependencies.logger.warn('Prettify profile portability operation failed', {
        code,
        operation,
      });
    } catch {
      // The closed failure result remains authoritative if logging is unavailable.
    }
    return createFailureResult(code);
  }

  private notifyExportResult(status: 'failed' | 'saved'): void {
    const titleKey =
      status === 'saved' ? 'notification.prettifyProfilesExportSaved' : 'notification.prettifyProfilesExportFailed';
    const bodyKey =
      status === 'saved'
        ? 'notification.prettifyProfilesExportSavedBody'
        : 'notification.prettifyProfilesExportFailedBody';
    this.notifySafely(titleKey, bodyKey, status === 'saved' ? 'success' : 'error');
  }

  private notifyImportFailure(): void {
    this.notifySafely(
      'notification.prettifyProfilesImportFailed',
      'notification.prettifyProfilesImportFailedBody',
      'error',
    );
  }

  private notifySafely(titleKey: TranslationKey, bodyKey: TranslationKey, sound: 'error' | 'success'): void {
    try {
      this.dependencies.notification.show(
        this.dependencies.localization.translate(titleKey),
        this.dependencies.localization.translate(bodyKey),
        { sound },
      );
    } catch {
      try {
        this.dependencies.logger.warn('Prettify profile portability notification failed');
      } catch {
        // File and merge results remain fail-safe if both adapters are unavailable.
      }
    }
  }
}
