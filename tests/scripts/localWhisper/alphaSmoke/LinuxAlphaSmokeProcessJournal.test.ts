import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { LinuxAlphaSmokeProcessJournal } from '@scripts/local-whisper/alpha-smoke/LinuxAlphaSmokeProcessJournal';
import { LinuxAlphaSmokeClock } from '@scripts/local-whisper/alpha-smoke/LinuxAlphaSmokeClock';
import {
  createPlatformSmokeInput,
  type AlphaSmokeAttempt,
} from '@scripts/local-whisper/alpha-smoke/AlphaSmokeProtocol';

function createAttempt(): AlphaSmokeAttempt {
  return {
    schemaVersion: 2,
    monotonicDeadline: new LinuxAlphaSmokeClock().capture(60_000),
    completion: null,
    terminalOutcome: null,
    attemptId: 'alpha-test',
    deadlineEpochMilliseconds: Date.now() + 60_000,
    input: createPlatformSmokeInput(
      'linux',
      [{ fileName: 'gpt-voice_2.4.0-alpha.1_amd64.deb', length: 1, sha256: 'a'.repeat(64) }],
      'd'.repeat(64),
    ),
    packageDisposition: 'exact-alpha',
    settingsBackupStatus: 'retained-private',
    startedAtEpochMilliseconds: Date.now(),
    state: 'Finalizing',
  };
}

describe('LinuxAlphaSmokeProcessJournal', () => {
  it('round-trips private attempt-bound identities and accepts an absent prelaunch journal', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-process-journal-'));
    try {
      const journal = new LinuxAlphaSmokeProcessJournal(root);
      const attempt = createAttempt();
      assert.deepEqual(await journal.read(attempt), []);
      const receipt = { processId: 123, startTime: '100' };
      const groups = [{ receipt, members: [receipt, { processId: 124, startTime: '101' }] }];
      await journal.write(attempt, groups);
      assert.deepEqual(await journal.read(attempt), groups);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  for (const mutation of ['attempt', 'input', 'boot', 'duplicate', 'missing-root', 'unknown-field'] as const) {
    it(`rejects a private process journal with ${mutation} corruption`, async () => {
      const root = await mkdtemp(path.join(tmpdir(), 'alpha-process-binding-'));
      try {
        await mkdir(path.join(root, 'control'), { mode: 0o700 });
        const attempt = createAttempt();
        const receipt = { processId: 123, startTime: '100' };
        const document: Record<string, unknown> = {
          schemaVersion: 2,
          attemptId: attempt.attemptId,
          inputDigest: attempt.input.platformSmokeInputDigest,
          bootId: attempt.monotonicDeadline?.bootId,
          groups: [{ receipt, members: [receipt] }],
        };
        switch (mutation) {
          case 'attempt':
            document.attemptId = 'alpha-other';
            break;
          case 'input':
            document.inputDigest = 'e'.repeat(64);
            break;
          case 'boot':
            document.bootId = 'other-boot';
            break;
          case 'duplicate':
            document.groups = [{ receipt, members: [receipt, receipt] }];
            break;
          case 'missing-root':
            document.groups = [{ receipt, members: [{ processId: 124, startTime: '101' }] }];
            break;
          case 'unknown-field':
            document.extra = true;
            break;
        }
        await writeFile(path.join(root, 'control/owned-processes.json'), JSON.stringify(document), { mode: 0o600 });
        await assert.rejects(new LinuxAlphaSmokeProcessJournal(root).read(attempt), /PROCESS_JOURNAL_INVALID/u);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }
});
