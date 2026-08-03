import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

import Ajv2020, { type AnySchema, type ValidateFunction } from 'ajv/dist/2020';
import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '../../../src/main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';

export const LOCAL_WHISPER_QUALIFICATION_FIXTURE_DIGEST =
  'de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226';

const SCHEMA_FILES = Object.freeze({
  candidateInput: 'candidate-input-v2.schema.json',
  platformInput: 'platform-input-v2.schema.json',
  profile: 'profile-v2.schema.json',
  platformGraph: 'platform-graph-v2.schema.json',
  directEngineManifest: 'direct-engine-manifest-v1.schema.json',
  measurementSeries: 'measurement-series-v2.schema.json',
  platformResult: 'platform-result-v2.schema.json',
  evidenceIndex: 'evidence-index-v2.schema.json',
} as const);

const RETIRED_ACTIVE_SCHEMA_FILES = Object.freeze(['candidate-v2.schema.json', 'measurement-series-v1.schema.json']);
const DOCUMENT_DIGEST_FIELDS = Object.freeze({
  candidateInput: 'candidateInputDigest',
  platformInput: 'platformInputDigest',
  profile: 'profileDigest',
  platformGraph: 'platformGraphDigest',
  directEngineManifest: 'manifestDigest',
  measurementSeries: 'seriesDigest',
  platformResult: 'resultDigest',
  evidenceIndex: 'indexDigest',
} as const);

const PRIVATE_KEYS = new Set([
  'audio',
  'deviceSerial',
  'environment',
  'hostPath',
  'logs',
  'privateLog',
  'prompt',
  'rawLog',
  'transcript',
]);
const PRIVATE_PATH_PATTERN = /^(?:\/(?:home|Users)\/|[A-Za-z]:\\Users\\)/u;
const PENDING_REASON_CODES = new Set([
  'AUTHENTICATED_PRODUCTION_CATALOG_UNAVAILABLE',
  'PRODUCTION_RUNTIME_MODEL_ARTIFACTS_UNAVAILABLE',
  'LICENSE_REDISTRIBUTION_APPROVAL_UNAVAILABLE',
  'PRODUCTION_ARTIFACT_PIPELINE_INCOMPLETE',
  'LIVE_WORKER_AUTHORITY_COMPOSITION_INCOMPLETE',
  'PREVIOUS_LINUX_PACKAGE_UNAVAILABLE',
]);
const QUALIFIED_REASON_CODES = new Set([
  'AUTHENTICATED_PRODUCTION_CATALOG_UNAVAILABLE',
  'LICENSE_REDISTRIBUTION_APPROVAL_UNAVAILABLE',
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const SEMVER_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;

export type QualificationDocumentKind = keyof typeof SCHEMA_FILES;
export type DigestQualificationDocumentKind = keyof typeof DOCUMENT_DIGEST_FIELDS;

export interface LocalWhisperQualificationPlatformBranch {
  readonly candidateInput: unknown;
  readonly platformInput: unknown;
  readonly profiles: readonly unknown[];
  readonly platformGraph: unknown;
  readonly measurementSeries: readonly unknown[];
  readonly platformResult: unknown;
  readonly evidenceIndex: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalValue(value: unknown): unknown {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('QUALIFICATION_NONFINITE_NUMBER_REJECTED');
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, 'en'))
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

export function qualificationCanonicalJson(value: unknown): string {
  if (!isRecord(value)) throw new Error('QUALIFICATION_DOCUMENT_INVALID');
  return JSON.stringify(canonicalValue(value));
}

export function qualificationDocumentDigest(value: unknown, digestField: string): string {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, digestField)) {
    throw new Error('QUALIFICATION_DOCUMENT_INVALID');
  }
  const copy = structuredClone(value);
  delete copy[digestField];
  return createHash('sha256').update(qualificationCanonicalJson(copy), 'utf8').digest('hex');
}

export function assertQualificationPrivacySafe(value: unknown): void {
  const visit = (candidate: unknown): void => {
    if (typeof candidate === 'string' && PRIVATE_PATH_PATTERN.test(candidate)) {
      throw new Error('QUALIFICATION_PRIVATE_VALUE_REJECTED');
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item);
      return;
    }
    if (!isRecord(candidate)) return;
    for (const [key, item] of Object.entries(candidate)) {
      if (PRIVATE_KEYS.has(key)) throw new Error('QUALIFICATION_PRIVATE_FIELD_REJECTED');
      visit(item);
    }
  };
  visit(value);
}

function parseJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
}

function parseSchema(filePath: string): AnySchema {
  const schema = parseJson(filePath);
  if (typeof schema !== 'boolean' && !isRecord(schema)) throw new Error('QUALIFICATION_SCHEMA_INVALID');
  return schema;
}

function asRecord(value: unknown, code: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(code);
  return value;
}

function strings(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) throw new Error(code);
  return value as string[];
}

function assertSortedUnique(values: readonly string[], code: string): void {
  if (
    new Set(values).size !== values.length ||
    !values.every((value, index) => index === 0 || values[index - 1]!.localeCompare(value, 'en') < 0)
  ) {
    throw new Error(code);
  }
}

function digestOf(document: Record<string, unknown>, field: string, code: string): string {
  const value = document[field];
  if (typeof value !== 'string') throw new Error(code);
  return value;
}

function immutableRecord(value: Record<string, unknown>): Readonly<Record<string, unknown>> {
  const freeze = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      for (const item of candidate) freeze(item);
      Object.freeze(candidate);
      return;
    }
    if (!isRecord(candidate)) return;
    for (const item of Object.values(candidate)) freeze(item);
    Object.freeze(candidate);
  };
  freeze(value);
  return value;
}

/** Produces immutable, schema-valid canonical qualification documents in explicit graph order. */
export class LocalWhisperQualificationGraphProducer {
  public constructor(private readonly validator: LocalWhisperQualificationValidator) {}

  public freeze(
    kind: DigestQualificationDocumentKind,
    documentWithoutDigest: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> {
    const digestField = DOCUMENT_DIGEST_FIELDS[kind];
    if (Object.prototype.hasOwnProperty.call(documentWithoutDigest, digestField)) {
      throw new Error('QUALIFICATION_DIGEST_FIELD_ALREADY_PRESENT');
    }
    const document = structuredClone(documentWithoutDigest) as Record<string, unknown>;
    document[digestField] = '0'.repeat(64);
    document[digestField] = qualificationDocumentDigest(document, digestField);
    this.validator.validateDocument(kind, document);
    return immutableRecord(document);
  }
}

/** Validates immutable qualification contracts without collecting host-private evidence. */
export class LocalWhisperQualificationValidator {
  private readonly validators: Readonly<Record<QualificationDocumentKind, ValidateFunction>>;

  public constructor(private readonly qualificationRoot: string) {
    const schemaRoot = path.join(qualificationRoot, 'schemas');
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    this.validators = Object.freeze(
      Object.fromEntries(
        Object.entries(SCHEMA_FILES).map(([kind, fileName]) => [
          kind,
          ajv.compile(parseSchema(path.join(schemaRoot, fileName))),
        ]),
      ) as unknown as Record<QualificationDocumentKind, ValidateFunction>,
    );
  }

  /** Compiles every active schema, rejects retired aliases, and validates the truthful Linux gate state. */
  public validateInputs(): void {
    for (const validator of Object.values(this.validators)) {
      if (typeof validator !== 'function') throw new Error('QUALIFICATION_SCHEMA_INVALID');
    }
    const schemaRoot = path.join(this.qualificationRoot, 'schemas');
    if (RETIRED_ACTIVE_SCHEMA_FILES.some((fileName) => existsSync(path.join(schemaRoot, fileName)))) {
      throw new Error('QUALIFICATION_RETIRED_SCHEMA_PRESENT');
    }
    this.validateLinuxStateDocument(parseJson(path.join(this.qualificationRoot, 'linux-state.json')));
  }

  public validateDocument(kind: QualificationDocumentKind, document: unknown): void {
    assertQualificationPrivacySafe(document);
    const validator = this.validators[kind];
    if (!validator(document)) throw new Error(`QUALIFICATION_${kind.toUpperCase()}_INVALID`);
    if (!isRecord(document)) throw new Error(`QUALIFICATION_${kind.toUpperCase()}_INVALID`);
    this.assertDigest(document, DOCUMENT_DIGEST_FIELDS[kind]);
    if (kind === 'candidateInput') this.assertCandidateInput(document);
    if (kind === 'platformInput') this.assertPlatformInput(document);
    if (kind === 'profile') this.assertProfile(document);
    if (kind === 'platformGraph') this.assertPlatformGraph(document);
    if (kind === 'measurementSeries') this.assertMeasurementSeries(document);
    if (kind === 'platformResult') this.assertPlatformResult(document);
    if (kind === 'evidenceIndex') this.assertEvidenceIndex(document);
  }

  /** Validates every forward edge in one already-frozen platform branch. */
  public validatePlatformBranch(branch: LocalWhisperQualificationPlatformBranch): void {
    this.validateDocument('candidateInput', branch.candidateInput);
    this.validateDocument('platformInput', branch.platformInput);
    for (const profile of branch.profiles) this.validateDocument('profile', profile);
    this.validateDocument('platformGraph', branch.platformGraph);
    for (const series of branch.measurementSeries) this.validateDocument('measurementSeries', series);
    this.validateDocument('platformResult', branch.platformResult);
    this.validateDocument('evidenceIndex', branch.evidenceIndex);

    const candidate = asRecord(branch.candidateInput, 'QUALIFICATION_BRANCH_INVALID');
    const platformInput = asRecord(branch.platformInput, 'QUALIFICATION_BRANCH_INVALID');
    const graph = asRecord(branch.platformGraph, 'QUALIFICATION_BRANCH_INVALID');
    const result = asRecord(branch.platformResult, 'QUALIFICATION_BRANCH_INVALID');
    const index = asRecord(branch.evidenceIndex, 'QUALIFICATION_BRANCH_INVALID');
    const candidateDigest = digestOf(candidate, 'candidateInputDigest', 'QUALIFICATION_BRANCH_INVALID');
    const platformInputDigest = digestOf(platformInput, 'platformInputDigest', 'QUALIFICATION_BRANCH_INVALID');
    const graphDigest = digestOf(graph, 'platformGraphDigest', 'QUALIFICATION_BRANCH_INVALID');
    const resultDigest = digestOf(result, 'resultDigest', 'QUALIFICATION_BRANCH_INVALID');
    const platform = platformInput.platform;

    if (
      platformInput.candidateInputDigest !== candidateDigest ||
      asRecord(platformInput.predecessor, 'QUALIFICATION_BRANCH_INVALID').cutoffTimestampUtc !==
        candidate.freezeTimestampUtc ||
      graph.candidateInputDigest !== candidateDigest ||
      graph.platformInputDigest !== platformInputDigest ||
      graph.platform !== platform ||
      result.candidateInputDigest !== candidateDigest ||
      result.platformGraphDigest !== graphDigest ||
      result.platform !== platform ||
      index.candidateInputDigest !== candidateDigest ||
      index.platformGraphDigest !== graphDigest ||
      index.platformResultDigest !== resultDigest ||
      index.platform !== platform
    ) {
      throw new Error('QUALIFICATION_MIXED_PLATFORM_BRANCH');
    }

    const profileByBackend = new Map<string, string>();
    for (const value of branch.profiles) {
      const profile = asRecord(value, 'QUALIFICATION_BRANCH_INVALID');
      if (
        profile.candidateInputDigest !== candidateDigest ||
        profile.platformInputDigest !== platformInputDigest ||
        profile.platform !== platform ||
        typeof profile.backend !== 'string'
      ) {
        throw new Error('QUALIFICATION_MIXED_PLATFORM_BRANCH');
      }
      profileByBackend.set(profile.backend, digestOf(profile, 'profileDigest', 'QUALIFICATION_BRANCH_INVALID'));
    }
    if (profileByBackend.size !== 2 || !profileByBackend.has('cpu') || !profileByBackend.has('cuda')) {
      throw new Error('QUALIFICATION_PLATFORM_PROFILE_SET_INVALID');
    }
    const expectedProfileDigests = [...profileByBackend.values()].sort((left, right) =>
      left.localeCompare(right, 'en'),
    );
    if (JSON.stringify(graph.profileDigests) !== JSON.stringify(expectedProfileDigests)) {
      throw new Error('QUALIFICATION_PLATFORM_PROFILE_SET_INVALID');
    }

    const seriesByDigest = new Map<string, Record<string, unknown>>();
    for (const value of branch.measurementSeries) {
      const series = asRecord(value, 'QUALIFICATION_BRANCH_INVALID');
      const digest = digestOf(series, 'seriesDigest', 'QUALIFICATION_BRANCH_INVALID');
      if (
        series.candidateInputDigest !== candidateDigest ||
        series.platformGraphDigest !== graphDigest ||
        !expectedProfileDigests.includes(String(series.profileDigest)) ||
        seriesByDigest.has(digest)
      ) {
        throw new Error('QUALIFICATION_MIXED_PLATFORM_BRANCH');
      }
      seriesByDigest.set(digest, series);
    }

    const rows = result.rows;
    if (!Array.isArray(rows) || rows.length !== seriesByDigest.size) {
      throw new Error('QUALIFICATION_PLATFORM_RESULT_SERIES_INVALID');
    }
    for (const value of rows) {
      const row = asRecord(value, 'QUALIFICATION_PLATFORM_RESULT_SERIES_INVALID');
      if (
        row.candidateInputDigest !== candidateDigest ||
        row.platformGraphDigest !== graphDigest ||
        row.profileDigest !== profileByBackend.get(String(row.backend)) ||
        !seriesByDigest.has(String(row.measurementSeriesDigest))
      ) {
        throw new Error('QUALIFICATION_MIXED_PLATFORM_BRANCH');
      }
    }
  }

  public readLinuxState(): Readonly<Record<string, unknown>> {
    const state = parseJson(path.join(this.qualificationRoot, 'linux-state.json'));
    this.validateLinuxStateDocument(state);
    return Object.freeze({ ...(state as Record<string, unknown>) });
  }

  public validateLinuxStateDocument(value: unknown): void {
    assertQualificationPrivacySafe(value);
    if (!isRecord(value)) throw new Error('QUALIFICATION_LINUX_STATE_INVALID');
    if (value.schemaVersion === 1) {
      this.validatePendingLinuxState(value);
      return;
    }
    if (value.schemaVersion === 2) {
      this.validateQualifiedLinuxState(value);
      return;
    }
    throw new Error('QUALIFICATION_LINUX_STATE_INVALID');
  }

  private assertDigest(document: Record<string, unknown>, field: string): void {
    if (document[field] !== qualificationDocumentDigest(document, field)) {
      throw new Error('QUALIFICATION_DIGEST_MISMATCH');
    }
  }

  private assertFixtureDigest(document: Record<string, unknown>): void {
    if (document.fixtureDigest !== LOCAL_WHISPER_QUALIFICATION_FIXTURE_DIGEST) {
      throw new Error('QUALIFICATION_FIXTURE_DIGEST_MISMATCH');
    }
  }

  private assertCandidateInput(document: Record<string, unknown>): void {
    this.assertFixtureDigest(document);
    const models = document.modelArtifacts;
    if (!Array.isArray(models)) throw new Error('QUALIFICATION_CANDIDATE_INPUT_INVALID');
    const actual = models.map((entry) => {
      const model = asRecord(entry, 'QUALIFICATION_CANDIDATE_INPUT_INVALID');
      return `${String(model.family)}|${String(model.variant)}|${String(model.fileName)}|${String(model.sizeBytes)}|${String(model.sha256)}`;
    });
    const expected = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.map(
      ({ family, variant, file, sizeBytes, sha256 }) => `${family}|${variant}|${file}|${sizeBytes}|${sha256}`,
    );
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error('QUALIFICATION_CANDIDATE_MODEL_MATRIX_INVALID');
    }
    this.assertSortedIdentities(document.sharedToolIdentities, 'id', 'QUALIFICATION_CANDIDATE_TOOL_ORDER_INVALID');
  }

  private assertPlatformInput(document: Record<string, unknown>): void {
    const runtimes = document.runtimeArtifacts;
    const direct = document.directEngineArtifacts;
    if (
      !Array.isArray(runtimes) ||
      !Array.isArray(direct) ||
      !this.hasExactBackends(runtimes) ||
      !this.hasExactBackends(direct)
    ) {
      throw new Error('QUALIFICATION_PLATFORM_INPUT_INVALID');
    }
    const packages = document.packages;
    if (!Array.isArray(packages)) throw new Error('QUALIFICATION_PLATFORM_INPUT_INVALID');
    const formats = packages.map((entry) => String(asRecord(entry, 'QUALIFICATION_PLATFORM_INPUT_INVALID').format));
    if (
      (document.platform === 'linux' && formats.some((format) => !['AppImage', 'deb', 'rpm'].includes(format))) ||
      (document.platform === 'win32' && formats.some((format) => format !== 'nsis'))
    ) {
      throw new Error('QUALIFICATION_PLATFORM_PACKAGE_INVALID');
    }
    this.assertSortedIdentities(packages, 'fileName', 'QUALIFICATION_PLATFORM_PACKAGE_ORDER_INVALID');
    this.assertSortedIdentities(runtimes, 'backend', 'QUALIFICATION_PLATFORM_RUNTIME_ORDER_INVALID');
    this.assertSortedIdentities(direct, 'backend', 'QUALIFICATION_PLATFORM_DIRECT_ENGINE_ORDER_INVALID');
    this.assertSortedIdentities(document.toolIdentities, 'id', 'QUALIFICATION_PLATFORM_TOOL_ORDER_INVALID');
    const catalog = asRecord(document.catalog, 'QUALIFICATION_PLATFORM_INPUT_INVALID');
    assertSortedUnique(
      strings(catalog.originIds, 'QUALIFICATION_PLATFORM_INPUT_INVALID'),
      'QUALIFICATION_ORIGIN_ORDER_INVALID',
    );
    const server = asRecord(document.qualificationServer, 'QUALIFICATION_PLATFORM_INPUT_INVALID');
    assertSortedUnique(
      strings(server.objectDigests, 'QUALIFICATION_PLATFORM_INPUT_INVALID'),
      'QUALIFICATION_SERVER_OBJECT_ORDER_INVALID',
    );
  }

  private assertProfile(document: Record<string, unknown>): void {
    const models = document.modelIdentities;
    if (!Array.isArray(models)) throw new Error('QUALIFICATION_PROFILE_MODEL_MATRIX_INVALID');
    const actual = models.map((entry) => {
      const model = asRecord(entry, 'QUALIFICATION_PROFILE_MODEL_MATRIX_INVALID');
      return `${String(model.family)}|${String(model.variant)}|${String(model.sha256)}`;
    });
    const expected = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.map(
      ({ family, variant, sha256 }) => `${family}|${variant}|${sha256}`,
    );
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error('QUALIFICATION_PROFILE_MODEL_MATRIX_INVALID');
    }
    this.assertSortedIdentities(document.toolIdentities, 'id', 'QUALIFICATION_PROFILE_TOOL_ORDER_INVALID');
  }

  private assertPlatformGraph(document: Record<string, unknown>): void {
    assertSortedUnique(
      strings(document.profileDigests, 'QUALIFICATION_PLATFORM_GRAPH_INVALID'),
      'QUALIFICATION_PLATFORM_PROFILE_SET_INVALID',
    );
  }

  private assertPlatformResult(document: Record<string, unknown>): void {
    const candidateInputDigest = document.candidateInputDigest;
    const platformGraphDigest = document.platformGraphDigest;
    const rows = document.rows;
    if (
      !Array.isArray(rows) ||
      rows.some(
        (row) =>
          !isRecord(row) ||
          row.candidateInputDigest !== candidateInputDigest ||
          row.platformGraphDigest !== platformGraphDigest,
      )
    ) {
      throw new Error('QUALIFICATION_MIXED_PLATFORM_BRANCH');
    }
    const expectedRows = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.flatMap(({ family, variant }) =>
      ['cpu', 'cuda'].map((backend) => `${backend}|${family}|${variant}`),
    );
    const actualRows = rows.map((row) => `${String(row.backend)}|${String(row.family)}|${String(row.variant)}`);
    if (JSON.stringify(actualRows) !== JSON.stringify(expectedRows)) {
      throw new Error('QUALIFICATION_PLATFORM_RESULT_MATRIX_INVALID');
    }
    const measurementSeriesDigests = strings(
      document.measurementSeriesDigests,
      'QUALIFICATION_PLATFORM_RESULT_SERIES_INVALID',
    );
    const evidenceDigests = strings(document.evidenceDigests, 'QUALIFICATION_PLATFORM_RESULT_EVIDENCE_INVALID');
    assertSortedUnique(measurementSeriesDigests, 'QUALIFICATION_PLATFORM_RESULT_SERIES_INVALID');
    assertSortedUnique(evidenceDigests, 'QUALIFICATION_PLATFORM_RESULT_EVIDENCE_INVALID');
    const rowSeries = rows.map((row) => String(row.measurementSeriesDigest)).sort((a, b) => a.localeCompare(b, 'en'));
    const rowEvidence = rows.map((row) => String(row.evidenceDigest)).sort((a, b) => a.localeCompare(b, 'en'));
    if (
      JSON.stringify(measurementSeriesDigests) !== JSON.stringify(rowSeries) ||
      JSON.stringify(evidenceDigests) !== JSON.stringify(rowEvidence)
    ) {
      throw new Error('QUALIFICATION_PLATFORM_RESULT_EVIDENCE_INVALID');
    }
    for (const row of rows) this.assertResultRow(asRecord(row, 'QUALIFICATION_PLATFORMRESULT_INVALID'));
  }

  private assertResultRow(row: Record<string, unknown>): void {
    const measurements = asRecord(row.measurements, 'QUALIFICATION_PLATFORMRESULT_INVALID');
    const gates = asRecord(row.gates, 'QUALIFICATION_PLATFORMRESULT_INVALID');
    const pass = row.status === 'Pass';
    if (pass && Object.values(gates).some((gate) => gate !== 'Pass')) {
      throw new Error('QUALIFICATION_PASS_GATE_INCOMPLETE');
    }
    if (pass && (measurements.werDeltaPercentagePoints as number) > 1) {
      throw new Error('QUALIFICATION_WER_LIMIT_EXCEEDED');
    }
    const isBase = row.family === 'base' && row.variant === 'full';
    if (
      (isBase && (typeof measurements.medianRtf !== 'number' || measurements.medianRtf > 1)) ||
      (!isBase && measurements.medianRtf !== null) ||
      (measurements.peakRamBytes as number) % (64 * 1024 * 1024) !== 0 ||
      (row.backend === 'cpu' && measurements.peakVramBytes !== 'notApplicable') ||
      (row.backend === 'cuda' && typeof measurements.peakVramBytes !== 'number')
    ) {
      throw new Error('QUALIFICATION_MEASUREMENT_METHOD_INVALID');
    }
  }

  private assertEvidenceIndex(document: Record<string, unknown>): void {
    this.assertFixtureDigest(document);
    const entries = document.entries;
    if (!Array.isArray(entries)) throw new Error('QUALIFICATION_EVIDENCE_INDEX_INVALID');
    const ids = entries.map((entry) => String(asRecord(entry, 'QUALIFICATION_EVIDENCE_INDEX_INVALID').id));
    assertSortedUnique(ids, 'QUALIFICATION_EVIDENCE_INDEX_INVALID');
    if (
      entries.some((entry) => {
        const platform = asRecord(entry, 'QUALIFICATION_EVIDENCE_INDEX_INVALID').platform;
        return platform !== 'shared' && platform !== document.platform;
      })
    ) {
      throw new Error('QUALIFICATION_MIXED_PLATFORM_BRANCH');
    }
  }

  private assertMeasurementSeries(document: Record<string, unknown>): void {
    const samples = document.samples;
    if (!Array.isArray(samples)) throw new Error('QUALIFICATION_MEASUREMENT_SERIES_INVALID');
    let previous = -1;
    for (const sample of samples) {
      if (!isRecord(sample) || typeof sample.elapsedNanoseconds !== 'number') {
        throw new Error('QUALIFICATION_MEASUREMENT_SERIES_INVALID');
      }
      const elapsed = sample.elapsedNanoseconds;
      if (elapsed <= previous || (previous >= 0 && elapsed - previous > 500_000_000)) {
        throw new Error('QUALIFICATION_MEASUREMENT_SERIES_GAP');
      }
      if (
        sample.ownedProcessCount === 0 &&
        (sample.ramBytes !== 0 || ![0, 'notApplicable'].includes(sample.vramBytes as never))
      ) {
        throw new Error('QUALIFICATION_MEASUREMENT_OWNERSHIP_INVALID');
      }
      previous = elapsed;
    }
  }

  private assertSortedIdentities(value: unknown, field: string, code: string): void {
    if (!Array.isArray(value)) throw new Error(code);
    const identities = value.map((entry) => String(asRecord(entry, code)[field]));
    assertSortedUnique(identities, code);
  }

  private hasExactBackends(entries: readonly unknown[]): boolean {
    const backends = entries.map((entry) => (isRecord(entry) ? entry.backend : null));
    return (
      backends.length === 2 && new Set(backends).size === 2 && backends.includes('cpu') && backends.includes('cuda')
    );
  }

  private validatePendingLinuxState(value: Record<string, unknown>): void {
    const expectedKeys = [
      'schemaVersion',
      'platform',
      'activationState',
      'candidateState',
      'profileState',
      'previousPackageState',
      'fixtureDigest',
      'representativeWindowsExecution',
      'reasonCodes',
    ];
    const actualKeys = Object.keys(value);
    const reasons = value.reasonCodes;
    if (
      actualKeys.length !== expectedKeys.length ||
      actualKeys.some((key) => !expectedKeys.includes(key)) ||
      value.schemaVersion !== 1 ||
      value.platform !== 'linux' ||
      value.activationState !== 'FailClosed' ||
      value.candidateState !== 'Pending' ||
      value.profileState !== 'Pending' ||
      value.previousPackageState !== 'Pending' ||
      value.fixtureDigest !== LOCAL_WHISPER_QUALIFICATION_FIXTURE_DIGEST ||
      value.representativeWindowsExecution !== 'NotRun' ||
      !Array.isArray(reasons) ||
      reasons.length !== PENDING_REASON_CODES.size ||
      new Set(reasons).size !== reasons.length ||
      reasons.some((reason) => typeof reason !== 'string' || !PENDING_REASON_CODES.has(reason))
    ) {
      throw new Error('QUALIFICATION_LINUX_STATE_INVALID');
    }
  }

  private validateQualifiedLinuxState(value: Record<string, unknown>): void {
    const expectedKeys = [
      'schemaVersion',
      'specificationRevision',
      'platform',
      'activationState',
      'candidateState',
      'profileState',
      'previousPackageState',
      'fixtureDigest',
      'representativeWindowsExecution',
      'candidateSemVer',
      'freezeTimestampUtc',
      'sourceCommit',
      'candidateInputDigest',
      'platformInputDigest',
      'profileDigests',
      'platformGraphDigest',
      'resultDigest',
      'evidenceIndexDigest',
      'predecessorEvidenceDigest',
      'packageDigests',
      'reasonCodes',
    ];
    const reasons = value.reasonCodes;
    const profileDigests = value.profileDigests;
    const packageDigests = value.packageDigests;
    const digestFields = [
      value.candidateInputDigest,
      value.platformInputDigest,
      value.platformGraphDigest,
      value.resultDigest,
      value.evidenceIndexDigest,
      value.predecessorEvidenceDigest,
    ];
    if (
      Object.keys(value).length !== expectedKeys.length ||
      Object.keys(value).some((key) => !expectedKeys.includes(key)) ||
      value.specificationRevision !== 10 ||
      value.platform !== 'linux' ||
      value.activationState !== 'FailClosed' ||
      value.candidateState !== 'Frozen' ||
      value.profileState !== 'Pass' ||
      value.previousPackageState !== 'Pass' ||
      value.fixtureDigest !== LOCAL_WHISPER_QUALIFICATION_FIXTURE_DIGEST ||
      value.representativeWindowsExecution !== 'NotRun' ||
      typeof value.candidateSemVer !== 'string' ||
      !SEMVER_PATTERN.test(value.candidateSemVer) ||
      typeof value.freezeTimestampUtc !== 'string' ||
      !TIMESTAMP_PATTERN.test(value.freezeTimestampUtc) ||
      !Number.isFinite(Date.parse(value.freezeTimestampUtc)) ||
      typeof value.sourceCommit !== 'string' ||
      !COMMIT_PATTERN.test(value.sourceCommit) ||
      digestFields.some((digest) => typeof digest !== 'string' || !SHA256_PATTERN.test(digest)) ||
      !Array.isArray(profileDigests) ||
      profileDigests.length !== 2 ||
      profileDigests.some((digest) => typeof digest !== 'string' || !SHA256_PATTERN.test(digest)) ||
      !Array.isArray(packageDigests) ||
      packageDigests.length !== 3 ||
      packageDigests.some((digest) => typeof digest !== 'string' || !SHA256_PATTERN.test(digest)) ||
      !Array.isArray(reasons) ||
      reasons.length !== QUALIFIED_REASON_CODES.size ||
      new Set(reasons).size !== reasons.length ||
      reasons.some((reason) => typeof reason !== 'string' || !QUALIFIED_REASON_CODES.has(reason))
    ) {
      throw new Error('QUALIFICATION_LINUX_STATE_INVALID');
    }
    assertSortedUnique(profileDigests as string[], 'QUALIFICATION_LINUX_STATE_INVALID');
    assertSortedUnique(packageDigests as string[], 'QUALIFICATION_LINUX_STATE_INVALID');
  }
}
