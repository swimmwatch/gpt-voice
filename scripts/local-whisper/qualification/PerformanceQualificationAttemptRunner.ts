import { createHash } from 'node:crypto';
import { constants, type Stats } from 'node:fs';
import { lstat, open, type FileHandle } from 'node:fs/promises';
import * as path from 'node:path';

import { hasSameVerifiedFileIdentity } from '../../security/verifiedRegularFile';
import { qualificationCanonicalJson } from './QualificationContracts';
import {
  performanceRequiredPhaseIds,
  type PerformanceBackend,
  type PerformanceCandidateWindow,
  type PerformancePhaseMeasurement,
} from './PerformanceQualification';
import type {
  PerformanceAttemptArtifactReference,
  PerformanceAttemptRequest,
} from './PerformanceQualificationCollector';
import { PerformanceQualificationEventCollector } from './PerformanceQualificationEventProtocol';

export const PERFORMANCE_ATTEMPT_ARGUMENT = '--local-whisper-performance-qualification-v3';
export const MAXIMUM_PERFORMANCE_ATTEMPT_REQUEST_BYTES = 64 * 1024;
export const MAXIMUM_PERFORMANCE_ATTEMPT_ARTIFACT_BYTES = 8 * 1024 ** 3;

const SHA256 = /^[a-f0-9]{64}$/u;
const SAMPLE_ID = /^[a-z0-9][a-z0-9-]{2,127}$/u;
const FAILURE_CODE = /^[A-Z][A-Z0-9_]{2,63}$/u;
const WINDOWS = [1, 2, 4, 8] as const;

export interface AuthenticatedPerformanceAttemptArtifact {
  readonly absolutePath: string;
  readonly descriptor: number;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface PerformanceAttemptApplicationInput {
  readonly request: PerformanceAttemptRequest;
  readonly effectiveInstallationWindow: PerformanceCandidateWindow;
  readonly artifacts: Readonly<{
    readonly runtime: AuthenticatedPerformanceAttemptArtifact;
    readonly model: AuthenticatedPerformanceAttemptArtifact;
    readonly inputFixture: AuthenticatedPerformanceAttemptArtifact;
  }>;
  readonly publishEvent: (frame: Buffer) => void;
}

export interface PerformanceAttemptApplicationResult {
  readonly endToEndNanoseconds: number;
}

export interface PerformanceAttemptApplicationPort {
  run(input: PerformanceAttemptApplicationInput): Promise<PerformanceAttemptApplicationResult>;
}

export interface PerformanceAttemptResponse {
  readonly schemaVersion: 3;
  readonly status: 'success' | 'failed';
  readonly failureReason: string | null;
  readonly endToEndNanoseconds: number | null;
  readonly phases: readonly PerformancePhaseMeasurement[];
}

export class PerformanceQualificationAttemptError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = 'PerformanceQualificationAttemptError';
  }
}

function fail(code: string): never {
  throw new PerformanceQualificationAttemptError(code);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean {
  return (
    JSON.stringify(Object.keys(value).sort((left, right) => left.localeCompare(right, 'en'))) ===
    JSON.stringify([...expected].sort((left, right) => left.localeCompare(right, 'en')))
  );
}

function safeInteger(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function parseArtifact(value: unknown): PerformanceAttemptArtifactReference {
  if (
    !isRecord(value) ||
    !exactKeys(value, ['absolutePath', 'sizeBytes', 'sha256']) ||
    typeof value.absolutePath !== 'string' ||
    !path.isAbsolute(value.absolutePath) ||
    value.absolutePath.length > 4096 ||
    !safeInteger(value.sizeBytes, 1, MAXIMUM_PERFORMANCE_ATTEMPT_ARTIFACT_BYTES) ||
    typeof value.sha256 !== 'string' ||
    !SHA256.test(value.sha256)
  ) {
    fail('ATTEMPT_REQUEST_INVALID');
  }
  return Object.freeze({
    absolutePath: path.resolve(value.absolutePath),
    sizeBytes: value.sizeBytes,
    sha256: value.sha256,
  });
}

/** Parses one exact canonical schema-v3 request line and rejects aliases/extras. */
export function parsePerformanceAttemptRequest(bytes: Buffer): PerformanceAttemptRequest {
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > MAXIMUM_PERFORMANCE_ATTEMPT_REQUEST_BYTES ||
    bytes[bytes.byteLength - 1] !== 0x0a ||
    bytes.subarray(0, -1).includes(0x0a) ||
    bytes.includes(0x0d)
  ) {
    fail('ATTEMPT_REQUEST_INVALID');
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, -1))) as unknown;
  } catch {
    fail('ATTEMPT_REQUEST_INVALID');
  }
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      'schemaVersion',
      'activationPurpose',
      'sampleId',
      'platform',
      'backend',
      'model',
      'candidateWindow',
      'cacheState',
      'pairIndex',
      'runOrder',
      'side',
      'runtimeArtifact',
      'modelArtifact',
      'inputFixture',
      'requiredPhaseIds',
      'derivedSourceReceiptDigest',
    ]) ||
    value.schemaVersion !== 3 ||
    value.activationPurpose !== 'qualification' ||
    typeof value.sampleId !== 'string' ||
    !SAMPLE_ID.test(value.sampleId) ||
    value.platform !== 'linux' ||
    (value.backend !== 'cpu' && value.backend !== 'cuda') ||
    !isRecord(value.model) ||
    !exactKeys(value.model, ['family', 'variant', 'sha256']) ||
    !['base', 'medium', 'large-v3'].includes(value.model.family as string) ||
    !['full', 'q5_0'].includes(value.model.variant as string) ||
    typeof value.model.sha256 !== 'string' ||
    !SHA256.test(value.model.sha256) ||
    !WINDOWS.includes(value.candidateWindow as PerformanceCandidateWindow) ||
    (value.cacheState !== 'cold' && value.cacheState !== 'warm') ||
    !safeInteger(value.pairIndex, 1, 6) ||
    (value.runOrder !== 'beforeThenAfter' && value.runOrder !== 'afterThenBefore') ||
    (value.side !== 'before' && value.side !== 'after') ||
    !Array.isArray(value.requiredPhaseIds) ||
    typeof value.derivedSourceReceiptDigest !== 'string' ||
    !SHA256.test(value.derivedSourceReceiptDigest)
  ) {
    fail('ATTEMPT_REQUEST_INVALID');
  }
  const backend = value.backend as PerformanceBackend;
  const requiredPhaseIds = performanceRequiredPhaseIds('linux', backend);
  if (JSON.stringify(value.requiredPhaseIds) !== JSON.stringify(requiredPhaseIds)) fail('ATTEMPT_REQUEST_INVALID');
  const runtimeArtifact = parseArtifact(value.runtimeArtifact);
  const modelArtifact = parseArtifact(value.modelArtifact);
  const inputFixture = parseArtifact(value.inputFixture);
  if (modelArtifact.sha256 !== value.model.sha256) fail('ATTEMPT_REQUEST_INVALID');
  const request = Object.freeze({
    ...value,
    model: Object.freeze({ ...value.model }),
    runtimeArtifact,
    modelArtifact,
    inputFixture,
    requiredPhaseIds: Object.freeze(requiredPhaseIds),
  }) as unknown as PerformanceAttemptRequest;
  if (qualificationCanonicalJson(request) !== bytes.subarray(0, -1).toString('utf8')) {
    fail('ATTEMPT_REQUEST_INVALID');
  }
  return request;
}

async function sha256Descriptor(file: FileHandle, sizeBytes: number): Promise<string> {
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(Math.min(1024 * 1024, sizeBytes));
  let offset = 0;
  while (offset < sizeBytes) {
    const length = Math.min(buffer.byteLength, sizeBytes - offset);
    const { bytesRead } = await file.read(buffer, 0, length, offset).catch(() => fail('ATTEMPT_ARTIFACT_INVALID'));
    if (bytesRead !== length) fail('ATTEMPT_ARTIFACT_INVALID');
    hash.update(buffer.subarray(0, bytesRead));
    offset += bytesRead;
  }
  const trailing = Buffer.allocUnsafe(1);
  if ((await file.read(trailing, 0, 1, sizeBytes)).bytesRead !== 0) fail('ATTEMPT_ARTIFACT_INVALID');
  return hash.digest('hex');
}

class OwnedAttemptArtifact {
  public readonly exposed: AuthenticatedPerformanceAttemptArtifact;
  private constructor(
    private readonly handle: FileHandle,
    private readonly reference: PerformanceAttemptArtifactReference,
    private readonly openedMetadata: Stats,
  ) {
    this.exposed = Object.freeze({ ...reference, descriptor: handle.fd });
  }

  public static async open(reference: PerformanceAttemptArtifactReference): Promise<OwnedAttemptArtifact> {
    const handle = await open(reference.absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() =>
      fail('ATTEMPT_ARTIFACT_INVALID'),
    );
    try {
      const [opened, linked] = await Promise.all([
        (handle.stat({ bigint: false }) as Promise<Stats>).catch(() => fail('ATTEMPT_ARTIFACT_INVALID')),
        lstat(reference.absolutePath).catch(() => fail('ATTEMPT_ARTIFACT_INVALID')),
      ]);
      if (
        !opened.isFile() ||
        !linked.isFile() ||
        linked.isSymbolicLink() ||
        opened.size !== reference.sizeBytes ||
        !hasSameVerifiedFileIdentity(opened, linked) ||
        (await sha256Descriptor(handle, reference.sizeBytes)) !== reference.sha256
      ) {
        fail('ATTEMPT_ARTIFACT_INVALID');
      }
      return new OwnedAttemptArtifact(handle, reference, opened);
    } catch (error) {
      await handle.close().catch(() => undefined);
      throw error;
    }
  }

  public async verifyUnchanged(): Promise<void> {
    const [opened, linked, digest] = await Promise.all([
      (this.handle.stat({ bigint: false }) as Promise<Stats>).catch(() => fail('ATTEMPT_ARTIFACT_CHANGED')),
      lstat(this.reference.absolutePath).catch(() => fail('ATTEMPT_ARTIFACT_CHANGED')),
      sha256Descriptor(this.handle, this.reference.sizeBytes),
    ]);
    if (
      !hasSameVerifiedFileIdentity(this.openedMetadata, opened) ||
      !hasSameVerifiedFileIdentity(opened, linked) ||
      linked.isSymbolicLink() ||
      opened.size !== this.reference.sizeBytes ||
      digest !== this.reference.sha256
    ) {
      fail('ATTEMPT_ARTIFACT_CHANGED');
    }
  }

  public async close(): Promise<void> {
    await this.handle.close().catch(() => undefined);
  }
}

function failedResponse(code: string): PerformanceAttemptResponse {
  return Object.freeze({
    schemaVersion: 3,
    status: 'failed',
    failureReason: FAILURE_CODE.test(code) ? code : 'ATTEMPT_FAILED',
    endToEndNanoseconds: null,
    phases: Object.freeze([]),
  });
}

/** Owns one authenticated attempt, including event proof and immutable file lifetime. */
export class PerformanceQualificationAttemptRunner {
  private running = false;

  public constructor(private readonly application: PerformanceAttemptApplicationPort) {}

  public async run(
    requestBytes: Buffer,
    inheritedEventOutput: (frame: Buffer) => void,
  ): Promise<PerformanceAttemptResponse> {
    if (this.running) return failedResponse('ATTEMPT_ALREADY_ACTIVE');
    this.running = true;
    const owned: OwnedAttemptArtifact[] = [];
    try {
      const request = parsePerformanceAttemptRequest(requestBytes);
      const runtime = await OwnedAttemptArtifact.open(request.runtimeArtifact);
      owned.push(runtime);
      const model = await OwnedAttemptArtifact.open(request.modelArtifact);
      owned.push(model);
      const inputFixture = await OwnedAttemptArtifact.open(request.inputFixture);
      owned.push(inputFixture);
      const events = new PerformanceQualificationEventCollector('linux', request.backend, request.requiredPhaseIds);
      const publishEvent = (frame: Buffer): void => {
        events.append(frame);
        inheritedEventOutput(Buffer.from(frame));
      };
      const result = await this.application.run({
        request,
        effectiveInstallationWindow: request.side === 'before' ? 1 : request.candidateWindow,
        artifacts: Object.freeze({
          runtime: runtime.exposed,
          model: model.exposed,
          inputFixture: inputFixture.exposed,
        }),
        publishEvent,
      });
      if (!safeInteger(result.endToEndNanoseconds, 1)) fail('ATTEMPT_RESULT_INVALID');
      const proof = events.finish();
      await Promise.all(owned.map(async (artifact) => await artifact.verifyUnchanged()));
      return Object.freeze({
        schemaVersion: 3,
        status: 'success',
        failureReason: null,
        endToEndNanoseconds: result.endToEndNanoseconds,
        phases: proof.phases,
      });
    } catch (error) {
      const code =
        error instanceof PerformanceQualificationAttemptError
          ? error.code
          : error instanceof Error && FAILURE_CODE.test(error.message)
            ? error.message
            : 'ATTEMPT_FAILED';
      return failedResponse(code);
    } finally {
      await Promise.all(owned.map(async (artifact) => await artifact.close()));
      this.running = false;
    }
  }
}

export function performanceAttemptResponseLine(response: PerformanceAttemptResponse): Buffer {
  return Buffer.from(`${qualificationCanonicalJson(response)}\n`, 'utf8');
}
