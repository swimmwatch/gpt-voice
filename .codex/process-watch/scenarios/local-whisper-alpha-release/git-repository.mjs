import { RELEASE_COMMAND_TIMEOUT_MILLISECONDS, RELEASE_CONTRACT } from './constants.mjs';

const SHA_PATTERN = /^[a-f\d]{40}$/u;

function requireSha(value) {
  const sha = value.trim();
  if (!SHA_PATTERN.test(sha)) throw new Error('release-git-sha-invalid');
  return sha;
}

export class ReleaseGitRepository {
  #runner;

  constructor({ runner }) {
    this.#runner = runner;
  }

  async authenticateIdentity() {
    const [name, email] = await Promise.all([
      this.#runner.run('git', ['config', 'user.name']),
      this.#runner.run('git', ['config', 'user.email']),
    ]);
    if (name.stdout.length === 0 || email.stdout.length === 0) throw new Error('release-git-identity-missing');
  }

  async branch() {
    const result = await this.#runner.run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD']);
    return result.stdout;
  }

  async head() {
    return requireSha((await this.#runner.run('git', ['rev-parse', '--verify', 'HEAD'])).stdout);
  }

  async assertClean() {
    const status = await this.#runner.run('git', ['status', '--porcelain=v1', '--untracked-files=all']);
    if (status.stdout.length !== 0) throw new Error('release-worktree-not-clean');
  }

  async assertUpstreamHead() {
    const [head, upstream] = await Promise.all([
      this.head(),
      this.#runner.run('git', ['rev-parse', '--verify', '@{upstream}']),
    ]);
    if (head !== requireSha(upstream.stdout)) throw new Error('release-upstream-head-mismatch');
    return head;
  }

  async fetch() {
    await this.#runner.run('git', ['fetch', '--prune', 'origin'], {
      timeoutMilliseconds: RELEASE_COMMAND_TIMEOUT_MILLISECONDS,
    });
  }

  async assertAncestor(ancestor, descendant) {
    requireSha(ancestor);
    const result = await this.#runner.run('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      allowFailure: true,
    });
    if (result.exitCode !== 0) throw new Error('release-preserving-merge-invalid');
  }

  async switchToReleaseBranch() {
    await this.fetch();
    const local = await this.#runner.run(
      'git',
      ['show-ref', '--verify', '--quiet', `refs/heads/${RELEASE_CONTRACT.releaseBranch}`],
      { allowFailure: true },
    );
    if (local.exitCode === 0) {
      await this.#runner.run('git', ['switch', RELEASE_CONTRACT.releaseBranch]);
      const remote = await this.#runner.run(
        'git',
        ['show-ref', '--verify', '--quiet', `refs/remotes/origin/${RELEASE_CONTRACT.releaseBranch}`],
        { allowFailure: true },
      );
      if (remote.exitCode === 0) {
        const [localHead, remoteHead] = await Promise.all([
          this.head(),
          this.#runner.run('git', ['rev-parse', '--verify', `origin/${RELEASE_CONTRACT.releaseBranch}`]),
        ]);
        if (localHead !== requireSha(remoteHead.stdout)) throw new Error('release-branch-remote-mismatch');
      }
      return;
    }
    const remote = await this.#runner.run(
      'git',
      ['show-ref', '--verify', '--quiet', `refs/remotes/origin/${RELEASE_CONTRACT.releaseBranch}`],
      { allowFailure: true },
    );
    if (remote.exitCode === 0) {
      await this.#runner.run('git', [
        'switch',
        '--track',
        '--create',
        RELEASE_CONTRACT.releaseBranch,
        `origin/${RELEASE_CONTRACT.releaseBranch}`,
      ]);
      return;
    }
    await this.#runner.run('git', [
      'switch',
      '--create',
      RELEASE_CONTRACT.releaseBranch,
      `origin/${RELEASE_CONTRACT.baseBranch}`,
    ]);
  }

  async commitReleasePreparation(paths) {
    await this.#runner.run('git', ['add', '--', ...paths]);
    const staged = await this.#runner.run('git', ['diff', '--cached', '--name-only', '--']);
    if (staged.stdout.length === 0) return this.head();
    await this.#runner.run('git', ['commit', '-m', `chore(release): prepare ${RELEASE_CONTRACT.releaseTag}`]);
    return this.head();
  }

  async pushReleaseBranch() {
    await this.#runner.run('git', ['push', '--set-upstream', 'origin', RELEASE_CONTRACT.releaseBranch], {
      timeoutMilliseconds: RELEASE_COMMAND_TIMEOUT_MILLISECONDS,
    });
  }
}
