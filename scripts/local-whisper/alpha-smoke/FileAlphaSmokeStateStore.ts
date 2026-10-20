import {
  ALPHA_SMOKE_VERIFIED_STAGES,
  alphaSmokeDigest,
  type AlphaSmokeAttempt,
  type AlphaSmokeVerifiedStage,
} from './AlphaSmokeProtocol';
import type { AlphaSmokeStateStore } from './AlphaSmokeSession';
import { LinuxAlphaSmokeFilesystem } from './LinuxAlphaSmokeFilesystem';
import { AlphaSmokeSchemaValidator } from './AlphaSmokeSchemaValidator';
import { isLinuxAlphaSmokeDeadline, type AlphaSmokeDeadline } from './LinuxAlphaSmokeClock';

export interface AlphaSmokeAttemptStart {
  readonly schemaVersion: 2;
  readonly monotonicDeadline: AlphaSmokeDeadline | null;
  readonly attemptId: string;
  readonly deadlineEpochMilliseconds: number;
  readonly inputDigest: string;
  readonly inputSnapshotDigest: string;
  readonly startedAtEpochMilliseconds: number;
}

const SHA256_PATTERN = /^[a-f\d]{64}$/u;

function parseAttemptStart(value: unknown): AlphaSmokeAttemptStart {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ALPHA_SMOKE_ATTEMPT_START_INVALID');
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(',') !==
      'attemptId,deadlineEpochMilliseconds,inputDigest,inputSnapshotDigest,monotonicDeadline,schemaVersion,startedAtEpochMilliseconds' ||
    record.schemaVersion !== 2 ||
    (record.monotonicDeadline !== null && !isLinuxAlphaSmokeDeadline(record.monotonicDeadline)) ||
    typeof record.attemptId !== 'string' ||
    typeof record.deadlineEpochMilliseconds !== 'number' ||
    !Number.isSafeInteger(record.deadlineEpochMilliseconds) ||
    record.deadlineEpochMilliseconds <= 0 ||
    typeof record.inputDigest !== 'string' ||
    !SHA256_PATTERN.test(record.inputDigest) ||
    typeof record.inputSnapshotDigest !== 'string' ||
    !SHA256_PATTERN.test(record.inputSnapshotDigest) ||
    typeof record.startedAtEpochMilliseconds !== 'number' ||
    !Number.isSafeInteger(record.startedAtEpochMilliseconds) ||
    record.startedAtEpochMilliseconds <= 0
  ) {
    throw new Error('ALPHA_SMOKE_ATTEMPT_START_INVALID');
  }
  return value as AlphaSmokeAttemptStart;
}

function sameDeadline(left: AlphaSmokeDeadline | null, right: AlphaSmokeDeadline | null): boolean {
  if (left === null || right === null) return left === right;
  return left.bootId === right.bootId && left.expiresAtUptimeMilliseconds === right.expiresAtUptimeMilliseconds;
}

/** Stores private control state under pinned directory descriptors. */
export class FileAlphaSmokeStateStore implements AlphaSmokeStateStore {
  private readonly schemas = new AlphaSmokeSchemaValidator();
  public constructor(
    private readonly root: string,
    private readonly directory: string | null = null,
  ) {}

  private async filesystem(create = true): Promise<LinuxAlphaSmokeFilesystem> {
    const filesystem = await LinuxAlphaSmokeFilesystem.openRoot(this.root);
    try {
      if (this.directory !== null) await filesystem.openChildDirectory(this.directory, create);
      return filesystem;
    } catch (error) {
      await filesystem.dispose();
      throw error;
    }
  }

  private name(name: string): string {
    return this.directory === null ? name : `${this.directory}/${name}`;
  }

  private async readDocument(name: string, limit: number): Promise<string | null> {
    let filesystem;
    try {
      filesystem = await this.filesystem(false);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    }
    try {
      let handle;
      try {
        handle = await filesystem.openRegularFile(this.name(name), limit);
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
        throw error;
      }
      try {
        const before = await handle.stat();
        const document = await handle.readFile('utf8');
        const after = await handle.stat();
        if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
          throw new Error('ALPHA_SMOKE_PRIVATE_STATE_INVALID');
        await filesystem.revalidate();
        return document;
      } finally {
        await handle.close();
      }
    } finally {
      await filesystem.dispose();
    }
  }

  public async read(): Promise<AlphaSmokeAttempt | null> {
    const document = await this.readDocument('alpha-smoke-state.json', 64 * 1024);
    const start = await this.readAttemptStart();
    if (document === null) {
      if (start !== null) throw new Error('ALPHA_SMOKE_STATE_INVALID');
      return null;
    }
    const attempt = this.schemas.attempt(JSON.parse(document) as unknown);
    if (attempt.startedAtEpochMilliseconds === null) {
      if (start === null) return attempt;
      if (
        start.attemptId !== attempt.attemptId ||
        start.inputDigest !== attempt.input.platformSmokeInputDigest ||
        start.inputSnapshotDigest !== alphaSmokeDigest(attempt.input) ||
        start.deadlineEpochMilliseconds !== attempt.deadlineEpochMilliseconds ||
        !sameDeadline(start.monotonicDeadline, attempt.monotonicDeadline)
      )
        throw new Error('ALPHA_SMOKE_ATTEMPT_START_INVALID');
      return Object.freeze({
        ...attempt,
        startedAtEpochMilliseconds: start.startedAtEpochMilliseconds,
        state: 'Finalizing',
      });
    }
    if (
      !start ||
      start.attemptId !== attempt.attemptId ||
      start.inputDigest !== attempt.input.platformSmokeInputDigest ||
      start.inputSnapshotDigest !== alphaSmokeDigest(attempt.input) ||
      start.deadlineEpochMilliseconds !== attempt.deadlineEpochMilliseconds ||
      !sameDeadline(start.monotonicDeadline, attempt.monotonicDeadline) ||
      start.startedAtEpochMilliseconds !== attempt.startedAtEpochMilliseconds
    )
      throw new Error('ALPHA_SMOKE_ATTEMPT_START_INVALID');
    return attempt;
  }

  public async readAttemptStart(): Promise<AlphaSmokeAttemptStart | null> {
    const document = await this.readDocument('attempt-start.json', 4096);
    return document === null ? null : parseAttemptStart(JSON.parse(document) as unknown);
  }

  private stageDocument(attempt: AlphaSmokeAttempt, stage: AlphaSmokeVerifiedStage): string {
    if (!ALPHA_SMOKE_VERIFIED_STAGES.includes(stage) || attempt.startedAtEpochMilliseconds === null)
      throw new Error('ALPHA_SMOKE_STAGE_PROOF_INVALID');
    return JSON.stringify({
      schemaVersion: 2,
      attemptId: attempt.attemptId,
      inputDigest: attempt.input.platformSmokeInputDigest,
      deploymentDigest: attempt.input.deploymentDigest,
      stage,
    });
  }

  public async recordVerifiedStage(attempt: AlphaSmokeAttempt, stage: AlphaSmokeVerifiedStage): Promise<void> {
    const document = this.stageDocument(attempt, stage);
    const existing = await this.readDocument(`stage-${stage}.json`, 4096);
    if (existing !== null) {
      if (existing !== document) throw new Error('ALPHA_SMOKE_STAGE_PROOF_INVALID');
      return;
    }
    const filesystem = await this.filesystem();
    try {
      await filesystem.writeExclusive(this.name(`stage-${stage}.json`), document);
    } finally {
      await filesystem.dispose();
    }
  }

  public async assertVerifiedStages(attempt: AlphaSmokeAttempt): Promise<void> {
    for (const stage of ALPHA_SMOKE_VERIFIED_STAGES) {
      if ((await this.readDocument(`stage-${stage}.json`, 4096)) !== this.stageDocument(attempt, stage))
        throw new Error('ALPHA_SMOKE_STAGE_PROOF_INVALID');
    }
  }

  public async sealAttemptStart(attempt: AlphaSmokeAttempt): Promise<void> {
    if (attempt.startedAtEpochMilliseconds === null) throw new Error('ALPHA_SMOKE_ATTEMPT_START_INVALID');
    const filesystem = await this.filesystem();
    try {
      await filesystem.writeExclusive(
        this.name('attempt-start.json'),
        `${JSON.stringify({ schemaVersion: 2, monotonicDeadline: attempt.monotonicDeadline, attemptId: attempt.attemptId, deadlineEpochMilliseconds: attempt.deadlineEpochMilliseconds, inputDigest: attempt.input.platformSmokeInputDigest, inputSnapshotDigest: alphaSmokeDigest(attempt.input), startedAtEpochMilliseconds: attempt.startedAtEpochMilliseconds }, null, 2)}\n`,
      );
    } finally {
      await filesystem.dispose();
    }
  }

  public async write(attempt: AlphaSmokeAttempt): Promise<void> {
    this.schemas.attempt(attempt);
    const filesystem = await this.filesystem();
    try {
      await filesystem.replaceAtomically(this.name('alpha-smoke-state.json'), `${JSON.stringify(attempt, null, 2)}\n`);
    } finally {
      await filesystem.dispose();
    }
  }
}
