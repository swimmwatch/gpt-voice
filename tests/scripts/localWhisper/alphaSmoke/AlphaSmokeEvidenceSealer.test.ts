import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { it } from 'node:test';
import { AlphaSmokeEvidenceSealer } from '@scripts/local-whisper/alpha-smoke/AlphaSmokeEvidenceSealer';
import { LinuxAlphaSmokeFilesystem } from '@scripts/local-whisper/alpha-smoke/LinuxAlphaSmokeFilesystem';
import {
  createPlatformSmokeInput,
  type AlphaSmokeAttempt,
} from '@scripts/local-whisper/alpha-smoke/AlphaSmokeProtocol';

it('repairs an interrupted index write without replacing an immutable result', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'alpha-seal-retry-'));
  try {
    const attempt: AlphaSmokeAttempt = {
      schemaVersion: 2,
      monotonicDeadline: null,
      completion: null,
      terminalOutcome: null,
      attemptId: 'alpha-test',
      deadlineEpochMilliseconds: 10_000,
      startedAtEpochMilliseconds: 1_000,
      state: 'Finalizing',
      packageDisposition: 'exact-alpha',
      settingsBackupStatus: 'retained-private',
      input: createPlatformSmokeInput(
        'linux',
        [{ fileName: 'gpt-voice_2.4.0-alpha.1_amd64.deb', length: 1, sha256: 'a'.repeat(64) }],
        'd'.repeat(64),
      ),
    };
    let interrupted = true;
    const sealer = new AlphaSmokeEvidenceSealer(async (root) => {
      const filesystem = await LinuxAlphaSmokeFilesystem.openRoot(root);
      const write = filesystem.writeExclusive.bind(filesystem);
      filesystem.writeExclusive = async (name, content) => {
        if (name === 'evidence-index.json' && interrupted) {
          interrupted = false;
          throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
        }
        await write(name, content);
      };
      return filesystem;
    });
    const completion = { packageStatus: 'retained-alpha', settingsBackupStatus: 'retained-private' } as const;
    await assert.rejects(
      new AlphaSmokeEvidenceSealer().seal(root, attempt, 'Fail', 'private_transcript_excerpt', completion),
      /ALPHA_SMOKE_(?:EVIDENCE|RESULT)_/u,
    );
    await assert.rejects(sealer.seal(root, attempt, 'Fail', 'deadline_exhausted', completion), /disk full/u);
    const before = await readFile(path.join(root, 'platform-smoke-result.json'));
    await assert.rejects(readFile(path.join(root, 'evidence-index.json')), /ENOENT/u);
    await sealer.seal(root, attempt, 'Fail', 'deadline_exhausted', completion);
    assert.deepEqual(await readFile(path.join(root, 'platform-smoke-result.json')), before);
    await assert.rejects(sealer.seal(root, attempt, 'Pass', 'qualified', completion));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
