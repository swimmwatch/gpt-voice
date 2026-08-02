import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { TextDecoder } from 'node:util';

import { buildIndexManifest, canonicalJson, runGit, sha256, validateRelativePath } from './native-source-core.mjs';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9.-]{0,127}$/u;
const EXPECTED_COMMAND = 'git apply --index --whitespace=error-all -p1';

function patchTouchedPaths(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const paths = new Set();
  for (const line of text.split('\n')) {
    if (!line.startsWith('--- a/') && !line.startsWith('+++ b/')) continue;
    const pathAndMetadata = line.slice(6);
    const tab = pathAndMetadata.indexOf('\t');
    const path = tab < 0 ? pathAndMetadata : pathAndMetadata.slice(0, tab);
    paths.add(validateRelativePath(path));
  }
  if (paths.size === 0) throw new Error('Native patch has no bounded touched paths');
  return [...paths].sort();
}

function verifyPatchLockHeader(lock) {
  if (
    lock?.schemaId !== 'local-whisper-native-patch-lock-v1' ||
    !SAFE_ID_PATTERN.test(lock.lockId ?? '') ||
    !SAFE_ID_PATTERN.test(lock.sourceLockId ?? '') ||
    !SHA256_PATTERN.test(lock.originalManifestSha256 ?? '') ||
    !SHA256_PATTERN.test(lock.finalManifestSha256 ?? '') ||
    lock.application?.stripLevel !== 1 ||
    lock.application?.command !== EXPECTED_COMMAND ||
    lock.application?.allowFuzz !== false ||
    lock.application?.allowThreeWay !== false ||
    lock.application?.allowOffsets !== false ||
    lock.expectedRejectCount !== 0 ||
    !Array.isArray(lock.patches)
  ) {
    throw new Error('Invalid native patch lock contract');
  }
}

function verifyPatchEntry(patch, patchRoot, ids) {
  if (!SAFE_ID_PATTERN.test(patch.patchId ?? '') || ids.has(patch.patchId))
    throw new Error('Invalid or duplicate native patch ID');
  ids.add(patch.patchId);
  validateRelativePath(patch.relativePath);
  const absolute = resolve(patchRoot, ...patch.relativePath.split('/'));
  const bytes = readFileSync(absolute);
  if (bytes.byteLength !== patch.sizeBytes || sha256(bytes) !== patch.sha256)
    throw new Error(`Native patch identity mismatch: ${patch.patchId}`);
  const touched = patchTouchedPaths(bytes);
  const allowed = [...patch.allowedTouchedPaths].map(validateRelativePath).sort();
  if (canonicalJson(touched) !== canonicalJson(allowed))
    throw new Error(`Native patch touched-path allowlist mismatch: ${patch.patchId}`);
}

function verifyIntermediateManifests(lock) {
  if (lock.intermediateManifests === undefined) return;
  if (!Array.isArray(lock.intermediateManifests) || lock.intermediateManifests.length !== lock.patches.length - 1)
    throw new Error('Invalid native patch intermediate manifest contract');
  for (const [index, intermediate] of lock.intermediateManifests.entries()) {
    if (
      intermediate?.afterPatchId !== lock.patches[index].patchId ||
      !SHA256_PATTERN.test(intermediate?.manifestSha256 ?? '')
    )
      throw new Error('Invalid native patch intermediate manifest identity');
  }
}

function verifyLicenseProvenance(lock) {
  if (lock.licenseProvenance === undefined) return;
  if (!Array.isArray(lock.licenseProvenance) || lock.licenseProvenance.length === 0)
    throw new Error('Invalid native patch license provenance');
  for (const entry of lock.licenseProvenance) {
    if (!SAFE_ID_PATTERN.test(entry?.component ?? '') || !SAFE_ID_PATTERN.test(entry?.license ?? ''))
      throw new Error('Invalid native patch license provenance identity');
    validateRelativePath(entry.evidence);
  }
}

export function verifyPatchLock(lock, patchRoot) {
  verifyPatchLockHeader(lock);
  const ids = new Set();
  for (const patch of lock.patches) verifyPatchEntry(patch, patchRoot, ids);
  verifyIntermediateManifests(lock);
  verifyLicenseProvenance(lock);
  return true;
}

function applyExact(repositoryRoot, patchPath) {
  const result = spawnSync(
    'git',
    ['-c', 'core.autocrlf=false', 'apply', '--index', '--whitespace=error-all', '-p1', '--verbose', patchPath],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: { LANG: 'C', LC_ALL: 'C', PATH: process.env.PATH },
      maxBuffer: 16 * 1024 * 1024,
      shell: false,
    },
  );
  const diagnostics = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (result.error || result.status !== 0)
    throw new Error(`Exact native patch application failed: ${diagnostics.trim()}`);
  if (/\b(?:fuzz|offset)\b/iu.test(diagnostics)) throw new Error('Native patch required a forbidden fuzz or offset');
}

export function applyPatchLock(repositoryRoot, patchRoot, lock) {
  verifyPatchLock(lock, patchRoot);
  const status = String(runGit(repositoryRoot, ['status', '--porcelain=v1'], { encoding: 'utf8' })).trim();
  if (status !== '') throw new Error('Native patch input repository is not clean');
  const original = buildIndexManifest(repositoryRoot);
  if (original.manifestSha256 !== lock.originalManifestSha256) {
    throw new Error('Native patch input manifest mismatch');
  }
  for (const [index, patch] of lock.patches.entries()) {
    applyExact(repositoryRoot, resolve(patchRoot, ...patch.relativePath.split('/')));
    if (index < lock.patches.length - 1 && lock.intermediateManifests !== undefined) {
      const intermediate = buildIndexManifest(repositoryRoot).manifestSha256;
      if (intermediate !== lock.intermediateManifests[index].manifestSha256)
        throw new Error('Native patch intermediate manifest mismatch');
    }
  }
  const finalManifest = buildIndexManifest(repositoryRoot);
  if (finalManifest.manifestSha256 !== lock.finalManifestSha256) {
    throw new Error('Native patched-tree manifest mismatch');
  }
  return finalManifest;
}
