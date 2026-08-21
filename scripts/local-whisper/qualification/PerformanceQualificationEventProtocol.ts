import type { Writable } from 'node:stream';

import type { LocalWhisperPerformancePhaseId } from './QualificationContracts';
import { LOCAL_WHISPER_PERFORMANCE_PHASES } from './QualificationContracts';
import type { PerformancePhaseMeasurement, PerformancePlatform, PerformanceBackend } from './PerformanceQualification';
import type { PerformanceProcessRole, PerformanceRoleRegistration } from './PerformanceQualificationCollector';
import {
  hasExactQualificationKeys as exactKeys,
  isQualificationRecord as isRecord,
  isQualificationSafeInteger as safeInteger,
} from './QualificationJsonFields';

const MAXIMUM_EVENT_BYTES = 64 * 1024;
const MAXIMUM_EVENT_COUNT = 64;
const MAXIMUM_FRAME_BYTES = 1024;
const PROCESS_START_IDENTITY = /^\w[\w.:-]{0,127}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const ROLES = ['main', 'guard', 'worker'] as const;

type PhaseEvent = Readonly<{
  schemaVersion: 1;
  kind: 'phase';
  sequence: number;
  phaseId: LocalWhisperPerformancePhaseId;
  applicability: 'applicable' | 'notApplicable';
  durationNanoseconds: number | null;
}>;

type RoleEvent = Readonly<{
  schemaVersion: 1;
  kind: 'role';
  sequence: number;
  role: PerformanceProcessRole;
  pid: number;
  processStartIdentity: string;
  executableSha256: string;
}>;

type TerminalEvent = Readonly<{
  schemaVersion: 1;
  kind: 'terminal';
  sequence: number;
  status: 'success';
}>;

export type PerformanceQualificationEvent = PhaseEvent | RoleEvent | TerminalEvent;

export interface PerformanceQualificationEventProof {
  readonly phases: readonly PerformancePhaseMeasurement[];
  readonly roleRegistrations: readonly PerformanceRoleRegistration[];
}

export class PerformanceQualificationEventError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = 'PerformanceQualificationEventError';
  }
}

function invalidEvent(): never {
  throw new PerformanceQualificationEventError('ATTEMPT_EVENT_PROTOCOL_INVALID');
}

/** Writes the fixed qualification-only inherited event protocol without arbitrary metadata. */
export class PerformanceQualificationEventWriter {
  private sequence = 0;
  private terminal = false;

  public constructor(private readonly output: Pick<Writable, 'write' | 'end'>) {}

  public phase(
    phaseId: LocalWhisperPerformancePhaseId,
    durationNanoseconds: number | null,
    applicability: PhaseEvent['applicability'] = 'applicable',
  ): void {
    if (
      this.terminal ||
      (applicability === 'applicable'
        ? !safeInteger(durationNanoseconds, 1)
        : applicability !== 'notApplicable' || durationNanoseconds !== null)
    ) {
      invalidEvent();
    }
    this.write({
      schemaVersion: 1,
      kind: 'phase',
      sequence: this.sequence,
      phaseId,
      applicability,
      durationNanoseconds,
    });
  }

  public role(
    registration: Omit<PerformanceRoleRegistration, 'role'> & { readonly role: PerformanceProcessRole },
  ): void {
    if (this.terminal) invalidEvent();
    this.write({ schemaVersion: 1, kind: 'role', sequence: this.sequence, ...registration });
  }

  public success(): void {
    if (this.terminal) invalidEvent();
    this.terminal = true;
    this.write({ schemaVersion: 1, kind: 'terminal', sequence: this.sequence, status: 'success' });
    this.output.end();
  }

  private write(event: PerformanceQualificationEvent): void {
    const frame = `${JSON.stringify(event)}\n`;
    if (Buffer.byteLength(frame) > MAXIMUM_FRAME_BYTES || this.sequence >= MAXIMUM_EVENT_COUNT) invalidEvent();
    this.sequence += 1;
    if (!this.output.write(frame, 'utf8')) {
      throw new PerformanceQualificationEventError('ATTEMPT_EVENT_CHANNEL_BACKPRESSURE');
    }
  }
}

/**
 * Owns strict framing, ordering, applicability, and terminal validation for one
 * inherited private event channel. Raw frames never enter retained evidence.
 */
export class PerformanceQualificationEventCollector {
  private pending = Buffer.alloc(0);
  private totalBytes = 0;
  private sequence = 0;
  private phaseIndex = 0;
  private roleIndex = 0;
  private terminal = false;
  private readonly phases: PerformancePhaseMeasurement[] = [];
  private readonly roles: PerformanceRoleRegistration[] = [];
  private readonly allPhaseIds: readonly LocalWhisperPerformancePhaseId[];
  private readonly applicablePhaseIds: ReadonlySet<LocalWhisperPerformancePhaseId>;

  public constructor(
    platform: PerformancePlatform,
    backend: PerformanceBackend,
    applicablePhaseIds: readonly LocalWhisperPerformancePhaseId[],
  ) {
    this.allPhaseIds = Object.freeze(
      LOCAL_WHISPER_PERFORMANCE_PHASES.map(({ id }) => id).filter(
        (id) => !(platform === 'win32' && id === 'nativeAuthorityDigest'),
      ),
    );
    this.applicablePhaseIds = new Set(applicablePhaseIds);
    if (
      this.allPhaseIds.some(
        (id) => !this.applicablePhaseIds.has(id) && !(backend === 'cpu' && id === 'gpuUploadAllocation'),
      )
    ) {
      invalidEvent();
    }
  }

  public append(chunk: Buffer): void {
    if (this.terminal || chunk.byteLength === 0) invalidEvent();
    this.totalBytes += chunk.byteLength;
    if (this.totalBytes > MAXIMUM_EVENT_BYTES) invalidEvent();
    this.pending = Buffer.concat([this.pending, chunk]);
    while (true) {
      const newline = this.pending.indexOf(0x0a);
      if (newline < 0) break;
      if (newline === 0 || newline > MAXIMUM_FRAME_BYTES || this.pending.subarray(0, newline).includes(0x0d)) {
        invalidEvent();
      }
      const frame = this.pending.subarray(0, newline);
      this.pending = this.pending.subarray(newline + 1);
      this.consume(frame);
    }
    if (this.pending.byteLength > MAXIMUM_FRAME_BYTES) invalidEvent();
  }

  public finish(): PerformanceQualificationEventProof {
    if (
      !this.terminal ||
      this.pending.byteLength !== 0 ||
      this.sequence > MAXIMUM_EVENT_COUNT ||
      this.phaseIndex !== this.allPhaseIds.length ||
      this.roleIndex !== ROLES.length
    ) {
      invalidEvent();
    }
    return Object.freeze({
      phases: Object.freeze([...this.phases]),
      roleRegistrations: Object.freeze([...this.roles]),
    });
  }

  private consume(bytes: Buffer): void {
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
    } catch {
      invalidEvent();
    }
    if (!isRecord(value) || value.schemaVersion !== 1 || value.sequence !== this.sequence) invalidEvent();
    this.sequence += 1;
    if (this.sequence > MAXIMUM_EVENT_COUNT) invalidEvent();
    if (value.kind === 'phase') this.consumePhase(value);
    else if (value.kind === 'role') this.consumeRole(value);
    else if (value.kind === 'terminal') this.consumeTerminal(value);
    else invalidEvent();
  }

  private consumePhase(value: Readonly<Record<string, unknown>>): void {
    if (
      this.terminal ||
      !exactKeys(value, ['schemaVersion', 'kind', 'sequence', 'phaseId', 'applicability', 'durationNanoseconds']) ||
      value.phaseId !== this.allPhaseIds[this.phaseIndex]
    ) {
      invalidEvent();
    }
    const phaseId = value.phaseId as LocalWhisperPerformancePhaseId;
    const applicable = this.applicablePhaseIds.has(phaseId);
    if (
      applicable
        ? value.applicability !== 'applicable' || !safeInteger(value.durationNanoseconds, 1)
        : value.applicability !== 'notApplicable' || value.durationNanoseconds !== null
    ) {
      invalidEvent();
    }
    if (applicable) {
      this.phases.push(
        Object.freeze({
          id: phaseId,
          sequence: this.phases.length,
          durationNanoseconds: value.durationNanoseconds as number,
        }),
      );
    }
    this.phaseIndex += 1;
  }

  private consumeRole(value: Readonly<Record<string, unknown>>): void {
    if (
      this.terminal ||
      !exactKeys(value, [
        'schemaVersion',
        'kind',
        'sequence',
        'role',
        'pid',
        'processStartIdentity',
        'executableSha256',
      ]) ||
      value.role !== ROLES[this.roleIndex] ||
      !safeInteger(value.pid, 2) ||
      typeof value.processStartIdentity !== 'string' ||
      !PROCESS_START_IDENTITY.test(value.processStartIdentity) ||
      typeof value.executableSha256 !== 'string' ||
      !SHA256.test(value.executableSha256) ||
      this.roles.some(({ pid }) => pid === value.pid)
    ) {
      invalidEvent();
    }
    this.roles.push(
      Object.freeze({
        role: value.role as PerformanceProcessRole,
        pid: value.pid as number,
        processStartIdentity: value.processStartIdentity,
        executableSha256: value.executableSha256,
      }),
    );
    this.roleIndex += 1;
  }

  private consumeTerminal(value: Readonly<Record<string, unknown>>): void {
    if (
      this.terminal ||
      !exactKeys(value, ['schemaVersion', 'kind', 'sequence', 'status']) ||
      value.status !== 'success' ||
      this.phaseIndex !== this.allPhaseIds.length ||
      this.roleIndex !== ROLES.length
    ) {
      invalidEvent();
    }
    this.terminal = true;
  }
}
