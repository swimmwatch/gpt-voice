import { request as httpsRequest } from 'node:https';
import { join, resolve } from 'node:path';
import { TextDecoder } from 'node:util';

import { canonicalDigest, canonicalJson, sha256, verifySourceLock } from './native-source-core.mjs';
import { readVerifiedRegularFileSync } from '../secure-file-reader.mjs';

export const ADVISORY_REPORT_MAX_BYTES = 16 * 1024;
export const ADVISORY_REPORT_SCHEMA_VERSION = 1;
export const ADVISORY_SCAN_TIMEOUT_MILLISECONDS = 15_000;
export const OSV_SOURCE_ID = 'osv-v1-querybatch';
export const GITHUB_SOURCE_ID = 'github-rest-git-tag-v1';

const SOURCE_RESPONSE_MAX_BYTES = 256 * 1024;
const LOCK_FILE_MAX_BYTES = 1024 * 1024;
const GIT_OID_PATTERN = /^[a-f0-9]{40}$/u;
const ADVISORY_ID_PATTERN = /^[\w.:-]{1,128}$/u;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const REPORT_RESULT_PRIORITY = Object.freeze({
  affected: 3,
  malformed: 5,
  unavailable: 4,
  unaffected: 0,
  unresolved: 2,
});

export const LOCKED_SOURCE_ADVISORY_TARGETS = Object.freeze([
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

export class AdvisorySourceError extends Error {
  constructor(kind) {
    super(kind);
    this.kind = kind;
  }
}

function record(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new AdvisorySourceError('malformed');
  return value;
}

function string(value) {
  if (typeof value !== 'string') throw new AdvisorySourceError('malformed');
  return value;
}

function sourceResult(result, mappingBasis, advisoryIds, provenanceSha256) {
  return Object.freeze({
    advisoryIds: Object.freeze([...advisoryIds]),
    mappingBasis,
    provenanceSha256,
    result,
  });
}

function worstResult(results) {
  return results.reduce((worst, candidate) =>
    REPORT_RESULT_PRIORITY[candidate] > REPORT_RESULT_PRIORITY[worst] ? candidate : worst,
  );
}

function uniqueSortedAdvisoryIds(vulnerabilities) {
  if (vulnerabilities.length > 16) throw new AdvisorySourceError('malformed');
  const ids = vulnerabilities.map((vulnerability) => {
    const id = string(record(vulnerability, 'advisory').id, 'id');
    if (!ADVISORY_ID_PATTERN.test(id)) throw new AdvisorySourceError('malformed');
    return id;
  });
  const sorted = [...new Set(ids)].sort((left, right) => left.localeCompare(right, 'en'));
  if (sorted.length !== ids.length) throw new AdvisorySourceError('malformed');
  return Object.freeze(sorted);
}

function hasVersionRangeOnly(vulnerability) {
  const affected = record(vulnerability, 'advisory').affected;
  if (!Array.isArray(affected) || affected.length === 0) return false;
  const ranges = affected.flatMap((entry) => {
    const entryRecord = record(entry, 'affected');
    if (!Array.isArray(entryRecord.ranges)) throw new AdvisorySourceError('malformed');
    return entryRecord.ranges;
  });
  if (ranges.length === 0) return false;
  let hasVersionRange = false;
  for (const range of ranges) {
    const type = string(record(range, 'range').type, 'type');
    if (type === 'GIT') return false;
    if (type === 'SEMVER' || type === 'ECOSYSTEM') hasVersionRange = true;
    else throw new AdvisorySourceError('malformed');
  }
  return hasVersionRange;
}

function normalizeOsvResult(value, provenanceSha256) {
  const result = record(value, 'osv result');
  const keys = Object.keys(result);
  if (keys.length === 0) return sourceResult('unaffected', 'exact-commit-query', [], provenanceSha256);
  if (keys.length !== 1 || !Array.isArray(result.vulns)) throw new AdvisorySourceError('malformed');
  if (result.vulns.length === 0) return sourceResult('unaffected', 'exact-commit-query', [], provenanceSha256);
  const advisoryIds = uniqueSortedAdvisoryIds(result.vulns);
  if (result.vulns.some(hasVersionRangeOnly)) {
    return sourceResult('unresolved', 'version-range-only', advisoryIds, provenanceSha256);
  }
  return sourceResult('affected', 'exact-commit-query', advisoryIds, provenanceSha256);
}

function githubRepositoryPath(target) {
  const match = /^https:\/\/github\.com\/([a-z0-9-]+)\/([\w.-]+)\.git$/u.exec(target.repository);
  if (!match) throw new Error('Locked advisory repository is not a canonical GitHub repository');
  return `${match[1]}/${match[2]}`;
}

function githubTagUrl(target) {
  return `https://api.github.com/repos/${githubRepositoryPath(target)}/git/ref/tags/${target.releaseTag}`;
}

function githubAnnotatedTagUrl(target, tagObject) {
  if (!GIT_OID_PATTERN.test(tagObject)) throw new AdvisorySourceError('malformed');
  return `https://api.github.com/repos/${githubRepositoryPath(target)}/git/tags/${tagObject}`;
}

function parseTagReference(value, target) {
  const reference = record(value, 'github tag reference');
  const object = record(reference.object, 'github tag object');
  const type = string(object.type, 'github tag object type');
  const sha = string(object.sha, 'github tag object sha');
  if (
    reference.ref !== `refs/tags/${target.releaseTag}` ||
    !GIT_OID_PATTERN.test(sha) ||
    !['commit', 'tag'].includes(type)
  ) {
    throw new AdvisorySourceError('malformed');
  }
  return Object.freeze({ sha, type });
}

function parseAnnotatedTag(value) {
  const tag = record(value, 'github annotated tag');
  const object = record(tag.object, 'github annotated tag object');
  const type = string(object.type, 'github annotated tag object type');
  const sha = string(object.sha, 'github annotated tag object sha');
  if (type !== 'commit' || !GIT_OID_PATTERN.test(sha)) throw new AdvisorySourceError('malformed');
  return sha;
}

function combineProvenance(first, second) {
  return sha256(Buffer.from(`${first}\n${second}`, 'ascii'));
}

function parseCanonicalJson(bytes, maximumBytes) {
  if (bytes.byteLength === 0 || bytes.byteLength > maximumBytes) throw new AdvisorySourceError('malformed');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return Object.freeze({ text, value: JSON.parse(text) });
  } catch {
    throw new AdvisorySourceError('malformed');
  }
}

function lockPath(workspaceRoot, lockId) {
  return join(workspaceRoot, 'runtime', 'local-whisper', 'sources', 'locks', `${lockId}.json`);
}

function readLockedTargets(workspaceRoot) {
  const canonicalWorkspaceRoot = resolve(workspaceRoot);
  return Object.freeze(
    LOCKED_SOURCE_ADVISORY_TARGETS.map((target) => {
      const { bytes } = readVerifiedRegularFileSync(lockPath(canonicalWorkspaceRoot, target.lockId));
      const lock = parseCanonicalJson(bytes, LOCK_FILE_MAX_BYTES).value;
      verifySourceLock(lock);
      if (lock.lockId !== target.lockId || lock.repository !== target.repository || lock.commit !== target.revision) {
        throw new Error('Native advisory lock identity mismatch');
      }
      return Object.freeze({ ...target });
    }),
  );
}

function timestamp(value) {
  const result = value.toISOString();
  if (!TIMESTAMP_PATTERN.test(result)) throw new Error('Advisory clock did not provide a canonical timestamp');
  return result;
}

/** Uses public HTTPS JSON endpoints without credentials, redirects, or unbounded response bodies. */
export class CredentialFreeAdvisoryTransport {
  async request(input) {
    const url = new URL(input.url);
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
      throw new AdvisorySourceError('malformed');
    }
    const requestBody = input.body === null ? null : Buffer.from(canonicalJson(input.body), 'utf8');
    return await new Promise((resolve, reject) => {
      const clientRequest = httpsRequest(
        url,
        {
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'identity',
            ...(requestBody
              ? { 'Content-Length': String(requestBody.byteLength), 'Content-Type': 'application/json' }
              : {}),
            'User-Agent': 'gpt-voice-native-advisory-monitor/1',
          },
          method: input.method,
          timeout: ADVISORY_SCAN_TIMEOUT_MILLISECONDS,
        },
        (response) => {
          const contentLength = response.headers['content-length'];
          const contentEncoding = response.headers['content-encoding'];
          const contentType = response.headers['content-type'];
          if (
            (typeof contentLength === 'string' &&
              (!/^\d+$/u.test(contentLength) || Number(contentLength) > SOURCE_RESPONSE_MAX_BYTES)) ||
            (contentEncoding !== undefined && contentEncoding !== 'identity') ||
            typeof contentType !== 'string' ||
            !contentType.toLowerCase().startsWith('application/json') ||
            (response.statusCode ?? 0) < 200 ||
            (response.statusCode ?? 0) >= 300
          ) {
            response.resume();
            reject(new AdvisorySourceError((response.statusCode ?? 0) >= 400 ? 'unavailable' : 'malformed'));
            return;
          }
          const chunks = [];
          let byteLength = 0;
          response.on('data', (chunk) => {
            const bytes = Buffer.from(chunk);
            byteLength += bytes.byteLength;
            if (byteLength > SOURCE_RESPONSE_MAX_BYTES) {
              response.destroy();
              reject(new AdvisorySourceError('malformed'));
              return;
            }
            chunks.push(bytes);
          });
          response.once('error', () => reject(new AdvisorySourceError('unavailable')));
          response.once('end', () => {
            try {
              const bytes = Buffer.concat(chunks);
              resolve(
                Object.freeze({
                  provenanceSha256: sha256(bytes),
                  value: parseCanonicalJson(bytes, SOURCE_RESPONSE_MAX_BYTES).value,
                }),
              );
            } catch (error) {
              reject(error instanceof AdvisorySourceError ? error : new AdvisorySourceError('malformed'));
            }
          });
        },
      );
      clientRequest.once('timeout', () => clientRequest.destroy(new AdvisorySourceError('unavailable')));
      clientRequest.once('error', () => reject(new AdvisorySourceError('unavailable')));
      if (requestBody) clientRequest.write(requestBody);
      clientRequest.end();
    });
  }
}

async function scanReleaseTarget(transport, target) {
  try {
    const first = await transport.request({ body: null, method: 'GET', url: githubTagUrl(target) });
    const reference = parseTagReference(first.value, target);
    const resolved =
      reference.type === 'commit'
        ? Object.freeze({ provenanceSha256: first.provenanceSha256, revision: reference.sha })
        : await transport
            .request({ body: null, method: 'GET', url: githubAnnotatedTagUrl(target, reference.sha) })
            .then((second) =>
              Object.freeze({
                provenanceSha256: combineProvenance(first.provenanceSha256, second.provenanceSha256),
                revision: parseAnnotatedTag(second.value),
              }),
            );
    return sourceResult(
      resolved.revision === target.revision ? 'unaffected' : 'unresolved',
      resolved.revision === target.revision ? 'tag-target-commit' : 'tag-target-mismatch',
      [],
      resolved.provenanceSha256,
    );
  } catch (error) {
    if (!(error instanceof AdvisorySourceError)) throw error;
    return sourceResult(error.kind, error.kind === 'unavailable' ? 'source-unavailable' : 'source-malformed', [], null);
  }
}

async function scanOsv(transport, targets) {
  try {
    const source = await transport.request({
      body: { queries: targets.map((target) => ({ commit: target.revision })) },
      method: 'POST',
      url: 'https://api.osv.dev/v1/querybatch',
    });
    const response = record(source.value, 'osv batch');
    if (
      Object.keys(response).length !== 1 ||
      !Array.isArray(response.results) ||
      response.results.length !== targets.length
    ) {
      throw new AdvisorySourceError('malformed');
    }
    return Object.freeze(response.results.map((result) => normalizeOsvResult(result, source.provenanceSha256)));
  } catch (error) {
    if (!(error instanceof AdvisorySourceError)) throw error;
    return Object.freeze(
      targets.map(() =>
        sourceResult(error.kind, error.kind === 'unavailable' ? 'source-unavailable' : 'source-malformed', [], null),
      ),
    );
  }
}

function buildReport(scannedAt, locks) {
  const result = worstResult(locks.map((lock) => lock.result));
  const unsigned = Object.freeze({
    locks: Object.freeze(locks),
    result,
    scannedAt,
    schemaVersion: ADVISORY_REPORT_SCHEMA_VERSION,
  });
  const report = Object.freeze({ ...unsigned, reportDigest: canonicalDigest(unsigned) });
  const encoded = Buffer.from(canonicalJson(report), 'utf8');
  if (encoded.byteLength > ADVISORY_REPORT_MAX_BYTES) throw new Error('Native advisory report exceeded its bound');
  return report;
}

/** Creates a canonical, privacy-safe advisory report for exactly the reviewed native locks. */
export class NativeSourceAdvisoryScanner {
  constructor(transport = new CredentialFreeAdvisoryTransport(), clock = () => new Date()) {
    this.transport = transport;
    this.clock = clock;
  }

  async scan(workspaceRoot) {
    const targets = readLockedTargets(workspaceRoot);
    const osvResults = await scanOsv(this.transport, targets);
    const releaseResults = await Promise.all(targets.map((target) => scanReleaseTarget(this.transport, target)));
    const locks = targets.map((target, index) => {
      const sources = Object.freeze([osvResults[index], releaseResults[index]]);
      return Object.freeze({
        lockId: target.lockId,
        releaseTag: target.releaseTag,
        repository: target.repository,
        result: worstResult(sources.map((source) => source.result)),
        revision: target.revision,
        sources,
      });
    });
    return buildReport(timestamp(this.clock()), locks);
  }
}

export function canonicalAdvisoryReportJson(report) {
  return canonicalJson(report);
}

export function isCleanAdvisoryReport(report) {
  return report?.result === 'unaffected';
}
