import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { AlphaSmokeEvidenceSealer } from '@scripts/local-whisper/alpha-smoke/AlphaSmokeEvidenceSealer';
import {
  ALPHA_SMOKE_DEADLINE_MILLISECONDS,
  AlphaSmokeSession,
  type AlphaSmokeStateStore,
} from '@scripts/local-whisper/alpha-smoke/AlphaSmokeSession';
import { FakePlatformAlphaSmokeAdapter as FakeAdapter } from './helpers/FakePlatformAlphaSmokeAdapter';
import {
  createPlatformSmokeInput,
  type AlphaSmokeAttempt,
  type AlphaSmokeVerifiedStage,
  ALPHA_SMOKE_VERIFIED_STAGES,
} from '@scripts/local-whisper/alpha-smoke/AlphaSmokeProtocol';

class MemoryStateStore implements AlphaSmokeStateStore {
  private readonly verifiedStages = new Set<AlphaSmokeVerifiedStage>();

  public async recordVerifiedStage(_attempt: AlphaSmokeAttempt, stage: AlphaSmokeVerifiedStage): Promise<void> {
    this.verifiedStages.add(stage);
  }

  public async assertVerifiedStages(): Promise<void> {
    if (!ALPHA_SMOKE_VERIFIED_STAGES.every((stage) => this.verifiedStages.has(stage)))
      throw new Error('ALPHA_SMOKE_STAGE_PROOF_INVALID');
  }
  public attemptStart: AlphaSmokeAttempt | null = null;
  public value: AlphaSmokeAttempt | null = null;

  public async read(): Promise<AlphaSmokeAttempt | null> {
    return this.value ? structuredClone(this.value) : null;
  }

  public async sealAttemptStart(attempt: AlphaSmokeAttempt): Promise<void> {
    if (this.attemptStart !== null) throw new Error('attempt already started');
    this.attemptStart = structuredClone(attempt);
  }

  public async write(attempt: AlphaSmokeAttempt): Promise<void> {
    this.value = structuredClone(attempt);
  }
}

function input() {
  return createPlatformSmokeInput(
    'linux',
    [
      {
        fileName: 'gpt-voice_2.4.0-alpha.1_amd64.deb',
        length: 1,
        sha256: 'a'.repeat(64),
      },
    ],
    'd'.repeat(64),
  );
}

describe('AlphaSmokeSession', () => {
  it('repairs final state after immutable evidence succeeds but the final state write fails', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-final-state-retry-'));
    try {
      const store = new MemoryStateStore();
      const session = new AlphaSmokeSession({
        adapter: new FakeAdapter(),
        stateStore: store,
        sealer: new AlphaSmokeEvidenceSealer(),
        clock: { now: () => 1_000 },
      });
      await session.prepare('alpha-test', input());
      await session.exercise(root, 'alpha-test');
      const write = store.write.bind(store);
      let failOnce = true;
      store.write = async (attempt) => {
        if (failOnce && attempt.state === 'SealedPass') {
          failOnce = false;
          throw new Error('final state unavailable');
        }
        await write(attempt);
      };
      await assert.rejects(session.seal(root, 'alpha-test'), /final state unavailable/u);
      const immutable = await readFile(path.join(root, 'platform-smoke-result.json'));
      assert.equal(await session.seal(root, 'alpha-test'), 'Pass');
      assert.deepEqual(await readFile(path.join(root, 'platform-smoke-result.json')), immutable);
      assert.equal(store.value?.state, 'SealedPass');
      await rm(path.join(root, 'evidence-index.json'));
      assert.equal(await session.seal(root, 'alpha-test'), 'Pass');
      assert.deepEqual(await readFile(path.join(root, 'platform-smoke-result.json')), immutable);
      await readFile(path.join(root, 'evidence-index.json'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  for (const state of ['ReadyToSeal', 'Sealing', 'SealedPass'] as const) {
    it(`never seals Pass from a forged ${state} state without verified stage records`, async () => {
      const root = await mkdtemp(path.join(tmpdir(), 'alpha-missing-stage-proof-'));
      try {
        const store = new MemoryStateStore();
        const session = new AlphaSmokeSession({
          adapter: new FakeAdapter(),
          stateStore: store,
          sealer: new AlphaSmokeEvidenceSealer(),
          clock: { now: () => 1_000 },
        });
        const prepared = await session.prepare('alpha-test', input());
        store.value = {
          ...prepared,
          startedAtEpochMilliseconds: 1_000,
          state,
          terminalOutcome: 'qualified',
          completion: { packageStatus: 'retained-alpha', settingsBackupStatus: 'retained-private' },
        };
        assert.equal(await session.seal(root, 'alpha-test'), 'Fail');
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }

  for (const state of [
    'AwaitingPackageReady',
    'PackageReady',
    'CpuExercise',
    'CudaExercise',
    'OfflineExercise',
    'Finalizing',
  ] as const) {
    it(`attempts cleanup when resuming interrupted ${state} and never upgrades it to Pass`, async () => {
      const root = await mkdtemp(path.join(tmpdir(), 'alpha-resume-finalizing-'));
      try {
        const store = new MemoryStateStore();
        const adapter = new FakeAdapter();
        const session = new AlphaSmokeSession({
          adapter,
          stateStore: store,
          sealer: new AlphaSmokeEvidenceSealer(),
          clock: { now: () => 1_000 },
        });
        const prepared = await session.prepare('alpha-test', input());
        store.value = { ...prepared, startedAtEpochMilliseconds: 1_000, state };
        assert.equal(await session.seal(root, 'alpha-test'), 'Fail');
        assert.equal(adapter.finalizeCalls, 1);
        assert.equal(store.value.state, 'SealedFail');
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }

  it('finalizes and seals a failure when the first post-start state write fails', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-state-write-'));
    try {
      const store = new MemoryStateStore();
      const adapter = new FakeAdapter();
      const session = new AlphaSmokeSession({
        adapter,
        clock: { now: () => 1_000 },
        sealer: new AlphaSmokeEvidenceSealer(),
        stateStore: store,
      });
      await session.prepare('alpha-test', input());
      const write = store.write.bind(store);
      let failed = false;
      store.write = async (attempt) => {
        if (attempt.startedAtEpochMilliseconds !== null && !failed) {
          failed = true;
          throw new Error('state write failed');
        }
        await write(attempt);
      };
      assert.equal(await session.exercise(root, 'alpha-test'), 'Fail');
      assert.equal(adapter.finalizeCalls, 1);
      assert.equal(store.value?.state, 'SealedFail');
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
  it('backs up settings, retains the exact alpha, and seals a successful result', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-success-'));
    try {
      const store = new MemoryStateStore();
      const adapter = new FakeAdapter();
      const session = new AlphaSmokeSession({
        adapter,
        clock: { now: () => 1_000 },
        sealer: new AlphaSmokeEvidenceSealer(),
        stateStore: store,
      });
      await session.prepare('alpha-test', input());
      assert.equal(store.value?.state, 'AwaitingPackageReady');
      assert.equal(store.value?.settingsBackupStatus, 'retained-private');
      assert.equal(await session.exercise(root, 'alpha-test'), 'ReadyToSeal');
      assert.equal(store.attemptStart?.startedAtEpochMilliseconds, 1_000);
      assert.equal(await session.seal(root, 'alpha-test'), 'Pass');
      assert.equal(store.value?.state, 'SealedPass');
      assert.equal(adapter.finalizeCalls, 1);
      const resultDocument = await readFile(path.join(root, 'platform-smoke-result.json'), 'utf8');
      assert.doesNotMatch(resultDocument, /config\.json|settings-backup-receipt|\/home\/|sha256/iu);
      const result = JSON.parse(resultDocument) as {
        inputDigest: string;
        packageStatus: string;
        resultDigest: string;
        settingsBackupStatus: string;
        status: string;
      };
      assert.equal(result.inputDigest, input().platformSmokeInputDigest);
      assert.equal(result.packageStatus, 'retained-alpha');
      assert.equal(result.settingsBackupStatus, 'retained-private');
      assert.equal(result.status, 'Pass');
      assert.match(result.resultDigest, /^[a-f\d]{64}$/u);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('finalizes and seals a functional failure without a recovery path', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-failure-'));
    try {
      const store = new MemoryStateStore();
      const adapter = new FakeAdapter();
      adapter.failAt = 'cuda';
      const session = new AlphaSmokeSession({
        adapter,
        clock: { now: () => 1_000 },
        sealer: new AlphaSmokeEvidenceSealer(),
        stateStore: store,
      });
      await session.prepare('alpha-test', input());
      assert.equal(await session.exercise(root, 'alpha-test'), 'Fail');
      assert.equal(store.value?.state, 'SealedFail');
      assert.equal(adapter.finalizeCalls, 1);
      await assert.rejects(session.exercise(root, 'other-attempt'), /ALPHA_SMOKE_RESUME_INVALID/u);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('seals Fail when the single deadline expires after exercise', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-timeout-'));
    try {
      let now = 1_000;
      const store = new MemoryStateStore();
      const adapter = new FakeAdapter();
      const session = new AlphaSmokeSession({
        adapter,
        clock: { now: () => now },
        sealer: new AlphaSmokeEvidenceSealer(),
        stateStore: store,
      });
      await session.prepare('alpha-test', input(), now);
      assert.equal(await session.exercise(root, 'alpha-test'), 'ReadyToSeal');
      now += ALPHA_SMOKE_DEADLINE_MILLISECONDS + 1;
      assert.equal(await session.seal(root, 'alpha-test'), 'Fail');
      const result = JSON.parse(await readFile(path.join(root, 'platform-smoke-result.json'), 'utf8')) as {
        outcome: string;
      };
      assert.equal(result.outcome, 'deadline_exhausted');
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('keeps a failed preparation Pending and emits no result', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-preflight-failure-'));
    try {
      const store = new MemoryStateStore();
      const adapter = new FakeAdapter();
      adapter.failAt = 'preflight';
      const session = new AlphaSmokeSession({
        adapter,
        clock: { now: () => 1_000 },
        sealer: new AlphaSmokeEvidenceSealer(),
        stateStore: store,
      });
      await assert.rejects(session.prepare('alpha-test', input()), /preflight failed/u);
      assert.equal(store.value, null);
      await assert.rejects(readFile(path.join(root, 'platform-smoke-result.json')), /ENOENT/u);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('keeps package or backup drift Pending when it is detected before attempt start', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-prestart-drift-'));
    try {
      const store = new MemoryStateStore();
      const adapter = new FakeAdapter();
      const session = new AlphaSmokeSession({
        adapter,
        clock: { now: () => 1_000 },
        sealer: new AlphaSmokeEvidenceSealer(),
        stateStore: store,
      });
      await session.prepare('alpha-test', input());
      adapter.failAt = 'package';
      await assert.rejects(session.exercise(root, 'alpha-test'), /package drift/u);
      assert.equal(store.value?.startedAtEpochMilliseconds, null);
      assert.equal(store.value?.state, 'AwaitingPackageReady');
      assert.equal(store.attemptStart, null);
      await assert.rejects(readFile(path.join(root, 'platform-smoke-result.json')), /ENOENT/u);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('records normalized observations when finalization itself fails', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-finalize-failure-'));
    try {
      const store = new MemoryStateStore();
      const adapter = new FakeAdapter();
      adapter.failAt = 'finalize';
      const session = new AlphaSmokeSession({
        adapter,
        clock: { now: () => 1_000 },
        sealer: new AlphaSmokeEvidenceSealer(),
        stateStore: store,
      });
      await session.prepare('alpha-test', input());
      assert.equal(await session.exercise(root, 'alpha-test'), 'Fail');
      assert.equal(await session.seal(root, 'alpha-test'), 'Fail');
      const result = JSON.parse(await readFile(path.join(root, 'platform-smoke-result.json'), 'utf8')) as {
        packageStatus: string;
        settingsBackupStatus: string;
      };
      assert.equal(result.packageStatus, 'unverified');
      assert.equal(result.settingsBackupStatus, 'integrity-failed');
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
