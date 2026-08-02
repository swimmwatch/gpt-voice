import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { importerIdentity } from './importer-identity.mjs';
import { buildSourceCandidate, parseArguments, requiredArgument, writeJsonAtomic } from './native-source-core.mjs';
import { getSourceDefinition } from './source-definitions.mjs';

function sanitizedGitEnvironment() {
  return {
    GIT_ASKPASS: '/bin/false',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_LFS_SKIP_SMUDGE: '1',
    GIT_TERMINAL_PROMPT: '0',
    LANG: 'C',
    LC_ALL: 'C',
    PATH: process.env.PATH,
    SSH_ASKPASS: '/bin/false',
  };
}

function git(repositoryRoot, arguments_) {
  const result = spawnSync(
    'git',
    [
      '-c',
      'advice.detachedHead=false',
      '-c',
      'core.autocrlf=false',
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'credential.helper=',
      '-c',
      'filter.lfs.clean=',
      '-c',
      'filter.lfs.required=false',
      '-c',
      'filter.lfs.smudge=',
      '-c',
      'protocol.file.allow=never',
      ...arguments_,
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: sanitizedGitEnvironment(),
      maxBuffer: 256 * 1024 * 1024,
      shell: false,
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error(`Pinned Git import failed: ${result.error?.message ?? result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const lockId = requiredArgument(arguments_, 'lock');
  const privateRoot = resolve(requiredArgument(arguments_, 'private-root'));
  const output = resolve(requiredArgument(arguments_, 'candidate-output'));
  const imageIdentity = arguments_.get('image-identity') ?? 'host-manual-gate';
  const definition = getSourceDefinition(lockId);
  mkdirSync(privateRoot, { mode: 0o700, recursive: true });
  const canonicalPrivateRoot = realpathSync(privateRoot);
  const repositoryRoot = mkdtempSync(resolve(canonicalPrivateRoot, `${lockId}-`));
  git(repositoryRoot, ['init', '--quiet']);
  git(repositoryRoot, [
    'fetch',
    '--no-auto-maintenance',
    '--no-recurse-submodules',
    '--no-tags',
    '--depth=1',
    definition.repository,
    definition.commit,
  ]);
  const fetchedCommit = git(repositoryRoot, ['rev-parse', 'FETCH_HEAD^{commit}']);
  if (fetchedCommit !== definition.commit) throw new Error('Networked import returned the wrong commit');
  git(repositoryRoot, ['update-ref', 'refs/local-whisper/imported', definition.commit]);
  git(repositoryRoot, ['fsck', '--full', '--strict', '--no-dangling']);
  const gitVersion = git(repositoryRoot, ['--version']);
  const candidate = buildSourceCandidate(repositoryRoot, lockId, importerIdentity(gitVersion, imageIdentity));
  const result = Object.freeze({ ...candidate, privateRepositoryRoot: repositoryRoot });
  writeJsonAtomic(output, result);
  process.stdout.write(`${candidate.candidateDigest}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Pinned native source import failed'}\n`);
  process.exitCode = 1;
}
