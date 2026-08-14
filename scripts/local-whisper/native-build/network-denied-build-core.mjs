import { isAbsolute, resolve } from 'node:path';
import process from 'node:process';

import { resolveProfileTool } from './native-toolchain-core.mjs';

export const LINUX_NETWORK_DENIAL_STRATEGY = 'linux-user-network-namespace';
export const WINDOWS_NETWORK_DENIAL_STRATEGY = 'windows-firewall-process-boundary';

const WINDOWS_RUNNER_PATH = resolve(import.meta.dirname, 'windows-network-denied-runner.mjs');

function fail(message) {
  throw new Error(`Network-denied native build contract failed: ${message}`);
}

function requireRole(profile, role) {
  if (!profile.tools.some((tool) => tool.role === role)) {
    fail(`${profile.target.os} profile is missing required network role: ${role}`);
  }
}

function assertBuildRoot(buildRoot) {
  if (!isAbsolute(buildRoot) || resolve(buildRoot) === resolve(buildRoot, '..')) {
    fail('attempt build root must be an absolute bounded directory');
  }
}

function windowsAllowedPrograms(command, allowedPrograms) {
  if (!Array.isArray(allowedPrograms) || allowedPrograms.length === 0) {
    fail('Windows network boundary requires the prepared executable set');
  }
  const programs = new Set(allowedPrograms);
  programs.add(command);
  programs.add(process.execPath);
  const result = [...programs];
  if (result.some((program) => !isAbsolute(program))) fail('Windows network boundary contains a non-absolute program');
  return result;
}

/**
 * Resolves the OS-enforced command boundary used for every disconnected native
 * build phase. It deliberately has no proxy or boolean-only fallback.
 */
export function resolveNetworkDeniedCommand({
  profile,
  toolchainRoot,
  buildRoot,
  command,
  arguments_,
  allowedPrograms = null,
}) {
  if (!profile?.target || !['linux', 'windows'].includes(profile.target.os)) {
    fail('network boundary profile target is invalid');
  }
  if (!isAbsolute(command) || !Array.isArray(arguments_)) fail('network boundary command is invalid');
  assertBuildRoot(buildRoot);
  if (profile.target.os === 'linux') {
    requireRole(profile, 'network-probe-runtime');
    requireRole(profile, 'network-harness');
    return Object.freeze({
      arguments: Object.freeze(['-Urn', '--', command, ...arguments_]),
      command: resolveProfileTool(profile, toolchainRoot, 'network-harness'),
      strategy: LINUX_NETWORK_DENIAL_STRATEGY,
    });
  }
  return Object.freeze({
    arguments: Object.freeze([
      WINDOWS_RUNNER_PATH,
      `--attempt-root=${buildRoot}`,
      ...windowsAllowedPrograms(command, allowedPrograms).map((program) => `--allowed-program=${program}`),
      '--',
      command,
      ...arguments_,
    ]),
    command: process.execPath,
    strategy: WINDOWS_NETWORK_DENIAL_STRATEGY,
  });
}
