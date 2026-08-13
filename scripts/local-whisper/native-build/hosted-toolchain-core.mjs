import {
  chmodSync,
  closeSync,
  createReadStream,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { createGunzip, inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';

import { canonicalDigest, canonicalJson, sha256, validateRelativePath } from '../source-import/native-source-core.mjs';
import { readVerifiedRegularFileSync } from '../secure-file-reader.mjs';

export const HOSTED_TOOLCHAIN_ACQUISITION_SCHEMA_ID = 'local-whisper-hosted-toolchain-acquisition-lock-v1';
export const HOSTED_TOOLCHAIN_MATERIALIZATION_DIRECTORY = 'materialized-toolchain';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9.-]{0,127}$/u;
const FILE_MODE_PATTERN = /^(?:100644|100755)$/u;
const HOSTED_TOOLCHAIN_MANIFEST_KEYS = Object.freeze([
  '$schema',
  'schemaId',
  'manifestId',
  'manifestMode',
  'target',
  'records',
]);
const RECORD_KEYS = Object.freeze([
  'id',
  'target',
  'component',
  'roles',
  'origin',
  'transport',
  'provenance',
  'materialization',
  'license',
]);
const TARGET_KEYS = Object.freeze(['os', 'architecture']);
const ORIGIN_KEYS = Object.freeze(['uri', 'authority']);
const TRANSPORT_KEYS = Object.freeze(['byteLength', 'sha256']);
const PROVENANCE_KEYS = Object.freeze(['kind', 'identity', 'sha256']);
const MATERIALIZATION_KEYS = Object.freeze([
  'format',
  'expandedRegularBytes',
  'expandedRegularBytesCeiling',
  'entries',
  'xzDecoder',
]);
const MATERIALIZED_ENTRY_KEYS = Object.freeze(['path', 'entryType', 'byteLength', 'sha256', 'mode', 'linkTarget']);
const LICENSE_KEYS = Object.freeze(['recordId', 'path', 'sha256', 'spdxId']);
const ZIP_GENERAL_PURPOSE_ALLOWED_FLAGS = 0x800;
const ZIP_GENERAL_PURPOSE_ENCRYPTED_FLAG = 0x1;
const ZIP_GENERAL_PURPOSE_DATA_DESCRIPTOR_FLAG = 0x8;
const TAR_BLOCK_BYTES = 512;
const TAR_PAX_MAXIMUM_BYTES = 64 * 1024;
const TAR_GNU_LONG_PATH_MAXIMUM_BYTES = 64 * 1024;
const TAR_ACCEPTED_MAGICS = new Set(['ustar', 'ustar ']);
const CRC32_TABLE = Object.freeze(
  Array.from({ length: 256 }, (_value, index) => {
    let current = index;
    for (let bit = 0; bit < 8; bit += 1) current = (current >>> 1) ^ (current & 1 ? 0xedb88320 : 0);
    return current >>> 0;
  }),
);

function fail(message) {
  throw new Error(`Hosted toolchain acquisition contract failed: ${message}`);
}

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function assertExactKeys(value, expectedKeys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${label} has unexpected or missing keys`);
  }
}

function assertSafeId(value, label) {
  if (typeof value !== 'string' || !SAFE_ID_PATTERN.test(value)) fail(`${label} is invalid`);
}

function assertSha256(value, label) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) fail(`${label} must be a SHA-256`);
}

function assertByteLength(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) fail(`${label} must be a positive safe integer`);
}

function assertTarget(target, label) {
  assertRecord(target, label);
  assertExactKeys(target, TARGET_KEYS, label);
  if (!['linux', 'windows'].includes(target.os) || target.architecture !== 'x64') {
    fail(`${label} target is unsupported`);
  }
}

function assertPathInside(root, candidate, label) {
  const child = relative(root, candidate);
  if (child === '' || child.startsWith('..') || isAbsolute(child)) fail(`${label} escaped its bounded root`);
  return candidate;
}

function assertFreshAttemptRoot(attemptRoot) {
  if (!isAbsolute(attemptRoot)) fail('attempt root must be absolute');
  if (existsSync(attemptRoot)) {
    const metadata = lstatSync(attemptRoot);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || readdirSync(attemptRoot).length !== 0) {
      fail('attempt root must be a fresh empty directory');
    }
    return;
  }
  mkdirSync(attemptRoot, { mode: 0o700, recursive: true });
}

function assertOrigin(origin, manifestMode, label) {
  assertRecord(origin, label);
  assertExactKeys(origin, ORIGIN_KEYS, label);
  if (typeof origin.uri !== 'string' || typeof origin.authority !== 'string' || origin.authority.length === 0) {
    fail(`${label} is malformed`);
  }
  let parsed;
  try {
    parsed = new URL(origin.uri);
  } catch {
    fail(`${label} URI is invalid`);
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== origin.authority ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    /(?:^|[-/_])(?:latest|main|master|stable)(?:[-/_]|$)/iu.test(parsed.pathname)
  ) {
    fail(`${label} is mutable, mirrored, or not an exact HTTPS origin`);
  }
  if (manifestMode === 'fixture' && origin.authority !== 'fixture.invalid') {
    fail(`${label} fixture authority is not exact`);
  }
}

function assertMaterializedEntry(entry, label) {
  assertRecord(entry, label);
  assertExactKeys(entry, MATERIALIZED_ENTRY_KEYS, label);
  if (typeof entry.path !== 'string') fail(`${label} path is invalid`);
  try {
    validateRelativePath(entry.path);
  } catch {
    fail(`${label} path is unsafe`);
  }
  assertByteLength(entry.byteLength, `${label} byteLength`);
  assertSha256(entry.sha256, `${label} sha256`);
  if (entry.entryType === 'regular') {
    if (entry.linkTarget !== null) fail(`${label} regular entry has an unexpected link target`);
    if (typeof entry.mode !== 'string' || !FILE_MODE_PATTERN.test(entry.mode)) fail(`${label} mode is invalid`);
    return;
  }
  if (entry.entryType !== 'symbolic-link' || entry.mode !== '120777' || typeof entry.linkTarget !== 'string') {
    fail(`${label} entry type is not permitted`);
  }
  try {
    const targetWithoutLeadingCurrentDirectory = entry.linkTarget.startsWith('./')
      ? entry.linkTarget.slice('./'.length)
      : entry.linkTarget;
    if (
      entry.linkTarget.startsWith('/') ||
      entry.linkTarget.includes('\\') ||
      targetWithoutLeadingCurrentDirectory.length === 0 ||
      targetWithoutLeadingCurrentDirectory.split('/').some((part) => part === '' || part === '.' || part === '..')
    ) {
      throw new Error('unsafe link target');
    }
  } catch {
    fail(`${label} link target is unsafe`);
  }
  const linkBytes = Buffer.from(entry.linkTarget, 'utf8');
  if (linkBytes.byteLength !== entry.byteLength || sha256(linkBytes) !== entry.sha256) {
    fail(`${label} link identity is invalid`);
  }
}

/** Validates exact materialization entries before raw-file copy or ZIP extraction. */
export function validateHostedArchiveEntries(entries, expandedRegularBytesCeiling) {
  if (!Array.isArray(entries) || entries.length === 0) fail('archive has no entries');
  assertByteLength(expandedRegularBytesCeiling, 'archive expanded byte ceiling');
  const caseFoldedPaths = new Set();
  let expandedRegularBytes = 0;
  for (const [index, entry] of entries.entries()) {
    assertMaterializedEntry(entry, `archive entry ${index}`);
    const caseFoldedPath = entry.path.toLocaleLowerCase('en-US');
    if (caseFoldedPaths.has(caseFoldedPath)) fail('archive contains a duplicate or case-fold-colliding path');
    caseFoldedPaths.add(caseFoldedPath);
    if (entry.entryType === 'regular') expandedRegularBytes += entry.byteLength;
    if (!Number.isSafeInteger(expandedRegularBytes) || expandedRegularBytes > expandedRegularBytesCeiling) {
      fail('archive expanded bytes exceed the declared ceiling');
    }
  }
  return true;
}

function assertRecordContract(record, manifestTarget, manifestMode, knownIds) {
  assertRecord(record, 'record');
  assertExactKeys(record, RECORD_KEYS, 'record');
  assertSafeId(record.id, 'record ID');
  if (knownIds.has(record.id)) fail(`duplicate record ID: ${record.id}`);
  knownIds.add(record.id);
  assertTarget(record.target, `record ${record.id} target`);
  if (canonicalJson(record.target) !== canonicalJson(manifestTarget)) {
    fail(`record ${record.id} target differs from its manifest target`);
  }
  assertSafeId(record.component, `record ${record.id} component`);
  if (!Array.isArray(record.roles) || record.roles.length === 0) fail(`record ${record.id} has no permitted role`);
  for (const role of record.roles) assertSafeId(role, `record ${record.id} role`);
  if (new Set(record.roles).size !== record.roles.length) fail(`record ${record.id} repeats a role`);
  assertOrigin(record.origin, manifestMode, `record ${record.id} origin`);
  assertRecord(record.transport, `record ${record.id} transport`);
  assertExactKeys(record.transport, TRANSPORT_KEYS, `record ${record.id} transport`);
  assertByteLength(record.transport.byteLength, `record ${record.id} transport byteLength`);
  assertSha256(record.transport.sha256, `record ${record.id} transport sha256`);
  assertRecord(record.provenance, `record ${record.id} provenance`);
  assertExactKeys(record.provenance, PROVENANCE_KEYS, `record ${record.id} provenance`);
  if (
    !['fixture-signature', 'repository-provenance', 'vendor-signature'].includes(record.provenance.kind) ||
    (manifestMode === 'production' && record.provenance.kind === 'fixture-signature') ||
    (manifestMode === 'fixture' && record.provenance.kind !== 'fixture-signature') ||
    typeof record.provenance.identity !== 'string' ||
    record.provenance.identity.length === 0
  ) {
    fail(`record ${record.id} provenance is not permitted`);
  }
  assertSha256(record.provenance.sha256, `record ${record.id} provenance sha256`);
  if (record.provenance.kind === 'fixture-signature' && record.provenance.sha256 !== record.transport.sha256) {
    fail(`record ${record.id} fixture provenance does not bind the transport object`);
  }
  assertRecord(record.materialization, `record ${record.id} materialization`);
  assertExactKeys(record.materialization, MATERIALIZATION_KEYS, `record ${record.id} materialization`);
  if (!['raw-file', 'zip', 'tar-gzip', 'tar-xz'].includes(record.materialization.format)) {
    fail(`record ${record.id} extraction format is unsupported`);
  }
  if (record.materialization.format === 'tar-xz') {
    assertRecord(record.materialization.xzDecoder, `record ${record.id} XZ decoder`);
    assertExactKeys(
      record.materialization.xzDecoder,
      ['recordId', 'modulePath', 'exportName'],
      `record ${record.id} XZ decoder`,
    );
    assertSafeId(record.materialization.xzDecoder.recordId, `record ${record.id} XZ decoder record ID`);
    try {
      validateRelativePath(record.materialization.xzDecoder.modulePath);
    } catch {
      fail(`record ${record.id} XZ decoder module path is unsafe`);
    }
    if (record.materialization.xzDecoder.exportName !== 'XzReadableStream') {
      fail(`record ${record.id} XZ decoder export is invalid`);
    }
  } else if (record.materialization.xzDecoder !== null) {
    fail(`record ${record.id} has an unexpected XZ decoder`);
  }
  assertByteLength(record.materialization.expandedRegularBytes, `record ${record.id} expandedRegularBytes`);
  assertByteLength(
    record.materialization.expandedRegularBytesCeiling,
    `record ${record.id} expandedRegularBytesCeiling`,
  );
  if (record.materialization.expandedRegularBytes > record.materialization.expandedRegularBytesCeiling) {
    fail(`record ${record.id} extraction size exceeds its ceiling`);
  }
  if (!Array.isArray(record.materialization.entries) || record.materialization.entries.length === 0) {
    fail(`record ${record.id} materialization has no entries`);
  }
  if (record.materialization.format === 'raw-file' && record.materialization.entries.length !== 1) {
    fail(`record ${record.id} raw-file materialization must contain exactly one entry`);
  }
  const expandedRegularBytes = record.materialization.entries.reduce(
    (total, entry) => total + (entry.entryType === 'regular' ? entry.byteLength : 0),
    0,
  );
  if (
    !Number.isSafeInteger(expandedRegularBytes) ||
    expandedRegularBytes !== record.materialization.expandedRegularBytes
  ) {
    fail(`record ${record.id} materialization expanded byte count is invalid`);
  }
  validateHostedArchiveEntries(record.materialization.entries, record.materialization.expandedRegularBytesCeiling);
  const [entry] = record.materialization.entries;
  if (
    record.materialization.format === 'raw-file' &&
    (entry.entryType !== 'regular' ||
      entry.byteLength !== record.transport.byteLength ||
      entry.sha256 !== record.transport.sha256)
  ) {
    fail(`record ${record.id} transport and materialized file identities differ`);
  }
  assertRecord(record.license, `record ${record.id} license`);
  assertExactKeys(record.license, LICENSE_KEYS, `record ${record.id} license`);
  assertSafeId(record.license.recordId, `record ${record.id} license record ID`);
  if (
    typeof record.license.path !== 'string' ||
    typeof record.license.spdxId !== 'string' ||
    record.license.spdxId.length === 0
  ) {
    fail(`record ${record.id} license is malformed`);
  }
  assertSha256(record.license.sha256, `record ${record.id} license sha256`);
}

/** Validates a fully pinned hosted toolchain acquisition manifest without fetching anything. */
export function validateHostedToolchainManifest(manifest) {
  assertRecord(manifest, 'manifest');
  assertExactKeys(manifest, HOSTED_TOOLCHAIN_MANIFEST_KEYS, 'manifest');
  if (manifest.schemaId !== HOSTED_TOOLCHAIN_ACQUISITION_SCHEMA_ID) fail('manifest schema ID is invalid');
  assertSafeId(manifest.manifestId, 'manifest ID');
  if (!['fixture', 'production'].includes(manifest.manifestMode)) fail('manifest mode is invalid');
  assertTarget(manifest.target, 'manifest target');
  if (!Array.isArray(manifest.records) || manifest.records.length === 0) fail('manifest has no records');
  const knownIds = new Set();
  for (const record of manifest.records) {
    assertRecordContract(record, manifest.target, manifest.manifestMode, knownIds);
  }
  const recordsById = new Map(manifest.records.map((record) => [record.id, record]));
  for (const record of manifest.records) {
    if (record.materialization.format === 'tar-xz') {
      const decoder = record.materialization.xzDecoder;
      const decoderRecord = recordsById.get(decoder.recordId);
      const decoderEntry = decoderRecord?.materialization.entries.find(
        (entry) => entry.path === decoder.modulePath && entry.entryType === 'regular',
      );
      if (
        !decoderRecord ||
        !decoderRecord.roles.includes('xz-decoder') ||
        !decoderEntry ||
        decoder.recordId === record.id ||
        manifest.records.indexOf(decoderRecord) >= manifest.records.indexOf(record)
      ) {
        fail(`record ${record.id} XZ decoder is not bound to a reviewed decoder record`);
      }
    }
    const licenseRecord = recordsById.get(record.license.recordId);
    const licenseEntry = licenseRecord?.materialization.entries.find(
      (entry) =>
        entry.path === record.license.path && entry.entryType === 'regular' && entry.sha256 === record.license.sha256,
    );
    if (!licenseEntry) fail(`record ${record.id} license is not bound to a materialized license record`);
  }
  return true;
}

function sourceForRecord(sourceFiles, recordId) {
  if (!sourceFiles || typeof sourceFiles !== 'object' || Array.isArray(sourceFiles)) {
    fail('source files must be an ID-keyed object');
  }
  const source = sourceFiles[recordId];
  if (typeof source !== 'string' || !isAbsolute(source)) fail(`record ${recordId} source is missing or not absolute`);
  if (!existsSync(source)) fail(`record ${recordId} source does not exist`);
  const metadata = lstatSync(source);
  if (!metadata.isFile() || metadata.isSymbolicLink()) fail(`record ${recordId} source is not a regular file`);
  return realpathSync(source);
}

function assertExactSourceIds(sourceFiles, manifest) {
  const actual = Object.keys(sourceFiles ?? {}).sort();
  const expected = manifest.records.map((record) => record.id).sort();
  if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) {
    fail('source file IDs do not exactly match the manifest records');
  }
}

function verifiedSourceIdentity(source, record) {
  const bytes = readFileSync(source);
  if (bytes.byteLength !== record.transport.byteLength || sha256(bytes) !== record.transport.sha256) {
    fail(`record ${record.id} transport object identity changed`);
  }
  return bytes;
}

function readUInt16(bytes, offset, label) {
  if (offset < 0 || offset + 2 > bytes.byteLength) fail(`${label} is truncated`);
  return bytes.readUInt16LE(offset);
}

function readUInt32(bytes, offset, label) {
  if (offset < 0 || offset + 4 > bytes.byteLength) fail(`${label} is truncated`);
  return bytes.readUInt32LE(offset);
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function findZipEndOfCentralDirectory(bytes) {
  const minimum = 22;
  if (bytes.byteLength < minimum) fail('ZIP object is truncated');
  const firstOffset = Math.max(0, bytes.byteLength - minimum - 0xffff);
  for (let offset = bytes.byteLength - minimum; offset >= firstOffset; offset -= 1) {
    if (readUInt32(bytes, offset, 'ZIP end of central directory') === 0x06054b50) return offset;
  }
  fail('ZIP end of central directory is absent');
}

function archivePath(value, label) {
  if (typeof value !== 'string' || value.includes('\u0000')) fail(`${label} path is invalid`);
  const normalized = value.endsWith('/') ? value.slice(0, -1) : value;
  if (normalized.length === 0) fail(`${label} path is empty`);
  try {
    validateRelativePath(normalized);
  } catch {
    fail(`${label} path is unsafe`);
  }
  return normalized;
}

function decodeZipPath(bytes, label) {
  if (bytes.includes(0) || bytes.some((byte) => byte > 0x7f)) fail(`${label} path is not portable ASCII`);
  return bytes.toString('ascii');
}

function decompressZipEntry(bytes, localOffset, central, expected, entryPath) {
  if (readUInt32(bytes, localOffset, `ZIP local entry ${entryPath}`) !== 0x04034b50) {
    fail(`ZIP local entry ${entryPath} signature is invalid`);
  }
  const localFlags = readUInt16(bytes, localOffset + 6, `ZIP local entry ${entryPath}`);
  const localCompressionMethod = readUInt16(bytes, localOffset + 8, `ZIP local entry ${entryPath}`);
  const localCrc32 = readUInt32(bytes, localOffset + 14, `ZIP local entry ${entryPath}`);
  const localCompressedSize = readUInt32(bytes, localOffset + 18, `ZIP local entry ${entryPath}`);
  const localUncompressedSize = readUInt32(bytes, localOffset + 22, `ZIP local entry ${entryPath}`);
  const localNameLength = readUInt16(bytes, localOffset + 26, `ZIP local entry ${entryPath}`);
  const localExtraLength = readUInt16(bytes, localOffset + 28, `ZIP local entry ${entryPath}`);
  const localNameOffset = localOffset + 30;
  const localNameEnd = localNameOffset + localNameLength;
  const localName = bytes.subarray(localNameOffset, localNameEnd);
  if (!localName.equals(central.name)) fail(`ZIP local entry ${entryPath} name differs from the central directory`);
  if (
    localFlags !== central.flags ||
    localCompressionMethod !== central.compressionMethod ||
    localCrc32 !== central.crc32 ||
    localCompressedSize !== central.compressedSize ||
    localUncompressedSize !== central.uncompressedSize
  ) {
    fail(`ZIP local entry ${entryPath} metadata differs from the central directory`);
  }
  const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
  const dataEnd = dataOffset + central.compressedSize;
  if (dataEnd > central.directoryOffset) fail(`ZIP entry ${entryPath} payload overlaps the central directory`);
  const compressed = bytes.subarray(dataOffset, dataEnd);
  let output;
  try {
    output =
      central.compressionMethod === 0
        ? compressed
        : inflateRawSync(compressed, { maxOutputLength: expected.byteLength });
  } catch {
    fail(`ZIP entry ${entryPath} decompression failed`);
  }
  if (
    output.byteLength !== central.uncompressedSize ||
    output.byteLength !== expected.byteLength ||
    crc32(output) !== central.crc32
  ) {
    fail(`ZIP entry ${entryPath} identity changed during decompression`);
  }
  return { endOffset: dataEnd, output, startOffset: localOffset };
}

function extractZipEntries(bytes, record) {
  const endOffset = findZipEndOfCentralDirectory(bytes);
  if (
    readUInt16(bytes, endOffset + 4, 'ZIP end of central directory') !== 0 ||
    readUInt16(bytes, endOffset + 6, 'ZIP end of central directory') !== 0
  ) {
    fail(`record ${record.id} ZIP uses multiple disks`);
  }
  const entriesOnThisDisk = readUInt16(bytes, endOffset + 8, 'ZIP end of central directory');
  const entryCount = readUInt16(bytes, endOffset + 10, 'ZIP end of central directory');
  const centralDirectorySize = readUInt32(bytes, endOffset + 12, 'ZIP end of central directory');
  const centralDirectoryOffset = readUInt32(bytes, endOffset + 16, 'ZIP end of central directory');
  const commentLength = readUInt16(bytes, endOffset + 20, 'ZIP end of central directory');
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (
    entriesOnThisDisk !== entryCount ||
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff ||
    !Number.isSafeInteger(centralDirectoryEnd) ||
    centralDirectoryEnd !== endOffset ||
    endOffset + 22 + commentLength !== bytes.byteLength
  ) {
    fail(`record ${record.id} ZIP uses unsupported ZIP64 or invalid central directory metadata`);
  }
  const expectedEntries = new Map(record.materialization.entries.map((entry) => [entry.path, entry]));
  const extracted = new Map();
  const caseFoldedPaths = new Set();
  const localEntryRanges = [];
  let offset = centralDirectoryOffset;
  let regularEntryCount = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(bytes, offset, `ZIP central entry ${index}`) !== 0x02014b50) {
      fail(`record ${record.id} ZIP central entry ${index} signature is invalid`);
    }
    const versionMadeBy = readUInt16(bytes, offset + 4, `ZIP central entry ${index}`);
    const flags = readUInt16(bytes, offset + 8, `ZIP central entry ${index}`);
    const compressionMethod = readUInt16(bytes, offset + 10, `ZIP central entry ${index}`);
    const crc = readUInt32(bytes, offset + 16, `ZIP central entry ${index}`);
    const compressedSize = readUInt32(bytes, offset + 20, `ZIP central entry ${index}`);
    const uncompressedSize = readUInt32(bytes, offset + 24, `ZIP central entry ${index}`);
    const nameLength = readUInt16(bytes, offset + 28, `ZIP central entry ${index}`);
    const extraLength = readUInt16(bytes, offset + 30, `ZIP central entry ${index}`);
    const commentLength = readUInt16(bytes, offset + 32, `ZIP central entry ${index}`);
    const externalAttributes = readUInt32(bytes, offset + 38, `ZIP central entry ${index}`);
    const localOffset = readUInt32(bytes, offset + 42, `ZIP central entry ${index}`);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (!Number.isSafeInteger(nextOffset) || nextOffset > centralDirectoryEnd) {
      fail(`record ${record.id} ZIP central entry ${index} is truncated`);
    }
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength);
    const name = decodeZipPath(nameBytes, `ZIP central entry ${index}`);
    const path = archivePath(name, `ZIP central entry ${index}`);
    const unixFileType = versionMadeBy >>> 8 === 3 ? (externalAttributes >>> 16) & 0o170000 : 0;
    const directory = name.endsWith('/');
    if (unixFileType === 0o120000 || (!directory && unixFileType !== 0 && unixFileType !== 0o100000)) {
      fail(`record ${record.id} ZIP contains a link or special file: ${path}`);
    }
    const caseFoldedPath = path.toLocaleLowerCase('en-US');
    if (caseFoldedPaths.has(caseFoldedPath)) fail(`record ${record.id} ZIP has a duplicate or case-fold collision`);
    caseFoldedPaths.add(caseFoldedPath);
    if (directory) {
      if (![...expectedEntries.keys()].some((expectedPath) => expectedPath.startsWith(`${path}/`))) {
        fail(`record ${record.id} ZIP contains an undeclared directory: ${path}`);
      }
      offset = nextOffset;
      continue;
    }
    if (
      (flags & ZIP_GENERAL_PURPOSE_ENCRYPTED_FLAG) !== 0 ||
      (flags & ZIP_GENERAL_PURPOSE_DATA_DESCRIPTOR_FLAG) !== 0 ||
      (flags & ~ZIP_GENERAL_PURPOSE_ALLOWED_FLAGS) !== 0 ||
      ![0, 8].includes(compressionMethod)
    ) {
      fail(`record ${record.id} ZIP entry ${path} is encrypted or uses unsupported compression`);
    }
    const expected = expectedEntries.get(path);
    if (!expected) fail(`record ${record.id} ZIP contains an undeclared file: ${path}`);
    if (uncompressedSize !== expected.byteLength) fail(`record ${record.id} ZIP entry ${path} size is undeclared`);
    const extractedEntry = decompressZipEntry(
      bytes,
      localOffset,
      {
        compressedSize,
        compressionMethod,
        crc32: crc,
        directoryOffset: centralDirectoryOffset,
        flags,
        name: nameBytes,
        uncompressedSize,
      },
      expected,
      path,
    );
    if (
      localEntryRanges.some(
        (range) => extractedEntry.startOffset < range.endOffset && range.startOffset < extractedEntry.endOffset,
      )
    ) {
      fail(`record ${record.id} ZIP local entries overlap`);
    }
    localEntryRanges.push(extractedEntry);
    if (sha256(extractedEntry.output) !== expected.sha256) {
      fail(`record ${record.id} ZIP entry identity changed: ${path}`);
    }
    extracted.set(path, extractedEntry.output);
    regularEntryCount += 1;
    offset = nextOffset;
  }
  if (
    offset !== centralDirectoryEnd ||
    regularEntryCount !== expectedEntries.size ||
    extracted.size !== expectedEntries.size
  ) {
    fail(`record ${record.id} ZIP does not exactly match its declared file manifest`);
  }
  return extracted;
}

function tarString(header, start, length, label) {
  const value = header.subarray(start, start + length);
  const terminator = value.indexOf(0);
  const textBytes = terminator < 0 ? value : value.subarray(0, terminator);
  if (
    (terminator >= 0 && value.subarray(terminator).some((byte) => byte !== 0)) ||
    textBytes.some((byte) => byte < 0x20 || byte > 0x7e)
  ) {
    fail(`${label} is not portable ASCII`);
  }
  return textBytes.toString('ascii');
}

function tarOctal(header, start, length, label) {
  const field = header
    .subarray(start, start + length)
    .toString('ascii')
    .replace(/[\0 ]+$/u, '')
    .trim();
  if (!/^[0-7]*$/u.test(field)) fail(`${label} is not octal`);
  const value = field === '' ? 0 : Number.parseInt(field, 8);
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} is unsafe`);
  return value;
}

function parseTarHeader(header) {
  if (header.byteLength !== TAR_BLOCK_BYTES) fail('TAR header is truncated');
  let checksum = 0;
  for (let index = 0; index < header.byteLength; index += 1)
    checksum += index >= 148 && index < 156 ? 0x20 : header[index];
  const declaredChecksum = tarOctal(header, 148, 8, 'TAR header checksum');
  if (declaredChecksum !== checksum) fail(`TAR header checksum is invalid: ${declaredChecksum} !== ${checksum}`);
  const magic = tarString(header, 257, 6, 'TAR header magic');
  if (!TAR_ACCEPTED_MAGICS.has(magic)) fail('TAR header is not USTAR');
  const name = tarString(header, 0, 100, 'TAR header name');
  const prefix = tarString(header, 345, 155, 'TAR header prefix');
  const typeByte = header[156];
  const type = typeByte === 0 ? '0' : String.fromCharCode(typeByte);
  return Object.freeze({
    linkTarget: tarString(header, 157, 100, 'TAR header link target'),
    mode: tarOctal(header, 100, 8, 'TAR header mode'),
    path: prefix === '' ? name : `${prefix}/${name}`,
    size: tarOctal(header, 124, 12, 'TAR header size'),
    type,
  });
}

function parsePaxRecords(bytes) {
  const values = Object.create(null);
  let offset = 0;
  while (offset < bytes.byteLength) {
    const separator = bytes.indexOf(0x20, offset);
    if (separator < 0) fail('TAR PAX record length is absent');
    const lengthText = bytes.subarray(offset, separator).toString('ascii');
    if (!/^[1-9]\d*$/u.test(lengthText)) fail('TAR PAX record length is invalid');
    const length = Number(lengthText);
    const end = offset + length;
    if (!Number.isSafeInteger(end) || end > bytes.byteLength || bytes[end - 1] !== 0x0a) {
      fail('TAR PAX record is truncated');
    }
    const payload = bytes.subarray(separator + 1, end - 1);
    const equals = payload.indexOf(0x3d);
    if (equals < 1 || payload.some((byte) => byte < 0x20 || byte > 0x7e)) fail('TAR PAX record is invalid');
    const key = payload.subarray(0, equals).toString('ascii');
    const value = payload.subarray(equals + 1).toString('ascii');
    if (!['path', 'linkpath'].includes(key) || Object.hasOwn(values, key)) fail('TAR PAX record is not permitted');
    values[key] = value;
    offset = end;
  }
  return values;
}

function parseGnuLongPath(bytes) {
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > TAR_GNU_LONG_PATH_MAXIMUM_BYTES ||
    bytes.at(-1) !== 0 ||
    bytes.subarray(0, -1).some((byte) => byte < 0x20 || byte > 0x7e)
  ) {
    fail('TAR GNU long path is invalid');
  }
  return bytes.subarray(0, -1).toString('ascii');
}

function resolvedTarPath(value, label) {
  try {
    validateRelativePath(value);
  } catch {
    fail(`${label} path is unsafe`);
  }
  return value;
}

function validateTarLinkGraph(entries) {
  const expected = new Map(entries.map((entry) => [entry.path, entry]));
  for (const entry of entries) {
    if (entry.entryType !== 'symbolic-link') continue;
    let current = entry;
    const visited = new Set();
    while (current.entryType === 'symbolic-link') {
      if (visited.has(current.path)) fail(`TAR symbolic link cycle: ${entry.path}`);
      visited.add(current.path);
      const targetPath = posix.normalize(posix.join(posix.dirname(current.path), current.linkTarget));
      if (targetPath === '..' || targetPath.startsWith('../') || targetPath.startsWith('/')) {
        fail(`TAR symbolic link escapes its component: ${entry.path}`);
      }
      current = expected.get(targetPath);
      if (!current) fail(`TAR symbolic link target is undeclared: ${entry.path}`);
    }
  }
}

function writeTarRegularChunk(current, chunk, record) {
  let writtenOffset = 0;
  while (writtenOffset < chunk.byteLength) {
    const written = writeSync(current.descriptor, chunk, writtenOffset, chunk.byteLength - writtenOffset);
    if (!Number.isSafeInteger(written) || written <= 0) {
      fail(`record ${record.id} TAR entry write failed: ${current.expected.path}`);
    }
    writtenOffset += written;
  }
  current.hash.update(chunk);
  current.byteLength += chunk.byteLength;
}

function consumeTarEntryChunk(current, chunk, record) {
  if (current.kind === 'regular') {
    writeTarRegularChunk(current, chunk, record);
    return;
  }
  if (current.kind === 'pax' || current.kind === 'gnu-long-path') current.chunks.push(chunk);
}

function gnuLongPathEntry(header, record, overrides, currentLongPath) {
  if (header.type !== 'L') return null;
  if (
    overrides !== null ||
    currentLongPath !== null ||
    header.path !== '././@LongLink' ||
    header.linkTarget !== '' ||
    header.mode !== 0o644 ||
    header.size === 0 ||
    header.size > TAR_GNU_LONG_PATH_MAXIMUM_BYTES
  ) {
    fail(`record ${record.id} TAR GNU long path entry is invalid`);
  }
  return {
    chunks: [],
    kind: 'gnu-long-path',
    padding: (TAR_BLOCK_BYTES - (header.size % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES,
    remaining: header.size,
    size: header.size,
  };
}

async function extractTarEntries(readable, record, recordRoot) {
  const expected = new Map(record.materialization.entries.map((entry) => [entry.path, entry]));
  const extracted = new Set();
  let pending = Buffer.alloc(0);
  let current = null;
  let gnuLongPath = null;
  let pax = null;
  let zeroBlocks = 0;
  const finishCurrent = () => {
    if (!current || current.remaining !== 0 || current.finished) return;
    current.finished = true;
    if (current.kind === 'regular') {
      const descriptor = current.descriptor;
      try {
        closeSync(descriptor);
      } finally {
        current.descriptor = null;
      }
      if (
        current.byteLength !== current.expected.byteLength ||
        current.hash.digest('hex') !== current.expected.sha256
      ) {
        fail(`record ${record.id} TAR entry identity changed: ${current.expected.path}`);
      }
      extracted.add(current.expected.path);
    } else if (current.kind === 'pax') {
      pax = parsePaxRecords(Buffer.concat(current.chunks, current.size));
    } else if (current.kind === 'gnu-long-path') {
      gnuLongPath = parseGnuLongPath(Buffer.concat(current.chunks, current.size));
    }
  };
  const startEntry = (header) => {
    const overrides = pax;
    pax = null;
    const gnuEntry = gnuLongPathEntry(header, record, overrides, gnuLongPath);
    if (gnuEntry) return gnuEntry;
    if (header.type === 'x' && gnuLongPath !== null)
      fail(`record ${record.id} TAR GNU long path is not followed by an entry`);
    const rawPath = gnuLongPath ?? overrides?.path ?? header.path;
    gnuLongPath = null;
    const path = resolvedTarPath(
      header.type === '5' && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath,
      `record ${record.id} TAR entry`,
    );
    const linkTarget = overrides?.linkpath ?? header.linkTarget;
    if (header.type === 'x') {
      if (header.size > TAR_PAX_MAXIMUM_BYTES || path === '') fail(`record ${record.id} TAR PAX entry is invalid`);
      return {
        chunks: [],
        kind: 'pax',
        padding: (TAR_BLOCK_BYTES - (header.size % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES,
        remaining: header.size,
        size: header.size,
      };
    }
    if (!['0', '5', '2'].includes(header.type)) fail(`record ${record.id} TAR entry type is unsupported`);
    if (header.type === '5') {
      if (header.size !== 0 || header.linkTarget !== '' || header.mode !== 0o755 || expected.has(path))
        fail(`record ${record.id} TAR directory metadata is invalid`);
      return { kind: 'skip', padding: 0, remaining: 0, size: 0 };
    }
    const expectedEntry = expected.get(path);
    if (!expectedEntry || extracted.has(path))
      fail(`record ${record.id} TAR entry is undeclared or duplicated: ${path}`);
    if (header.type === '0') {
      if (
        expectedEntry.entryType !== 'regular' ||
        header.size !== expectedEntry.byteLength ||
        header.mode !== Number.parseInt(expectedEntry.mode.slice(3), 8)
      ) {
        fail(`record ${record.id} TAR regular entry metadata is invalid: ${path}`);
      }
      const destination = resolve(recordRoot, ...expectedEntry.path.split('/'));
      assertPathInside(recordRoot, destination, `record ${record.id} TAR destination`);
      mkdirSync(dirname(destination), { mode: 0o700, recursive: true });
      assertNoSymlinkPathComponent(recordRoot, destination, `record ${record.id} TAR destination`);
      return {
        byteLength: 0,
        descriptor: openSync(destination, 'wx', expectedEntry.mode === '100755' ? 0o500 : 0o400),
        expected: expectedEntry,
        hash: createHash('sha256'),
        kind: 'regular',
        padding: (TAR_BLOCK_BYTES - (header.size % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES,
        remaining: header.size,
        size: header.size,
      };
    }
    if (
      expectedEntry.entryType !== 'symbolic-link' ||
      header.size !== 0 ||
      header.mode !== 0o777 ||
      linkTarget !== expectedEntry.linkTarget
    ) {
      fail(`record ${record.id} TAR symbolic link metadata is invalid: ${path}`);
    }
    extracted.add(path);
    return { kind: 'skip', padding: 0, remaining: 0, size: 0 };
  };
  const consume = () => {
    while (true) {
      if (current) {
        if (current.remaining > 0) {
          if (pending.byteLength === 0) return;
          const take = Math.min(current.remaining, pending.byteLength);
          const chunk = pending.subarray(0, take);
          consumeTarEntryChunk(current, chunk, record);
          current.remaining -= take;
          pending = pending.subarray(take);
          continue;
        }
        finishCurrent();
        if (current.padding > 0) {
          if (pending.byteLength < current.padding) return;
          pending = pending.subarray(current.padding);
        }
        current = null;
        continue;
      }
      if (pending.byteLength < TAR_BLOCK_BYTES) return;
      const header = pending.subarray(0, TAR_BLOCK_BYTES);
      pending = pending.subarray(TAR_BLOCK_BYTES);
      if (header.every((byte) => byte === 0)) {
        zeroBlocks += 1;
        continue;
      }
      if (zeroBlocks > 0) fail(`record ${record.id} TAR contains trailing data after its terminator`);
      current = startEntry(parseTarHeader(header));
    }
  };
  try {
    for await (const chunk of readable) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (zeroBlocks > 0 && bytes.some((byte) => byte !== 0)) fail(`record ${record.id} TAR contains trailing data`);
      pending = pending.byteLength === 0 ? bytes : Buffer.concat([pending, bytes]);
      consume();
    }
    consume();
  } catch (error) {
    if (current?.kind === 'regular' && current.descriptor !== null) {
      try {
        closeSync(current.descriptor);
      } catch {
        // Preserve the materialization error that triggered cleanup.
      }
      current.descriptor = null;
    }
    throw error;
  }
  if (current || pending.byteLength !== 0 || zeroBlocks < 2 || gnuLongPath !== null || pax !== null)
    fail(`record ${record.id} TAR is truncated`);
  if (extracted.size !== expected.size) fail(`record ${record.id} TAR is incomplete`);
  validateTarLinkGraph(record.materialization.entries);
  for (const entry of record.materialization.entries) {
    if (entry.entryType !== 'symbolic-link') continue;
    const destination = resolve(recordRoot, ...entry.path.split('/'));
    assertPathInside(recordRoot, destination, `record ${record.id} TAR symbolic link destination`);
    mkdirSync(dirname(destination), { mode: 0o700, recursive: true });
    assertNoSymlinkPathComponent(recordRoot, destination, `record ${record.id} TAR symbolic link destination`);
    symlinkSync(entry.linkTarget, destination);
  }
}

function materializedEntries(record, sourceBytes) {
  if (record.materialization.format === 'raw-file') {
    return new Map([[record.materialization.entries[0].path, sourceBytes]]);
  }
  return extractZipEntries(sourceBytes, record);
}

async function verifyStreamedSourceIdentity(source, record) {
  const hash = createHash('sha256');
  let byteLength = 0;
  for await (const chunk of createReadStream(source)) {
    byteLength += chunk.byteLength;
    if (!Number.isSafeInteger(byteLength) || byteLength > record.transport.byteLength) {
      fail(`record ${record.id} transport object length changed`);
    }
    hash.update(chunk);
  }
  if (byteLength !== record.transport.byteLength || hash.digest('hex') !== record.transport.sha256) {
    fail(`record ${record.id} transport object identity changed`);
  }
}

function tarReadable(record, source, materializedRoot, recordsById) {
  if (record.materialization.format === 'tar-gzip') return createReadStream(source).pipe(createGunzip());
  const decoder = record.materialization.xzDecoder;
  const decoderRecord = recordsById.get(decoder.recordId);
  const decoderEntry = decoderRecord.materialization.entries.find((entry) => entry.path === decoder.modulePath);
  const decoderPath = destinationForEntry(materializedRoot, decoderRecord, decoderEntry);
  assertNoSymlinkPathComponent(materializedRoot, decoderPath, `record ${record.id} XZ decoder`);
  const { bytes: decoderBytes, stat: metadata } = readVerifiedRegularFileSync(decoderPath);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    decoderBytes.byteLength !== decoderEntry.byteLength ||
    sha256(decoderBytes) !== decoderEntry.sha256
  ) {
    fail(`record ${record.id} XZ decoder identity changed`);
  }
  let loaded;
  try {
    loaded = createRequire(import.meta.url)(decoderPath);
  } catch {
    fail(`record ${record.id} XZ decoder failed to load`);
  }
  const XzReadableStream = loaded?.[decoder.exportName];
  if (typeof XzReadableStream !== 'function') fail(`record ${record.id} XZ decoder export is unavailable`);
  let decoded;
  try {
    decoded = new XzReadableStream(Readable.toWeb(createReadStream(source)));
  } catch {
    fail(`record ${record.id} XZ decoder rejected the transport object`);
  }
  if (!decoded || typeof decoded.getReader !== 'function') fail(`record ${record.id} XZ decoder stream is invalid`);
  return Readable.fromWeb(decoded);
}

function destinationForEntry(materializedRoot, record, entry) {
  const recordRoot = resolve(materializedRoot, record.id);
  const destination = resolve(recordRoot, ...entry.path.split('/'));
  assertPathInside(materializedRoot, recordRoot, `record ${record.id} root`);
  assertPathInside(recordRoot, destination, `record ${record.id} materialization destination`);
  return destination;
}

function assertNoSymlinkPathComponent(root, destination, label) {
  const child = relative(root, destination);
  assertPathInside(root, destination, label);
  let current = root;
  for (const segment of child.split(sep)) {
    current = resolve(current, segment);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) fail(`${label} contains a symbolic link`);
  }
}

function listedMaterializedEntries(root) {
  const files = [];
  const walk = (directory, relativeDirectory = '') => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relativePath = relativeDirectory === '' ? entry.name : `${relativeDirectory}/${entry.name}`;
      const path = resolve(directory, entry.name);
      const metadata = lstatSync(path);
      if (!metadata.isDirectory() && !metadata.isFile() && !metadata.isSymbolicLink()) {
        fail('materialized root contains an unsafe entry');
      }
      if (metadata.isDirectory()) walk(path, relativePath);
      else files.push(relativePath);
    }
  };
  walk(root);
  return files.sort();
}

function materializationRecord(manifest, files) {
  return Object.freeze({
    schemaId: HOSTED_TOOLCHAIN_ACQUISITION_SCHEMA_ID,
    manifestId: manifest.manifestId,
    manifestSha256: canonicalDigest(manifest),
    files: Object.freeze(files),
  });
}

function materializedFileRecord(record, entry) {
  return Object.freeze({
    recordId: record.id,
    relativePath: `${record.id}/${entry.path}`,
    byteLength: entry.byteLength,
    sha256: entry.sha256,
    mode: entry.mode,
  });
}

function appendVerifiedTarEntries(files, materializedRoot, record) {
  for (const entry of record.materialization.entries) {
    const destination = destinationForEntry(materializedRoot, record, entry);
    if (entry.entryType === 'regular') {
      assertNoSymlinkPathComponent(materializedRoot, destination, `record ${record.id} materialization destination`);
      const { bytes: written, stat: metadata } = readVerifiedRegularFileSync(destination);
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        written.byteLength !== entry.byteLength ||
        sha256(written) !== entry.sha256
      ) {
        fail(`record ${record.id} changed during materialization`);
      }
    } else {
      assertNoSymlinkPathComponent(materializedRoot, dirname(destination), `record ${record.id} symbolic link parent`);
      const metadata = lstatSync(destination);
      if (!metadata.isSymbolicLink() || readlinkSync(destination) !== entry.linkTarget) {
        fail(`record ${record.id} symbolic link changed during materialization`);
      }
    }
    files.push(materializedFileRecord(record, entry));
  }
}

async function materializeTarRecord({ files, materializedRoot, record, recordsById, source }) {
  const recordRoot = resolve(materializedRoot, record.id);
  assertPathInside(materializedRoot, recordRoot, `record ${record.id} root`);
  mkdirSync(recordRoot, { mode: 0o700 });
  await verifyStreamedSourceIdentity(source, record);
  await extractTarEntries(tarReadable(record, source, materializedRoot, recordsById), record, recordRoot);
  appendVerifiedTarEntries(files, materializedRoot, record);
}

/** Materializes already acquired, identity-checked objects into a fresh bounded attempt root. */
export async function materializeHostedToolchain({ attemptRoot, manifest, sourceFiles }) {
  validateHostedToolchainManifest(manifest);
  assertExactSourceIds(sourceFiles, manifest);
  assertFreshAttemptRoot(attemptRoot);
  const materializedRoot = resolve(attemptRoot, HOSTED_TOOLCHAIN_MATERIALIZATION_DIRECTORY);
  assertPathInside(attemptRoot, materializedRoot, 'materialized toolchain root');
  mkdirSync(materializedRoot, { mode: 0o700 });
  const files = [];
  const recordsById = new Map(manifest.records.map((record) => [record.id, record]));
  try {
    for (const record of manifest.records) {
      const source = sourceForRecord(sourceFiles, record.id);
      const isTarArchive = record.materialization.format === 'tar-gzip' || record.materialization.format === 'tar-xz';
      if (isTarArchive) {
        await materializeTarRecord({ files, materializedRoot, record, recordsById, source });
        continue;
      }

      const extracted = materializedEntries(record, verifiedSourceIdentity(source, record));
      for (const entry of record.materialization.entries.filter((entry) => entry.entryType === 'regular')) {
        const copied = extracted.get(entry.path);
        if (!copied) fail(`record ${record.id} did not materialize declared file: ${entry.path}`);
        const destination = destinationForEntry(materializedRoot, record, entry);
        const materializedMode = entry.mode === '100755' ? 0o500 : 0o400;
        mkdirSync(dirname(destination), { mode: 0o700, recursive: true });
        assertNoSymlinkPathComponent(materializedRoot, destination, `record ${record.id} materialization destination`);
        writeFileSync(destination, copied, { flag: 'wx', mode: materializedMode });
        chmodSync(destination, materializedMode);
        const written = readFileSync(destination);
        if (written.byteLength !== entry.byteLength || sha256(written) !== entry.sha256) {
          fail(`record ${record.id} changed during materialization`);
        }
        files.push(
          Object.freeze({
            recordId: record.id,
            relativePath: `${record.id}/${entry.path}`,
            byteLength: entry.byteLength,
            sha256: entry.sha256,
            mode: entry.mode,
          }),
        );
      }
      for (const entry of record.materialization.entries.filter((entry) => entry.entryType === 'symbolic-link')) {
        const destination = destinationForEntry(materializedRoot, record, entry);
        mkdirSync(dirname(destination), { mode: 0o700, recursive: true });
        assertNoSymlinkPathComponent(materializedRoot, destination, `record ${record.id} materialization destination`);
        symlinkSync(entry.linkTarget, destination);
        if (readlinkSync(destination) !== entry.linkTarget)
          fail(`record ${record.id} symbolic link changed during materialization`);
        files.push(
          Object.freeze({
            recordId: record.id,
            relativePath: `${record.id}/${entry.path}`,
            byteLength: entry.byteLength,
            sha256: entry.sha256,
            mode: entry.mode,
          }),
        );
      }
    }
    const materialization = materializationRecord(manifest, files);
    writeFileSync(resolve(materializedRoot, 'materialization.json'), `${canonicalJson(materialization)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o400,
    });
    return Object.freeze({
      files: materialization.files,
      manifestSha256: materialization.manifestSha256,
      root: realpathSync(materializedRoot),
    });
  } catch (error) {
    rmSync(materializedRoot, { force: true, recursive: true });
    throw error;
  }
}

/** Re-verifies every materialized file so later build phases reject mutation. */
export function verifyHostedToolchainMaterialization({ manifest, materializedRoot }) {
  validateHostedToolchainManifest(manifest);
  if (!isAbsolute(materializedRoot) || !existsSync(materializedRoot)) fail('materialized root is unavailable');
  const canonicalRoot = realpathSync(materializedRoot);
  const expected = [];
  for (const record of manifest.records) {
    for (const entry of record.materialization.entries) {
      const destination = destinationForEntry(canonicalRoot, record, entry);
      assertNoSymlinkPathComponent(
        canonicalRoot,
        entry.entryType === 'symbolic-link' ? dirname(destination) : destination,
        `record ${record.id} materialization destination`,
      );
      if (entry.entryType === 'symbolic-link') {
        const metadata = lstatSync(destination);
        if (!metadata.isSymbolicLink() || readlinkSync(destination) !== entry.linkTarget) {
          fail(`record ${record.id} materialized symbolic link is unsafe`);
        }
      } else {
        const { bytes, stat: metadata } = readVerifiedRegularFileSync(destination);
        if (!metadata.isFile() || metadata.isSymbolicLink()) fail(`record ${record.id} materialized file is unsafe`);
        if (bytes.byteLength !== entry.byteLength || sha256(bytes) !== entry.sha256) {
          fail(`record ${record.id} materialized file identity changed`);
        }
      }
      expected.push(`${record.id}/${entry.path}`);
    }
  }
  const manifestPath = resolve(canonicalRoot, 'materialization.json');
  if (!existsSync(manifestPath) || !lstatSync(manifestPath).isFile()) fail('materialized file manifest is missing');
  const expectedFiles = [...expected, 'materialization.json'].sort();
  const actualFiles = listedMaterializedEntries(canonicalRoot);
  if (canonicalJson(actualFiles) !== canonicalJson(expectedFiles)) fail('materialized root contains undeclared files');
  const expectedRecord = materializationRecord(
    manifest,
    manifest.records.flatMap((record) =>
      record.materialization.entries.map((entry) =>
        Object.freeze({
          recordId: record.id,
          relativePath: `${record.id}/${entry.path}`,
          byteLength: entry.byteLength,
          sha256: entry.sha256,
          mode: entry.mode,
        }),
      ),
    ),
  );
  if (readFileSync(manifestPath, 'utf8') !== `${canonicalJson(expectedRecord)}\n`) {
    fail('materialized file manifest identity changed');
  }
  return Object.freeze({ manifestSha256: expectedRecord.manifestSha256, files: Object.freeze(expected) });
}

/** Rejects Windows profiles whose build authority was filled from an ambient machine. */
export function assertClosedHostedWindowsProfile(profile) {
  if (profile?.target?.os !== 'windows') fail('Windows hosted profile target is required');
  const inputs = [...(profile.tools ?? []), ...(profile.runtime ?? []), ...(profile.licenses ?? [])].filter(
    (component) => component.pathKind !== 'outputRelative',
  );
  if (
    inputs.length === 0 ||
    inputs.some((component) => typeof component.sha256 !== 'string' || !SHA256_PATTERN.test(component.sha256))
  ) {
    fail('Windows hosted profile retains an unpinned ambient input identity');
  }
  return true;
}
