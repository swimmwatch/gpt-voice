import { runtimeFail } from './runtime-core-support.mjs';

export const VERSION_SCOPED_RELEASE_STATE_FILE_NAME = 'version-scoped-release-state.json';

const SHA_PATTERN = /^[a-f\d]{40}$/u;
const MAXIMUM_RELEASE_STATE_STARTUP_SKEW_MILLISECONDS = 10_000;
const RELEASE_BRANCH_PHASES = new Set([
  'release-pr-checks',
  'release-candidate',
  'merge-release',
  'publish-release',
  'succeeded',
]);

function matchesReleaseDeadline(releaseStateDeadline, watchDeadline) {
  if (watchDeadline === null) return true;
  const startupSkew = releaseStateDeadline - watchDeadline;
  return startupSkew >= 0 && startupSkew <= MAXIMUM_RELEASE_STATE_STARTUP_SKEW_MILLISECONDS;
}

function hasProvenReleaseState({
  allowExplicitSourceRecovery = false,
  deadlineEpochMilliseconds,
  releaseState,
  releaseTag,
  sourceSha,
  watchId,
}) {
  const acceptedPhases = allowExplicitSourceRecovery ? new Set([...RELEASE_BRANCH_PHASES, 'blocked']) : RELEASE_BRANCH_PHASES;
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
    matchesReleaseDeadline(releaseState.deadlineEpochMilliseconds, deadlineEpochMilliseconds) &&
    SHA_PATTERN.test(releaseState.sourceSha) &&
    acceptedPhases.has(releaseState.phase) &&
    (allowExplicitSourceRecovery || releaseState.sourceSha === sourceSha)
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
        allowExplicitSourceRecovery: true,
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
