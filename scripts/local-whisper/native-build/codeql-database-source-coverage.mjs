import { spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';
import { TextDecoder } from 'node:util';

import { readVerifiedRegularFileSync } from '../secure-file-reader.mjs';

const MAXIMUM_SOURCE_ARCHIVE_BYTES = 1024 * 1024 * 1024;
const MAXIMUM_SOURCE_LIST_BYTES = 16 * 1024 * 1024;
const MAXIMUM_SOURCE_ARCHIVE_MEMBERS = 200_000;
const MAXIMUM_TRANSLATION_UNIT_BYTES = 4 * 1024 * 1024;
const ARCHIVE_COMMAND_TIMEOUT_MS = 30_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

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

function verifiedArchiveTool() {
  let executable;
  let kind;
  let environment;
  try {
    if (process.platform === 'linux') {
      const expected = '/usr/bin/unzip';
      executable = realpathSync(expected);
      if (executable !== expected) throw new Error('unexpected executable identity');
      kind = 'unzip';
      environment = Object.freeze({ LANG: 'C', LC_ALL: 'C' });
    } else if (process.platform === 'win32') {
      const rootInput = process.env.SystemRoot ?? process.env.WINDIR;
      if (typeof rootInput !== 'string' || !isAbsolute(rootInput)) {
        throw new Error('Windows root is unavailable');
      }
      const systemRoot = realpathSync(rootInput);
      const expectedSystemDirectory = resolve(systemRoot, 'System32');
      const systemDirectory = realpathSync(expectedSystemDirectory);
      if (systemDirectory.toLowerCase() !== expectedSystemDirectory.toLowerCase()) {
        throw new Error('Windows system directory identity changed');
      }
      const expected = resolve(systemDirectory, 'tar.exe');
      executable = realpathSync(expected);
      if (executable.toLowerCase() !== expected.toLowerCase()) {
        throw new Error('unexpected executable identity');
      }
      kind = 'bsdtar';
      environment = Object.freeze({ SystemRoot: systemRoot, WINDIR: systemRoot });
    } else {
      throw new Error('unsupported platform');
    }
    const metadata = lstatSync(executable);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.size < 1 ||
      (process.platform === 'linux' && (metadata.mode & 0o111) === 0)
    ) {
      throw new Error('archive tool is invalid');
    }
  } catch {
    throw new Error('Native quality CodeQL ZIP tool is unavailable');
  }
  return Object.freeze({ environment, executable, kind });
}

function checkedArchiveToolEntry(value) {
  const normalizedValue = typeof value === 'string' && value.endsWith('/') ? value.slice(0, -1) : value;
  normalizedArchivePath(normalizedValue);
  if (
    value.startsWith('-') ||
    value.includes('\\') ||
    value.includes('*') ||
    value.includes('?') ||
    value.includes('[') ||
    value.includes(']')
  ) {
    throw new Error('Native quality CodeQL source inventory is malformed');
  }
  return value;
}

function checkedArchiveToolPath(value) {
  if (
    typeof value !== 'string' ||
    !isAbsolute(value) ||
    /[\0\r\n]/u.test(value) ||
    value.includes('*') ||
    value.includes('?') ||
    value.includes('[') ||
    value.includes(']')
  ) {
    throw new Error('Native quality CodeQL source archive is invalid');
  }
  return value;
}

function runArchiveTool(tool, operation, archivePath, archiveEntry = null) {
  const listing = operation === 'list';
  const checkedArchivePath = checkedArchiveToolPath(archivePath);
  const arguments_ =
    tool.kind === 'unzip'
      ? listing
        ? ['-Z1', checkedArchivePath]
        : ['-p', checkedArchivePath, checkedArchiveToolEntry(archiveEntry)]
      : listing
        ? ['-tf', checkedArchivePath]
        : ['-xOf', checkedArchivePath, '--', checkedArchiveToolEntry(archiveEntry)];
  return spawnSync(tool.executable, arguments_, {
    encoding: null,
    env: tool.environment,
    maxBuffer: listing ? MAXIMUM_SOURCE_LIST_BYTES : MAXIMUM_TRANSLATION_UNIT_BYTES,
    shell: false,
    timeout: ARCHIVE_COMMAND_TIMEOUT_MS,
    windowsHide: true,
  });
}

export function codeqlArchiveListingEntries(listingBytes) {
  if (!Buffer.isBuffer(listingBytes) || listingBytes.length < 1 || listingBytes.length > MAXIMUM_SOURCE_LIST_BYTES) {
    throw new Error('Native quality CodeQL source inventory is malformed');
  }
  let memberCount = listingBytes.at(-1) === 0x0a ? 0 : 1;
  for (const byte of listingBytes) {
    if (byte !== 0x0a) continue;
    memberCount += 1;
    if (memberCount > MAXIMUM_SOURCE_ARCHIVE_MEMBERS) {
      throw new Error('Native quality CodeQL source inventory is malformed');
    }
  }
  let listing;
  try {
    listing = UTF8_DECODER.decode(listingBytes);
  } catch {
    throw new Error('Native quality CodeQL source inventory is malformed');
  }
  const listedEntries = listing.split(/\r?\n/u);
  if (listedEntries.at(-1) === '') listedEntries.pop();
  if (listedEntries.length !== memberCount || listedEntries.some((entry) => entry.length === 0)) {
    throw new Error('Native quality CodeQL source inventory is malformed');
  }
  return Object.freeze(
    listedEntries.map((entry) => checkedArchiveToolEntry(entry)).filter((entry) => !entry.endsWith('/')),
  );
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
  const result = runArchiveTool(verifiedArchiveTool(), 'list', metadata.archivePath);
  if (result.error || result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    throw new Error('Native quality CodeQL source inventory is unavailable');
  }
  const entries = codeqlArchiveListingEntries(result.stdout);
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
  const result = runArchiveTool(verifiedArchiveTool(), 'extract', inventory.metadata.archivePath, archiveEntry);
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
    file = readVerifiedRegularFileSync(source, { maximumBytes: MAXIMUM_TRANSLATION_UNIT_BYTES });
  } catch {
    throw new Error('Native quality workspace source is unavailable');
  }
  return boundedSha256(file.bytes);
}
