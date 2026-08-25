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
      releaseState === null ||
      typeof releaseState !== 'object' ||
      releaseState.watchId !== this.#watchId ||
      releaseState.releaseTag !== this.#authority.tag ||
      releaseState.timeoutSeconds * 1_000 + releaseState.startedAtEpochMilliseconds !==
        releaseState.deadlineEpochMilliseconds ||
      releaseState.deadlineEpochMilliseconds !== this.#deadlineEpochMilliseconds ||
      !RELEASE_BRANCH_PHASES.has(releaseState.phase) ||
      releaseState.sourceSha !== headSha
    ) {
      runtimeFail('release-repair-source-unproven');
    }
    return headSha;
  }
}
