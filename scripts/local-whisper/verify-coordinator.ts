import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';

const DETERMINISTIC_LINUX_PROFILE = 'deterministic-linux';
const REAL_LINUX_CPU_PROFILE = 'real-linux-cpu';
const REAL_LINUX_CUDA_PROFILE = 'real-linux-cuda';
const WINDOWS_PROFILES = Object.freeze(['windows-cpu', 'windows-cuda', 'windows-vulkan'] as const);
const SUPPORTED_PROFILES = Object.freeze([
  DETERMINISTIC_LINUX_PROFILE,
  REAL_LINUX_CPU_PROFILE,
  REAL_LINUX_CUDA_PROFILE,
  ...WINDOWS_PROFILES,
]);
const CPU_RUNTIME_PROFILE = 'linux-x64-cpu-baseline-v1';
const CUDA_RUNTIME_PROFILE = 'linux-x64-cuda-12.8.1-sm120a-v1';
const REAL_PROFILE_AUTHORIZATION_VARIABLE = 'LOCAL_WHISPER_COORDINATOR_REAL_PROFILE_AUTHORIZED';
const workspaceRoot = resolve(__dirname, '..', '..');

function parseProfile(arguments_: readonly string[]): (typeof SUPPORTED_PROFILES)[number] {
  if (arguments_.length !== 1 || !arguments_[0]?.startsWith('--profile=')) {
    throw new Error(`Expected exactly --profile=<${SUPPORTED_PROFILES.join('|')}>`);
  }
  const profile = arguments_[0].slice('--profile='.length);
  const supported = SUPPORTED_PROFILES.find((candidate) => candidate === profile);
  if (!supported) throw new Error('Unknown Local Whisper coordinator verification profile');
  return supported;
}

function runNode(arguments_: readonly string[]): void {
  const result = spawnSync(process.execPath, arguments_, {
    cwd: workspaceRoot,
    shell: false,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function requireLinux(profile: string): void {
  if (process.platform !== 'linux') throw new Error(`${profile} requires Linux`);
}

function requireRealProfileAuthorization(profile: string): void {
  if (process.env[REAL_PROFILE_AUTHORIZATION_VARIABLE] !== profile) {
    throw new Error(
      `${profile} requires exact local inputs and explicit ${REAL_PROFILE_AUTHORIZATION_VARIABLE}=${profile}`,
    );
  }
}

function verifyDeterministicLinux(): void {
  requireLinux(DETERMINISTIC_LINUX_PROFILE);
  runNode([
    '--import',
    'tsx',
    '--test',
    resolve(
      workspaceRoot,
      'tests',
      'main',
      'localWhisper',
      'coordinator',
      'LocalWhisperCoordinator.integration.test.ts',
    ),
  ]);
}

function verifyRealLinuxCpu(): void {
  requireLinux(REAL_LINUX_CPU_PROFILE);
  requireRealProfileAuthorization(REAL_LINUX_CPU_PROFILE);
  runNode([
    resolve(workspaceRoot, 'scripts', 'local-whisper', 'verify-whisper-cpp-cpu.mjs'),
    '--mode=integration',
    `--profile=${CPU_RUNTIME_PROFILE}`,
    '--include-cancellation',
  ]);
}

function verifyRealLinuxCuda(): void {
  requireLinux(REAL_LINUX_CUDA_PROFILE);
  requireRealProfileAuthorization(REAL_LINUX_CUDA_PROFILE);
  runNode([
    resolve(workspaceRoot, 'scripts', 'local-whisper', 'verify-whisper-cpp-cuda-integration.mjs'),
    `--profile=${CUDA_RUNTIME_PROFILE}`,
  ]);
}

try {
  const profile = parseProfile(process.argv.slice(2));
  if (WINDOWS_PROFILES.some((candidate) => candidate === profile)) {
    throw new Error(`${profile} is defined but representative Windows execution is deferred exclusively to Task 19`);
  }
  if (profile === DETERMINISTIC_LINUX_PROFILE) verifyDeterministicLinux();
  else if (profile === REAL_LINUX_CPU_PROFILE) verifyRealLinuxCpu();
  else verifyRealLinuxCuda();
  process.stdout.write(`Local Whisper coordinator verification passed for ${profile}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Coordinator verification failed'}\n`);
  process.exitCode = 1;
}
