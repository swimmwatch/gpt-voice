import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import {
  AdvisorySourceError,
  canonicalAdvisoryReportJson,
  LOCKED_SOURCE_ADVISORY_TARGETS,
  NativeSourceAdvisoryScanner,
} from '../../../../scripts/local-whisper/source-import/native-source-advisory-core.mjs';
import { canonicalJson, sha256 } from '../../../../scripts/local-whisper/source-import/native-source-core.mjs';

const WORKSPACE_ROOT = resolve(import.meta.dirname, '../../../..');
const SCANNED_AT = '2026-08-13T12:00:00.000Z';

function response(value) {
  return Object.freeze({ provenanceSha256: sha256(Buffer.from(canonicalJson(value), 'utf8')), value });
}

function tagResponse(target, commit = target.revision) {
  return {
    object: { sha: commit, type: 'commit' },
    ref: `refs/tags/${target.releaseTag}`,
  };
}

function annotatedTagResponse(target) {
  return { object: { sha: 'a'.repeat(40), type: 'tag' }, ref: `refs/tags/${target.releaseTag}` };
}

class FixtureTransport {
  constructor(options = {}) {
    this.options = options;
  }

  async request(input) {
    if (input.url === 'https://api.osv.dev/v1/querybatch') {
      if (this.options.osvError) throw this.options.osvError;
      return response(this.options.osv ?? { results: [{}, {}, {}] });
    }
    const target = LOCKED_SOURCE_ADVISORY_TARGETS.find((candidate) =>
      input.url.endsWith(`/tags/${candidate.releaseTag}`),
    );
    if (target) {
      if (this.options.tagError) throw this.options.tagError;
      if (target.lockId === 'nlohmann-json-v3.12.0-subset' && this.options.annotated !== false) {
        return response(annotatedTagResponse(target));
      }
      return response(tagResponse(target, this.options.tagCommit ?? target.revision));
    }
    if (input.url.endsWith(`/tags/${'a'.repeat(40)}`)) {
      const target = LOCKED_SOURCE_ADVISORY_TARGETS.find(
        (candidate) => candidate.lockId === 'nlohmann-json-v3.12.0-subset',
      );
      return response({ object: { sha: target.revision, type: 'commit' }, tag: target.releaseTag });
    }
    throw new Error('Unexpected fixture URL');
  }
}

function scanner(options = {}) {
  return new NativeSourceAdvisoryScanner(new FixtureTransport(options), () => new Date(SCANNED_AT));
}

describe('Native source advisory scanner', () => {
  it('reads exactly the three reviewed locks and resolves direct and annotated release tags', async () => {
    const report = await scanner().scan(WORKSPACE_ROOT);

    assert.equal(report.result, 'unaffected');
    assert.deepEqual(
      report.locks.map((entry) => entry.lockId),
      LOCKED_SOURCE_ADVISORY_TARGETS.map((entry) => entry.lockId),
    );
    assert.deepEqual(
      report.locks.map((entry) => entry.result),
      ['unaffected', 'unaffected', 'unaffected'],
    );
    assert.match(canonicalAdvisoryReportJson(report), /"reportDigest":"[a-f0-9]{64}"/u);
    assert.ok(Buffer.byteLength(canonicalAdvisoryReportJson(report), 'utf8') <= 16 * 1024);
  });

  it('classifies an exact commit advisory as affected', async () => {
    const report = await scanner({ osv: { results: [{ vulns: [{ id: 'GHSA-test-0001' }] }, {}, {}] } }).scan(
      WORKSPACE_ROOT,
    );

    assert.equal(report.result, 'affected');
    assert.equal(report.locks[0].sources[0].mappingBasis, 'exact-commit-query');
    assert.deepEqual(report.locks[0].sources[0].advisoryIds, ['GHSA-test-0001']);
  });

  it('rejects version-range-only advisory evidence as unresolved', async () => {
    const report = await scanner({
      osv: {
        results: [{ vulns: [{ affected: [{ ranges: [{ type: 'SEMVER' }] }], id: 'GHSA-test-0002' }] }, {}, {}],
      },
    }).scan(WORKSPACE_ROOT);

    assert.equal(report.result, 'unresolved');
    assert.equal(report.locks[0].sources[0].mappingBasis, 'version-range-only');
  });

  it('normalizes unavailable, malformed, and release-mismatch sources without retaining raw transport data', async () => {
    const unavailable = await scanner({ osvError: new AdvisorySourceError('unavailable') }).scan(WORKSPACE_ROOT);
    const malformed = await scanner({ osv: { result: [] } }).scan(WORKSPACE_ROOT);
    const mismatch = await scanner({ annotated: false, tagCommit: 'b'.repeat(40) }).scan(WORKSPACE_ROOT);

    assert.equal(unavailable.result, 'unavailable');
    assert.equal(malformed.result, 'malformed');
    assert.equal(mismatch.result, 'unresolved');
    assert.doesNotMatch(canonicalAdvisoryReportJson(malformed), /raw|token|\/home\//iu);
  });
});
