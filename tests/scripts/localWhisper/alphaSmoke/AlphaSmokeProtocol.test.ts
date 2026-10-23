import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ALPHA_SMOKE_TARGET,
  createPlatformSmokeInput,
  parseAlphaSmokeAttempt,
  parseAlphaSmokeCommand,
} from '@scripts/local-whisper/alpha-smoke/AlphaSmokeProtocol';

const LINUX_PACKAGE = Object.freeze({
  fileName: 'gpt-voice_2.4.0-alpha.1_amd64.deb',
  length: 10,
  sha256: 'a'.repeat(64),
});

describe('AlphaSmokeProtocol', () => {
  it('accepts the closed contract command without physical inputs', () => {
    assert.deepEqual(
      parseAlphaSmokeCommand(['--platform=linux', `--target=${ALPHA_SMOKE_TARGET}`, '--mode=contract']),
      {
        attemptId: null,
        evidenceRoot: null,
        mode: 'contract',
        phase: null,
        platform: 'linux',
        settingsBackupRoot: null,
        target: ALPHA_SMOKE_TARGET,
        workRoot: null,
      },
    );
  });

  it('requires three distinct absolute roots for every Linux physical phase', () => {
    assert.deepEqual(
      parseAlphaSmokeCommand([
        '--platform=linux',
        `--target=${ALPHA_SMOKE_TARGET}`,
        '--mode=physical',
        '--phase=exercise',
        '--work-root=/tmp/work',
        '--evidence-root=/tmp/evidence',
        '--settings-backup-root=/tmp/settings-backup',
        '--attempt-id=alpha-test',
      ]),
      {
        attemptId: 'alpha-test',
        evidenceRoot: '/tmp/evidence',
        mode: 'physical',
        phase: 'exercise',
        platform: 'linux',
        settingsBackupRoot: '/tmp/settings-backup',
        target: ALPHA_SMOKE_TARGET,
        workRoot: '/tmp/work',
      },
    );
  });

  it('rejects recovery, unsafe, duplicate, mixed-mode, incomplete, and overlapping input', () => {
    const common = ['--platform=linux', `--target=${ALPHA_SMOKE_TARGET}`, '--mode=physical', '--phase=prepare'];
    for (const arguments_ of [
      ['--platform=linux', `--target=${ALPHA_SMOKE_TARGET}`, '--mode=contract', '--work-root=/tmp/root'],
      ['--platform=linux', '--platform=win32', `--target=${ALPHA_SMOKE_TARGET}`, '--mode=contract'],
      [...common, '--work-root=relative', '--evidence-root=/tmp/evidence', '--settings-backup-root=/tmp/backup'],
      [...common, '--work-root=/tmp/work', '--evidence-root=/tmp/evidence'],
      [...common, '--work-root=/tmp/work', '--evidence-root=/tmp/work/evidence', '--settings-backup-root=/tmp/backup'],
      [
        ...common,
        '--work-root=/tmp/work',
        '--evidence-root=/tmp/evidence',
        '--settings-backup-root=/tmp/backup',
        '--recovery-deb=/tmp/gpt-voice_2.3.0_amd64.deb',
      ],
      ['--platform=linux', '--target=v2.4.0', '--mode=contract'],
      [
        '--platform=win32',
        `--target=${ALPHA_SMOKE_TARGET}`,
        '--mode=physical',
        '--phase=prepare',
        '--work-root=/tmp/work',
        '--evidence-root=/tmp/evidence',
        '--settings-backup-root=/tmp/backup',
      ],
    ]) {
      assert.throws(() => parseAlphaSmokeCommand(arguments_), /ALPHA_SMOKE_COMMAND_/u);
    }
  });

  it('derives an immutable input containing the exact platform package identity', () => {
    const input = createPlatformSmokeInput(
      'linux',
      [LINUX_PACKAGE, { fileName: 'release-manifest.json', length: 2, sha256: 'b'.repeat(64) }],
      'd'.repeat(64),
    );
    assert.deepEqual(input.packageAsset, LINUX_PACKAGE);
    assert.match(input.platformSmokeInputDigest, /^[a-f\d]{64}$/u);
    assert.throws(
      () =>
        createPlatformSmokeInput(
          'linux',
          [{ fileName: 'other.bin', length: 1, sha256: 'a'.repeat(64) }],
          'd'.repeat(64),
        ),
      /ALPHA_SMOKE_PUBLIC_INPUT_PACKAGE_MISSING/u,
    );
  });

  it('rejects obsolete recovery state when parsing persisted attempts', () => {
    const input = createPlatformSmokeInput('linux', [LINUX_PACKAGE], 'd'.repeat(64));
    assert.throws(
      () =>
        parseAlphaSmokeAttempt({
          attemptId: 'alpha-test',
          deadlineEpochMilliseconds: 10,
          input,
          packageDisposition: 'exact-alpha',
          settingsBackupStatus: 'retained-private',
          startedAtEpochMilliseconds: null,
          state: 'AwaitingRestore',
        }),
      /ALPHA_SMOKE_STATE_INVALID/u,
    );
  });
});
