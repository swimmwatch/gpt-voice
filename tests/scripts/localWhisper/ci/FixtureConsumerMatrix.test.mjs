import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const script = resolve('scripts/local-whisper/ci/emit-fixture-consumer-matrix.mjs');

function emit(overrides = {}) {
  const directory = mkdtempSync(resolve(tmpdir(), 'gpt-voice-fixture-matrix-'));
  const output = resolve(directory, 'github-output');
  writeFileSync(output, '', 'utf8');
  try {
    const result = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CI_ARCHITECTURE: 'x64',
        CI_LINUX_RUNNER: 'ubuntu-24.04',
        CI_WINDOWS_RUNNER: 'windows-latest',
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_OUTPUT: output,
        WINDOWS_QUALIFICATION_AUTHORIZED: 'false',
        ...overrides,
      },
    });
    const text = readFileSync(output, 'utf8');
    return { matrix: text ? JSON.parse(text.slice('consumer_matrix='.length)) : null, result };
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

test('fixture packaging selects only Linux outside the authorized reusable invocation', () => {
  const { matrix, result } = emit();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    matrix.include.map((entry) => entry.platform),
    ['linux'],
  );
});

test('fixture packaging adds Windows only for an authorized reusable invocation', () => {
  const { matrix, result } = emit({
    GITHUB_EVENT_NAME: 'workflow_call',
    WINDOWS_QUALIFICATION_AUTHORIZED: 'true',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    matrix.include.map((entry) => entry.platform),
    ['linux', 'windows'],
  );
});

test('fixture packaging rejects invalid configured runner values', () => {
  const { result } = emit({ CI_WINDOWS_RUNNER: 'self-hosted' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported windows runner/u);
});
