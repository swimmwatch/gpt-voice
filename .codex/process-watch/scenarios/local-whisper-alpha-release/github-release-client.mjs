import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import {
  RELEASE_COMMAND_TIMEOUT_MILLISECONDS,
  RELEASE_CONTRACT,
  RELEASE_POLL_INTERVAL_MILLISECONDS,
  RELEASE_PULL_REQUEST_DISCOVERY_INTERVAL_MILLISECONDS,
  RELEASE_PULL_REQUEST_DISCOVERY_TIMEOUT_MILLISECONDS,
} from './constants.mjs';

const SHA_PATTERN = /^[a-f\d]{40}$/u;

function requireSha(value) {
  if (!SHA_PATTERN.test(value)) throw new Error('release-github-sha-invalid');
  return value;
}

function operationKey(watchId, phase, sourceSha) {
  return createHash('sha256').update(`${watchId}\0${phase}\0${sourceSha}`).digest('hex');
}

function runCorrelation(watchId, phase, sourceSha) {
  return `release-watch-${operationKey(watchId, phase, sourceSha).slice(0, 32)}`;
}

export class ReleaseGitHubClient {
  #clock;
  #delay;
  #runner;

  constructor({ clock = () => Date.now(), delay: wait = delay, runner }) {
    if (typeof clock !== 'function' || typeof wait !== 'function') {
      throw new TypeError('release-github-client-dependencies-invalid');
    }
    this.#clock = clock;
    this.#delay = wait;
    this.#runner = runner;
  }

  async preflight() {
    const authentication = await this.#runner.run('gh', ['auth', 'status', '--hostname', 'github.com'], {
      allowFailure: true,
    });
    if (authentication.exitCode !== 0) throw new Error('release-authentication-failed');
    let user;
    let repository;
    try {
      [user, repository] = await Promise.all([
        this.#runner.json('gh', ['api', 'user']),
        this.#runner.json('gh', ['api', `repos/${RELEASE_CONTRACT.repository}`]),
      ]);
    } catch {
      throw new Error('release-remote-state-ambiguous');
    }
    if (typeof user.value.login !== 'string' || repository.value.full_name !== RELEASE_CONTRACT.repository) {
      throw new Error('release-github-preflight-failed');
    }
  }

  async release() {
    const result = await this.#runner.run(
      'gh',
      ['api', `repos/${RELEASE_CONTRACT.repository}/releases/tags/${RELEASE_CONTRACT.releaseTag}`],
      { allowFailure: true },
    );
    if (result.exitCode !== 0) {
      if (/HTTP 404|not found/iu.test(result.stderr)) return null;
      if (/HTTP 401|authentication|credential|not logged/iu.test(result.stderr)) {
        throw new Error('release-authentication-failed');
      }
      throw new Error('release-remote-state-ambiguous');
    }
    try {
      const value = JSON.parse(result.stdout);
      return Object.freeze({
        isDraft: value.draft,
        isPrerelease: value.prerelease,
        tagName: value.tag_name,
        targetCommitish: value.target_commitish,
        url: value.html_url,
      });
    } catch {
      throw new Error('release-github-release-invalid');
    }
  }

  async assertReleaseAbsent() {
    if ((await this.release()) !== null) throw new Error('release-already-published');
    const tag = await this.#runner.run(
      'gh',
      ['api', `repos/${RELEASE_CONTRACT.repository}/git/ref/tags/${RELEASE_CONTRACT.releaseTag}`],
      { allowFailure: true },
    );
    if (tag.exitCode === 0) throw new Error('release-tag-already-exists');
    if (!/HTTP 404|not found/iu.test(tag.stderr)) {
      if (/HTTP 401|authentication|credential|not logged/iu.test(tag.stderr)) {
        throw new Error('release-authentication-failed');
      }
      throw new Error('release-remote-state-ambiguous');
    }
  }

  async findPullRequest(branch, { includeMerged = false, sourceSha } = {}) {
    const result = await this.#runner.json('gh', [
      'pr',
      'list',
      '--repo',
      RELEASE_CONTRACT.repository,
      '--head',
      branch,
      '--base',
      RELEASE_CONTRACT.baseBranch,
      '--state',
      includeMerged ? 'all' : 'open',
      '--json',
      'number,headRefName,headRefOid,baseRefName,state,mergedAt,url',
      '--limit',
      '20',
    ]);
    if (!Array.isArray(result.value)) throw new Error('release-pull-request-invalid');
    const matches = result.value.filter(
      (candidate) =>
        candidate.headRefName === branch &&
        candidate.baseRefName === RELEASE_CONTRACT.baseBranch &&
        (sourceSha === undefined || candidate.headRefOid === sourceSha),
    );
    const open = matches.filter((candidate) => candidate.state === 'OPEN');
    if (open.length > 1) throw new Error('release-pull-request-ambiguous');
    if (open.length === 1) return open[0];
    if (!includeMerged) return null;
    const merged = matches.filter((candidate) => candidate.state === 'MERGED' || candidate.mergedAt !== null);
    if (merged.length > 1) throw new Error('release-pull-request-ambiguous');
    return merged[0] ?? null;
  }

  async waitForPullRequest(
    branch,
    { deadlineEpochMilliseconds = Number.MAX_SAFE_INTEGER, includeMerged = false, sourceSha } = {},
  ) {
    requireSha(sourceSha);
    const discoveryDeadline = Math.min(
      deadlineEpochMilliseconds,
      this.#clock() + RELEASE_PULL_REQUEST_DISCOVERY_TIMEOUT_MILLISECONDS,
    );
    while (true) {
      const pullRequest = await this.findPullRequest(branch, { includeMerged, sourceSha });
      if (pullRequest !== null) return pullRequest;
      const remainingMilliseconds = discoveryDeadline - this.#clock();
      if (remainingMilliseconds <= 0) return null;
      await this.#delay(Math.min(RELEASE_PULL_REQUEST_DISCOVERY_INTERVAL_MILLISECONDS, remainingMilliseconds));
    }
  }

  async createReleasePullRequest(sourceSha, { deadlineEpochMilliseconds = Number.MAX_SAFE_INTEGER } = {}) {
    const existing = await this.findPullRequest(RELEASE_CONTRACT.releaseBranch, { sourceSha });
    if (existing !== null) {
      if (existing.headRefOid !== sourceSha) throw new Error('release-pull-request-head-mismatch');
      return existing;
    }
    await this.#runner.run('gh', [
      'pr',
      'create',
      '--repo',
      RELEASE_CONTRACT.repository,
      '--base',
      RELEASE_CONTRACT.baseBranch,
      '--head',
      RELEASE_CONTRACT.releaseBranch,
      '--title',
      `Release ${RELEASE_CONTRACT.releaseTag}`,
      '--body-file',
      `docs/releases/${RELEASE_CONTRACT.version}.md`,
    ]);
    const created = await this.waitForPullRequest(RELEASE_CONTRACT.releaseBranch, {
      deadlineEpochMilliseconds,
      sourceSha,
    });
    if (created === null || created.headRefOid !== sourceSha) throw new Error('release-pull-request-create-failed');
    return created;
  }

  async waitForPullRequestChecks(pullRequestNumber, sourceSha, deadlineEpochMilliseconds) {
    while (Date.now() < deadlineEpochMilliseconds) {
      const result = await this.#runner.run(
        'gh',
        [
          'pr',
          'checks',
          String(pullRequestNumber),
          '--repo',
          RELEASE_CONTRACT.repository,
          '--json',
          'name,bucket,state,workflow',
        ],
        { allowFailure: true },
      );
      if (result.exitCode !== 0) throw new Error('release-remote-state-ambiguous');
      let checks;
      try {
        checks = JSON.parse(result.stdout || '[]');
      } catch {
        throw new Error('release-pull-request-checks-invalid');
      }
      if (!Array.isArray(checks) || checks.length === 0) throw new Error('release-pull-request-checks-missing');
      if (checks.some((check) => ['fail', 'cancel'].includes(check.bucket))) {
        throw new Error('release-pull-request-checks-failed');
      }
      if (checks.every((check) => ['pass', 'skipping'].includes(check.bucket))) {
        const pullRequest = await this.#runner.json('gh', [
          'pr',
          'view',
          String(pullRequestNumber),
          '--repo',
          RELEASE_CONTRACT.repository,
          '--json',
          'headRefOid,state',
        ]);
        if (pullRequest.value.headRefOid !== sourceSha || pullRequest.value.state !== 'OPEN') {
          throw new Error('release-pull-request-head-mismatch');
        }
        return;
      }
      await delay(RELEASE_POLL_INTERVAL_MILLISECONDS);
    }
    throw new Error('release-deadline-exhausted');
  }

  async mergePullRequest(pullRequestNumber, sourceSha) {
    const result = await this.#runner.json(
      'gh',
      ['api', '--method', 'PUT', `repos/${RELEASE_CONTRACT.repository}/pulls/${pullRequestNumber}/merge`, '--input', '-'],
      {
        input: JSON.stringify({
          commit_title: `Merge pull request #${pullRequestNumber}`,
          merge_method: 'merge',
          sha: requireSha(sourceSha),
        }),
      },
    );
    if (result.value.merged !== true || !SHA_PATTERN.test(result.value.sha)) {
      throw new Error('release-pull-request-merge-failed');
    }
    return result.value.sha;
  }

  async dispatchAndWait({ candidateRunId, deadlineEpochMilliseconds, phase, publish, releaseTag, sourceSha, watchId }) {
    const correlation = runCorrelation(watchId, phase, sourceSha);
    let run = await this.#findWorkflowRun(correlation, sourceSha);
    if (run === null) {
      const fields = [
        'candidate_label=task32-alpha1-watch',
        `publish=${publish ? 'true' : 'false'}`,
        `watch_correlation=${correlation}`,
      ];
      if (releaseTag) fields.push(`release_tag=${releaseTag}`);
      if (candidateRunId) fields.push(`candidate_run_id=${candidateRunId}`);
      const args = [
        'workflow',
        'run',
        RELEASE_CONTRACT.workflow,
        '--repo',
        RELEASE_CONTRACT.repository,
        '--ref',
        phase === 'task32' ? RELEASE_CONTRACT.featureBranch : RELEASE_CONTRACT.releaseBranch,
      ];
      for (const field of fields) args.push('--field', field);
      await this.#runner.run('gh', args, { timeoutMilliseconds: RELEASE_COMMAND_TIMEOUT_MILLISECONDS });
      run = await this.#waitForDispatchedRun(correlation, sourceSha, deadlineEpochMilliseconds);
    }
    while (Date.now() < deadlineEpochMilliseconds) {
      await this.#approvePendingDeployments(run.databaseId);
      const observed = await this.#runner.json('gh', [
        'run',
        'view',
        String(run.databaseId),
        '--repo',
        RELEASE_CONTRACT.repository,
        '--json',
        'databaseId,headSha,status,conclusion,url,attempt,displayTitle',
      ]);
      if (observed.value.headSha !== sourceSha || observed.value.displayTitle !== correlation) {
        throw new Error('release-workflow-identity-mismatch');
      }
      if (observed.value.status === 'completed') {
        if (observed.value.conclusion !== 'success') throw new Error(`release-workflow-${phase}-failed`);
        return observed.value;
      }
      await delay(RELEASE_POLL_INTERVAL_MILLISECONDS);
    }
    throw new Error('release-deadline-exhausted');
  }

  async findSuccessfulRun({ phase, sourceSha, watchId }) {
    const run = await this.#findWorkflowRun(runCorrelation(watchId, phase, sourceSha), sourceSha);
    if (run === null || run.status !== 'completed' || run.conclusion !== 'success') return null;
    return run;
  }

  async verifyPublishedRelease(sourceSha) {
    const release = await this.release();
    if (
      release === null ||
      release.tagName !== RELEASE_CONTRACT.releaseTag ||
      release.isDraft !== false ||
      release.isPrerelease !== true
    ) {
      throw new Error('release-publication-invalid');
    }
    const reference = await this.#runner.json('gh', [
      'api',
      `repos/${RELEASE_CONTRACT.repository}/git/ref/tags/${RELEASE_CONTRACT.releaseTag}`,
    ]);
    if (reference.value.object?.sha !== sourceSha) throw new Error('release-tag-source-mismatch');
    return release;
  }

  async #findWorkflowRun(correlation, sourceSha) {
    const result = await this.#runner.json('gh', [
      'run',
      'list',
      '--repo',
      RELEASE_CONTRACT.repository,
      '--workflow',
      RELEASE_CONTRACT.workflow,
      '--commit',
      sourceSha,
      '--event',
      'workflow_dispatch',
      '--json',
      'databaseId,headSha,status,conclusion,url,attempt,displayTitle',
      '--limit',
      '30',
    ]);
    const matches = result.value.filter(
      (candidate) => candidate.headSha === sourceSha && candidate.displayTitle === correlation,
    );
    if (matches.length > 1) throw new Error('release-workflow-dispatch-ambiguous');
    return matches[0] ?? null;
  }

  async #waitForDispatchedRun(correlation, sourceSha, deadlineEpochMilliseconds) {
    while (Date.now() < deadlineEpochMilliseconds) {
      const run = await this.#findWorkflowRun(correlation, sourceSha);
      if (run !== null) return run;
      await delay(5_000);
    }
    throw new Error('release-workflow-dispatch-failed');
  }

  async #approvePendingDeployments(runId) {
    const pending = await this.#runner.json('gh', [
      'api',
      `repos/${RELEASE_CONTRACT.repository}/actions/runs/${runId}/pending_deployments`,
    ]);
    const environmentIds = pending.value
      .filter((deployment) => deployment.environment?.name === RELEASE_CONTRACT.environment)
      .map((deployment) => deployment.environment.id);
    if (environmentIds.length === 0) return;
    await this.#runner.run(
      'gh',
      ['api', '--method', 'POST', `repos/${RELEASE_CONTRACT.repository}/actions/runs/${runId}/pending_deployments`, '--input', '-'],
      {
        input: JSON.stringify({
          comment: `Approved by version-scoped Watch for ${RELEASE_CONTRACT.releaseTag}`,
          environment_ids: environmentIds,
          state: 'approved',
        }),
      },
    );
  }
}
