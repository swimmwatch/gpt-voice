import { runtimeFail } from './runtime-core-support.mjs';

export const VERSION_SCOPED_RELEASE_STATE_FILE_NAME = 'version-scoped-release-state.json';

const SHA_PATTERN = /^[a-f\d]{40}$/u;
const RELEASE_BRANCH_PHASES = new Set([
  'release-pr-checks',
  'release-candidate',
  'merge-release',
  'publish-release',
  'succeeded',
]);

function hasProvenReleaseState({ deadlineEpochMilliseconds, releaseState, releaseTag, sourceSha, watchId }) {
  return (
    releaseState !== null &&
    typeof releaseState === 'object' &&
    releaseState.watchId === watchId &&
    releaseState.releaseTag === releaseTag &&
    Number.isSafeInteger(releaseState.timeoutSeconds) &&
    Number.isSafeInteger(releaseState.startedAtEpochMilliseconds) &&
    Number.isSafeInteger(releaseState.deadlineEpochMilliseconds) &&
    releaseState.timeoutSeconds * 1_000 + releaseState.startedAtEpochMilliseconds ===
      releaseState.deadlineEpochMilliseconds &&
    (deadlineEpochMilliseconds === null || releaseState.deadlineEpochMilliseconds === deadlineEpochMilliseconds) &&
    RELEASE_BRANCH_PHASES.has(releaseState.phase) &&
    releaseState.sourceSha === sourceSha
  );
}

/** Proves that a release script, rather than an unrelated clean checkout, advanced the repair source. */
export class VersionScopedReleaseSourceBinding {
  #attemptSourceSha;
  #authority;
  #deadlineEpochMilliseconds;
  #watchId;

  constructor({ attemptSourceSha, authority, deadlineEpochMilliseconds, watchId }) {
    this.#attemptSourceSha = attemptSourceSha;
    this.#authority = authority;
    this.#deadlineEpochMilliseconds = deadlineEpochMilliseconds;
    this.#watchId = watchId;
  }

  resolve({ branch, headSha, releaseState }) {
    if (!SHA_PATTERN.test(headSha) || !SHA_PATTERN.test(this.#attemptSourceSha)) {
      runtimeFail('release-repair-source-invalid');
    }
    if (branch === this.#authority.featureBranch) {
      if (headSha !== this.#attemptSourceSha) runtimeFail('release-repair-source-unexpected');
      return this.#attemptSourceSha;
    }
    if (branch !== this.#authority.releaseBranch) runtimeFail('release-repair-branch-not-authorized');
    if (
      !hasProvenReleaseState({
        deadlineEpochMilliseconds: this.#deadlineEpochMilliseconds,
        releaseState,
        releaseTag: this.#authority.tag,
        sourceSha: headSha,
        watchId: this.#watchId,
      })
    ) {
      runtimeFail('release-repair-source-unproven');
    }
    return headSha;
  }

  /** Accepts a fresh source only after the explicit-resume operator proves its clean remote branch binding. */
  resolveExplicitRecovery({ branch, headSha, releaseState }) {
    if (!SHA_PATTERN.test(headSha) || !SHA_PATTERN.test(this.#attemptSourceSha)) {
      runtimeFail('release-recovery-source-invalid');
    }
    if (branch === this.#authority.featureBranch) return headSha;
    if (branch !== this.#authority.releaseBranch) runtimeFail('release-recovery-branch-not-authorized');
    if (
      !hasProvenReleaseState({
        deadlineEpochMilliseconds: null,
        releaseState,
        releaseTag: this.#authority.tag,
        sourceSha: headSha,
        watchId: this.#watchId,
      })
    ) {
      runtimeFail('release-recovery-source-unproven');
    }
    return headSha;
  }
}
