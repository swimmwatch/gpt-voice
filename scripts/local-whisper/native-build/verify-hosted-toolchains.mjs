import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import Ajv2020 from 'ajv/dist/2020.js';

import { assertClosedHostedWindowsProfile, HOSTED_TOOLCHAIN_ACQUISITION_SCHEMA_ID } from './hosted-toolchain-core.mjs';
import { readJson } from '../source-import/native-source-core.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');
const schemaPath = resolve(
  workspaceRoot,
  'runtime',
  'local-whisper',
  'toolchains',
  'schema',
  'hosted-toolchain-acquisition-lock.schema.json',
);
const profilesRoot = resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains', 'profiles');
const buildCorePath = resolve(workspaceRoot, 'scripts', 'local-whisper', 'whisper-cpp-build-core.mjs');
const runtimePackProducerPath = resolve(
  workspaceRoot,
  'scripts',
  'local-whisper',
  'qualification',
  'produce-runtime-packs.mjs',
);
const windowsRunnerPath = resolve(
  workspaceRoot,
  'scripts',
  'local-whisper',
  'native-build',
  'windows-network-denied-runner.mjs',
);

function fail(message) {
  throw new Error(`Hosted toolchain verification failed: ${message}`);
}

function verifySchema() {
  const schema = readJson(schemaPath);
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  if (schema.$id !== 'https://gpt-voice.local/schemas/local-whisper-hosted-toolchain-acquisition-lock-v1.json') {
    fail('acquisition schema identity changed');
  }
  if (schema.properties?.schemaId?.const !== HOSTED_TOOLCHAIN_ACQUISITION_SCHEMA_ID || typeof validate !== 'function') {
    fail('acquisition schema does not bind the canonical contract');
  }
}

function verifyFailClosedWindowsProfiles() {
  for (const profileId of ['windows-x64-cpu-msvc-19.51-v1', 'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1']) {
    const profile = readJson(resolve(profilesRoot, `${profileId}.json`));
    let rejected = false;
    try {
      assertClosedHostedWindowsProfile(profile);
    } catch {
      rejected = true;
    }
    if (!rejected) fail(`${profileId} unexpectedly accepts an ambient hosted build authority`);
  }
}

function verifyBuildBoundarySource() {
  const buildCore = readFileSync(buildCorePath, 'utf8');
  const runtimePackProducer = readFileSync(runtimePackProducerPath, 'utf8');
  const windowsRunner = readFileSync(windowsRunnerPath, 'utf8');
  if (
    !buildCore.includes('resolveNetworkDeniedCommand') ||
    !runtimePackProducer.includes('networkDenied: true') ||
    buildCore.includes('networkHarness:')
  ) {
    fail('native build controller does not route all runtime-pack builds through the shared boundary');
  }
  if (
    !windowsRunner.includes('New-NetFirewallRule') ||
    !windowsRunner.includes('Remove-NetFirewallRule') ||
    !windowsRunner.includes('LOCAL_WHISPER_NETWORK_DENIED')
  ) {
    fail('Windows boundary does not require an OS firewall rule and same-boundary probe');
  }
}

try {
  verifySchema();
  verifyFailClosedWindowsProfiles();
  verifyBuildBoundarySource();
  process.stdout.write(
    'Hosted toolchain local contract verified; official production locks and hosted Linux/Windows runs remain manual gates.\n',
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Hosted toolchain verification failed'}\n`);
  process.exitCode = 1;
}
