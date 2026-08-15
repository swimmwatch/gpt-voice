import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

import { NativeSourceAdvisoryEvidenceVerifier } from '@scripts/local-whisper/qualification/NativeSourceAdvisoryEvidence';

const TARGETS = Object.freeze([
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

type Result = 'unaffected' | 'affected' | 'unresolved' | 'unavailable' | 'malformed';

function digest(value: unknown): string {
  return createHash('sha256').update(serializeCanonicalLocalWhisperCatalogJson(value)).digest('hex');
}

function mapping(source: 'advisory' | 'release', result: Result): string {
  const mappings =
    source === 'advisory'
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

function source(kind: 'advisory' | 'release', result: Result, advisoryIds: readonly string[] = []) {
  return {
    advisoryIds,
    mappingBasis: mapping(kind, result),
    provenanceSha256: ['unavailable', 'malformed'].includes(result) ? null : 'a'.repeat(64),
    result,
  };
}

function priority(result: Result): number {
  return { unaffected: 0, unresolved: 2, unavailable: 4, malformed: 5, affected: 6 }[result];
}

function report(scannedAt: string, advisoryResult: Result = 'unaffected', releaseResult: Result = 'unaffected') {
  const result = priority(advisoryResult) > priority(releaseResult) ? advisoryResult : releaseResult;
  const locks = TARGETS.map((target) => ({
    ...target,
    result,
    sources: [
      source('advisory', advisoryResult, advisoryResult === 'affected' ? ['GHSA-test-0001'] : []),
      source('release', releaseResult),
    ],
  }));
  const unsigned = { locks, result, scannedAt, schemaVersion: 1 };
  return { ...unsigned, reportDigest: digest(unsigned) };
}

async function writeReport(directory: string, value: ReturnType<typeof report>): Promise<void> {
  await writeFile(
    path.join(directory, `report-${value.reportDigest}.json`),
    serializeCanonicalLocalWhisperCatalogJson(value),
    'utf8',
  );
}

async function withEvidence(action: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-advisory-'));
  try {
    await action(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

describe('Native source advisory qualification evidence', () => {
  it('accepts a fresh unaffected canonical report at the seven-day boundary', async () => {
    await withEvidence(async (directory) => {
      const value = report('2026-08-06T12:00:00.000Z');
      await writeReport(directory, value);

      const verified = await new NativeSourceAdvisoryEvidenceVerifier().verify(
        directory,
        new Date('2026-08-13T12:00:00.000Z'),
      );
      assert.deepEqual(verified, { reportDigest: value.reportDigest, scannedAt: value.scannedAt });
    });
  });

  it('allows a later unavailable report only while the last clean report remains fresh', async () => {
    await withEvidence(async (directory) => {
      const clean = report('2026-08-10T12:00:00.000Z');
      await writeReport(directory, clean);
      await writeReport(directory, report('2026-08-12T12:00:00.000Z', 'unavailable'));

      const verified = await new NativeSourceAdvisoryEvidenceVerifier().verify(
        directory,
        new Date('2026-08-13T12:00:00.000Z'),
      );
      assert.equal(verified.reportDigest, clean.reportDigest);
    });
  });

  for (const [name, reports, expected] of [
    ['stale evidence', [report('2026-08-05T11:59:59.999Z')], /STALE/u],
    [
      'later affected result',
      [report('2026-08-10T12:00:00.000Z'), report('2026-08-12T12:00:00.000Z', 'affected')],
      /LATER_ADVERSE_RESULT/u,
    ],
    [
      'later affected result with an unavailable secondary source',
      [report('2026-08-10T12:00:00.000Z'), report('2026-08-12T12:00:00.000Z', 'affected', 'unavailable')],
      /LATER_ADVERSE_RESULT/u,
    ],
    [
      'later unresolved result',
      [report('2026-08-10T12:00:00.000Z'), report('2026-08-12T12:00:00.000Z', 'unresolved')],
      /LATER_ADVERSE_RESULT/u,
    ],
    ['future clock', [report('2026-08-14T12:00:00.000Z')], /CLOCK_AMBIGUOUS/u],
  ] as const) {
    it(`fails closed for ${name}`, async () => {
      await withEvidence(async (directory) => {
        for (const value of reports) await writeReport(directory, value);
        await assert.rejects(
          () => new NativeSourceAdvisoryEvidenceVerifier().verify(directory, new Date('2026-08-13T12:00:00.000Z')),
          expected,
        );
      });
    });
  }

  it('rejects a tampered report before using it as evidence', async () => {
    await withEvidence(async (directory) => {
      const value = report('2026-08-12T12:00:00.000Z');
      await writeReport(directory, value);
      await writeFile(path.join(directory, `report-${value.reportDigest}.json`), '{"token":"synthetic"}', 'utf8');

      await assert.rejects(
        () => new NativeSourceAdvisoryEvidenceVerifier().verify(directory, new Date('2026-08-13T12:00:00.000Z')),
        /REPORT_INVALID/u,
      );
    });
  });
});
