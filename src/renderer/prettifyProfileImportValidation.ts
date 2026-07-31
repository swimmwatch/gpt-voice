import type {
  PrettifyPortableProfile,
  PrettifyProfileImportAction,
  PrettifyProfileImportConflict,
} from '@shared/prettifyProfilePortability';
import {
  MAX_PRETTIFY_CUSTOM_PROFILES,
  MAX_PRETTIFY_PROFILE_NAME_CODE_POINTS,
  normalizePrettifyCustomProfileNameForUniqueness,
  type PrettifyCustomProfile,
  type PrettifyCustomProfileId,
} from '@shared/prettifyProfiles';

export interface PrettifyProfileImportDecisionDraft {
  readonly action?: PrettifyProfileImportAction;
  readonly name: string;
}

export interface PrettifyProfileImportPreview {
  readonly conflicts: readonly PrettifyProfileImportConflict[];
  readonly profiles: readonly PrettifyPortableProfile[];
}

export interface PrettifyProfileImportValidationResult {
  readonly capacityValid: boolean;
  readonly complete: boolean;
  readonly renameErrors: ReadonlySet<PrettifyCustomProfileId>;
}

function countCodePoints(value: string): number {
  return Array.from(value).length;
}

function reserveReplacementTarget(
  conflict: PrettifyProfileImportConflict,
  replacementTargets: Set<PrettifyCustomProfileId>,
): boolean {
  const [targetId] = conflict.localProfileIds;
  if (!targetId || conflict.localProfileIds.length !== 1 || replacementTargets.has(targetId)) return false;
  replacementTargets.add(targetId);
  return true;
}

function validateFinalProfileNames(
  preview: PrettifyProfileImportPreview,
  decisions: Readonly<Record<PrettifyCustomProfileId, PrettifyProfileImportDecisionDraft>>,
  customProfiles: readonly PrettifyCustomProfile[],
  replacementTargets: ReadonlySet<PrettifyCustomProfileId>,
  renameErrors: Set<PrettifyCustomProfileId>,
): boolean {
  const conflictsById = new Map(preview.conflicts.map((conflict) => [conflict.importedProfileId, conflict]));
  const finalNames = new Map<string, PrettifyCustomProfileId | null>();
  for (const profile of customProfiles) {
    if (replacementTargets.has(profile.id)) continue;
    finalNames.set(normalizePrettifyCustomProfileNameForUniqueness(profile.name), null);
  }

  let valid = true;
  for (const profile of preview.profiles) {
    const conflict = conflictsById.get(profile.id);
    const decision = conflict ? decisions[profile.id] : undefined;
    if (conflict && (!decision?.action || decision.action === 'skip')) continue;

    const isRename = decision?.action === 'rename';
    const candidateName = isRename ? decision.name.trim() : profile.name;
    if (!candidateName) continue;
    const normalizedName = normalizePrettifyCustomProfileNameForUniqueness(candidateName);
    if (finalNames.has(normalizedName)) {
      if (isRename) renameErrors.add(profile.id);
      const previousRenameId = finalNames.get(normalizedName);
      if (previousRenameId) renameErrors.add(previousRenameId);
      valid = false;
      continue;
    }
    finalNames.set(normalizedName, isRename ? profile.id : null);
  }
  return valid;
}

/**
 * Mirrors the main-process merge result closely enough to keep the preview
 * actionable while the privileged service remains the final authority.
 */
export function validatePrettifyProfileImportPreview(
  preview: PrettifyProfileImportPreview | null,
  decisions: Readonly<Record<PrettifyCustomProfileId, PrettifyProfileImportDecisionDraft>>,
  customProfiles: readonly PrettifyCustomProfile[],
): PrettifyProfileImportValidationResult {
  const renameErrors = new Set<PrettifyCustomProfileId>();
  if (!preview) {
    return {
      capacityValid: false,
      complete: false,
      renameErrors,
    };
  }

  const replacementTargets = new Set<PrettifyCustomProfileId>();
  let appendedCount = preview.profiles.length - preview.conflicts.length;
  let complete = true;

  for (const conflict of preview.conflicts) {
    const decision = decisions[conflict.importedProfileId];
    if (!decision?.action || !conflict.allowedActions.includes(decision.action)) {
      complete = false;
      continue;
    }
    if (decision.action === 'replace') {
      if (!reserveReplacementTarget(conflict, replacementTargets)) {
        complete = false;
      }
    } else if (decision.action === 'rename') {
      appendedCount += 1;
      const name = decision.name.trim();
      if (!name || countCodePoints(name) > MAX_PRETTIFY_PROFILE_NAME_CODE_POINTS) {
        renameErrors.add(conflict.importedProfileId);
        complete = false;
      }
    }
  }

  if (!validateFinalProfileNames(preview, decisions, customProfiles, replacementTargets, renameErrors))
    complete = false;

  return {
    capacityValid: customProfiles.length + appendedCount <= MAX_PRETTIFY_CUSTOM_PROFILES,
    complete,
    renameErrors,
  };
}
