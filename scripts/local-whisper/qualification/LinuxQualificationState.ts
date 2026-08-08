import type { LinuxQualificationPackageIdentity } from './LinuxQualificationPackageBuilder';
import {
  LOCAL_WHISPER_QUALIFICATION_FIXTURE_DIGEST,
  type LocalWhisperQualificationValidator,
} from './QualificationContracts';
import type { QualificationLinuxFoundation } from './QualificationInputProducer';
import type { QualificationLinuxResult } from './QualificationResultProducer';

export interface QualifiedLinuxQualificationState extends Readonly<Record<string, unknown>> {
  readonly schemaVersion: 2;
  readonly specificationRevision: 10;
  readonly platform: 'linux';
  readonly activationState: 'FailClosed';
  readonly candidateState: 'Frozen';
  readonly profileState: 'Pass';
  readonly previousPackageState: 'Pass';
  readonly fixtureDigest: string;
  readonly representativeWindowsExecution: 'NotRun';
  readonly candidateSemVer: string;
  readonly freezeTimestampUtc: string;
  readonly sourceCommit: string;
  readonly candidateInputDigest: string;
  readonly platformInputDigest: string;
  readonly profileDigests: readonly string[];
  readonly platformGraphDigest: string;
  readonly resultDigest: string;
  readonly evidenceIndexDigest: string;
  readonly predecessorEvidenceDigest: string;
  readonly packageDigests: readonly string[];
  readonly reasonCodes: readonly string[];
}

export interface QualifiedLinuxQualificationStateInput {
  readonly candidateSemVer: string;
  readonly freezeTimestampUtc: string;
  readonly sourceCommit: string;
  readonly foundation: QualificationLinuxFoundation;
  readonly packages: readonly LinuxQualificationPackageIdentity[];
  readonly predecessorEvidenceDigest: string;
  readonly result: QualificationLinuxResult;
}

function digestField(document: unknown, field: string): string {
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    throw new Error('QUALIFICATION_LINUX_STATE_INPUT_INVALID');
  }
  const value = (document as Readonly<Record<string, unknown>>)[field];
  if (typeof value !== 'string') throw new Error('QUALIFICATION_LINUX_STATE_INPUT_INVALID');
  return value;
}

/** Seals the compact public Linux completion state only after result and evidence-index freeze. */
export class LinuxQualificationStateProducer {
  public constructor(
    private readonly validator: Pick<LocalWhisperQualificationValidator, 'validateLinuxStateDocument'>,
  ) {}

  public produce(input: QualifiedLinuxQualificationStateInput): QualifiedLinuxQualificationState {
    const state: QualifiedLinuxQualificationState = Object.freeze({
      schemaVersion: 2,
      specificationRevision: 10,
      platform: 'linux',
      activationState: 'FailClosed',
      candidateState: 'Frozen',
      profileState: 'Pass',
      previousPackageState: 'Pass',
      fixtureDigest: LOCAL_WHISPER_QUALIFICATION_FIXTURE_DIGEST,
      representativeWindowsExecution: 'NotRun',
      candidateSemVer: input.candidateSemVer,
      freezeTimestampUtc: input.freezeTimestampUtc,
      sourceCommit: input.sourceCommit,
      candidateInputDigest: digestField(input.foundation.candidateInput, 'candidateInputDigest'),
      platformInputDigest: digestField(input.foundation.platformInput, 'platformInputDigest'),
      profileDigests: Object.freeze(
        input.foundation.profiles
          .map((profile) => digestField(profile, 'profileDigest'))
          .sort((left, right) => left.localeCompare(right, 'en')),
      ),
      platformGraphDigest: digestField(input.foundation.platformGraph, 'platformGraphDigest'),
      resultDigest: input.result.resultDigest,
      evidenceIndexDigest: input.result.evidenceIndexDigest,
      predecessorEvidenceDigest: input.predecessorEvidenceDigest,
      packageDigests: Object.freeze(
        input.packages.map(({ sha256 }) => sha256).sort((left, right) => left.localeCompare(right, 'en')),
      ),
      reasonCodes: Object.freeze([
        'AUTHENTICATED_PRODUCTION_CATALOG_UNAVAILABLE',
        'LICENSE_REDISTRIBUTION_APPROVAL_UNAVAILABLE',
      ]),
    });
    this.validator.validateLinuxStateDocument(state);
    return state;
  }
}
