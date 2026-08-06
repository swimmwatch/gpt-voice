import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { TextDecoder } from 'node:util';

import { getSourceDefinition } from './source-definitions.mjs';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GIT_OID_PATTERN = /^[a-f0-9]{40}$/u;
const SAFE_LOCK_ID_PATTERN = /^[a-z0-9][a-z0-9.-]{0,127}$/u;
const WINDOWS_DEVICE_PATTERN = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
const GIT_LFS_HEADER = 'version https://git-lfs.github.com/spec/v1\n';
const MAX_GIT_OUTPUT_BYTES = 256 * 1024 * 1024;

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function hasValidUnicodeScalars(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/** Mirrors the strict canonical JSON representation accepted by signed Local Whisper documents. */
export function canonicalCatalogJson(value) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    if (!hasValidUnicodeScalars(value)) throw new TypeError('Invalid catalog value');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new TypeError('Invalid catalog value');
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalCatalogJson(entry)).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.keys(value)
      .sort((left, right) => left.localeCompare(right, 'en'))
      .map((key) => `${canonicalCatalogJson(key)}:${canonicalCatalogJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  throw new TypeError('Invalid catalog value');
}

export function canonicalDigest(value) {
  return sha256(Buffer.from(canonicalJson(value), 'utf8'));
}

function containsControlCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd,
    encoding: options.encoding,
    env: options.env,
    input: options.input,
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
    shell: false,
    stdio: options.stdio,
  });
  if (result.error) throw new Error(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : String(result.stderr ?? '');
    throw new Error(`${command} failed (${result.status ?? 'signal'}): ${stderr.trim()}`);
  }
  return result.stdout;
}

export function runGit(repositoryRoot, arguments_, options = {}) {
  return run('git', ['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=true', ...arguments_], {
    ...options,
    cwd: repositoryRoot,
  });
}

export function validateRelativePath(candidate) {
  if (typeof candidate !== 'string' || candidate.length === 0 || Buffer.byteLength(candidate, 'utf8') > 4096) {
    throw new Error('Native source path is empty or oversized');
  }
  if (
    candidate !== candidate.normalize('NFC') ||
    containsControlCharacter(candidate) ||
    candidate.includes('\\') ||
    candidate.startsWith('/') ||
    /^[A-Za-z]:/u.test(candidate) ||
    candidate.startsWith('//')
  ) {
    throw new Error(`Unsafe native source path: ${candidate}`);
  }
  const segments = candidate.split('/');
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === '.' ||
        segment === '..' ||
        segment.endsWith('.') ||
        segment.endsWith(' ') ||
        WINDOWS_DEVICE_PATTERN.test(segment),
    )
  ) {
    throw new Error(`Unsafe native source path segment: ${candidate}`);
  }
  if (posix.normalize(candidate) !== candidate) throw new Error(`Non-canonical native source path: ${candidate}`);
  return candidate;
}

export function validateSafeSymlinkTarget(entryPath, target) {
  if (
    typeof target !== 'string' ||
    target.length === 0 ||
    Buffer.byteLength(target, 'utf8') > 4096 ||
    containsControlCharacter(target) ||
    target.includes('\\') ||
    target.startsWith('/') ||
    /^[A-Za-z]:/u.test(target) ||
    target.startsWith('//')
  ) {
    throw new Error(`Unsafe symlink target for ${entryPath}`);
  }
  const resolved = posix.normalize(posix.join(posix.dirname(entryPath), target));
  if (resolved === '..' || resolved.startsWith('../')) throw new Error(`Escaping symlink target for ${entryPath}`);
  return target;
}

function parseGitModules(contents) {
  if (!contents) return new Map();
  const result = new Map();
  let currentPath = null;
  for (const line of contents.split(/\r?\n/u)) {
    const separator = line.indexOf('=');
    if (separator < 0) continue;
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (name === 'path') {
      currentPath = validateRelativePath(value);
      continue;
    }
    if (name !== 'url' || !currentPath) continue;
    let repository = value;
    if (repository.startsWith('git@github.com:')) {
      repository = `https://github.com/${repository.slice('git@github.com:'.length)}`;
    }
    if (repository.startsWith('https://github.com/') && repository.endsWith('.git')) {
      result.set(currentPath, repository);
    } else {
      throw new Error(`Unapproved submodule origin for ${currentPath}`);
    }
    currentPath = null;
  }
  return result;
}

function parseLfsPointer(path, bytes) {
  if (!bytes.subarray(0, Buffer.byteLength(GIT_LFS_HEADER)).equals(Buffer.from(GIT_LFS_HEADER))) return null;
  const text = bytes.toString('utf8');
  const oid = /^oid (sha256:[a-f0-9]{64})$/mu.exec(text)?.[1];
  const size = /^size ([1-9]\d*)$/mu.exec(text)?.[1];
  if (!oid || !size || !Number.isSafeInteger(Number(size))) throw new Error(`Malformed Git LFS pointer: ${path}`);
  return Object.freeze({ path, oid, sizeBytes: Number(size) });
}

function bytewisePathSort(left, right) {
  return Buffer.compare(Buffer.from(left.path, 'utf8'), Buffer.from(right.path, 'utf8'));
}

function validateManifestPath(entry, state) {
  validateRelativePath(entry.path);
  if (state.exactPaths.has(entry.path)) throw new Error(`Duplicate native source path: ${entry.path}`);
  state.exactPaths.add(entry.path);
  const folded = entry.path.normalize('NFC').toLowerCase();
  if (state.foldedPaths.has(folded)) throw new Error(`Case-fold collision in native source: ${entry.path}`);
  state.foldedPaths.add(folded);
  if (state.previous !== null && bytewisePathSort({ path: state.previous }, entry) >= 0) {
    throw new Error('Native source manifest is not bytewise sorted');
  }
  state.previous = entry.path;
}

function validateRegularManifestEntry(entry, definition, state) {
  if (!['100644', '100755'].includes(entry.mode) || !Number.isSafeInteger(entry.sizeBytes)) {
    throw new Error(`Invalid regular-file metadata: ${entry.path}`);
  }
  if (!SHA256_PATTERN.test(entry.sha256 ?? '') || !GIT_OID_PATTERN.test(entry.gitObjectId ?? '')) {
    throw new Error(`Invalid regular-file identity: ${entry.path}`);
  }
  state.regularBytes += entry.sizeBytes;
  if (!Number.isSafeInteger(state.regularBytes) || state.regularBytes > definition.regularBytesCeiling) {
    throw new Error('Native source expanded-size ceiling exceeded');
  }
  if (entry.mode === '100755') state.executableCount += 1;
}

function validateSymlinkManifestEntry(entry) {
  if (entry.mode !== '120000' || entry.sizeBytes !== null || entry.sha256 !== null) {
    throw new Error(`Invalid symlink metadata: ${entry.path}`);
  }
  validateSafeSymlinkTarget(entry.path, entry.symlinkTarget);
}

function validateGitlinkManifestEntry(entry) {
  if (
    entry.entryType !== 'gitlink' ||
    entry.mode !== '160000' ||
    entry.sizeBytes !== null ||
    entry.sha256 !== null ||
    entry.symlinkTarget !== null
  ) {
    throw new Error(`Invalid gitlink metadata: ${entry.path}`);
  }
}

function validateManifestShape(entries, definition) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('Native source manifest is empty');
  const state = {
    exactPaths: new Set(),
    executableCount: 0,
    foldedPaths: new Set(),
    previous: null,
    regularBytes: 0,
  };
  for (const entry of entries) {
    validateManifestPath(entry, state);
    if (!definition.allowedEntryTypes.includes(entry.entryType)) {
      throw new Error(`Disallowed native source entry type: ${entry.entryType}`);
    }
    if (entry.entryType === 'regular') {
      validateRegularManifestEntry(entry, definition, state);
    } else if (entry.entryType === 'symlink') {
      validateSymlinkManifestEntry(entry);
    } else {
      validateGitlinkManifestEntry(entry);
    }
  }
  if (definition.expectedPathCount !== null && entries.length !== definition.expectedPathCount) {
    throw new Error(`Native source path count mismatch: ${entries.length}`);
  }
  if (definition.expectedRegularBytes !== null && state.regularBytes !== definition.expectedRegularBytes) {
    throw new Error(`Native source byte count mismatch: ${state.regularBytes}`);
  }
  if (definition.expectedExecutableCount !== null && state.executableCount !== definition.expectedExecutableCount) {
    throw new Error(`Native source executable count mismatch: ${state.executableCount}`);
  }
  return Object.freeze({ executableCount: state.executableCount, regularBytes: state.regularBytes });
}

export function buildGitManifest(repositoryRoot, lockId) {
  const definition = getSourceDefinition(lockId);
  const commit = String(
    runGit(repositoryRoot, ['rev-parse', `${definition.commit}^{commit}`], { encoding: 'utf8' }),
  ).trim();
  const tree = String(
    runGit(repositoryRoot, ['rev-parse', `${definition.commit}^{tree}`], { encoding: 'utf8' }),
  ).trim();
  if (commit !== definition.commit || tree !== definition.gitTree) throw new Error('Pinned Git commit/tree mismatch');
  runGit(repositoryRoot, ['fsck', '--full', '--strict', '--no-dangling'], { encoding: 'utf8' });

  const output = runGit(repositoryRoot, ['ls-tree', '-r', '-z', '--full-tree', '-l', definition.gitTree]);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const subset = definition.subsetPaths ? new Set(definition.subsetPaths) : null;
  const entries = [];
  const lfsPointers = [];
  for (const rawRecord of output.subarray(0, -1).toString('binary').split('\0')) {
    const record = decoder.decode(Buffer.from(rawRecord, 'binary'));
    const match = /^(\d{6}) (blob|commit) ([a-f0-9]{40})\s+(?:-|\d+)\t(.+)$/su.exec(record);
    if (!match) throw new Error('Unexpected git ls-tree record');
    const [, mode, objectType, gitObjectId, rawPath] = match;
    const path = validateRelativePath(rawPath);
    if (subset && !subset.has(path)) continue;
    if (objectType === 'commit') {
      entries.push({
        path,
        entryType: 'gitlink',
        mode,
        gitObjectId,
        sizeBytes: null,
        sha256: null,
        symlinkTarget: null,
      });
      continue;
    }
    const bytes = runGit(repositoryRoot, ['cat-file', 'blob', gitObjectId]);
    if (mode === '120000') {
      const target = validateSafeSymlinkTarget(path, decoder.decode(bytes));
      entries.push({
        path,
        entryType: 'symlink',
        mode,
        gitObjectId,
        sizeBytes: null,
        sha256: null,
        symlinkTarget: target,
      });
      continue;
    }
    if (mode !== '100644' && mode !== '100755') throw new Error(`Unexpected Git mode ${mode}: ${path}`);
    const pointer = parseLfsPointer(path, bytes);
    if (pointer) lfsPointers.push(pointer);
    entries.push({
      path,
      entryType: 'regular',
      mode,
      gitObjectId,
      sizeBytes: bytes.byteLength,
      sha256: sha256(bytes),
      symlinkTarget: null,
    });
  }
  entries.sort(bytewisePathSort);
  if (subset && entries.length !== subset.size) throw new Error('Explicit source subset is incomplete');
  const counts = validateManifestShape(entries, definition);

  let gitModules = '';
  try {
    gitModules = String(runGit(repositoryRoot, ['show', `${definition.commit}:.gitmodules`], { encoding: 'utf8' }));
  } catch {
    // A proven-absent .gitmodules file is represented by an empty map.
  }
  const submoduleOrigins = parseGitModules(gitModules);
  const gitlinks = entries
    .filter((entry) => entry.entryType === 'gitlink')
    .map((entry) => {
      const repository = submoduleOrigins.get(entry.path);
      if (!repository) throw new Error(`Gitlink has no allowlisted .gitmodules origin: ${entry.path}`);
      return Object.freeze({
        path: entry.path,
        commit: entry.gitObjectId,
        repository,
        status: 'recorded-for-later-lock',
      });
    });
  if (submoduleOrigins.size !== gitlinks.length) throw new Error('Unmatched .gitmodules entries');
  return Object.freeze({
    entries: Object.freeze(entries),
    executableCount: counts.executableCount,
    regularBytes: counts.regularBytes,
    manifestSha256: canonicalDigest(entries),
    gitlinks: Object.freeze(gitlinks),
    lfsPointers: Object.freeze(lfsPointers),
  });
}

export function buildIndexManifest(repositoryRoot, regularBytesCeiling = 17_179_869_184) {
  const output = runGit(repositoryRoot, ['ls-files', '-s', '-z']);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const entries = [];
  const records = output.byteLength === 0 ? [] : output.subarray(0, -1).toString('binary').split('\0');
  const parsedRecords = records.map((rawRecord) => {
    const record = decoder.decode(Buffer.from(rawRecord, 'binary'));
    const match = /^(\d{6}) ([a-f0-9]{40}) \d+\t(.+)$/su.exec(record);
    if (!match) throw new Error('Unexpected Git index record');
    const [, mode, gitObjectId, rawPath] = match;
    return Object.freeze({ gitObjectId, mode, path: validateRelativePath(rawPath) });
  });
  const blobObjectIds = [
    ...new Set(parsedRecords.filter(({ mode }) => mode !== '160000').map(({ gitObjectId }) => gitObjectId)),
  ];
  const batch =
    blobObjectIds.length === 0
      ? Buffer.alloc(0)
      : runGit(repositoryRoot, ['cat-file', '--batch'], {
          input: Buffer.from(`${blobObjectIds.join('\n')}\n`, 'ascii'),
        });
  const blobs = new Map();
  let batchOffset = 0;
  for (const expectedObjectId of blobObjectIds) {
    const headerEnd = batch.indexOf(0x0a, batchOffset);
    if (headerEnd < 0) throw new Error('Truncated Git batch header');
    const header = batch.subarray(batchOffset, headerEnd).toString('ascii');
    const match = /^([a-f0-9]{40}) blob (\d+)$/u.exec(header);
    if (!match || match[1] !== expectedObjectId) throw new Error('Unexpected Git batch object');
    const sizeBytes = Number(match[2]);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) throw new Error('Unsafe Git batch object size');
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + sizeBytes;
    if (contentEnd >= batch.length || batch[contentEnd] !== 0x0a) throw new Error('Truncated Git batch object');
    blobs.set(expectedObjectId, batch.subarray(contentStart, contentEnd));
    batchOffset = contentEnd + 1;
  }
  if (batchOffset !== batch.length) throw new Error('Unexpected trailing Git batch output');
  for (const { gitObjectId, mode, path } of parsedRecords) {
    if (mode === '160000') {
      entries.push({
        path,
        entryType: 'gitlink',
        mode,
        gitObjectId,
        sizeBytes: null,
        sha256: null,
        symlinkTarget: null,
      });
      continue;
    }
    const bytes = blobs.get(gitObjectId);
    if (!bytes) throw new Error('Git batch object is missing');
    if (mode === '120000') {
      entries.push({
        path,
        entryType: 'symlink',
        mode,
        gitObjectId,
        sizeBytes: null,
        sha256: null,
        symlinkTarget: validateSafeSymlinkTarget(path, decoder.decode(bytes)),
      });
      continue;
    }
    if (mode !== '100644' && mode !== '100755') throw new Error(`Unexpected Git index mode: ${mode}`);
    entries.push({
      path,
      entryType: 'regular',
      mode,
      gitObjectId,
      sizeBytes: bytes.byteLength,
      sha256: sha256(bytes),
      symlinkTarget: null,
    });
  }
  entries.sort(bytewisePathSort);
  validateManifestShape(entries, {
    allowedEntryTypes: ['regular', 'symlink', 'gitlink'],
    expectedExecutableCount: null,
    expectedPathCount: null,
    expectedRegularBytes: null,
    regularBytesCeiling,
  });
  return Object.freeze({ entries: Object.freeze(entries), manifestSha256: canonicalDigest(entries) });
}

function exactEntry(manifest, path) {
  const entry = manifest.find((candidate) => candidate.path === path);
  if (!entry || entry.entryType !== 'regular') throw new Error(`Required regular source entry missing: ${path}`);
  return entry;
}

export function buildSourceCandidate(repositoryRoot, lockId, importerIdentity) {
  if (!SAFE_LOCK_ID_PATTERN.test(lockId)) throw new Error('Invalid native source lock ID');
  const definition = getSourceDefinition(lockId);
  const built = buildGitManifest(repositoryRoot, lockId);
  if (built.lfsPointers.length > 0) throw new Error('Git LFS pointers require a separately reviewed recursive lock');
  const license = exactEntry(built.entries, definition.licensePath);
  if (definition.licenseGitBlob && license.gitObjectId !== definition.licenseGitBlob) {
    throw new Error('Native source license Git blob mismatch');
  }
  if (definition.licenseSha256 && license.sha256 !== definition.licenseSha256) {
    throw new Error('Native source license SHA-256 mismatch');
  }
  const proposedLock = {
    $schema: '../schema/native-source-lock.schema.json',
    schemaId: 'local-whisper-native-source-lock-v1',
    lockId,
    repository: definition.repository,
    commit: definition.commit,
    gitTree: definition.gitTree,
    signature: {
      reviewResult: 'reviewed-unverifiable',
      signerKeyFingerprint: null,
      evidenceUrl: definition.repository.replace(/\.git$/u, `/commit/${definition.commit}`),
    },
    importer: importerIdentity,
    materialization: {
      kind: definition.materializationKind,
      rootPrefix: '',
      manifestSha256: built.manifestSha256,
      pathCount: built.entries.length,
      expandedRegularBytes: built.regularBytes,
      expandedRegularBytesCeiling: definition.regularBytesCeiling,
      executableModeCount: built.executableCount,
      allowedEntryTypes: [...definition.allowedEntryTypes],
      excludedTreeProvenance:
        definition.materializationKind === 'explicitSubset'
          ? { completeTree: definition.gitTree, includedPaths: [...definition.subsetPaths] }
          : null,
    },
    manifest: [...built.entries],
    transportObject: null,
    license: {
      path: license.path,
      gitBlob: license.gitObjectId,
      sizeBytes: license.sizeBytes,
      sha256: license.sha256,
      provenance: `${definition.repository}@${definition.commit}:${license.path}`,
      sbomComponent: definition.sbomComponent,
    },
    recursiveInputs: { gitlinks: [...built.gitlinks], lfsPointers: [...built.lfsPointers] },
    provenance: {
      reviewStatus: 'approved',
      reviewedAt: '1970-01-01T00:00:00.000Z',
      reviewedBy: 'PENDING_MANUAL_REVIEW',
      sourceEvidence: [definition.repository.replace(/\.git$/u, `/commit/${definition.commit}`)],
    },
    contentStore: {
      algorithm: 'sha256',
      identity: built.manifestSha256,
      relativeDestination: `sha256/${built.manifestSha256}`,
    },
  };
  return Object.freeze({
    schemaId: 'local-whisper-native-source-candidate-v1',
    lockId,
    candidateDigest: canonicalDigest(proposedLock),
    reviewRequired: true,
    proposedLock,
  });
}

export function approveSourceCandidate(candidate, review) {
  if (
    candidate?.schemaId !== 'local-whisper-native-source-candidate-v1' ||
    candidate.reviewRequired !== true ||
    !SHA256_PATTERN.test(candidate.candidateDigest ?? '') ||
    canonicalDigest(candidate.proposedLock) !== candidate.candidateDigest
  ) {
    throw new Error('Invalid or changed native source candidate');
  }
  if (
    review?.schemaId !== 'local-whisper-native-source-review-v1' ||
    review.candidateDigest !== candidate.candidateDigest ||
    review.disposition !== 'approved' ||
    typeof review.reviewedBy !== 'string' ||
    review.reviewedBy.length === 0 ||
    Number.isNaN(Date.parse(review.reviewedAt)) ||
    !Array.isArray(review.sourceEvidence) ||
    review.sourceEvidence.length === 0
  ) {
    throw new Error('Native source review does not approve this exact candidate');
  }
  const lock = globalThis.structuredClone(candidate.proposedLock);
  lock.signature = globalThis.structuredClone(review.signature);
  lock.provenance = {
    reviewStatus: 'approved',
    reviewedAt: review.reviewedAt,
    reviewedBy: review.reviewedBy,
    sourceEvidence: [...review.sourceEvidence],
  };
  verifySourceLock(lock);
  return Object.freeze(lock);
}

function verifyCanonicalSourceIdentity(lock, definition) {
  if (
    lock.repository !== definition.repository ||
    lock.commit !== definition.commit ||
    lock.gitTree !== definition.gitTree
  ) {
    throw new Error('Native source lock canonical identity mismatch');
  }
}

function verifyMaterializationIdentity(lock, definition) {
  if (
    lock.materialization?.kind !== definition.materializationKind ||
    lock.materialization?.rootPrefix !== '' ||
    canonicalDigest(lock.manifest) !== lock.materialization?.manifestSha256 ||
    lock.contentStore?.identity !== lock.materialization?.manifestSha256 ||
    lock.contentStore?.relativeDestination !== `sha256/${lock.materialization?.manifestSha256}`
  ) {
    throw new Error('Native source lock manifest/content identity mismatch');
  }
}

function verifyMaterializationPolicy(lock, definition, counts) {
  if (
    lock.materialization.pathCount !== lock.manifest.length ||
    lock.materialization.expandedRegularBytes !== counts.regularBytes ||
    lock.materialization.expandedRegularBytesCeiling !== definition.regularBytesCeiling ||
    lock.materialization.executableModeCount !== counts.executableCount ||
    canonicalJson(lock.materialization.allowedEntryTypes) !== canonicalJson(definition.allowedEntryTypes)
  ) {
    throw new Error('Native source lock counts or policy mismatch');
  }
}

function verifySubsetProvenance(lock, definition) {
  const excluded = lock.materialization.excludedTreeProvenance;
  if (definition.materializationKind === 'explicitSubset') {
    if (
      excluded?.completeTree !== definition.gitTree ||
      canonicalJson(excluded?.includedPaths) !== canonicalJson(definition.subsetPaths)
    ) {
      throw new Error('Native source subset provenance mismatch');
    }
  } else if (excluded !== null) {
    throw new Error('Complete native source tree cannot claim subset provenance');
  }
}

function verifyLicenseAndSignature(lock, definition) {
  const license = exactEntry(lock.manifest, definition.licensePath);
  if (
    lock.license?.path !== license.path ||
    lock.license?.gitBlob !== license.gitObjectId ||
    lock.license?.sizeBytes !== license.sizeBytes ||
    lock.license?.sha256 !== license.sha256
  ) {
    throw new Error('Native source lock license mismatch');
  }
  if (
    lock.license.sbomComponent !== definition.sbomComponent ||
    lock.signature?.evidenceUrl !== definition.repository.replace(/\.git$/u, `/commit/${definition.commit}`) ||
    !['reviewed-signed', 'reviewed-unsigned', 'reviewed-unverifiable'].includes(lock.signature?.reviewResult)
  ) {
    throw new Error('Native source license/SBOM/signature provenance mismatch');
  }
}

function verifyReviewProvenance(lock) {
  if (
    lock.provenance?.reviewStatus !== 'approved' ||
    lock.provenance?.reviewedBy === 'PENDING_MANUAL_REVIEW' ||
    Number.isNaN(Date.parse(lock.provenance?.reviewedAt ?? '')) ||
    !SHA256_PATTERN.test(lock.importer?.implementationSha256 ?? '')
  ) {
    throw new Error('Native source lock is not reviewed');
  }
}

function verifyRecursiveInputs(lock) {
  const gitlinks = lock.manifest.filter((entry) => entry.entryType === 'gitlink');
  if (
    gitlinks.length !== lock.recursiveInputs?.gitlinks?.length ||
    (lock.recursiveInputs?.lfsPointers?.length ?? -1) !== 0
  ) {
    throw new Error('Native source recursive-input record mismatch');
  }
  for (const entry of gitlinks) {
    const record = lock.recursiveInputs.gitlinks.find((candidate) => candidate.path === entry.path);
    if (!record || record.commit !== entry.gitObjectId || record.status !== 'recorded-for-later-lock') {
      throw new Error(`Native source gitlink identity mismatch: ${entry.path}`);
    }
  }
}

export function verifySourceLock(lock) {
  if (lock?.schemaId !== 'local-whisper-native-source-lock-v1' || !SAFE_LOCK_ID_PATTERN.test(lock.lockId ?? '')) {
    throw new Error('Invalid native source lock header');
  }
  const definition = getSourceDefinition(lock.lockId);
  verifyCanonicalSourceIdentity(lock, definition);
  verifyMaterializationIdentity(lock, definition);
  const counts = validateManifestShape(lock.manifest, definition);
  verifyMaterializationPolicy(lock, definition, counts);
  verifySubsetProvenance(lock, definition);
  verifyLicenseAndSignature(lock, definition);
  verifyReviewProvenance(lock);
  verifyRecursiveInputs(lock);
  return true;
}

function assertOwnedDescendant(root, candidate) {
  const relativePath = relative(root, candidate);
  if (relativePath === '' || relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error('Native source destination escaped its owned root');
  }
}

function verifyMaterializedEntry(root, entry) {
  const destination = resolve(root, ...entry.path.split('/'));
  assertOwnedDescendant(root, destination);
  const stat = lstatSync(destination);
  if (entry.entryType === 'gitlink') {
    if (!stat.isDirectory()) throw new Error(`Materialized gitlink placeholder mismatch: ${entry.path}`);
    return;
  }
  if (entry.entryType === 'symlink') {
    if (!stat.isSymbolicLink() || readlinkSync(destination) !== entry.symlinkTarget) {
      throw new Error(`Materialized symlink mismatch: ${entry.path}`);
    }
    return;
  }
  if (!stat.isFile() || stat.nlink !== 1 || stat.size !== entry.sizeBytes) {
    throw new Error(`Materialized regular-file metadata mismatch: ${entry.path}`);
  }
  if (sha256(readFileSync(destination)) !== entry.sha256) {
    throw new Error(`Materialized regular-file hash mismatch: ${entry.path}`);
  }
}

function verifyNoUnexpectedMaterializedEntries(root, manifest) {
  const expectedEntries = new Map(manifest.map((entry) => [entry.path, entry]));
  const expectedDirectories = new Set();
  for (const entry of manifest) {
    let parent = posix.dirname(entry.path);
    while (parent !== '.') {
      expectedDirectories.add(parent);
      parent = posix.dirname(parent);
    }
    if (entry.entryType === 'gitlink') expectedDirectories.add(entry.path);
  }
  const visit = (directory, prefix) => {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      validateRelativePath(path);
      if (item.isDirectory()) {
        if (!expectedDirectories.has(path)) throw new Error(`Unexpected materialized directory: ${path}`);
        if (expectedEntries.get(path)?.entryType !== 'gitlink') visit(resolve(directory, item.name), path);
      } else if (!expectedEntries.has(path)) {
        throw new Error(`Unexpected materialized entry: ${path}`);
      }
    }
  };
  visit(root, '');
}

export function verifyMaterializedSource(storeRoot, lock) {
  verifySourceLock(lock);
  const canonicalStore = realpathSync(storeRoot);
  const destination = resolve(canonicalStore, ...lock.contentStore.relativeDestination.split('/'));
  assertOwnedDescendant(canonicalStore, destination);
  for (const entry of lock.manifest) verifyMaterializedEntry(destination, entry);
  verifyNoUnexpectedMaterializedEntries(destination, lock.manifest);
  return destination;
}

export function materializeSource(repositoryRoot, storeRoot, lock) {
  verifySourceLock(lock);
  const canonicalRepository = realpathSync(repositoryRoot);
  const rebuilt = buildGitManifest(canonicalRepository, lock.lockId);
  if (rebuilt.manifestSha256 !== lock.materialization.manifestSha256) {
    throw new Error('Reviewed native source lock does not match repository objects');
  }
  mkdirSync(storeRoot, { mode: 0o700, recursive: true });
  const canonicalStore = realpathSync(storeRoot);
  const destination = resolve(canonicalStore, ...lock.contentStore.relativeDestination.split('/'));
  assertOwnedDescendant(canonicalStore, destination);
  if (existsSync(destination)) return verifyMaterializedSource(canonicalStore, lock);
  const staging = mkdtempSync(join(canonicalStore, '.staging-'));
  assertOwnedDescendant(canonicalStore, staging);
  try {
    for (const entry of lock.manifest) {
      const target = resolve(staging, ...entry.path.split('/'));
      assertOwnedDescendant(staging, target);
      mkdirSync(dirname(target), { mode: 0o700, recursive: true });
      if (entry.entryType === 'gitlink') {
        mkdirSync(target, { mode: 0o700 });
      } else if (entry.entryType === 'symlink') {
        symlinkSync(entry.symlinkTarget, target);
      } else {
        const bytes = runGit(canonicalRepository, ['cat-file', 'blob', entry.gitObjectId]);
        if (bytes.byteLength !== entry.sizeBytes || sha256(bytes) !== entry.sha256) {
          throw new Error(`Git object changed during materialization: ${entry.path}`);
        }
        writeFileSync(target, bytes, { flag: 'wx', mode: entry.mode === '100755' ? 0o755 : 0o644 });
        chmodSync(target, entry.mode === '100755' ? 0o755 : 0o644);
      }
    }
    for (const entry of lock.manifest) verifyMaterializedEntry(staging, entry);
    mkdirSync(dirname(destination), { mode: 0o700, recursive: true });
    renameSync(staging, destination);
    return verifyMaterializedSource(canonicalStore, lock);
  } catch (error) {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: false });
    throw error;
  }
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJsonAtomic(path, value) {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { mode: 0o700, recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  renameSync(temporary, absolute);
}

export function parseArguments(arguments_) {
  const result = new Map();
  for (const argument of arguments_) {
    const match = /^--([a-z][a-z0-9-]*)=(.+)$/u.exec(argument);
    if (!match || result.has(match[1])) throw new Error(`Invalid or duplicate argument: ${argument}`);
    result.set(match[1], match[2]);
  }
  return result;
}

export function requiredArgument(arguments_, name) {
  const value = arguments_.get(name);
  if (!value) throw new Error(`Missing --${name}=...`);
  return value;
}
