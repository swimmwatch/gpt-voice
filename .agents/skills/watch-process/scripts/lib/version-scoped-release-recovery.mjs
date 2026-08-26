import { freezeRecord, isRecord, requirePositiveInteger, runtimeFail } from './runtime-core-support.mjs';
import { validateSourceSha, validateWatchId } from './runtime-state-contracts.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

export const VERSION_SCOPED_RELEASE_RECOVERY_FILE_NAME = 'version-scoped-release-recovery.json';
export const VERSION_SCOPED_RELEASE_RECOVERY_SCHEMA_VERSION = 1;

function normalizePermit(value, expectedWatchId) {
  if (!isRecord(value) || Object.keys(value).length !== 5) runtimeFail('invalid-release-recovery-permit');
  for (const field of ['deadlineEpochMilliseconds', 'schemaVersion', 'sourceSha', 'timeoutSeconds', 'watchId']) {
    if (!Object.hasOwn(value, field)) runtimeFail('invalid-release-recovery-permit');
  }
  const watchId = validateWatchId(value.watchId, 'invalid-release-recovery-permit');
  if (watchId !== expectedWatchId || value.schemaVersion !== VERSION_SCOPED_RELEASE_RECOVERY_SCHEMA_VERSION) {
    runtimeFail('invalid-release-recovery-permit');
  }
  return freezeRecord({
    deadlineEpochMilliseconds: requirePositiveInteger(
      value.deadlineEpochMilliseconds,
      'invalid-release-recovery-permit',
      Number.MAX_SAFE_INTEGER,
    ),
    schemaVersion: VERSION_SCOPED_RELEASE_RECOVERY_SCHEMA_VERSION,
    sourceSha: validateSourceSha(value.sourceSha, 'invalid-release-recovery-permit'),
    timeoutSeconds: requirePositiveInteger(value.timeoutSeconds, 'invalid-release-recovery-permit', 604_800),
    watchId,
  });
}

/** Stores the bounded explicit-recovery lease for the reviewed release scenario only. */
export class VersionScopedReleaseRecoveryPermitStore {
  #storage;

  constructor({ storage } = {}) {
    if (!(storage instanceof WatchRuntimeStorage)) runtimeFail('invalid-release-recovery-store');
    this.#storage = storage;
  }

  async issue({ deadlineEpochMilliseconds, sourceSha, timeoutSeconds } = {}) {
    const permit = normalizePermit(
      {
        deadlineEpochMilliseconds,
        schemaVersion: VERSION_SCOPED_RELEASE_RECOVERY_SCHEMA_VERSION,
        sourceSha,
        timeoutSeconds,
        watchId: this.#storage.watchId,
      },
      this.#storage.watchId,
    );
    await this.#storage.writeJson(VERSION_SCOPED_RELEASE_RECOVERY_FILE_NAME, permit);
    return permit;
  }

  async read() {
    const value = await this.#storage.readJson(VERSION_SCOPED_RELEASE_RECOVERY_FILE_NAME);
    return value === null ? null : normalizePermit(value, this.#storage.watchId);
  }

  async matches({ deadlineEpochMilliseconds, sourceSha, timeoutSeconds } = {}) {
    const permit = await this.read();
    if (permit === null) return false;
    return (
      permit.deadlineEpochMilliseconds === deadlineEpochMilliseconds &&
      permit.sourceSha === validateSourceSha(sourceSha, 'invalid-release-recovery-permit') &&
      permit.timeoutSeconds === requirePositiveInteger(timeoutSeconds, 'invalid-release-recovery-permit', 604_800)
    );
  }
}
