import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { RELEASE_CONTRACT } from '../../../.codex/process-watch/scenarios/local-whisper-alpha-release/constants.mjs';
import {
  LocalWhisperAlphaReleaseOrchestrator,
  ReleaseBlockedError,
} from '../../../.codex/process-watch/scenarios/local-whisper-alpha-release/release-orchestrator.mjs';
import { ReleaseStateStore } from '../../../.codex/process-watch/scenarios/local-whisper-alpha-release/state-store.mjs';
import { VerifiedReleaseLifecycle } from '../../../.codex/process-watch/scenarios/local-whisper-alpha-release/verified-release-lifecycle.mjs';

const WATCH_ID = 'local-whisper-alpha-release-test';
const FEATURE_SHA = 'a'.repeat(40);
const REPAIRED_FEATURE_SHA = 'b'.repeat(40);
const RELEASE_SHA = 'c'.repeat(40);
const REPAIRED_RELEASE_SHA = 'd'.repeat(40);
const FOLLOW_UP_RELEASE_SHA = 'e'.repeat(40);

class MemoryReleaseStateStore {
  state;
  writes = [];

  constructor(state = null) {
    this.state = state;
  }

  async read() {
    return this.state === null ? null : globalThis.structuredClone(this.state);
  }

  async write(state) {
    this.state = globalThis.structuredClone(state);
    this.writes.push(this.state);
    return globalThis.structuredClone(this.state);
  }
}

class FakeReleaseGitRepository {
  branchName = RELEASE_CONTRACT.featureBranch;
  headSha = FEATURE_SHA;
  releaseCommitSha = RELEASE_SHA;
  upstreamSha = FEATURE_SHA;
  ancestorAssertions = [];

  async authenticateIdentity() {}
  async assertClean() {}
  async fetch() {}

  async branch() {
    return this.branchName;
  }

  async head() {
    return this.headSha;
  }

  async assertUpstreamHead() {
    assert.equal(this.headSha, this.upstreamSha);
    return this.headSha;
  }

  async assertAncestor(ancestor, descendant) {
    this.ancestorAssertions.push({ ancestor, descendant });
  }

  async switchToReleaseBranch() {
    this.branchName = RELEASE_CONTRACT.releaseBranch;
    this.headSha = this.releaseCommitSha;
    this.upstreamSha = this.releaseCommitSha;
  }

  async commitReleasePreparation() {
    this.headSha = this.releaseCommitSha;
    this.upstreamSha = this.releaseCommitSha;
    return this.headSha;
  }

  async pushReleaseBranch() {}

  repairCurrentBranch(sourceSha) {
    this.headSha = sourceSha;
    this.upstreamSha = sourceSha;
  }
}

class FakeReleasePreparation {
  paths = Object.freeze(['package.json', 'package-lock.json', 'CHANGELOG.md']);
  applyCount = 0;
  verifyCount = 0;

  async apply() {
    this.applyCount += 1;
  }

  async verify() {
    this.verifyCount += 1;
  }
}

class FakeReleaseGitHubClient {
  #git;
  #successfulRuns = new Map();
  dispatchFailures = new Map();
  releasePullRequestCheckFailures = 0;
  dispatches = [];
  merges = [];
  approvals = 0;
  releaseRecord = null;
  featurePullRequest = {
    baseRefName: RELEASE_CONTRACT.baseBranch,
    headRefName: RELEASE_CONTRACT.featureBranch,
    headRefOid: FEATURE_SHA,
    mergedAt: null,
    number: 32,
    state: 'OPEN',
    url: 'https://github.com/swimmwatch/gpt-voice/pull/32',
  };
  releasePullRequests = [];

  constructor(git) {
    this.#git = git;
  }

  async preflight() {}

  async release() {
    return this.releaseRecord;
  }

  async assertReleaseAbsent() {
    if (this.releaseRecord !== null) throw new Error('release-already-published');
  }

  async findPullRequest(branch, { includeMerged = false, sourceSha } = {}) {
    const candidates =
      branch === RELEASE_CONTRACT.featureBranch ? [this.featurePullRequest] : this.releasePullRequests;
    const exact = candidates.filter(
      (pullRequest) =>
        (sourceSha === undefined || pullRequest.headRefOid === sourceSha) &&
        (includeMerged || pullRequest.state === 'OPEN'),
    );
    return exact.find((pullRequest) => pullRequest.state === 'OPEN') ?? exact[0] ?? null;
  }

  async waitForPullRequest(branch, options = {}) {
    return await this.findPullRequest(branch, options);
  }

  async createReleasePullRequest(sourceSha) {
    const existing = await this.findPullRequest(RELEASE_CONTRACT.releaseBranch, { sourceSha });
    if (existing !== null) return existing;
    const pullRequest = {
      baseRefName: RELEASE_CONTRACT.baseBranch,
      headRefName: RELEASE_CONTRACT.releaseBranch,
      headRefOid: sourceSha,
      mergedAt: null,
      number: 40 + this.releasePullRequests.length,
      state: 'OPEN',
      url: `https://github.com/swimmwatch/gpt-voice/pull/${40 + this.releasePullRequests.length}`,
    };
    this.releasePullRequests.push(pullRequest);
    return pullRequest;
  }

  async waitForPullRequestChecks(number, sourceSha) {
    if (number !== this.featurePullRequest.number && this.releasePullRequestCheckFailures > 0) {
      this.releasePullRequestCheckFailures -= 1;
      throw new Error('release-pull-request-checks-failed');
    }
    assert.equal(sourceSha, this.#git.headSha);
  }

  async mergePullRequest(number, sourceSha) {
    const pullRequest =
      number === this.featurePullRequest.number
        ? this.featurePullRequest
        : this.releasePullRequests.find((candidate) => candidate.number === number);
    assert.ok(pullRequest);
    assert.equal(pullRequest.headRefOid, sourceSha);
    pullRequest.state = 'MERGED';
    pullRequest.mergedAt = new Date().toISOString();
    this.merges.push({ number, sourceSha });
    return String(this.merges.length).repeat(40).slice(0, 40);
  }

  async dispatchAndWait(request) {
    this.dispatches.push(globalThis.structuredClone(request));
    const failures = this.dispatchFailures.get(request.phase) ?? 0;
    if (failures > 0) {
      this.dispatchFailures.set(request.phase, failures - 1);
      throw new Error(`release-workflow-${request.phase}-failed`);
    }
    const run = Object.freeze({
      attempt: 1,
      conclusion: 'success',
      databaseId: this.dispatches.length,
      displayTitle: `release-watch-${request.phase}`,
      headSha: request.sourceSha,
      status: 'completed',
      url: `https://github.com/swimmwatch/gpt-voice/actions/runs/${this.dispatches.length}`,
    });
    this.#successfulRuns.set(`${request.phase}:${request.sourceSha}`, run);
    if (request.phase === 'promotion') {
      this.releaseRecord = Object.freeze({
        isDraft: false,
        isPrerelease: true,
        tagName: RELEASE_CONTRACT.releaseTag,
        targetCommitish: request.sourceSha,
        url: `https://github.com/swimmwatch/gpt-voice/releases/tag/${RELEASE_CONTRACT.releaseTag}`,
      });
    }
    return run;
  }

  async findSuccessfulRun({ phase, sourceSha }) {
    return this.#successfulRuns.get(`${phase}:${sourceSha}`) ?? null;
  }

  async verifyPublishedRelease(sourceSha) {
    if (this.releaseRecord?.targetCommitish !== sourceSha) throw new Error('release-tag-source-mismatch');
    return this.releaseRecord;
  }

  updatePullRequestHead(branch, sourceSha) {
    if (branch === RELEASE_CONTRACT.featureBranch) {
      this.featurePullRequest.headRefOid = sourceSha;
      return;
    }
    const open = this.releasePullRequests.find((pullRequest) => pullRequest.state === 'OPEN');
    if (open === undefined) {
      this.releasePullRequests.push({
        baseRefName: RELEASE_CONTRACT.baseBranch,
        headRefName: RELEASE_CONTRACT.releaseBranch,
        headRefOid: sourceSha,
        mergedAt: null,
        number: 40 + this.releasePullRequests.length,
        state: 'OPEN',
        url: `https://github.com/swimmwatch/gpt-voice/pull/${40 + this.releasePullRequests.length}`,
      });
    } else {
      open.headRefOid = sourceSha;
    }
  }
}

function harness(initialState = null) {
  const git = new FakeReleaseGitRepository();
  const github = new FakeReleaseGitHubClient(git);
  const preparation = new FakeReleasePreparation();
  const stateStore = new MemoryReleaseStateStore(initialState);
  const orchestrator = new LocalWhisperAlphaReleaseOrchestrator({ git, github, preparation, stateStore });
  return { git, github, orchestrator, preparation, stateStore };
}

async function run(orchestrator) {
  return await orchestrator.run({ timeoutSeconds: 21_600, watchId: WATCH_ID });
}

describe('VerifiedReleaseLifecycle', () => {
  it('revalidates the published release after orchestration and before reporting success', async () => {
    const calls = [];
    const finalState = Object.freeze({ phase: 'succeeded' });
    const lifecycle = new VerifiedReleaseLifecycle({
      orchestrator: {
        async run(options) {
          calls.push(['run', options]);
        },
        async verifyFinal() {
          calls.push(['verify-final']);
          return finalState;
        },
      },
    });
    const options = Object.freeze({ timeoutSeconds: 21_600, watchId: WATCH_ID });

    assert.equal(await lifecycle.execute(options), finalState);
    assert.deepEqual(calls, [
      ['run', options],
      ['verify-final'],
    ]);
  });

  it('does not report success when final public-release revalidation fails', async () => {
    const lifecycle = new VerifiedReleaseLifecycle({
      orchestrator: {
        async run() {},
        async verifyFinal() {
          throw new Error('release-final-state-invalid');
        },
      },
    });

    await assert.rejects(lifecycle.execute({ timeoutSeconds: 21_600, watchId: WATCH_ID }), {
      message: 'release-final-state-invalid',
    });
  });
});

describe('LocalWhisperAlphaReleaseOrchestrator', () => {
  it('completes Task 32, preserving merges, candidate reuse, and publication on the first attempt', async () => {
    const context = harness();
    const state = await run(context.orchestrator);

    assert.equal(state.phase, 'succeeded');
    assert.equal(state.releaseTag, RELEASE_CONTRACT.releaseTag);
    assert.equal(context.preparation.applyCount, 1);
    assert.deepEqual(
      context.github.dispatches.map(({ candidateRunId, phase, publish, releaseTag, sourceSha }) => ({
        candidateRunId,
        phase,
        publish,
        releaseTag,
        sourceSha,
      })),
      [
        { candidateRunId: undefined, phase: 'task32', publish: false, releaseTag: null, sourceSha: FEATURE_SHA },
        {
          candidateRunId: undefined,
          phase: 'release-candidate',
          publish: false,
          releaseTag: RELEASE_CONTRACT.releaseTag,
          sourceSha: RELEASE_SHA,
        },
        {
          candidateRunId: '2',
          phase: 'promotion',
          publish: true,
          releaseTag: RELEASE_CONTRACT.releaseTag,
          sourceSha: RELEASE_SHA,
        },
      ],
    );
    assert.deepEqual(context.github.merges, [
      { number: 32, sourceSha: FEATURE_SHA },
      { number: 40, sourceSha: RELEASE_SHA },
    ]);
    assert.deepEqual(context.git.ancestorAssertions, [
      { ancestor: FEATURE_SHA, descendant: 'origin/main' },
      { ancestor: RELEASE_SHA, descendant: 'origin/main' },
    ]);
    assert.deepEqual(await context.orchestrator.verifyFinal(), state);
  });

  it('invalidates stale candidates and completes after repairs on feature and release branches', async () => {
    const context = harness();
    context.github.dispatchFailures.set('task32', 1);
    await assert.rejects(run(context.orchestrator), /release-workflow-task32-failed/u);

    context.git.repairCurrentBranch(REPAIRED_FEATURE_SHA);
    context.github.updatePullRequestHead(RELEASE_CONTRACT.featureBranch, REPAIRED_FEATURE_SHA);
    context.github.releasePullRequestCheckFailures = 1;
    await assert.rejects(run(context.orchestrator), /release-pull-request-checks-failed/u);

    context.git.repairCurrentBranch(REPAIRED_RELEASE_SHA);
    context.github.updatePullRequestHead(RELEASE_CONTRACT.releaseBranch, REPAIRED_RELEASE_SHA);
    const state = await run(context.orchestrator);

    assert.equal(state.phase, 'succeeded');
    assert.equal(state.sourceSha, REPAIRED_RELEASE_SHA);
    assert.deepEqual(
      context.github.dispatches.map((dispatch) => [dispatch.phase, dispatch.sourceSha]),
      [
        ['task32', FEATURE_SHA],
        ['task32', REPAIRED_FEATURE_SHA],
        ['release-candidate', REPAIRED_RELEASE_SHA],
        ['promotion', REPAIRED_RELEASE_SHA],
      ],
    );
  });

  it('recovers the legacy transient PR visibility block and completes without another source change', async () => {
    const startedAtEpochMilliseconds = Date.now();
    const context = harness({
      candidateRun: null,
      completionDigest: null,
      deadlineEpochMilliseconds: startedAtEpochMilliseconds + 21_600_000,
      failureCode: 'release-feature-pull-request-missing',
      featurePr: null,
      phase: 'blocked',
      promotionRun: null,
      releasePr: null,
      releaseTag: RELEASE_CONTRACT.releaseTag,
      releaseUrl: null,
      schemaVersion: 1,
      sourceSha: FEATURE_SHA,
      startedAtEpochMilliseconds,
      task32Run: null,
      timeoutSeconds: 21_600,
      watchId: WATCH_ID,
    });

    const state = await run(context.orchestrator);

    assert.equal(state.phase, 'succeeded');
    assert.equal(state.failureCode, null);
    assert.equal(context.github.dispatches[0].phase, 'task32');
  });

  it('rebuilds from a new preserving follow-up PR after a promotion failure before tag creation', async () => {
    const context = harness();
    context.github.dispatchFailures.set('promotion', 1);
    await assert.rejects(run(context.orchestrator), /release-workflow-promotion-failed/u);
    assert.equal(context.stateStore.state.phase, 'publish-release');
    assert.equal(context.github.releaseRecord, null);

    context.git.repairCurrentBranch(FOLLOW_UP_RELEASE_SHA);
    context.github.updatePullRequestHead(RELEASE_CONTRACT.releaseBranch, FOLLOW_UP_RELEASE_SHA);
    const state = await run(context.orchestrator);

    assert.equal(state.phase, 'succeeded');
    assert.equal(state.sourceSha, FOLLOW_UP_RELEASE_SHA);
    assert.equal(
      context.github.dispatches.filter((dispatch) => dispatch.phase === 'release-candidate').length,
      2,
    );
    assert.equal(context.github.releasePullRequests.filter((pullRequest) => pullRequest.state === 'MERGED').length, 2);
  });

  it('reconciles a successful promotion receipt written remotely before the local state update', async () => {
    const context = harness();
    context.github.dispatchFailures.set('promotion', 1);
    await assert.rejects(run(context.orchestrator));
    context.github.dispatchFailures.set('promotion', 0);
    const sourceSha = context.stateStore.state.sourceSha;
    const promotionRun = await context.github.dispatchAndWait({
      candidateRunId: String(context.stateStore.state.candidateRun.databaseId),
      deadlineEpochMilliseconds: context.stateStore.state.deadlineEpochMilliseconds,
      phase: 'promotion',
      publish: true,
      releaseTag: RELEASE_CONTRACT.releaseTag,
      sourceSha,
      watchId: WATCH_ID,
    });
    assert.equal(promotionRun.conclusion, 'success');

    const state = await run(context.orchestrator);
    assert.equal(state.phase, 'succeeded');
    assert.equal(state.promotionRun.databaseId, promotionRun.databaseId);
  });

  it('blocks an immutable partial publication and never proceeds to artifact smoke tasks', async () => {
    const context = harness();
    context.github.releaseRecord = Object.freeze({
      isDraft: false,
      isPrerelease: true,
      tagName: RELEASE_CONTRACT.releaseTag,
      targetCommitish: FEATURE_SHA,
      url: `https://github.com/swimmwatch/gpt-voice/releases/tag/${RELEASE_CONTRACT.releaseTag}`,
    });

    await assert.rejects(
      run(context.orchestrator),
      (error) => error instanceof ReleaseBlockedError && error.code === 'release-public-state-immutable',
    );
    assert.equal(context.stateStore.state.phase, 'blocked');
    assert.equal(context.github.dispatches.length, 0);
  });

  it('blocks the persisted request when the shared deadline or GitHub authentication is exhausted', async () => {
    const expired = harness({
      candidateRun: null,
      deadlineEpochMilliseconds: Date.now() - 1,
      completionDigest: null,
      failureCode: null,
      featurePr: null,
      phase: 'task32-candidate',
      promotionRun: null,
      releasePr: null,
      releaseTag: RELEASE_CONTRACT.releaseTag,
      releaseUrl: null,
      schemaVersion: 1,
      sourceSha: FEATURE_SHA,
      startedAtEpochMilliseconds: Date.now() - 21_600_000,
      task32Run: null,
      timeoutSeconds: 21_600,
      watchId: WATCH_ID,
    });
    await assert.rejects(
      run(expired.orchestrator),
      (error) => error instanceof ReleaseBlockedError && error.code === 'release-deadline-exhausted',
    );
    assert.equal(expired.stateStore.state.phase, 'blocked');

    const unauthenticated = harness();
    unauthenticated.github.preflight = async () => {
      throw new Error('release-authentication-failed');
    };
    await assert.rejects(
      run(unauthenticated.orchestrator),
      (error) => error instanceof ReleaseBlockedError && error.code === 'release-authentication-failed',
    );
    assert.equal(unauthenticated.stateStore.state.phase, 'blocked');
  });
});

describe('ReleaseStateStore', () => {
  it('atomically round-trips the deadline-bound state and rejects stale source or run receipts', async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'alpha-release-state-'));
    const startedAtEpochMilliseconds = Date.now();
    const state = {
      candidateRun: null,
      completionDigest: null,
      deadlineEpochMilliseconds: startedAtEpochMilliseconds + 21_600_000,
      failureCode: null,
      featurePr: null,
      phase: 'task32-candidate',
      promotionRun: null,
      releasePr: null,
      releaseTag: RELEASE_CONTRACT.releaseTag,
      releaseUrl: null,
      schemaVersion: 1,
      sourceSha: FEATURE_SHA,
      startedAtEpochMilliseconds,
      task32Run: null,
      timeoutSeconds: 21_600,
      watchId: WATCH_ID,
    };
    try {
      const store = new ReleaseStateStore({ watchId: WATCH_ID, workspaceRoot });
      await store.write(state);
      assert.deepEqual(await store.read(), state);
      await assert.rejects(store.write({ ...state, sourceSha: 'invalid' }), /release-state-invalid/u);
      await assert.rejects(
        store.write({ ...state, task32Run: { conclusion: 'failure', databaseId: 1, headSha: FEATURE_SHA } }),
        /release-state-invalid/u,
      );
    } finally {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });
});
