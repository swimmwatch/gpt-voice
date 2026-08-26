import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { VersionScopedReleaseSourceBinding } from '../../../.agents/skills/watch-process/scripts/lib/version-scoped-release-source-binding.mjs';

const WATCH_ID = 'local-whisper-alpha-release-test';
const FEATURE_SHA = 'a'.repeat(40);
const RELEASE_SHA = 'b'.repeat(40);
const DEADLINE = 21_601_000;
const AUTHORITY = Object.freeze({
  featureBranch: 'feat/local-whisper-provider',
  releaseBranch: 'release/v2.4.0-alpha.1',
  tag: 'v2.4.0-alpha.1',
});

function binding() {
  return new VersionScopedReleaseSourceBinding({
    attemptSourceSha: FEATURE_SHA,
    authority: AUTHORITY,
    deadlineEpochMilliseconds: DEADLINE,
    watchId: WATCH_ID,
  });
}

function releaseState(overrides = {}) {
  return {
    deadlineEpochMilliseconds: DEADLINE,
    phase: 'release-pr-checks',
    releaseTag: AUTHORITY.tag,
    sourceSha: RELEASE_SHA,
    startedAtEpochMilliseconds: 1_000,
    timeoutSeconds: 21_600,
    watchId: WATCH_ID,
    ...overrides,
  };
}

describe('VersionScopedReleaseSourceBinding', () => {
  it('keeps the exact feature source and accepts a release source proven by the scenario state', () => {
    assert.equal(
      binding().resolve({ branch: AUTHORITY.featureBranch, headSha: FEATURE_SHA, releaseState: null }),
      FEATURE_SHA,
    );
    assert.equal(
      binding().resolve({
        branch: AUTHORITY.releaseBranch,
        headSha: RELEASE_SHA,
        releaseState: releaseState(),
      }),
      RELEASE_SHA,
    );
  });

  it('rejects external feature changes, unauthorized branches, stale release state, and deadline changes', () => {
    for (const request of [
      { branch: AUTHORITY.featureBranch, headSha: RELEASE_SHA, releaseState: releaseState() },
      { branch: 'main', headSha: FEATURE_SHA, releaseState: releaseState() },
      { branch: AUTHORITY.releaseBranch, headSha: RELEASE_SHA, releaseState: null },
      {
        branch: AUTHORITY.releaseBranch,
        headSha: RELEASE_SHA,
        releaseState: releaseState({ sourceSha: FEATURE_SHA }),
      },
      {
        branch: AUTHORITY.releaseBranch,
        headSha: RELEASE_SHA,
        releaseState: releaseState({ deadlineEpochMilliseconds: DEADLINE + 1, startedAtEpochMilliseconds: 1_001 }),
      },
    ]) {
      assert.throws(() => binding().resolve(request), /release-repair-(?:branch|source)-/u);
    }
  });

  it('allows an explicit recovery to rebind a clean feature branch or a state-proven release branch', () => {
    assert.equal(
      binding().resolveExplicitRecovery({
        branch: AUTHORITY.featureBranch,
        headSha: RELEASE_SHA,
        releaseState: releaseState(),
      }),
      RELEASE_SHA,
    );
    assert.equal(
      binding().resolveExplicitRecovery({
        branch: AUTHORITY.releaseBranch,
        headSha: RELEASE_SHA,
        releaseState: releaseState({ deadlineEpochMilliseconds: DEADLINE + 1, startedAtEpochMilliseconds: 1_001 }),
      }),
      RELEASE_SHA,
    );
    assert.throws(
      () => binding().resolveExplicitRecovery({ branch: 'main', headSha: RELEASE_SHA, releaseState: releaseState() }),
      /release-recovery-branch-not-authorized/u,
    );
  });
});
