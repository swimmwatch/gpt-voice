import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { canonicalDigest, readJson, sha256, verifySourceLock } from '../source-import/native-source-core.mjs';

const EXPECTED_FAMILIES = Object.freeze(['tiny', 'base', 'small', 'medium', 'large-v3', 'large-v3-turbo']);
const EXPECTED_VARIANTS = Object.freeze(['full', 'q5_0']);
const EXPECTED_TENSOR_TYPES = Object.freeze(['F32', 'F16', 'Q5_0']);
const EXPECTED_DERIVATION_INPUTS_SHA256 = '6405f4ffbdd14ba936d53722087bbd97a79d4c3f87382af695bac6582493e99f';

export function loaderLimitInputsPath(workspaceRoot) {
  return resolve(
    workspaceRoot,
    'runtime',
    'local-whisper',
    'sources',
    'limits',
    'whisper-cpp-loader-limit-inputs-v1.json',
  );
}

export function canonicalLoaderLimitToolSourceBytes(bytes) {
  return Buffer.from(bytes.toString('utf8').replace(/\r\n/gu, '\n'), 'utf8');
}

export function loaderLimitToolDigest() {
  const files = [
    resolve(import.meta.dirname, 'derive-whisper-cpp-loader-limits.mjs'),
    resolve(import.meta.dirname, 'loader-limit-core.mjs'),
    resolve(import.meta.dirname, 'verify-whisper-cpp-loader-limits.mjs'),
  ].map((path) => ({
    path: basename(path),
    sha256: sha256(canonicalLoaderLimitToolSourceBytes(readFileSync(path))),
  }));
  return canonicalDigest(files);
}

function assertExactArray(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Loader-limit ${label} changed`);
}

function assertWithin(value, range, label) {
  if (!Number.isSafeInteger(value) || value < range.minimum || value > range.maximum) {
    throw new Error(`Curated ${label} exceeds loader limits`);
  }
}

export function validateDerivationInputs(inputs) {
  if (
    inputs?.schemaId !== 'local-whisper-loader-limit-derivation-input-v1' ||
    inputs.sourceLockId !== 'whisper-cpp-v1.9.1-f049fff' ||
    inputs.gitTree !== 'f49541eaed447bce9b5e3598cc7a487ce5e54678'
  ) {
    throw new Error('Loader-limit derivation identity mismatch');
  }
  if (canonicalDigest(inputs) !== EXPECTED_DERIVATION_INPUTS_SHA256) {
    throw new Error('Loader-limit reviewed derivation inputs changed');
  }
  assertExactArray(
    inputs.families.map((family) => family.id),
    EXPECTED_FAMILIES,
    'family allowlist',
  );
  assertExactArray(inputs.variants, EXPECTED_VARIANTS, 'variant allowlist');
  assertExactArray(inputs.tensorTypes, EXPECTED_TENSOR_TYPES, 'tensor-type allowlist');
  for (const family of inputs.families) {
    assertWithin(family.nVocab, inputs.limits.vocabularyCount, `${family.id} vocabulary`);
    assertWithin(family.nAudioContext, inputs.limits.audioContext, `${family.id} audio context`);
    assertWithin(family.nAudioState, inputs.limits.audioState, `${family.id} audio state`);
    assertWithin(family.nAudioHeads, inputs.limits.audioHeads, `${family.id} audio heads`);
    assertWithin(family.nAudioLayers, inputs.limits.audioLayers, `${family.id} audio layers`);
    assertWithin(family.nTextContext, inputs.limits.textContext, `${family.id} text context`);
    assertWithin(family.nTextState, inputs.limits.textState, `${family.id} text state`);
    assertWithin(family.nTextHeads, inputs.limits.textHeads, `${family.id} text heads`);
    assertWithin(family.nTextLayers, inputs.limits.textLayers, `${family.id} text layers`);
    assertWithin(family.nMels, inputs.limits.melDimension, `${family.id} mel dimension`);
    if (family.nTextState !== family.nAudioState) throw new Error(`Curated ${family.id} state mismatch`);
    const tensors = 25 + 15 * family.nAudioLayers + 24 * family.nTextLayers;
    if (tensors > inputs.limits.tensorCount || tensors > inputs.catalogObjectCeilings.maximumTensorCount) {
      throw new Error(`Curated ${family.id} tensor count exceeds authority`);
    }
  }
  if (
    inputs.catalogObjectCeilings.largestReviewedModelBytes > inputs.limits.authenticatedModelBytes.maximum ||
    inputs.catalogObjectCeilings.maximumTensorNameBytes > inputs.limits.tensorNameBytes.maximum
  ) {
    throw new Error('Curated model object ceiling exceeds loader limits');
  }
  return true;
}

export function deriveProposedLoaderLimitTable(workspaceRoot, sourceLock) {
  verifySourceLock(sourceLock);
  const inputs = readJson(loaderLimitInputsPath(workspaceRoot));
  validateDerivationInputs(inputs);
  if (
    sourceLock.lockId !== inputs.sourceLockId ||
    sourceLock.gitTree !== inputs.gitTree ||
    sourceLock.materialization.kind !== 'completeTree'
  ) {
    throw new Error('Loader-limit source lock mismatch');
  }
  const layoutSources = inputs.layoutSources.map((layout) => {
    const entry = sourceLock.manifest.find((candidate) => candidate.path === layout.path);
    if (!entry || entry.entryType !== 'regular') throw new Error(`Pinned layout source missing: ${layout.path}`);
    return Object.freeze({
      path: layout.path,
      gitBlob: entry.gitObjectId,
      sha256: entry.sha256,
      symbols: [...layout.symbols],
    });
  });
  return {
    $schema: '../schema/loader-limit-table.schema.json',
    schemaId: 'local-whisper-loader-limit-table-schema-v1',
    tableId: 'whisper-cpp-loader-limits-v1',
    sourceLockId: sourceLock.lockId,
    gitTree: sourceLock.gitTree,
    originalManifestSha256: sourceLock.materialization.manifestSha256,
    layoutSources,
    derivationToolSha256: loaderLimitToolDigest(),
    families: [...EXPECTED_FAMILIES],
    variants: [...EXPECTED_VARIANTS],
    tensorTypes: [...EXPECTED_TENSOR_TYPES],
    limits: globalThis.structuredClone(inputs.limits),
    review: {
      status: 'approved',
      reviewedAt: '1970-01-01T00:00:00.000Z',
      reviewedBy: 'PENDING_MANUAL_REVIEW',
      provenancePath: 'whisper-cpp-loader-limits-v1.provenance.json',
      unresolvedExclusions: [],
    },
    tableSha256: '0'.repeat(64),
  };
}

export function loaderTableDigest(table) {
  const candidate = globalThis.structuredClone(table);
  delete candidate.tableSha256;
  return canonicalDigest(candidate);
}

export function buildLoaderLimitCandidate(workspaceRoot, sourceLock) {
  const proposedTable = deriveProposedLoaderLimitTable(workspaceRoot, sourceLock);
  return Object.freeze({
    schemaId: 'local-whisper-loader-limit-candidate-v1',
    candidateDigest: canonicalDigest(proposedTable),
    reviewRequired: true,
    proposedTable,
  });
}

export function approveLoaderLimitCandidate(candidate, review, inputs) {
  if (
    candidate?.schemaId !== 'local-whisper-loader-limit-candidate-v1' ||
    candidate.reviewRequired !== true ||
    canonicalDigest(candidate.proposedTable) !== candidate.candidateDigest ||
    review?.schemaId !== 'local-whisper-loader-limit-review-v1' ||
    review.candidateDigest !== candidate.candidateDigest ||
    review.disposition !== 'approved' ||
    typeof review.reviewedBy !== 'string' ||
    review.reviewedBy.length === 0 ||
    Number.isNaN(Date.parse(review.reviewedAt)) ||
    !Array.isArray(review.unresolvedExclusions)
  ) {
    throw new Error('Loader-limit review does not approve this exact candidate');
  }
  const table = globalThis.structuredClone(candidate.proposedTable);
  table.review = {
    status: 'approved',
    reviewedAt: review.reviewedAt,
    reviewedBy: review.reviewedBy,
    provenancePath: 'whisper-cpp-loader-limits-v1.provenance.json',
    unresolvedExclusions: [...review.unresolvedExclusions],
  };
  table.tableSha256 = loaderTableDigest(table);
  const provenance = Object.freeze({
    schemaId: 'local-whisper-loader-limit-provenance-v1',
    tableId: table.tableId,
    tableSha256: table.tableSha256,
    sourceLockId: table.sourceLockId,
    originalManifestSha256: table.originalManifestSha256,
    derivationInputsSha256: canonicalDigest(inputs),
    derivationToolSha256: table.derivationToolSha256,
    layoutSources: globalThis.structuredClone(table.layoutSources),
    curatedFamilies: globalThis.structuredClone(inputs.families),
    variants: [...inputs.variants],
    tensorTypes: [...inputs.tensorTypes],
    crossFieldInvariants: [...inputs.crossFieldInvariants],
    reviewer: { reviewedAt: review.reviewedAt, reviewedBy: review.reviewedBy, disposition: 'approved' },
    unresolvedExclusions: [...review.unresolvedExclusions],
  });
  return Object.freeze({ table, provenance });
}

export function verifyLoaderLimitAuthority(workspaceRoot, sourceLock, table, provenance) {
  const expected = deriveProposedLoaderLimitTable(workspaceRoot, sourceLock);
  expected.review = globalThis.structuredClone(table.review);
  expected.tableSha256 = loaderTableDigest(expected);
  if (canonicalDigest(expected) !== canonicalDigest(table) || table.tableSha256 !== loaderTableDigest(table)) {
    throw new Error('Loader-limit table differs from pinned derivation');
  }
  if (
    table.review.reviewedBy === 'PENDING_MANUAL_REVIEW' ||
    provenance?.schemaId !== 'local-whisper-loader-limit-provenance-v1' ||
    provenance.tableSha256 !== table.tableSha256 ||
    provenance.derivationToolSha256 !== table.derivationToolSha256
  ) {
    throw new Error('Loader-limit review provenance mismatch');
  }
  const inputs = readJson(loaderLimitInputsPath(workspaceRoot));
  if (
    provenance.derivationInputsSha256 !== canonicalDigest(inputs) ||
    JSON.stringify(provenance.curatedFamilies) !== JSON.stringify(inputs.families) ||
    JSON.stringify(provenance.crossFieldInvariants) !== JSON.stringify(inputs.crossFieldInvariants)
  ) {
    throw new Error('Loader-limit derivation inputs or reviewed coverage changed');
  }
  return true;
}
