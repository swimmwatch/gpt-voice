import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const PACKAGE_ROOT = path.resolve(WORKSPACE_ROOT, 'release', 'win-unpacked');
const LOCAL_WHISPER_ROOT = path.join(PACKAGE_ROOT, 'resources', 'local-whisper');
const NATIVE_ROOT = path.join(LOCAL_WHISPER_ROOT, 'native');
const EXPECTED_LOCAL_WHISPER_FILES = ['catalog-state.json', 'keyring.json', 'native'];
const EXPECTED_NATIVE_FILES = ['fs-guard.exe', 'helpers.manifest.json', 'LICENSE.txt', 'local-whisper-launcher.exe'];
const EXPECTED_HELPERS = [
  { name: 'fs-guard.exe', role: 'filesystem-authority-guard' },
  { name: 'local-whisper-launcher.exe', role: 'operation-scoped-launcher' },
];

function sortedEntries(directory) {
  return readdirSync(directory).sort((left, right) => left.localeCompare(right, 'en'));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertUnsigned(filePath) {
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '(Get-AuthenticodeSignature -LiteralPath $env:LOCAL_WHISPER_TASK24_SIGNATURE_TARGET).Status.ToString()',
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, LOCAL_WHISPER_TASK24_SIGNATURE_TARGET: filePath },
      shell: false,
      windowsHide: true,
    },
  );
  assert.equal(result.status, 0, 'Authenticode inspection failed');
  assert.equal(result.stdout.trim(), 'NotSigned', 'Unpacked Task 24 output must remain unsigned');
}

function allFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...allFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function verify() {
  assert.equal(process.platform, 'win32', 'Windows unpacked verification requires native Windows');
  assert.equal(process.arch, 'x64', 'Windows unpacked verification requires x64');
  assert.deepEqual(sortedEntries(LOCAL_WHISPER_ROOT), EXPECTED_LOCAL_WHISPER_FILES);
  assert.deepEqual(sortedEntries(NATIVE_ROOT), EXPECTED_NATIVE_FILES);

  const state = JSON.parse(readFileSync(path.join(LOCAL_WHISPER_ROOT, 'catalog-state.json'), 'utf8'));
  assert.equal(state.platform, 'win32');
  assert.equal(state.mode, 'disabled');
  assert.equal(state.purpose, 'disabled');
  assert.equal(state.executableActionsEnabled, false);
  assert.equal(state.catalogSha256, null);
  assert.equal(state.bundleManifestSha256, null);
  assert.equal(state.signingKeyId, null);

  const manifest = JSON.parse(readFileSync(path.join(NATIVE_ROOT, 'helpers.manifest.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.platform, 'win32');
  assert.equal(manifest.licenseFile, 'LICENSE.txt');
  assert.equal(manifest.helpers.length, EXPECTED_HELPERS.length);
  for (const [index, expected] of EXPECTED_HELPERS.entries()) {
    const helper = manifest.helpers[index];
    assert.equal(helper.name, expected.name);
    assert.equal(helper.role, expected.role);
    assert.equal(helper.mode, 0);
    const helperPath = path.join(NATIVE_ROOT, expected.name);
    const bytes = readFileSync(helperPath);
    assert.equal(bytes[0], 0x4d, 'Windows helper must be a PE executable');
    assert.equal(bytes[1], 0x5a, 'Windows helper must be a PE executable');
    assert.equal(helper.sizeBytes, bytes.byteLength);
    assert.equal(helper.sha256, sha256(bytes));
    assertUnsigned(helperPath);
  }

  const application = sortedEntries(PACKAGE_ROOT).find((entry) => entry.toLowerCase() === 'gpt-voice.exe');
  assert.ok(application, 'Unpacked Windows application executable is missing');
  assertUnsigned(path.join(PACKAGE_ROOT, application));
  assert.ok(statSync(path.join(PACKAGE_ROOT, 'resources', 'app.asar')).size > 0, 'Application ASAR is missing');

  const forbidden = allFiles(PACKAGE_ROOT).filter((filePath) =>
    /local-whisper-whisper-cpp-worker|ggml-[^\\/]*\.bin|cudart|cublas|nvrtc/iu.test(path.basename(filePath)),
  );
  assert.deepEqual(forbidden, [], 'Unpacked base package contains an inference runtime, model, or CUDA payload');
}

try {
  verify();
  process.stdout.write('Local Whisper unsigned Windows unpacked package verified\n');
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Windows unpacked verification failed'}\n`);
  process.exitCode = 1;
}
