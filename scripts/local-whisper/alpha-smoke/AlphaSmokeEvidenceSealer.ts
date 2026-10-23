import { readdir } from 'node:fs/promises';
import { LinuxAlphaSmokeFilesystem } from './LinuxAlphaSmokeFilesystem';
import { AlphaSmokeSchemaValidator } from './AlphaSmokeSchemaValidator';

import {
  alphaSmokeDigest,
  isAlphaSmokeOutcome,
  type AlphaSmokeAttempt,
  type AlphaSmokeCompletionEvidence,
  type AlphaSmokeResult,
  type AlphaSmokeStatus,
} from './AlphaSmokeProtocol';

const FORBIDDEN_EVIDENCE_KEY = /audio|clipboard|environment|home|log|path|prompt|secret|token|transcript/iu;

function assertSanitized(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertSanitized(item);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_EVIDENCE_KEY.test(key)) throw new Error('ALPHA_SMOKE_EVIDENCE_PRIVATE_FIELD');
      assertSanitized(nested);
    }
  }
  if (typeof value === 'string' && (value.includes('/') || value.includes('\\'))) {
    throw new Error('ALPHA_SMOKE_EVIDENCE_PRIVATE_VALUE');
  }
}

/** Writes immutable, sanitized repository evidence while raw host evidence stays in the private root. */
export class AlphaSmokeEvidenceSealer {
  private readonly schemas = new AlphaSmokeSchemaValidator();
  public constructor(
    private readonly openFilesystem: (
      root: string,
    ) => Promise<LinuxAlphaSmokeFilesystem> = LinuxAlphaSmokeFilesystem.openRoot,
  ) {}
  public async seal(
    evidenceRoot: string,
    attempt: AlphaSmokeAttempt,
    status: AlphaSmokeStatus,
    outcome: string,
    completion: AlphaSmokeCompletionEvidence,
  ): Promise<AlphaSmokeResult> {
    if (!isAlphaSmokeOutcome(outcome)) throw new Error('ALPHA_SMOKE_EVIDENCE_OUTCOME_INVALID');
    if (status === 'Pending') throw new Error('ALPHA_SMOKE_SEAL_STATUS_INVALID');
    if ((status === 'Pass' || status === 'Fail') && attempt.startedAtEpochMilliseconds === null) {
      throw new Error('ALPHA_SMOKE_SEAL_BEFORE_ATTEMPT');
    }
    if (
      status === 'Pass' &&
      (completion.packageStatus !== 'retained-alpha' || completion.settingsBackupStatus !== 'retained-private')
    ) {
      throw new Error('ALPHA_SMOKE_PASS_POSTCONDITION_INVALID');
    }
    const resultWithoutDigest = Object.freeze({
      schemaVersion: 2 as const,
      deploymentDigest: attempt.input.deploymentDigest,
      attemptId: attempt.attemptId,
      inputDigest: attempt.input.platformSmokeInputDigest,
      outcome,
      packageStatus: completion.packageStatus,
      platform: attempt.input.platform,
      settingsBackupStatus: completion.settingsBackupStatus,
      status,
      target: attempt.input.target,
    });
    assertSanitized(resultWithoutDigest);
    const result: AlphaSmokeResult = Object.freeze({
      ...resultWithoutDigest,
      resultDigest: alphaSmokeDigest(resultWithoutDigest),
    });
    const index = Object.freeze({
      schemaVersion: 2,
      deploymentDigest: attempt.input.deploymentDigest,
      inputDigest: attempt.input.platformSmokeInputDigest,
      attemptId: attempt.attemptId,
      platform: attempt.input.platform,
      resultDigest: result.resultDigest,
      target: attempt.input.target,
    });
    assertSanitized(index);
    this.schemas.result(result);
    this.schemas.index(index, result);
    const filesystem = await this.openFilesystem(evidenceRoot);
    try {
      const allowed = new Set(['control', 'platform-smoke-result.json', 'evidence-index.json']);
      if ((await readdir(filesystem.directoryPath())).some((name) => !allowed.has(name)))
        throw new Error('ALPHA_SMOKE_EVIDENCE_ROOT_INVALID');
      await this.writeOnce(filesystem, 'platform-smoke-result.json', result);
      await this.writeOnce(filesystem, 'evidence-index.json', index);
    } finally {
      await filesystem.dispose();
    }
    return result;
  }

  private async writeOnce(filesystem: LinuxAlphaSmokeFilesystem, fileName: string, value: unknown): Promise<void> {
    let existing;
    try {
      existing = await filesystem.openRegularFile(fileName, 64 * 1024);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    if (existing) {
      try {
        if (alphaSmokeDigest(JSON.parse(await existing.readFile('utf8')) as unknown) !== alphaSmokeDigest(value))
          throw new Error('ALPHA_SMOKE_EVIDENCE_CONFLICT');
        await filesystem.revalidate();
      } finally {
        await existing.close();
      }
      return;
    }
    await filesystem.writeExclusive(fileName, `${JSON.stringify(value, null, 2)}\n`);
  }
}
