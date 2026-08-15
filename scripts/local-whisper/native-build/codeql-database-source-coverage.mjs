import { spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { lstatSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import { readVerifiedRegularFileSync } from '../secure-file-reader.mjs';

const MAXIMUM_SOURCE_ARCHIVE_BYTES = 1024 * 1024 * 1024;
const MAXIMUM_SOURCE_LIST_BYTES = 16 * 1024 * 1024;
const MAXIMUM_TRANSLATION_UNIT_BYTES = 4 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function normalizedArchivePath(value) {
  if (typeof value !== 'string' || /[\0\r\n]/u.test(value)) {
    throw new Error('Native quality CodeQL source inventory is malformed');
  }
  const normalized = value
    .replace(/\\/gu, '/')
    .replace(/^(?:\.\/)+/u, '')
    .replace(/^\/+/, '');
  if (
    normalized.length === 0 ||
    normalized.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error('Native quality CodeQL source inventory is malformed');
  }
  return normalized;
}

function boundedSha256(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > MAXIMUM_TRANSLATION_UNIT_BYTES) {
    throw new Error('Native quality CodeQL translation unit is invalid');
  }
  return createHash('sha256').update(bytes).digest('hex');
}

function checkedDigest(digest) {
  if (typeof digest !== 'string' || !SHA256_PATTERN.test(digest)) {
    throw new Error('Native quality CodeQL source digest is unavailable');
  }
  return digest;
}

export function assertCodeqlDatabaseSourceCoverage(manifest, platform, databaseSources, sourceDigests) {
  if (platform !== 'linux' && platform !== 'windows') {
    throw new Error('Native quality CodeQL platform is invalid');
  }
  if (!Array.isArray(manifest) || !Array.isArray(databaseSources) || databaseSources.length === 0) {
    throw new Error('Native quality CodeQL source inventory is unavailable');
  }
  if (typeof sourceDigests?.databaseSha256 !== 'function' || typeof sourceDigests?.workspaceSha256 !== 'function') {
    throw new Error('Native quality CodeQL source digest is unavailable');
  }
  const sources = databaseSources.map((archiveEntry) => ({
    archiveEntry,
    path: normalizedArchivePath(archiveEntry),
  }));
  if (new Set(sources.map((entry) => entry.path)).size !== sources.length) {
    throw new Error('Native quality CodeQL source inventory is malformed');
  }
  const translationUnits = manifest
    .filter(
      (entry) =>
        entry?.kind === 'translation-unit' && Array.isArray(entry.platforms) && entry.platforms.includes(platform),
    )
    .map((entry) => normalizedArchivePath(entry.path));
  if (translationUnits.length === 0) throw new Error('Native quality manifest has no translation units');
  const matches = translationUnits.map((source) => {
    const candidates = sources.filter(
      (candidate) => candidate.path === source || candidate.path.endsWith(`/${source}`),
    );
    if (candidates.length !== 1) return null;
    const candidate = candidates[0];
    return Object.freeze({
      archiveEntry: candidate.archiveEntry,
      prefix: candidate.path.slice(0, candidate.path.length - source.length),
      source,
    });
  });
  const missing = matches.filter((match) => match === null);
  if (missing.length > 0) {
    throw new Error(`Native quality CodeQL database omitted ${missing.length} translation unit(s)`);
  }
  const prefixes = new Set(matches.map((match) => match.prefix));
  if (prefixes.size !== 1) {
    throw new Error('Native quality CodeQL database source prefix is inconsistent');
  }
  const stale = matches.filter(
    (match) =>
      checkedDigest(sourceDigests.databaseSha256(match.archiveEntry)) !==
      checkedDigest(sourceDigests.workspaceSha256(match.source)),
  );
  if (stale.length > 0) {
    throw new Error(`Native quality CodeQL database has ${stale.length} stale translation unit(s)`);
  }
}

function archiveFileMetadata(archivePath) {
  let metadata;
  try {
    metadata = lstatSync(archivePath);
  } catch {
    throw new Error('Native quality CodeQL source archive is unavailable');
  }
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size < 1 ||
    metadata.size > MAXIMUM_SOURCE_ARCHIVE_BYTES
  ) {
    throw new Error('Native quality CodeQL source archive is invalid');
  }
  return Object.freeze({
    archivePath,
    ctimeMs: metadata.ctimeMs,
    dev: metadata.dev,
    ino: metadata.ino,
    mtimeMs: metadata.mtimeMs,
    size: metadata.size,
  });
}

function archiveMetadata(databasePath) {
  return archiveFileMetadata(resolve(databasePath, 'src.zip'));
}

function sameArchive(left, right) {
  const identityMatches =
    left.dev !== 0 && left.ino !== 0 && right.dev !== 0 && right.ino !== 0
      ? left.dev === right.dev && left.ino === right.ino
      : true;
  return (
    identityMatches && left.size === right.size && left.ctimeMs === right.ctimeMs && left.mtimeMs === right.mtimeMs
  );
}

export function codeqlDatabaseSources(databasePath) {
  const metadata = archiveMetadata(databasePath);
  const result = spawnSync('tar', ['-tf', metadata.archivePath], {
    encoding: 'utf8',
    maxBuffer: MAXIMUM_SOURCE_LIST_BYTES,
    shell: false,
    windowsHide: true,
  });
  if (result.error || result.status !== 0 || typeof result.stdout !== 'string') {
    throw new Error('Native quality CodeQL source inventory is unavailable');
  }
  const entries = result.stdout
    .split(/\r?\n/u)
    .filter((entry) => entry.length > 0 && !entry.endsWith('/') && !entry.endsWith('\\'))
    .map((entry) => {
      normalizedArchivePath(entry);
      return entry;
    });
  if (!sameArchive(metadata, archiveFileMetadata(metadata.archivePath))) {
    throw new Error('Native quality CodeQL source archive changed while being inspected');
  }
  return Object.freeze({ entries: Object.freeze(entries), metadata });
}

export function codeqlDatabaseSourceSha256(inventory, archiveEntry) {
  if (
    !inventory?.metadata ||
    !Array.isArray(inventory.entries) ||
    !inventory.entries.includes(archiveEntry) ||
    !sameArchive(inventory.metadata, archiveFileMetadata(inventory.metadata.archivePath))
  ) {
    throw new Error('Native quality CodeQL source archive changed while being inspected');
  }
  normalizedArchivePath(archiveEntry);
  const result = spawnSync('tar', ['-xOf', inventory.metadata.archivePath, '--', archiveEntry], {
    encoding: null,
    maxBuffer: MAXIMUM_TRANSLATION_UNIT_BYTES,
    shell: false,
    windowsHide: true,
  });
  if (
    result.error ||
    result.status !== 0 ||
    !Buffer.isBuffer(result.stdout) ||
    !sameArchive(inventory.metadata, archiveFileMetadata(inventory.metadata.archivePath))
  ) {
    throw new Error('Native quality CodeQL archived source is unavailable');
  }
  return boundedSha256(result.stdout);
}

export function workspaceSourceSha256(workspaceRoot, sourcePath) {
  const root = resolve(workspaceRoot);
  const normalized = normalizedArchivePath(sourcePath);
  const source = resolve(root, ...normalized.split('/'));
  const sourceRelative = relative(root, source);
  if (
    sourceRelative.length === 0 ||
    sourceRelative === '..' ||
    sourceRelative.startsWith('../') ||
    sourceRelative.startsWith('..\\') ||
    isAbsolute(sourceRelative)
  ) {
    throw new Error('Native quality workspace source path is invalid');
  }
  let file;
  try {
    file = readVerifiedRegularFileSync(source);
  } catch {
    throw new Error('Native quality workspace source is unavailable');
  }
  return boundedSha256(file.bytes);
}
