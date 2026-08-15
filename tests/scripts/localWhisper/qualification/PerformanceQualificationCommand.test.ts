import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';

import { LocalWhisperQualificationValidator } from '@scripts/local-whisper/qualification/QualificationContracts';
import { createHostedPerformanceFixture } from '@scripts/local-whisper/qualification/PerformanceQualificationFixtures';

const execFileAsync = promisify(execFile);
const workspaceRoot = path.resolve('.');
const qualificationRoot = path.join(workspaceRoot, 'docs/specs/local-whisper/qualification');
const commandPath = path.join(workspaceRoot, 'scripts/local-whisper/qualification/run-performance-qualification.ts');
const maximumInputBytes = 8 * 1024 * 1024;

function argumentsFor(root: string, input: string, output: string): string[] {
  return [
    '--import',
    'tsx',
    commandPath,
    '--platform=win32',
    '--mode=hostedFixture',
    `--root=${root}`,
    `--input=${input}`,
    `--output=${output}`,
  ];
}

describe('Local Whisper performance qualification command', () => {
  it('reads and writes only inside the validated root and never overwrites a result', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-performance-command-'));
    try {
      const fixture = createHostedPerformanceFixture(
        new LocalWhisperQualificationValidator(qualificationRoot),
        'win32',
        'cpu',
      );
      await writeFile(
        path.join(root, 'input.json'),
        JSON.stringify({ manifest: fixture.manifest, samples: fixture.samples }),
        { encoding: 'utf8', mode: 0o600 },
      );
      const execution = await execFileAsync(process.execPath, argumentsFor(root, 'input.json', 'result.json'), {
        cwd: workspaceRoot,
      });
      const summary = JSON.parse(execution.stdout) as Readonly<Record<string, unknown>>;
      const result = JSON.parse(await readFile(path.join(root, 'result.json'), 'utf8')) as Readonly<
        Record<string, unknown>
      >;
      assert.equal(summary.status, 'produced');
      assert.equal(result.selectedInFlightWindow, 4);
      assert.equal(result.selectionStatus, 'fixtureOnly');
      await assert.rejects(
        execFileAsync(process.execPath, argumentsFor(root, 'input.json', 'result.json'), { cwd: workspaceRoot }),
      );
      await assert.rejects(
        execFileAsync(process.execPath, argumentsFor(root, 'input.json', '../escaped.json'), { cwd: workspaceRoot }),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects empty and oversized input before parsing it', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-performance-input-bounds-'));
    try {
      await writeFile(path.join(root, 'empty.json'), '');
      await writeFile(path.join(root, 'oversized.json'), Buffer.alloc(maximumInputBytes + 1));
      for (const input of ['empty.json', 'oversized.json']) {
        await assert.rejects(
          execFileAsync(process.execPath, argumentsFor(root, input, `${input}.result`), { cwd: workspaceRoot }),
          /Qualification input is invalid/u,
        );
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
