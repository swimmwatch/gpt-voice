import { createHash } from 'node:crypto';

import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';

import type { LinuxResourceSample } from './LinuxResourceSampler';
import {
  LOCAL_WHISPER_QUALIFICATION_FIXTURE_DIGEST,
  LocalWhisperQualificationGraphProducer,
  qualificationCanonicalJson,
  type LocalWhisperQualificationPlatformBranch,
  type LocalWhisperQualificationValidator,
} from './QualificationContracts';
import type { QualificationLinuxFoundation } from './QualificationInputProducer';
import { roundQualificationPeakBytes } from './QualificationMetrics';

const GATE_NAMES = Object.freeze([
  'load',
  'warmup',
  'parity',
  'resources',
  'cancellation',
  'crashReload',
  'unload',
  'providerSwitch',
  'suspendResume',
  'appExit',
  'offlineRestart',
  'repetitions',
  'predecessor',
] as const);

type QualificationGateName = (typeof GATE_NAMES)[number];
export type QualificationGateStatus = 'Pass' | 'Fail' | 'Pending';

export interface QualificationLinuxRowEvidence {
  readonly family: (typeof LOCAL_WHISPER_RELEASE_MODEL_MATRIX)[number]['family'];
  readonly variant: (typeof LOCAL_WHISPER_RELEASE_MODEL_MATRIX)[number]['variant'];
  readonly backend: 'cpu' | 'cuda';
  readonly status: 'Pass' | 'Fail' | 'Pending';
  readonly reasonCode: string;
  readonly applicationWerPercentage: number;
  readonly directWerPercentage: number;
  readonly peakRamBytes: number;
  readonly peakVramBytes: number | 'notApplicable';
  readonly medianRtf: number | null;
  readonly gates: Readonly<Record<QualificationGateName, QualificationGateStatus>>;
  readonly resourceSamples: readonly LinuxResourceSample[];
}

export interface QualificationLinuxResult {
  readonly branch: LocalWhisperQualificationPlatformBranch;
  readonly resultDigest: string;
  readonly evidenceIndexDigest: string;
}

function digestField(document: unknown, field: string): string {
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    throw new Error('QUALIFICATION_RESULT_INPUT_INVALID');
  }
  const value = (document as Readonly<Record<string, unknown>>)[field];
  if (typeof value !== 'string') throw new Error('QUALIFICATION_RESULT_INPUT_INVALID');
  return value;
}

function evidenceIdentity(value: Readonly<Record<string, unknown>>): {
  readonly sha256: string;
  readonly byteLength: number;
} {
  const bytes = Buffer.from(qualificationCanonicalJson(value), 'utf8');
  return Object.freeze({ sha256: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.byteLength });
}

function rowKey(row: Pick<QualificationLinuxRowEvidence, 'backend' | 'family' | 'variant'>): string {
  return `${row.backend}|${row.family}|${row.variant}`;
}

/** Seals sanitized Linux measurement/result/index evidence only after the immutable platform graph. */
export class LocalWhisperQualificationResultProducer {
  private readonly graph: LocalWhisperQualificationGraphProducer;

  public constructor(private readonly validator: LocalWhisperQualificationValidator) {
    this.graph = new LocalWhisperQualificationGraphProducer(validator);
  }

  public produce(
    foundation: QualificationLinuxFoundation,
    rowEvidence: readonly QualificationLinuxRowEvidence[],
  ): QualificationLinuxResult {
    const candidateInputDigest = digestField(foundation.candidateInput, 'candidateInputDigest');
    const platformGraphDigest = digestField(foundation.platformGraph, 'platformGraphDigest');
    const profiles = new Map(
      foundation.profiles.map((profile) => [String(profile.backend), digestField(profile, 'profileDigest')]),
    );
    const expectedKeys = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.flatMap(({ family, variant }) =>
      (['cpu', 'cuda'] as const).map((backend) => `${backend}|${family}|${variant}`),
    );
    if (
      rowEvidence.length !== expectedKeys.length ||
      new Set(rowEvidence.map(rowKey)).size !== expectedKeys.length ||
      rowEvidence.some((row, index) => rowKey(row) !== expectedKeys[index])
    ) {
      throw new Error('QUALIFICATION_LINUX_RESULT_MATRIX_INVALID');
    }

    const measurementSeries = rowEvidence.map((row) => {
      const profileDigest = profiles.get(row.backend);
      if (!profileDigest) throw new Error('QUALIFICATION_LINUX_PROFILE_MISSING');
      return this.graph.freeze('measurementSeries', {
        schemaVersion: 2,
        specificationRevision: 10,
        candidateInputDigest,
        platformGraphDigest,
        profileDigest,
        rowId: `linux-${row.backend}-${row.family}-${row.variant}`,
        sampleIntervalMilliseconds: 100,
        maximumGapMilliseconds: 500,
        samples: row.resourceSamples,
      });
    });
    const seriesByKey = new Map(
      measurementSeries.map((series, index) => [rowKey(rowEvidence[index]!), digestField(series, 'seriesDigest')]),
    );
    const evidenceEntries: Array<Readonly<Record<string, unknown>>> = [];
    const rows = rowEvidence.map((row) => {
      const id = `linux-${row.backend}-${row.family}-${row.variant}`;
      const profileDigest = profiles.get(row.backend);
      const measurementSeriesDigest = seriesByKey.get(rowKey(row));
      if (!profileDigest || !measurementSeriesDigest) throw new Error('QUALIFICATION_LINUX_RESULT_EDGE_MISSING');
      const roundedRam = roundQualificationPeakBytes(row.peakRamBytes);
      const roundedVram =
        row.peakVramBytes === 'notApplicable' ? 'notApplicable' : roundQualificationPeakBytes(row.peakVramBytes);
      const evidenceDocument = Object.freeze({
        schemaVersion: 1,
        specificationRevision: 10,
        id,
        candidateInputDigest,
        platformGraphDigest,
        profileDigest,
        measurementSeriesDigest,
        status: row.status,
        reasonCode: row.reasonCode,
        gates: row.gates,
        measurements: {
          applicationWerPercentage: row.applicationWerPercentage,
          directWerPercentage: row.directWerPercentage,
          werDeltaPercentagePoints: row.applicationWerPercentage - row.directWerPercentage,
          peakRamBytes: roundedRam,
          peakVramBytes: roundedVram,
          medianRtf: row.medianRtf,
        },
      });
      const identity = evidenceIdentity(evidenceDocument);
      evidenceEntries.push(
        Object.freeze({
          id,
          platform: 'linux',
          evidenceClass: row.backend === 'cuda' ? 'hardware' : 'platform',
          sha256: identity.sha256,
          byteLength: identity.byteLength,
          sanitizedLabel: `Linux ${row.backend.toUpperCase()} ${row.family} ${row.variant} qualification`,
        }),
      );
      return Object.freeze({
        id,
        family: row.family,
        variant: row.variant,
        backend: row.backend,
        status: row.status,
        reasonCode: row.reasonCode,
        candidateInputDigest,
        platformGraphDigest,
        profileDigest,
        evidenceDigest: identity.sha256,
        measurementSeriesDigest,
        measurements: evidenceDocument.measurements,
        gates: row.gates,
      });
    });
    const platformResult = this.graph.freeze('platformResult', {
      schemaVersion: 2,
      specificationRevision: 10,
      candidateInputDigest,
      platformGraphDigest,
      platform: 'linux',
      representativeWindowsExecution: 'NotRun',
      measurementSeriesDigests: rows
        .map(({ measurementSeriesDigest }) => measurementSeriesDigest)
        .sort((left, right) => left.localeCompare(right, 'en')),
      evidenceDigests: rows
        .map(({ evidenceDigest }) => evidenceDigest)
        .sort((left, right) => left.localeCompare(right, 'en')),
      rows,
    });
    const evidenceIndex = this.graph.freeze('evidenceIndex', {
      schemaVersion: 2,
      specificationRevision: 10,
      candidateInputDigest,
      platformGraphDigest,
      platformResultDigest: digestField(platformResult, 'resultDigest'),
      platform: 'linux',
      fixtureDigest: LOCAL_WHISPER_QUALIFICATION_FIXTURE_DIGEST,
      entries: evidenceEntries.sort((left, right) => String(left.id).localeCompare(String(right.id), 'en')),
    });
    const branch: LocalWhisperQualificationPlatformBranch = Object.freeze({
      ...foundation,
      measurementSeries: Object.freeze(measurementSeries),
      platformResult,
      evidenceIndex,
    });
    this.validator.validatePlatformBranch(branch);
    return Object.freeze({
      branch,
      resultDigest: digestField(platformResult, 'resultDigest'),
      evidenceIndexDigest: digestField(evidenceIndex, 'indexDigest'),
    });
  }
}
