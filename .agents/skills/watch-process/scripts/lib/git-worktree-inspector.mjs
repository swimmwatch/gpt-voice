import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { lstat, readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { GitCommandRunner } from './git-command-runner.mjs';
import {
  digestNormalizedValue,
  freezeArray,
  freezeRecord,
  requirePositiveInteger,
  runtimeFail,
} from './runtime-core-support.mjs';
import { validateSourceSha } from './runtime-state-contracts.mjs';
import { normalizeWorkspaceRelativePath } from './scenario-repair-scope.mjs';

const MAX_CHANGED_FILES = 500;
const MAX_REPAIR_FILE_BYTES = 10_485_760;
const GIT_REFERENCE_PATTERN = /^(?!(?:.*\/)?\.\.?$)[A-Za-z0-9][\w./-]{0,255}$/u;

function defaultFileSystem() {
  return Object.freeze({ lstat, readFile });
}

function sameIdentity(left, right) {
  return (
    left.byteLength === right.byteLength &&
    left.contentDigest === right.contentDigest &&
    left.exists === right.exists &&
    left.mode === right.mode &&
    left.path === right.path
  );
}

function normalizeRelativePath(value) {
  return normalizeWorkspaceRelativePath(value, '$.gitPath');
}

function normalizeReference(value, code) {
  const reference = value.trim();
  if (!GIT_REFERENCE_PATTERN.test(reference) || reference.includes('//') || reference.includes('..')) runtimeFail(code);
  return reference;
}

function splitNullSeparatedPaths(value) {
  if (value.length === 0) return [];
  if (!value.endsWith('\0')) runtimeFail('git-path-output-invalid');
  return value
    .slice(0, -1)
    .split('\0')
    .map((entry) => normalizeRelativePath(entry));
}

function normalizeWorkspaceRoot(value) {
  if (typeof value !== 'string' || value.length === 0) runtimeFail('invalid-git-worktree-inspector');
  return path.resolve(value);
}

/** Owns bounded Git worktree observations without retaining raw command output. */
export class GitWorktreeInspector {
  #commandRunner;
  #fileSystem;
  #workspaceRoot;

  constructor({ commandRunner, fileSystem = defaultFileSystem(), workspaceRoot } = {}) {
    if (!(commandRunner instanceof GitCommandRunner)) runtimeFail('invalid-git-worktree-inspector');
    if (typeof fileSystem?.lstat !== 'function' || typeof fileSystem?.readFile !== 'function') {
      runtimeFail('invalid-git-worktree-inspector');
    }
    this.#commandRunner = commandRunner;
    this.#fileSystem = fileSystem;
    this.#workspaceRoot = normalizeWorkspaceRoot(workspaceRoot);
  }

  async assertClean({ timeoutMilliseconds } = {}) {
    const snapshot = await this.snapshot({ timeoutMilliseconds });
    if (snapshot.changedFiles.length !== 0) runtimeFail('repair-worktree-not-clean');
    return snapshot;
  }

  async currentBranch({ timeoutMilliseconds } = {}) {
    const response = await this.#commandRunner.run({
      args: ['symbolic-ref', '--quiet', '--short', 'HEAD'],
      timeoutMilliseconds,
    });
    if (!response.terminal.succeeded) runtimeFail('git-detached-head');
    return normalizeReference(response.stdout, 'git-branch-invalid');
  }

  async currentUpstream({ timeoutMilliseconds } = {}) {
    const response = await this.#commandRunner.run({
      args: ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
      timeoutMilliseconds,
    });
    if (!response.terminal.succeeded) runtimeFail('git-upstream-unavailable');
    const fullName = normalizeReference(response.stdout, 'git-upstream-invalid');
    const separator = fullName.indexOf('/');
    if (separator < 1 || separator === fullName.length - 1) runtimeFail('git-upstream-invalid');
    return freezeRecord({
      branch: normalizeReference(fullName.slice(separator + 1), 'git-upstream-invalid'),
      remote: normalizeReference(fullName.slice(0, separator), 'git-upstream-invalid'),
    });
  }

  async readHead({ timeoutMilliseconds } = {}) {
    const response = await this.#commandRunner.run({ args: ['rev-parse', '--verify', 'HEAD'], timeoutMilliseconds });
    if (!response.terminal.succeeded) runtimeFail('git-head-unavailable');
    return validateSourceSha(response.stdout.trim(), 'git-head-invalid');
  }

  async remoteHead({ timeoutMilliseconds, upstream } = {}) {
    if (upstream === null || typeof upstream !== 'object') runtimeFail('git-upstream-invalid');
    const remote = normalizeReference(upstream.remote, 'git-upstream-invalid');
    const branch = normalizeReference(upstream.branch, 'git-upstream-invalid');
    const response = await this.#commandRunner.run({
      args: ['ls-remote', '--heads', remote, `refs/heads/${branch}`],
      timeoutMilliseconds,
    });
    if (!response.terminal.succeeded) runtimeFail('git-remote-inspection-failed');
    const lines = response.stdout.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;
    if (lines.length !== 1) runtimeFail('git-remote-head-ambiguous');
    const match = /^(?<sha>[a-f0-9]{40}|[a-f0-9]{64})\trefs\/heads\/(?<branch>[^\t\r\n]+)$/u.exec(lines[0]);
    if (match?.groups?.sha === undefined || match.groups.branch !== branch) runtimeFail('git-remote-head-invalid');
    return validateSourceSha(match.groups.sha, 'git-remote-head-invalid');
  }

  async snapshot({ timeoutMilliseconds } = {}) {
    const timeout = requirePositiveInteger(timeoutMilliseconds, 'invalid-git-command-timeout', 604_800_000);
    const [headSha, changedFiles] = await Promise.all([
      this.readHead({ timeoutMilliseconds: timeout }),
      this.changedFiles({ timeoutMilliseconds: timeout }),
    ]);
    const files = await this.snapshotFiles(changedFiles);
    const diffDigest = digestNormalizedValue('gpt-voice/watch-process/repair-worktree/v1', {
      files,
      headSha,
    });
    return freezeRecord({ changedFiles, diffDigest, files, headSha });
  }

  async snapshotFiles(paths) {
    if (!Array.isArray(paths) || paths.length > MAX_CHANGED_FILES) runtimeFail('invalid-repair-file-list');
    const normalized = paths.map((candidate) => normalizeRelativePath(candidate)).sort();
    if (new Set(normalized).size !== normalized.length) runtimeFail('invalid-repair-file-list');
    return freezeArray(await Promise.all(normalized.map((relativePath) => this.#fileIdentity(relativePath))));
  }

  async changedFiles({ timeoutMilliseconds } = {}) {
    const timeout = requirePositiveInteger(timeoutMilliseconds, 'invalid-git-command-timeout', 604_800_000);
    const responses = await Promise.all([
      this.#commandRunner.run({
        args: ['diff', '--no-ext-diff', '--no-renames', '--name-only', '-z'],
        timeoutMilliseconds: timeout,
      }),
      this.#commandRunner.run({
        args: ['diff', '--cached', '--no-ext-diff', '--no-renames', '--name-only', '-z'],
        timeoutMilliseconds: timeout,
      }),
      this.#commandRunner.run({
        args: ['ls-files', '--others', '--exclude-standard', '-z'],
        timeoutMilliseconds: timeout,
      }),
    ]);
    for (const response of responses) {
      if (!response.terminal.succeeded) runtimeFail('git-worktree-inspection-failed');
    }
    const paths = new Set(responses.flatMap((response) => splitNullSeparatedPaths(response.stdout)));
    if (paths.size > MAX_CHANGED_FILES) runtimeFail('repair-patch-limit-exceeded');
    return freezeArray([...paths].sort());
  }

  static sameSnapshot(left, right) {
    return (
      left !== null &&
      right !== null &&
      left.headSha === right.headSha &&
      left.diffDigest === right.diffDigest &&
      Array.isArray(left.changedFiles) &&
      Array.isArray(right.changedFiles) &&
      left.changedFiles.length === right.changedFiles.length &&
      left.changedFiles.every((path_, index) => path_ === right.changedFiles[index])
    );
  }

  static sameFileIdentity(left, right) {
    return left !== null && right !== null && sameIdentity(left, right);
  }

  async #fileIdentity(relativePath) {
    const candidate = path.resolve(this.#workspaceRoot, ...relativePath.split('/'));
    const relative = path.relative(this.#workspaceRoot, candidate);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      runtimeFail('repair-path-outside-workspace');
    }
    let before;
    try {
      before = await this.#fileSystem.lstat(candidate);
    } catch (error) {
      if (error?.code === 'ENOENT')
        return freezeRecord({ byteLength: 0, contentDigest: null, exists: false, mode: null, path: relativePath });
      runtimeFail('repair-file-inspection-failed');
    }
    if (before.isSymbolicLink?.() || !before.isFile?.() || before.size > MAX_REPAIR_FILE_BYTES) {
      runtimeFail('repair-file-inspection-failed');
    }
    let contents;
    try {
      contents = await this.#fileSystem.readFile(candidate);
    } catch {
      runtimeFail('repair-file-inspection-failed');
    }
    const bytes = Buffer.from(contents);
    if (bytes.byteLength !== before.size || bytes.byteLength > MAX_REPAIR_FILE_BYTES)
      runtimeFail('repair-file-inspection-failed');
    let after;
    try {
      after = await this.#fileSystem.lstat(candidate);
    } catch {
      runtimeFail('repair-file-changed-during-hash');
    }
    if (
      after.isSymbolicLink?.() ||
      !after.isFile?.() ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      (after.mode & 0o7777) !== (before.mode & 0o7777)
    ) {
      runtimeFail('repair-file-changed-during-hash');
    }
    return freezeRecord({
      byteLength: bytes.byteLength,
      contentDigest: createHash('sha256').update(bytes).digest('hex'),
      exists: true,
      mode: before.mode & 0o7777,
      path: relativePath,
    });
  }
}
