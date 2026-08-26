import process from 'node:process';
import { appendFileSync } from 'node:fs';
import runnerPolicy from './runner-policy.json' with { type: 'json' };

const SUPPORTED_ARCHITECTURE = 'x64';
const SUPPORTED_PLATFORMS = new Set(['linux', 'windows']);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assertRunner(platform, runner) {
  const expected = SUPPORTED_PLATFORMS.has(platform) ? runnerPolicy[platform] : null;
  if (runner !== expected) throw new Error(`Unsupported ${platform} runner: ${runner}`);
}

function entry(platform, runner) {
  assertRunner(platform, runner);
  return {
    architecture: SUPPORTED_ARCHITECTURE,
    checkName: platform === 'linux' ? 'Linux' : 'Windows',
    platform,
    runner,
    target: platform === 'linux' ? 'linux' : 'win32',
    timeoutMinutes: platform === 'linux' ? 30 : 45,
  };
}

function writeGithubOutput(value) {
  if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required');
  appendFileSync(process.env.GITHUB_OUTPUT, `consumer_matrix=${JSON.stringify(value)}\n`, 'utf8');
}

function main() {
  if (required('CI_ARCHITECTURE') !== SUPPORTED_ARCHITECTURE) {
    throw new Error(`CI_ARCHITECTURE must be ${SUPPORTED_ARCHITECTURE}`);
  }
  const linux = entry('linux', required('CI_LINUX_RUNNER'));
  const windows = entry('windows', required('CI_WINDOWS_RUNNER'));
  const authorized =
    process.env.GITHUB_EVENT_NAME === 'workflow_call' && process.env.WINDOWS_QUALIFICATION_AUTHORIZED === 'true';
  const include = authorized ? [linux, windows] : [linux];
  if (include.some((candidate) => !SUPPORTED_PLATFORMS.has(candidate.platform))) {
    throw new Error('Fixture consumer matrix contains an unsupported platform');
  }
  writeGithubOutput({ include });
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Fixture matrix generation failed'}\n`);
  process.exitCode = 1;
}
