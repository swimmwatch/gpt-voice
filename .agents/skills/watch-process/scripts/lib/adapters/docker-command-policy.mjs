import { runtimeFail } from '../runtime-core-support.mjs';

import { resolveDockerExecutableName } from './adapter-support.mjs';

const FORBIDDEN_SUBCOMMANDS = new Set([
  'attach',
  'commit',
  'cp',
  'export',
  'import',
  'load',
  'login',
  'logout',
  'plugin',
  'pull',
  'push',
  'save',
  'swarm',
  'tag',
]);
const FORBIDDEN_CLEANUP_SUBCOMMANDS = new Set([
  'kill',
  'pause',
  'prune',
  'rename',
  'restart',
  'rm',
  'rmi',
  'stop',
  'unpause',
]);
const FORBIDDEN_FLAGS = new Set([
  '--allow',
  '--build-context',
  '--cache-from',
  '--cache-to',
  '--driver',
  '--iidfile',
  '--output',
  '--platform',
  '--pull',
  '--push',
  '--secret',
  '--ssh',
]);
const FORBIDDEN_FLAG_PREFIXES = Object.freeze([
  '--allow=',
  '--build-context=',
  '--cache-from=',
  '--cache-to=',
  '--driver=',
  '--iidfile=',
  '--output=',
  '--platform=',
  '--pull=',
  '--push=',
  '--secret=',
  '--ssh=',
]);
const HOST_ESCAPE_RUN_FLAGS = new Set([
  '--cap-add',
  '--device',
  '--network',
  '--pid',
  '--privileged',
  '--security-opt',
  '--volume',
  '-v',
]);
const HOST_ESCAPE_RUN_PREFIXES = Object.freeze([
  '--cap-add=',
  '--device=',
  '--network=',
  '--pid=',
  '--security-opt=',
  '--volume=',
]);

function normalizedArgument(value) {
  return value.toLowerCase();
}

function hasForbiddenFlag(args) {
  return args.some((argument) => {
    const normalized = normalizedArgument(argument);
    return FORBIDDEN_FLAGS.has(normalized) || FORBIDDEN_FLAG_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  });
}

function assertNoForbiddenOperation(command) {
  resolveDockerExecutableName(command.executable);
  if (hasForbiddenFlag(command.args)) runtimeFail('forbidden-docker-action');
  const [first = '', second = ''] = command.args.map(normalizedArgument);
  if (FORBIDDEN_SUBCOMMANDS.has(first) || FORBIDDEN_CLEANUP_SUBCOMMANDS.has(first)) {
    runtimeFail('forbidden-docker-action');
  }
  if (
    ['container', 'image', 'network', 'volume', 'system', 'builder'].includes(first) &&
    FORBIDDEN_CLEANUP_SUBCOMMANDS.has(second)
  ) {
    runtimeFail('forbidden-docker-action');
  }
  if (first === 'buildx' || first === 'compose') runtimeFail('forbidden-docker-action');
}

/** Allows only a direct local Docker build and excludes registry, buildx, and cleanup capabilities. */
export function assertDockerBuildCommandAllowed(command) {
  assertNoForbiddenOperation(command);
  if (command.args[0]?.toLowerCase() !== 'build') runtimeFail('docker-build-command-required');
}

function assertSafeSmokeCommand(command) {
  const args = command.args.map(normalizedArgument);
  const hasRemove = args.includes('--rm');
  const hasNoPull =
    args.includes('--pull=never') ||
    args.some((argument, index) => argument === '--pull' && args[index + 1] === 'never');
  const hasDetached = args.includes('--detach') || args.includes('-d');
  const hostEscape = args.some(
    (argument) =>
      HOST_ESCAPE_RUN_FLAGS.has(argument) || HOST_ESCAPE_RUN_PREFIXES.some((prefix) => argument.startsWith(prefix)),
  );
  if (!hasRemove || !hasNoPull || hasDetached || hostEscape) runtimeFail('forbidden-docker-action');
}

/** Allows image inspection and tightly bounded local smoke commands as image verification. */
export function assertDockerVerificationCommandAllowed(command) {
  assertNoForbiddenOperation(command);
  const [first = '', second = ''] = command.args.map(normalizedArgument);
  if (first === 'image' && second === 'inspect') return;
  if (first === 'inspect') return;
  if (first === 'run') {
    assertSafeSmokeCommand(command);
    return;
  }
  runtimeFail('forbidden-docker-verification-command');
}
