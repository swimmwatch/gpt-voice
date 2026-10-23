import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { FileAlphaSmokeStateStore } from '@scripts/local-whisper/alpha-smoke/FileAlphaSmokeStateStore';
import {
  createPlatformSmokeInput,
  type AlphaSmokeAttempt,
  ALPHA_SMOKE_VERIFIED_STAGES,
} from '@scripts/local-whisper/alpha-smoke/AlphaSmokeProtocol';

function attempt(startedAtEpochMilliseconds: number | null): AlphaSmokeAttempt {
  return Object.freeze({
    schemaVersion: 2,
    monotonicDeadline: null,
    completion: null,
    terminalOutcome: null,
    attemptId: 'alpha-test',
    deadlineEpochMilliseconds: 10_000,
    input: createPlatformSmokeInput(
      'linux',
      [
        {
          fileName: 'gpt-voice_2.4.0-alpha.1_amd64.deb',
          length: 1,
          sha256: 'a'.repeat(64),
        },
      ],
      'd'.repeat(64),
    ),
    packageDisposition: 'exact-alpha',
    settingsBackupStatus: 'retained-private',
    startedAtEpochMilliseconds,
    state: startedAtEpochMilliseconds === null ? 'AwaitingPackageReady' : 'PackageReady',
  });
}

describe('FileAlphaSmokeStateStore', () => {
  it('rejects changed public input fields even when the persisted claimed input digest is unchanged', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-state-input-binding-'));
    try {
      const store = new FileAlphaSmokeStateStore(root);
      const started = attempt(1_000);
      await store.sealAttemptStart(started);
      await store.write({ ...started, input: { ...started.input, deploymentDigest: 'e'.repeat(64) } });
      await assert.rejects(store.read(), /ALPHA_SMOKE_ATTEMPT_START_INVALID/u);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('requires every private stage proof and binds it to the exact attempt input and deployment', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-stage-proofs-'));
    try {
      const store = new FileAlphaSmokeStateStore(root, 'control');
      const started = attempt(1_000);
      await store.sealAttemptStart(started);
      await store.recordVerifiedStage(started, 'cpu');
      await assert.rejects(store.assertVerifiedStages(started), /STAGE_PROOF_INVALID/u);
      for (const stage of ALPHA_SMOKE_VERIFIED_STAGES) await store.recordVerifiedStage(started, stage);
      await store.assertVerifiedStages(started);
      await assert.rejects(
        store.assertVerifiedStages({ ...started, input: { ...started.input, deploymentDigest: 'b'.repeat(64) } }),
        /STAGE_PROOF_INVALID/u,
      );
      await assert.rejects(
        store.recordVerifiedStage({ ...started, attemptId: 'alpha-other' }, 'cpu'),
        /STAGE_PROOF_INVALID/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects a changed monotonic deadline against the immutable start marker', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-state-deadline-'));
    try {
      const store = new FileAlphaSmokeStateStore(root);
      const started = {
        ...attempt(1_000),
        monotonicDeadline: {
          bootId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          expiresAtUptimeMilliseconds: 10_000,
        },
      };
      await store.sealAttemptStart(started);
      await store.write({
        ...started,
        monotonicDeadline: { ...started.monotonicDeadline, expiresAtUptimeMilliseconds: 20_000 },
      });
      await assert.rejects(store.read(), /ALPHA_SMOKE_ATTEMPT_START_INVALID/u);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('seals one exclusive attempt-start marker and verifies it on every resume', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-state-store-'));
    try {
      const store = new FileAlphaSmokeStateStore(root);
      await store.write(attempt(null));
      assert.equal((await store.read())?.startedAtEpochMilliseconds, null);

      const started = attempt(1_000);
      await store.sealAttemptStart(started);
      await store.write(started);
      assert.equal((await store.read())?.startedAtEpochMilliseconds, 1_000);
      await assert.rejects(store.sealAttemptStart(started), /EEXIST/u);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('rejects started state without the immutable attempt marker', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-state-store-missing-marker-'));
    try {
      const store = new FileAlphaSmokeStateStore(root);
      await store.write(attempt(1_000));
      await assert.rejects(store.read(), /ALPHA_SMOKE_ATTEMPT_START_INVALID/u);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
