import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');
const platformArgument = process.argv.find((value) => value.startsWith('--platform='));
const platform = platformArgument?.slice('--platform='.length);
const contractOnly = process.argv.includes('--contract-only');
if (platform !== 'linux' && platform !== 'windows') {
  throw new Error('Expected --platform=linux or --platform=windows');
}

function source(relativePath) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

function requireInOrder(value, markers, label) {
  let offset = -1;
  for (const marker of markers) {
    const next = value.indexOf(marker, offset + 1);
    assert.notEqual(next, -1, `${label}: ${marker}`);
    assert.ok(next > offset, `${label}: ${marker} ordering`);
    offset = next;
  }
}

function verifyWindowsContract() {
  assert.equal(contractOnly, true, 'Task 09 permits Windows contract-only validation');
  const guard = source('runtime/local-whisper/fs-guard/src/platform/windows/windows_model_authority_server.cpp');
  const client = source('runtime/local-whisper/launcher/src/platform/windows/windows_model_authority_client.cpp');
  const launcher = source('runtime/local-whisper/launcher/src/platform/windows/windows_launcher.cpp');
  for (const marker of ['DuplicateHandle', 'DUPLICATE_SAME_ACCESS', 'windows_launcher_handle']) {
    assert.ok(guard.includes(marker), `Windows guard contract: ${marker}`);
  }
  for (const marker of ['DuplicateHandle', 'windows_worker_handle', 'carrier_value', 'worker_pid']) {
    assert.ok(client.includes(marker), `Windows launcher client contract: ${marker}`);
  }
  for (const marker of [
    'STARTUPINFOEXW',
    'PROC_THREAD_ATTRIBUTE_HANDLE_LIST',
    'CREATE_SUSPENDED',
    'JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE',
  ]) {
    assert.ok(launcher.includes(marker), `Windows launcher contract: ${marker}`);
  }
  requireInOrder(
    launcher,
    ['CreateProcessW', 'AssignProcessToJobObject', 'ResumeThread', 'write_acknowledgment'],
    'Windows assign/resume/bootstrap-ready contract',
  );
  assert.match(launcher, /Terminate(?:Process|JobObject)/u);

  const manifest = JSON.parse(source('tests/fixtures/local-whisper/protocol/v1/manifest.json'));
  const authorityNames = new Set(manifest.authority.map((entry) => entry.name));
  assert.equal(authorityNames.has('windows-hop-1'), true);
  assert.equal(authorityNames.has('windows-hop-2'), true);
  process.stdout.write('Local Whisper Windows authority source contract verified without execution\n');
}

function verifyLinuxExecutableContract() {
  if (contractOnly) throw new Error('Linux authority verification must execute integration tests');
  if (process.platform !== 'linux') throw new Error('Linux authority verification requires Linux');
  const result = spawnSync(
    process.execPath,
    [resolve(workspaceRoot, 'scripts', 'local-whisper', 'native-launcher-quality.mjs'), 'integration'],
    {
      cwd: workspaceRoot,
      shell: false,
      stdio: 'inherit',
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  process.stdout.write('Local Whisper Linux authority handoff verified\n');
}

if (platform === 'windows') verifyWindowsContract();
else verifyLinuxExecutableContract();
