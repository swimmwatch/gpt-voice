import { createHash } from 'node:crypto';
import { lstat, readdir } from 'node:fs/promises';
import * as path from 'node:path';

import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

import { readVerifiedRegularFile } from '../../SecureFileReader';

const REPORT_SCHEMA_VERSION = 1;
const REPORT_MAXIMUM_BYTES = 16 * 1024;
const REPORT_LIMIT = 32;
const FRESHNESS_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ADVISORY_ID_PATTERN = /^[\w.:-]{1,128}$/u;
const REPORT_FILE_PATTERN = /^report-([a-f0-9]{64})\.json$/u;

const EXPECTED_LOCKS = Object.freeze([
  Object.freeze({
    lockId: 'googletest-v1.17.0-52eb810',
    releaseTag: 'v1.17.0',
    repository: 'https://github.com/google/googletest.git',
    revision: '52eb8108c5bdec04579160ae17225d66034bd723',
  }),
  Object.freeze({
    lockId: 'nlohmann-json-v3.12.0-subset',
    releaseTag: 'v3.12.0',
    repository: 'https://github.com/nlohmann/json.git',
    revision: '55f93686c01528224f448c19128836e7df245f72',
  }),
  Object.freeze({
    lockId: 'whisper-cpp-v1.9.1-f049fff',
    releaseTag: 'v1.9.1',
    repository: 'https://github.com/ggml-org/whisper.cpp.git',
    revision: 'f049fff95a089aa9969deb009cdd4892b3e74916',
  }),
]);

const RESULTS = Object.freeze(['unaffected', 'affected', 'unresolved', 'unavailable', 'malformed'] as const);
type AdvisoryResult = (typeof RESULTS)[number];

interface AdvisorySourceRecord {
  readonly advisoryIds: readonly string[];
  readonly mappingBasis: string;
  readonly provenanceSha256: string | null;
  readonly result: AdvisoryResult;
}

interface AdvisoryLockRecord {
  readonly lockId: string;
  readonly releaseTag: string;
  readonly repository: string;
  readonly result: AdvisoryResult;
  readonly revision: string;
  readonly sources: readonly [AdvisorySourceRecord, AdvisorySourceRecord];
}

interface AdvisoryReport {
  readonly locks: readonly [AdvisoryLockRecord, AdvisoryLockRecord, AdvisoryLockRecord];
  readonly reportDigest: string;
  readonly result: AdvisoryResult;
  readonly scannedAt: string;
  readonly schemaVersion: number;
}

export interface VerifiedNativeSourceAdvisoryEvidence {
  readonly reportDigest: string;
  readonly scannedAt: string;
}

function fail(code: string): never {
  throw new Error(`NATIVE_ADVISORY_EVIDENCE_${code}`);
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(code);
  return value as Readonly<Record<string, unknown>>;
}

function exactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[], code: string): void {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, 'en'));
  const sortedExpected = [...expected].sort((left, right) => left.localeCompare(right, 'en'));
  if (JSON.stringify(actual) !== JSON.stringify(sortedExpected)) fail(code);
}

function string(value: unknown, code: string): string {
  if (typeof value !== 'string') fail(code);
  return value;
}

function status(value: unknown, code: string): AdvisoryResult {
  if (typeof value !== 'string' || !RESULTS.includes(value as AdvisoryResult)) fail(code);
  return value as AdvisoryResult;
}

function digest(value: unknown, code: string): string {
  const result = string(value, code);
  if (!SHA256_PATTERN.test(result)) fail(code);
  return result;
}

function timestamp(value: unknown, code: string): string {
  const result = string(value, code);
  if (!TIMESTAMP_PATTERN.test(result) || !Number.isFinite(Date.parse(result))) fail(code);
  return result;
}

function orderedUniqueAdvisoryIds(value: unknown, code: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 16 || value.some((entry) => typeof entry !== 'string')) fail(code);
  const result = value as readonly string[];
  if (
    result.some((entry) => !ADVISORY_ID_PATTERN.test(entry)) ||
    JSON.stringify(result) !== JSON.stringify([...result].sort((left, right) => left.localeCompare(right, 'en'))) ||
    new Set(result).size !== result.length
  ) {
    fail(code);
  }
  return Object.freeze([...result]);
}

function resultPriority(value: AdvisoryResult): number {
  return { unaffected: 0, unresolved: 2, affected: 3, unavailable: 4, malformed: 5 }[value];
}

function worstResult(values: readonly AdvisoryResult[]): AdvisoryResult {
  if (values.length === 0) fail('RESULT_INVALID');
  return values.reduce((worst, candidate) => (resultPriority(candidate) > resultPriority(worst) ? candidate : worst));
}

function expectedMapping(sourceId: 'osv-v1-querybatch' | 'github-rest-git-tag-v1', result: AdvisoryResult): string {
  const mappings =
    sourceId === 'osv-v1-querybatch'
      ? {
          affected: 'exact-commit-query',
          malformed: 'source-malformed',
          unavailable: 'source-unavailable',
          unaffected: 'exact-commit-query',
          unresolved: 'version-range-only',
        }
      : {
          affected: 'tag-target-commit',
          malformed: 'source-malformed',
          unavailable: 'source-unavailable',
          unaffected: 'tag-target-commit',
          unresolved: 'tag-target-mismatch',
        };
  return mappings[result];
}

function source(value: unknown, sourceId: 'osv-v1-querybatch' | 'github-rest-git-tag-v1'): AdvisorySourceRecord {
  const result = record(value, 'SOURCE_INVALID');
  exactKeys(result, ['advisoryIds', 'mappingBasis', 'provenanceSha256', 'result'], 'SOURCE_INVALID');
  const normalizedResult = status(result.result, 'SOURCE_INVALID');
  const provenance = result.provenanceSha256;
  if (
    result.mappingBasis !== expectedMapping(sourceId, normalizedResult) ||
    (['unavailable', 'malformed'].includes(normalizedResult)
      ? provenance !== null
      : typeof provenance !== 'string' || !SHA256_PATTERN.test(provenance))
  ) {
    fail('SOURCE_PROVENANCE_INVALID');
  }
  const provenanceSha256 = ['unavailable', 'malformed'].includes(normalizedResult)
    ? null
    : digest(provenance, 'SOURCE_PROVENANCE_INVALID');
  const advisoryIds = orderedUniqueAdvisoryIds(result.advisoryIds, 'SOURCE_INVALID');
  if (sourceId === 'github-rest-git-tag-v1' && advisoryIds.length !== 0) fail('SOURCE_INVALID');
  return Object.freeze({
    advisoryIds,
    mappingBasis: String(result.mappingBasis),
    provenanceSha256,
    result: normalizedResult,
  });
}

function lock(value: unknown, expected: (typeof EXPECTED_LOCKS)[number]): AdvisoryLockRecord {
  const result = record(value, 'LOCK_INVALID');
  exactKeys(result, ['lockId', 'releaseTag', 'repository', 'result', 'revision', 'sources'], 'LOCK_INVALID');
  if (
    result.lockId !== expected.lockId ||
    result.releaseTag !== expected.releaseTag ||
    result.repository !== expected.repository ||
    result.revision !== expected.revision ||
    !Array.isArray(result.sources) ||
    result.sources.length !== 2
  ) {
    fail('LOCK_IDENTITY_INVALID');
  }
  const sources = Object.freeze([
    source(result.sources[0], 'osv-v1-querybatch'),
    source(result.sources[1], 'github-rest-git-tag-v1'),
  ]) as AdvisoryLockRecord['sources'];
  const normalizedResult = status(result.result, 'LOCK_INVALID');
  if (normalizedResult !== worstResult(sources.map((entry) => entry.result))) fail('LOCK_RESULT_INVALID');
  return Object.freeze({ ...expected, result: normalizedResult, sources });
}

function report(value: unknown): AdvisoryReport {
  const result = record(value, 'REPORT_INVALID');
  exactKeys(result, ['locks', 'reportDigest', 'result', 'scannedAt', 'schemaVersion'], 'REPORT_INVALID');
  if (
    result.schemaVersion !== REPORT_SCHEMA_VERSION ||
    !Array.isArray(result.locks) ||
    result.locks.length !== EXPECTED_LOCKS.length
  ) {
    fail('REPORT_INVALID');
  }
  const locks = Object.freeze(
    result.locks.map((entry, index) => lock(entry, EXPECTED_LOCKS[index])),
  ) as AdvisoryReport['locks'];
  const normalizedResult = status(result.result, 'REPORT_INVALID');
  const scannedAt = timestamp(result.scannedAt, 'REPORT_INVALID');
  const reportDigest = digest(result.reportDigest, 'REPORT_INVALID');
  if (normalizedResult !== worstResult(locks.map((entry) => entry.result))) fail('REPORT_RESULT_INVALID');
  const unsigned = { locks, result: normalizedResult, scannedAt, schemaVersion: REPORT_SCHEMA_VERSION };
  if (createHash('sha256').update(serializeCanonicalLocalWhisperCatalogJson(unsigned)).digest('hex') !== reportDigest) {
    fail('REPORT_DIGEST_INVALID');
  }
  return Object.freeze({
    locks,
    reportDigest,
    result: normalizedResult,
    scannedAt,
    schemaVersion: REPORT_SCHEMA_VERSION,
  });
}

async function readReport(directory: string, fileName: string): Promise<AdvisoryReport> {
  const match = REPORT_FILE_PATTERN.exec(fileName);
  if (!match) fail('FILE_NAME_INVALID');
  const filePath = path.join(directory, fileName);
  const [metadata, file] = await Promise.all([lstat(filePath), readVerifiedRegularFile(filePath)]);
  if (!metadata.isFile() || metadata.isSymbolicLink() || file.sizeBytes <= 0 || file.sizeBytes > REPORT_MAXIMUM_BYTES) {
    fail('FILE_INVALID');
  }
  let text: string;
  let parsed: unknown;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(file.bytes);
    parsed = JSON.parse(text) as unknown;
  } catch {
    fail('FILE_INVALID');
  }
  if (serializeCanonicalLocalWhisperCatalogJson(parsed) !== text) fail('FILE_NONCANONICAL');
  const result = report(parsed);
  if (result.reportDigest !== match[1]) fail('FILE_DIGEST_INVALID');
  return result;
}

/** Validates retained, privacy-safe advisory evidence before a platform qualification begins. */
export class NativeSourceAdvisoryEvidenceVerifier {
  public async verify(
    evidenceDirectory: string,
    qualificationStart: Date = new Date(),
  ): Promise<VerifiedNativeSourceAdvisoryEvidence> {
    if (!Number.isFinite(qualificationStart.getTime())) fail('CLOCK_INVALID');
    const directory = path.resolve(evidenceDirectory);
    const [directoryMetadata, entries] = await Promise.all([
      lstat(directory),
      readdir(directory, { withFileTypes: true }),
    ]).catch(() => fail('DIRECTORY_UNAVAILABLE'));
    if (
      !directoryMetadata.isDirectory() ||
      directoryMetadata.isSymbolicLink() ||
      entries.length === 0 ||
      entries.length > REPORT_LIMIT ||
      entries.some((entry) => !entry.isFile() || entry.isSymbolicLink() || !REPORT_FILE_PATTERN.test(entry.name))
    ) {
      fail('DIRECTORY_INVALID');
    }
    const reports = await Promise.all(entries.map((entry) => readReport(directory, entry.name)));
    reports.sort((left, right) => left.scannedAt.localeCompare(right.scannedAt, 'en'));
    if (reports.some((entry, index) => index > 0 && entry.scannedAt === reports[index - 1]?.scannedAt))
      fail('ORDER_INVALID');
    const start = qualificationStart.getTime();
    if (reports.some((entry) => Date.parse(entry.scannedAt) > start)) fail('CLOCK_AMBIGUOUS');
    const clean = reports.filter((entry) => entry.result === 'unaffected').pop();
    if (!clean) fail('NO_CLEAN_REPORT');
    if (start - Date.parse(clean.scannedAt) > FRESHNESS_MILLISECONDS) fail('STALE');
    const later = reports.filter((entry) => entry.scannedAt > clean.scannedAt);
    if (later.some((entry) => ['affected', 'unresolved', 'malformed'].includes(entry.result)))
      fail('LATER_ADVERSE_RESULT');
    return Object.freeze({ reportDigest: clean.reportDigest, scannedAt: clean.scannedAt });
  }
}
