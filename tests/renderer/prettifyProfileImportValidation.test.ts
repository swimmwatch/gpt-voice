import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validatePrettifyProfileImportPreview,
  type PrettifyProfileImportDecisionDraft,
} from '@renderer/prettifyProfileImportValidation';
import { normalizePrettifyCustomProfile, type PrettifyCustomProfileId } from '@shared/prettifyProfiles';
import type { PrettifyPortableProfile, PrettifyProfileImportConflict } from '@shared/prettifyProfilePortability';

const PROFILE_IDS = {
  alpha: 'custom:00000000-0000-4000-8000-000000000001',
  beta: 'custom:00000000-0000-4000-8000-000000000002',
} as const satisfies Record<string, PrettifyCustomProfileId>;

function createProfile(id: PrettifyCustomProfileId, name: string): PrettifyPortableProfile {
  return normalizePrettifyCustomProfile({
    id,
    instruction: `Use the ${name} style.`,
    name,
  });
}

function createIdConflict(
  importedProfileId: PrettifyCustomProfileId,
  localProfileId: PrettifyCustomProfileId,
): PrettifyProfileImportConflict {
  return {
    allowedActions: ['rename', 'replace', 'skip'],
    importedProfileId,
    kind: 'id',
    localProfileIds: [localProfileId],
  };
}

function validate(
  profiles: readonly PrettifyPortableProfile[],
  conflicts: readonly PrettifyProfileImportConflict[],
  decisions: Readonly<Record<PrettifyCustomProfileId, PrettifyProfileImportDecisionDraft>>,
) {
  return validatePrettifyProfileImportPreview({ conflicts, profiles }, decisions, [
    createProfile(PROFILE_IDS.alpha, 'Alpha'),
    createProfile(PROFILE_IDS.beta, 'Beta'),
  ]);
}

describe('Prettify profile import preview validation', () => {
  it('allows a renamed profile to reuse the name removed by a replacement', () => {
    const importedAlpha = createProfile(PROFILE_IDS.alpha, 'Gamma');
    const importedBeta = createProfile(PROFILE_IDS.beta, 'Delta');

    const result = validate(
      [importedAlpha, importedBeta],
      [createIdConflict(importedAlpha.id, PROFILE_IDS.alpha), createIdConflict(importedBeta.id, PROFILE_IDS.beta)],
      {
        [importedAlpha.id]: { action: 'rename', name: 'Beta' },
        [importedBeta.id]: { action: 'replace', name: '' },
      },
    );

    assert.equal(result.complete, true);
    assert.equal(result.capacityValid, true);
    assert.deepEqual([...result.renameErrors], []);
  });

  it('rejects a renamed profile that duplicates the final replacement name', () => {
    const importedAlpha = createProfile(PROFILE_IDS.alpha, 'Gamma');
    const importedBeta = createProfile(PROFILE_IDS.beta, 'Delta');

    const result = validate(
      [importedAlpha, importedBeta],
      [createIdConflict(importedAlpha.id, PROFILE_IDS.alpha), createIdConflict(importedBeta.id, PROFILE_IDS.beta)],
      {
        [importedAlpha.id]: { action: 'replace', name: '' },
        [importedBeta.id]: { action: 'rename', name: 'Gamma' },
      },
    );

    assert.equal(result.complete, false);
    assert.deepEqual([...result.renameErrors], [importedBeta.id]);
  });

  it('rejects duplicate replacement targets before invoking the main-process merge', () => {
    const importedAlpha = createProfile(PROFILE_IDS.alpha, 'Gamma');
    const importedBeta = createProfile(PROFILE_IDS.beta, 'Delta');

    const result = validate(
      [importedAlpha, importedBeta],
      [createIdConflict(importedAlpha.id, PROFILE_IDS.alpha), createIdConflict(importedBeta.id, PROFILE_IDS.alpha)],
      {
        [importedAlpha.id]: { action: 'replace', name: '' },
        [importedBeta.id]: { action: 'replace', name: '' },
      },
    );

    assert.equal(result.complete, false);
  });
});
