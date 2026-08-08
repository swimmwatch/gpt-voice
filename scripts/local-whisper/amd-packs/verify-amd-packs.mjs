import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { verifyCleanStartRoot, verifyHipNoApprovedRow, verifyVulkanContract, workspaceRoot } from './contract-core.mjs';

function parseArguments(arguments_) {
  const result = new Map();
  for (const argument of arguments_) {
    const separator = argument.indexOf('=');
    if (!argument.startsWith('--') || separator < 3) throw new Error(`Invalid AMD pack argument: ${argument}`);
    const key = argument.slice(2, separator);
    if (result.has(key)) throw new Error(`Duplicate AMD pack argument: ${key}`);
    result.set(key, argument.slice(separator + 1));
  }
  return result;
}

function verifyRelocatedCleanStart(root) {
  const maliciousWorkingDirectory = resolve(
    workspaceRoot,
    '.cache',
    'local-whisper',
    'amd-packs',
    'malicious-working-directory',
  );
  mkdirSync(maliciousWorkingDirectory, { mode: 0o700, recursive: true });
  const child = spawnSync(process.execPath, [import.meta.filename, `--clean-start-root=${root}`], {
    cwd: maliciousWorkingDirectory,
    encoding: 'utf8',
    env: {
      LANG: 'C',
      LC_ALL: 'C',
      LOCAL_WHISPER_NETWORK: 'denied',
      PATH: '/usr/bin:/bin',
    },
    shell: false,
  });
  if (child.error || child.status !== 0) {
    throw new Error(`Synthetic AMD clean-start verification failed: ${child.stderr.trim()}`);
  }
}

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  if (arguments_.has('clean-start-root')) {
    verifyCleanStartRoot(resolve(arguments_.get('clean-start-root')));
  } else {
    const profile = arguments_.get('profile');
    if (profile === 'vulkan-contract-linux' || profile === 'vulkan-windows-x64') {
      const relocatedRoot = verifyVulkanContract();
      verifyRelocatedCleanStart(relocatedRoot);
      process.stdout.write(`${profile}\tPreview · Untested\tcontract-only\n`);
    } else if (profile === 'hip-no-approved-row') {
      verifyHipNoApprovedRow();
      process.stdout.write('hip-no-approved-row\tPreview · Untested\tunavailable-no-approved-row\n');
    } else if (profile === 'amd-physical-qualification') {
      throw new Error('Physical AMD qualification is outside the current release');
    } else {
      throw new Error('Unsupported AMD pack verification profile');
    }
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'AMD pack verification failed'}\n`);
  process.exitCode = 1;
}
