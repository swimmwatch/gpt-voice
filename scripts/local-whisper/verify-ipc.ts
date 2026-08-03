import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';

const DETERMINISTIC_PROFILE = 'deterministic';
const WINDOWS_PROFILES = Object.freeze(['windows-cpu', 'windows-cuda', 'windows-vulkan'] as const);
const SUPPORTED_PROFILES = Object.freeze([DETERMINISTIC_PROFILE, ...WINDOWS_PROFILES] as const);
const workspaceRoot = resolve(__dirname, '..', '..');

function parseProfile(arguments_: readonly string[]): (typeof SUPPORTED_PROFILES)[number] {
  if (arguments_.length !== 1 || !arguments_[0]?.startsWith('--profile=')) {
    throw new Error(`Expected exactly --profile=<${SUPPORTED_PROFILES.join('|')}>`);
  }
  const profile = arguments_[0].slice('--profile='.length);
  const supported = SUPPORTED_PROFILES.find((candidate) => candidate === profile);
  if (!supported) throw new Error('Unknown Local Whisper IPC verification profile');
  return supported;
}

function runDeterministicTests(): void {
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--test',
      resolve(workspaceRoot, 'tests', 'shared', 'localWhisper', 'ipc.test.ts'),
      resolve(workspaceRoot, 'tests', 'main', 'localWhisper', 'ipc', '*.test.ts'),
      resolve(workspaceRoot, 'tests', 'main', 'localWhisper', 'composition', '*.test.ts'),
      resolve(workspaceRoot, 'tests', 'main', 'backgroundBrowserLifecycle.test.ts'),
      resolve(workspaceRoot, 'tests', 'main', 'mainProcessApplication.test.ts'),
      resolve(workspaceRoot, 'tests', 'main', 'mainProcessCompositionRoot.test.ts'),
      resolve(workspaceRoot, 'tests', 'main', 'preloadApi.test.ts'),
      resolve(workspaceRoot, 'tests', 'main', 'providers', 'localWhisper*.test.ts'),
      resolve(workspaceRoot, 'tests', 'main', 'providers', 'providerRegistry.test.ts'),
      resolve(workspaceRoot, 'tests', 'main', 'windowManager.test.ts'),
      resolve(workspaceRoot, 'tests', 'renderer', 'localWhisper', '*.test.ts'),
      resolve(workspaceRoot, 'tests', 'renderer', 'providerState.test.ts'),
      resolve(workspaceRoot, 'tests', 'renderer', 'providerSwitching.test.ts'),
    ],
    {
      cwd: workspaceRoot,
      shell: false,
      stdio: 'inherit',
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  const profile = parseProfile(process.argv.slice(2));
  if (WINDOWS_PROFILES.some((candidate) => candidate === profile)) {
    throw new Error(`${profile} is defined but representative Windows execution is deferred exclusively to Task 20`);
  }
  runDeterministicTests();
  process.stdout.write(`Local Whisper IPC verification passed for ${profile}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'IPC verification failed'}\n`);
  process.exitCode = 1;
}
