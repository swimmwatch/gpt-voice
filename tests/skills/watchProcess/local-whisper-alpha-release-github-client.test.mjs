import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  RELEASE_CONTRACT,
  RELEASE_READ_RETRY_DELAY_MILLISECONDS,
  RELEASE_READ_RETRY_MAX_ATTEMPTS,
} from '../../../.codex/process-watch/scenarios/local-whisper-alpha-release/constants.mjs';
import { ReleaseCommandError } from '../../../.codex/process-watch/scenarios/local-whisper-alpha-release/command-runner.mjs';
import { ReleaseGitHubClient } from '../../../.codex/process-watch/scenarios/local-whisper-alpha-release/github-release-client.mjs';

const SOURCE_SHA = 'a'.repeat(40);
const WATCH_ID = 'local-whisper-alpha-release-test';

class RecordingGitHubRunner {
  calls = [];
  dispatched = false;
  pendingApproval = true;
  pullRequestVisibilityMisses = 0;
  pullRequests = [];

  async run(executable, args, options = {}) {
    this.calls.push({ args: [...args], executable, options: globalThis.structuredClone(options) });
    if (args[0] === 'workflow' && args[1] === 'run') {
      this.dispatched = true;
      return { exitCode: 0, stderr: '', stdout: '' };
    }
    if (
      args[0] === 'api' &&
      args.some((value) => value.includes('/pending_deployments')) &&
      args.includes('POST')
    ) {
      this.pendingApproval = false;
      return { exitCode: 0, stderr: '', stdout: '{}' };
    }
    if (args[0] === 'api' && args[1]?.includes('/releases/tags/')) {
      return { exitCode: 1, stderr: 'HTTP 404: Not Found', stdout: '' };
    }
    if (args[0] === 'api' && args[1]?.includes('/git/ref/tags/')) {
      return { exitCode: 1, stderr: 'HTTP 404: Not Found', stdout: '' };
    }
    if (args[0] === 'pr' && args[1] === 'create') return { exitCode: 0, stderr: '', stdout: 'created' };
    return { exitCode: 0, stderr: '', stdout: '' };
  }

  async json(executable, args, options = {}) {
    this.calls.push({ args: [...args], executable, options: globalThis.structuredClone(options) });
    if (args[0] === 'pr' && args[1] === 'list') {
      if (this.pullRequestVisibilityMisses > 0) {
        this.pullRequestVisibilityMisses -= 1;
        return { exitCode: 0, stderr: '', stdout: '', value: [] };
      }
      return { exitCode: 0, stderr: '', stdout: '', value: globalThis.structuredClone(this.pullRequests) };
    }
    if (args[0] === 'run' && args[1] === 'list') {
      return {
        exitCode: 0,
        stderr: '',
        stdout: '',
        value: this.dispatched
          ? [
              {
                attempt: 1,
                conclusion: 'success',
                databaseId: 77,
                displayTitle: args.includes('task32') ? 'unused' : this.#correlationFromCalls(),
                headSha: SOURCE_SHA,
                status: 'completed',
                url: 'https://github.com/swimmwatch/gpt-voice/actions/runs/77',
              },
            ]
          : [],
      };
    }
    if (args[0] === 'api' && args[1]?.includes('/pending_deployments')) {
      return {
        exitCode: 0,
        stderr: '',
        stdout: '',
        value: this.pendingApproval
          ? [{ environment: { id: 5, name: RELEASE_CONTRACT.environment } }]
          : [],
      };
    }
    if (args[0] === 'run' && args[1] === 'view') {
      return {
        exitCode: 0,
        stderr: '',
        stdout: '',
        value: {
          attempt: 1,
          conclusion: 'success',
          databaseId: 77,
          displayTitle: this.#correlationFromCalls(),
          headSha: SOURCE_SHA,
          status: 'completed',
          url: 'https://github.com/swimmwatch/gpt-voice/actions/runs/77',
        },
      };
    }
    throw new Error(`unexpected-json-call:${args.join(' ')}`);
  }

  #correlationFromCalls() {
    const dispatch = this.calls.find((call) => call.args[0] === 'workflow' && call.args[1] === 'run');
    const fieldIndex = dispatch?.args.findIndex((value) => value.startsWith('watch_correlation=')) ?? -1;
    return fieldIndex >= 0 ? dispatch.args[fieldIndex].slice('watch_correlation='.length) : '';
  }
}

describe('ReleaseGitHubClient operation receipts', () => {
  it('selects the exact open PR instead of becoming ambiguous on historical PRs', async () => {
    const runner = new RecordingGitHubRunner();
    runner.pullRequests = [
      {
        baseRefName: 'main',
        headRefName: RELEASE_CONTRACT.featureBranch,
        headRefOid: 'b'.repeat(40),
        mergedAt: '2026-01-01T00:00:00Z',
        number: 1,
        state: 'MERGED',
      },
      {
        baseRefName: 'main',
        headRefName: RELEASE_CONTRACT.featureBranch,
        headRefOid: SOURCE_SHA,
        mergedAt: null,
        number: 2,
        state: 'OPEN',
      },
    ];
    const pullRequest = await new ReleaseGitHubClient({ runner }).findPullRequest(RELEASE_CONTRACT.featureBranch, {
      includeMerged: true,
      sourceSha: SOURCE_SHA,
    });
    assert.equal(pullRequest.number, 2);
  });

  it('reconciles an existing release PR before creation', async () => {
    const runner = new RecordingGitHubRunner();
    runner.pullRequests = [
      {
        baseRefName: 'main',
        headRefName: RELEASE_CONTRACT.releaseBranch,
        headRefOid: SOURCE_SHA,
        mergedAt: null,
        number: 3,
        state: 'OPEN',
      },
    ];
    assert.equal((await new ReleaseGitHubClient({ runner }).createReleasePullRequest(SOURCE_SHA)).number, 3);
    assert.equal(runner.calls.some((call) => call.args[0] === 'pr' && call.args[1] === 'create'), false);
  });

  it('waits within a bounded window for a just-pushed PR to become visible', async () => {
    const runner = new RecordingGitHubRunner();
    runner.pullRequestVisibilityMisses = 2;
    runner.pullRequests = [
      {
        baseRefName: 'main',
        headRefName: RELEASE_CONTRACT.featureBranch,
        headRefOid: SOURCE_SHA,
        mergedAt: null,
        number: 58,
        state: 'OPEN',
      },
    ];
    let now = 10_000;
    const delays = [];
    const client = new ReleaseGitHubClient({
      clock: () => now,
      delay: async (milliseconds) => {
        delays.push(milliseconds);
        now += milliseconds;
      },
      runner,
    });

    const pullRequest = await client.waitForPullRequest(RELEASE_CONTRACT.featureBranch, {
      deadlineEpochMilliseconds: now + 90_000,
      includeMerged: true,
      sourceSha: SOURCE_SHA,
    });

    assert.equal(pullRequest.number, 58);
    assert.deepEqual(delays, [5_000, 5_000]);
  });

  it('retries a transient read-only GitHub query before accepting its result', async () => {
    const runner = new RecordingGitHubRunner();
    runner.pullRequests = [
      {
        baseRefName: 'main',
        headRefName: RELEASE_CONTRACT.featureBranch,
        headRefOid: SOURCE_SHA,
        mergedAt: null,
        number: 59,
        state: 'OPEN',
      },
    ];
    const originalJson = runner.json.bind(runner);
    let attempts = 0;
    runner.json = async (executable, args, options) => {
      if (args[0] === 'pr' && args[1] === 'list' && attempts++ === 0) {
        throw new ReleaseCommandError('release-command-timed-out');
      }
      return await originalJson(executable, args, options);
    };
    const delays = [];
    const client = new ReleaseGitHubClient({
      delay: async (milliseconds) => delays.push(milliseconds),
      runner,
    });

    const pullRequest = await client.findPullRequest(RELEASE_CONTRACT.featureBranch, { sourceSha: SOURCE_SHA });

    assert.equal(pullRequest.number, 59);
    assert.equal(attempts, 2);
    assert.deepEqual(delays, [RELEASE_READ_RETRY_DELAY_MILLISECONDS]);
  });

  it('fails closed when all bounded read attempts are interrupted', async () => {
    const runner = new RecordingGitHubRunner();
    let attempts = 0;
    runner.json = async () => {
      attempts += 1;
      throw new ReleaseCommandError('release-command-timed-out');
    };
    const delays = [];
    const client = new ReleaseGitHubClient({
      delay: async (milliseconds) => delays.push(milliseconds),
      runner,
    });

    await assert.rejects(
      client.findPullRequest(RELEASE_CONTRACT.featureBranch, { sourceSha: SOURCE_SHA }),
      /release-command-timed-out/u,
    );
    assert.equal(attempts, RELEASE_READ_RETRY_MAX_ATTEMPTS);
    assert.deepEqual(
      delays,
      Array(RELEASE_READ_RETRY_MAX_ATTEMPTS - 1).fill(RELEASE_READ_RETRY_DELAY_MILLISECONDS),
    );
  });

  it('does not retry a failed workflow dispatch mutation', async () => {
    const runner = new RecordingGitHubRunner();
    const originalRun = runner.run.bind(runner);
    let dispatches = 0;
    runner.run = async (executable, args, options) => {
      if (args[0] === 'workflow' && args[1] === 'run') {
        dispatches += 1;
        throw new ReleaseCommandError('release-command-timed-out');
      }
      return await originalRun(executable, args, options);
    };
    const client = new ReleaseGitHubClient({ runner });

    await assert.rejects(
      client.dispatchAndWait({
        deadlineEpochMilliseconds: Date.now() + 60_000,
        phase: 'task32',
        publish: false,
        releaseTag: null,
        sourceSha: SOURCE_SHA,
        watchId: WATCH_ID,
      }),
      /release-command-timed-out/u,
    );
    assert.equal(dispatches, 1);
  });

  it('dispatches against the declared branch, reuses the correlated run, and deduplicates approval', async () => {
    const runner = new RecordingGitHubRunner();
    const client = new ReleaseGitHubClient({ runner });
    const request = {
      deadlineEpochMilliseconds: Date.now() + 60_000,
      phase: 'task32',
      publish: false,
      releaseTag: null,
      sourceSha: SOURCE_SHA,
      watchId: WATCH_ID,
    };
    const first = await client.dispatchAndWait(request);
    const second = await client.dispatchAndWait(request);

    assert.equal(first.databaseId, 77);
    assert.equal(second.databaseId, 77);
    const dispatches = runner.calls.filter((call) => call.args[0] === 'workflow' && call.args[1] === 'run');
    assert.equal(dispatches.length, 1);
    assert.equal(dispatches[0].args[dispatches[0].args.indexOf('--ref') + 1], RELEASE_CONTRACT.featureBranch);
    const approvals = runner.calls.filter(
      (call) =>
        call.args[0] === 'api' &&
        call.args.includes('POST') &&
        call.args.some((value) => value.includes('/pending_deployments')),
    );
    assert.equal(approvals.length, 1);
  });

  it('treats authentication and ambiguous release lookup failures as blockers rather than absence', async () => {
    for (const stderr of ['HTTP 401: Bad credentials', 'network unavailable']) {
      const runner = new RecordingGitHubRunner();
      runner.run = async () => ({ exitCode: 1, stderr, stdout: '' });
      await assert.rejects(
        new ReleaseGitHubClient({ runner }).release(),
        new RegExp(stderr.includes('401') ? 'release-authentication-failed' : 'release-remote-state-ambiguous', 'u'),
      );
    }
  });
});
