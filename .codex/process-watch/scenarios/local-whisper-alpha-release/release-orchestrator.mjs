import { createHash } from 'node:crypto';

import { RELEASE_CONTRACT, RELEASE_STATE_SCHEMA_VERSION } from './constants.mjs';

export class ReleaseBlockedError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ReleaseBlockedError';
    this.code = code;
  }
}

function safeCode(error) {
  const code = error?.code ?? error?.message;
  return typeof code === 'string' && /^[a-z][a-z0-9-]{2,95}$/u.test(code) ? code : 'release-process-failed';
}

function finalDigest(state) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        candidateRunId: state.candidateRun?.databaseId,
        promotionRunId: state.promotionRun?.databaseId,
        releaseTag: state.releaseTag,
        releaseUrl: state.releaseUrl,
        sourceSha: state.sourceSha,
      }),
    )
    .digest('hex');
}

const LEGACY_RETRYABLE_BLOCK_PHASES = Object.freeze({
  'release-feature-pull-request-missing': 'task32-candidate',
});

export class LocalWhisperAlphaReleaseOrchestrator {
  #git;
  #github;
  #preparation;
  #stateStore;

  constructor({ git, github, preparation, stateStore }) {
    this.#git = git;
    this.#github = github;
    this.#preparation = preparation;
    this.#stateStore = stateStore;
  }

  async run({ timeoutSeconds, watchId }) {
    let state = await this.#stateStore.read();
    if (state === null) {
      const now = Date.now();
      state = await this.#stateStore.write({
        candidateRun: null,
        deadlineEpochMilliseconds: now + timeoutSeconds * 1_000,
        completionDigest: null,
        failureCode: null,
        featurePr: null,
        phase: 'task32-candidate',
        promotionRun: null,
        releasePr: null,
        releaseTag: RELEASE_CONTRACT.releaseTag,
        releaseUrl: null,
        schemaVersion: RELEASE_STATE_SCHEMA_VERSION,
        sourceSha: null,
        startedAtEpochMilliseconds: now,
        task32Run: null,
        timeoutSeconds,
        watchId,
      });
    }
    // A resumed outer Watch may pass only its remaining approved budget. The
    // persisted release state owns the original shared deadline, so its
    // timeout must remain stable rather than rejecting a safe reattachment.
    try {
      await this.#git.authenticateIdentity();
      await this.#github.preflight();
      state = await this.#reconcile(state);
      while (state.phase !== 'succeeded') {
        this.#assertDeadline(state);
        state = await this.#runPhase(state);
      }
    } catch (error) {
      const code = safeCode(error);
      state = (await this.#stateStore.read()) ?? state;
      state = await this.#stateStore.write({ ...state, failureCode: code });
      if (
        error instanceof ReleaseBlockedError ||
        error?.name === 'ReleaseCommandError' ||
        [
          'release-already-published',
          'release-authentication-failed',
          'release-remote-state-ambiguous',
          'release-tag-already-exists',
        ].includes(code)
      ) {
        await this.#stateStore.write({ ...state, phase: 'blocked' });
        throw new ReleaseBlockedError(code);
      }
      throw error;
    }
    return state;
  }

  async verifyFinal() {
    const state = await this.#stateStore.read();
    if (state === null || state.phase !== 'succeeded') throw new Error('release-final-state-invalid');
    if (state.completionDigest !== finalDigest(state)) {
      throw new Error('release-final-state-invalid');
    }
    const release = await this.#github.verifyPublishedRelease(state.sourceSha);
    if (release.url !== state.releaseUrl) throw new Error('release-final-url-mismatch');
    return state;
  }

  async #reconcile(state) {
    await this.#git.assertClean();
    if (state.phase === 'blocked' && Object.hasOwn(LEGACY_RETRYABLE_BLOCK_PHASES, state.failureCode)) {
      state = await this.#stateStore.write({
        ...state,
        failureCode: null,
        phase: LEGACY_RETRYABLE_BLOCK_PHASES[state.failureCode],
      });
    }
    const [branch, head, release] = await Promise.all([this.#git.branch(), this.#git.head(), this.#github.release()]);
    if (release !== null && state.phase !== 'succeeded') {
      const promotionRun =
        state.phase === 'publish-release'
          ? (state.promotionRun ??
            (await this.#github.findSuccessfulRun({
              phase: 'promotion',
              sourceSha: state.sourceSha,
              watchId: state.watchId,
            })))
          : null;
      if (promotionRun?.conclusion === 'success') {
        const verified = await this.#github.verifyPublishedRelease(state.sourceSha);
        const succeeded = {
          ...state,
          failureCode: null,
          phase: 'succeeded',
          promotionRun,
          releaseUrl: verified.url,
        };
        succeeded.completionDigest = finalDigest(succeeded);
        return await this.#stateStore.write(succeeded);
      }
      throw new ReleaseBlockedError('release-public-state-immutable');
    }
    if (state.sourceSha === null) {
      if (branch === RELEASE_CONTRACT.featureBranch) {
        return await this.#stateStore.write({ ...state, sourceSha: head });
      }
      if (branch === RELEASE_CONTRACT.releaseBranch) {
        return await this.#stateStore.write({
          ...state,
          failureCode: null,
          phase: 'release-pr-checks',
          sourceSha: head,
        });
      }
      throw new ReleaseBlockedError('release-feature-branch-required');
    }
    if (head === state.sourceSha) return state;
    if (branch === RELEASE_CONTRACT.featureBranch) {
      return await this.#stateStore.write({
        ...state,
        candidateRun: null,
        failureCode: null,
        phase: 'task32-candidate',
        promotionRun: null,
        releasePr: null,
        sourceSha: head,
        task32Run: null,
      });
    }
    if (branch === RELEASE_CONTRACT.releaseBranch) {
      return await this.#stateStore.write({
        ...state,
        candidateRun: null,
        failureCode: null,
        phase: 'release-pr-checks',
        promotionRun: null,
        releasePr: null,
        sourceSha: head,
      });
    }
    throw new ReleaseBlockedError('release-source-branch-changed');
  }

  async #runPhase(state) {
    switch (state.phase) {
      case 'task32-candidate':
        return await this.#task32Candidate(state);
      case 'merge-feature':
        return await this.#mergeFeature(state);
      case 'prepare-release':
        return await this.#prepareRelease(state);
      case 'release-pr-checks':
        return await this.#releasePullRequestChecks(state);
      case 'release-candidate':
        return await this.#releaseCandidate(state);
      case 'merge-release':
        return await this.#mergeRelease(state);
      case 'publish-release':
        return await this.#publishRelease(state);
      case 'blocked':
        throw new ReleaseBlockedError(state.failureCode ?? 'release-blocked');
      default:
        throw new ReleaseBlockedError('release-phase-invalid');
    }
  }

  async #task32Candidate(state) {
    if ((await this.#git.branch()) !== RELEASE_CONTRACT.featureBranch) {
      throw new ReleaseBlockedError('release-feature-branch-required');
    }
    const sourceSha = await this.#git.assertUpstreamHead();
    const pullRequest = await this.#github.waitForPullRequest(RELEASE_CONTRACT.featureBranch, {
      deadlineEpochMilliseconds: state.deadlineEpochMilliseconds,
      includeMerged: true,
      sourceSha,
    });
    if (pullRequest === null || pullRequest.headRefOid !== sourceSha) {
      throw new Error('release-feature-pull-request-missing');
    }
    const run = await this.#github.dispatchAndWait({
      deadlineEpochMilliseconds: state.deadlineEpochMilliseconds,
      phase: 'task32',
      publish: false,
      releaseTag: null,
      sourceSha,
      watchId: state.watchId,
    });
    return await this.#stateStore.write({
      ...state,
      failureCode: null,
      featurePr: pullRequest,
      phase: 'merge-feature',
      sourceSha,
      task32Run: run,
    });
  }

  async #mergeFeature(state) {
    const pullRequest = await this.#github.findPullRequest(RELEASE_CONTRACT.featureBranch, {
      includeMerged: true,
      sourceSha: state.sourceSha,
    });
    if (pullRequest === null || pullRequest.headRefOid !== state.sourceSha) {
      throw new ReleaseBlockedError('release-feature-pull-request-mismatch');
    }
    if (pullRequest.state === 'OPEN') {
      await this.#github.waitForPullRequestChecks(
        pullRequest.number,
        state.sourceSha,
        state.deadlineEpochMilliseconds,
      );
      await this.#github.mergePullRequest(pullRequest.number, state.sourceSha);
    }
    await this.#git.fetch();
    await this.#git.assertAncestor(state.sourceSha, `origin/${RELEASE_CONTRACT.baseBranch}`);
    return await this.#stateStore.write({ ...state, failureCode: null, phase: 'prepare-release' });
  }

  async #prepareRelease(state) {
    await this.#github.assertReleaseAbsent();
    await this.#git.switchToReleaseBranch();
    await this.#git.assertClean();
    await this.#preparation.apply();
    await this.#preparation.verify();
    const sourceSha = await this.#git.commitReleasePreparation(this.#preparation.paths);
    await this.#git.pushReleaseBranch();
    await this.#git.assertClean();
    return await this.#stateStore.write({
      ...state,
      failureCode: null,
      phase: 'release-pr-checks',
      sourceSha,
    });
  }

  async #releasePullRequestChecks(state) {
    await this.#preparation.verify();
    const sourceSha = await this.#git.assertUpstreamHead();
    const pullRequest = await this.#github.createReleasePullRequest(sourceSha, {
      deadlineEpochMilliseconds: state.deadlineEpochMilliseconds,
    });
    await this.#github.waitForPullRequestChecks(
      pullRequest.number,
      sourceSha,
      state.deadlineEpochMilliseconds,
    );
    return await this.#stateStore.write({
      ...state,
      failureCode: null,
      phase: 'release-candidate',
      releasePr: pullRequest,
      sourceSha,
    });
  }

  async #releaseCandidate(state) {
    await this.#github.assertReleaseAbsent();
    const run = await this.#github.dispatchAndWait({
      deadlineEpochMilliseconds: state.deadlineEpochMilliseconds,
      phase: 'release-candidate',
      publish: false,
      releaseTag: RELEASE_CONTRACT.releaseTag,
      sourceSha: state.sourceSha,
      watchId: state.watchId,
    });
    return await this.#stateStore.write({
      ...state,
      candidateRun: run,
      failureCode: null,
      phase: 'merge-release',
    });
  }

  async #mergeRelease(state) {
    const pullRequest = await this.#github.findPullRequest(RELEASE_CONTRACT.releaseBranch, {
      includeMerged: true,
      sourceSha: state.sourceSha,
    });
    if (pullRequest === null || pullRequest.headRefOid !== state.sourceSha) {
      throw new ReleaseBlockedError('release-pull-request-head-mismatch');
    }
    if (pullRequest.state === 'OPEN') await this.#github.mergePullRequest(pullRequest.number, state.sourceSha);
    await this.#git.fetch();
    await this.#git.assertAncestor(state.sourceSha, `origin/${RELEASE_CONTRACT.baseBranch}`);
    return await this.#stateStore.write({ ...state, failureCode: null, phase: 'publish-release' });
  }

  async #publishRelease(state) {
    await this.#github.assertReleaseAbsent();
    if (state.candidateRun?.headSha !== state.sourceSha || state.candidateRun?.conclusion !== 'success') {
      throw new ReleaseBlockedError('release-candidate-receipt-invalid');
    }
    const promotionRun =
      state.promotionRun ??
      (await this.#github.dispatchAndWait({
        candidateRunId: String(state.candidateRun.databaseId),
        deadlineEpochMilliseconds: state.deadlineEpochMilliseconds,
        phase: 'promotion',
        publish: true,
        releaseTag: RELEASE_CONTRACT.releaseTag,
        sourceSha: state.sourceSha,
        watchId: state.watchId,
      }));
    if (state.promotionRun === null) {
      state = await this.#stateStore.write({ ...state, failureCode: null, promotionRun });
    }
    const published = await this.#github.verifyPublishedRelease(state.sourceSha);
    const succeeded = {
      ...state,
      failureCode: null,
      phase: 'succeeded',
      promotionRun,
      releaseUrl: published.url,
    };
    succeeded.completionDigest = finalDigest(succeeded);
    return await this.#stateStore.write(succeeded);
  }

  #assertDeadline(state) {
    if (Date.now() >= state.deadlineEpochMilliseconds) throw new ReleaseBlockedError('release-deadline-exhausted');
  }
}
