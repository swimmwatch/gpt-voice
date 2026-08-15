import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { deflateRawSync, gzipSync } from 'node:zlib';

import Ajv2020 from 'ajv/dist/2020.js';

import {
  assertClosedHostedWindowsProfile,
  HOSTED_TOOLCHAIN_ACQUISITION_SCHEMA_ID,
  materializeHostedToolchain,
  validateHostedArchiveEntries,
  validateHostedToolchainManifest,
  verifyHostedToolchainMaterialization,
} from '../../../../scripts/local-whisper/native-build/hosted-toolchain-core.mjs';
import {
  LINUX_NETWORK_DENIAL_STRATEGY,
  resolveNetworkDeniedCommand,
  runWithRequiredCleanup,
  WINDOWS_NETWORK_DENIAL_STRATEGY,
} from '../../../../scripts/local-whisper/native-build/network-denied-build-core.mjs';
import { sha256 } from '../../../../scripts/local-whisper/source-import/native-source-core.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..', '..');
const schemaPath = resolve(
  workspaceRoot,
  'runtime',
  'local-whisper',
  'toolchains',
  'schema',
  'hosted-toolchain-acquisition-lock.schema.json',
);

function digest(text) {
  return sha256(Buffer.from(text, 'utf8'));
}

function record({ id, path, contents, roles, license }) {
  const sha256 = digest(contents);
  return {
    id,
    target: { os: 'windows', architecture: 'x64' },
    component: id,
    roles,
    origin: {
      uri: `https://fixture.invalid/local-whisper/${id}-v1.bin`,
      authority: 'fixture.invalid',
    },
    transport: { byteLength: Buffer.byteLength(contents, 'utf8'), sha256 },
    provenance: { kind: 'fixture-signature', identity: `fixture:${id}`, sha256 },
    materialization: {
      format: 'raw-file',
      expandedRegularBytes: Buffer.byteLength(contents, 'utf8'),
      expandedRegularBytesCeiling: Buffer.byteLength(contents, 'utf8'),
      entries: [
        {
          path,
          entryType: 'regular',
          byteLength: Buffer.byteLength(contents, 'utf8'),
          sha256,
          mode: '100644',
          linkTarget: null,
        },
      ],
      xzDecoder: null,
    },
    license,
  };
}

function fixtureManifest() {
  const licenseContents = 'Fixture-License\n';
  const licenseSha256 = digest(licenseContents);
  const license = {
    recordId: 'fixture-license',
    path: 'LICENSE.txt',
    sha256: licenseSha256,
    spdxId: 'MIT',
  };
  return {
    $schema: './hosted-toolchain-acquisition-lock.schema.json',
    schemaId: HOSTED_TOOLCHAIN_ACQUISITION_SCHEMA_ID,
    manifestId: 'fixture-hosted-toolchain-v1',
    manifestMode: 'fixture',
    target: { os: 'windows', architecture: 'x64' },
    records: [
      record({ id: 'fixture-cmake', path: 'bin/cmake.exe', contents: 'Fixture-CMake\n', roles: ['cmake'], license }),
      record({ id: 'fixture-license', path: 'LICENSE.txt', contents: licenseContents, roles: ['license'], license }),
    ],
  };
}

function fixtureSources(root, manifest) {
  mkdirSync(root, { recursive: true });
  const sources = {};
  for (const record of manifest.records) {
    const source = resolve(root, `${record.id}.bin`);
    writeFileSync(
      source,
      record.materialization.entries[0].path === 'LICENSE.txt' ? 'Fixture-License\n' : 'Fixture-CMake\n',
    );
    sources[record.id] = source;
  }
  return sources;
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const localEntries = [];
  const centralEntries = [];
  let offset = 0;
  for (const entry of entries) {
    const {
      centralCrc32,
      centralFlags = 0,
      centralPath = entry.path,
      contents,
      externalAttributes = 0o100755 * 0x10000,
      localCompressionMethod = 8,
      localCrc32,
      localFlags = centralFlags,
      localPath = entry.path,
    } = entry;
    const localName = Buffer.from(localPath, 'utf8');
    const centralName = Buffer.from(centralPath, 'utf8');
    const source = Buffer.from(contents, 'utf8');
    const compressed = deflateRawSync(source);
    const calculatedCrc32 = crc32(source);
    const expectedCentralCrc32 = centralCrc32 ?? calculatedCrc32;
    const expectedLocalCrc32 = localCrc32 ?? expectedCentralCrc32;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(localFlags, 6);
    local.writeUInt16LE(localCompressionMethod, 8);
    local.writeUInt32LE(expectedLocalCrc32, 14);
    local.writeUInt32LE(compressed.byteLength, 18);
    local.writeUInt32LE(source.byteLength, 22);
    local.writeUInt16LE(localName.byteLength, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(centralFlags, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(expectedCentralCrc32, 16);
    central.writeUInt32LE(compressed.byteLength, 20);
    central.writeUInt32LE(source.byteLength, 24);
    central.writeUInt16LE(centralName.byteLength, 28);
    central.writeUInt32LE(externalAttributes, 38);
    central.writeUInt32LE(offset, 42);
    localEntries.push(Buffer.concat([local, localName, compressed]));
    centralEntries.push(Buffer.concat([central, centralName]));
    offset += local.byteLength + localName.byteLength + compressed.byteLength;
  }
  const centralDirectory = Buffer.concat(centralEntries);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.byteLength, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localEntries, centralDirectory, end]);
}

const ZIP_FIXTURE_ENTRIES = Object.freeze([
  Object.freeze({ path: 'bin/cmake.exe', contents: 'Fixture-CMake\n' }),
  Object.freeze({ path: 'NOTICE.txt', contents: 'Fixture-Notice\n' }),
]);

function tar(entries) {
  const blocks = [];
  const octal = (value, length) => `${value.toString(8).padStart(length - 1, '0')}\0`;
  for (const entry of entries) {
    const contents = Buffer.from(entry.contents ?? '', 'utf8');
    const header = Buffer.alloc(512);
    header.write(entry.path, 0, 'ascii');
    header.write(octal(entry.mode ?? (entry.type === '2' ? 0o777 : 0o755), 8), 100, 'ascii');
    header.write(octal(0, 8), 108, 'ascii');
    header.write(octal(0, 8), 116, 'ascii');
    header.write(octal(entry.type === '2' ? 0 : contents.byteLength, 12), 124, 'ascii');
    header.write(octal(0, 12), 136, 'ascii');
    header.fill(0x20, 148, 156);
    header[156] = (entry.type ?? '0').charCodeAt(0);
    if (entry.target) header.write(entry.target, 157, 'ascii');
    header.write(entry.magic ?? 'ustar\0', 257, 'ascii');
    header.write('00', 263, 'ascii');
    header.write(
      octal(
        header.reduce((total, byte) => total + byte, 0),
        8,
      ),
      148,
      'ascii',
    );
    blocks.push(header);
    if (contents.byteLength > 0) blocks.push(contents, Buffer.alloc((512 - (contents.byteLength % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

function zipFixtureManifest(archive = zip(ZIP_FIXTURE_ENTRIES)) {
  const manifest = fixtureManifest();
  const archiveRecord = manifest.records[0];
  archiveRecord.origin.uri = 'https://fixture.invalid/local-whisper/fixture-cmake-v1.zip';
  archiveRecord.transport = { byteLength: archive.byteLength, sha256: sha256(archive) };
  archiveRecord.provenance.sha256 = archiveRecord.transport.sha256;
  archiveRecord.materialization = {
    format: 'zip',
    expandedRegularBytes: Buffer.byteLength('Fixture-CMake\n') + Buffer.byteLength('Fixture-Notice\n'),
    expandedRegularBytesCeiling: 1024,
    entries: [
      {
        path: 'bin/cmake.exe',
        entryType: 'regular',
        byteLength: Buffer.byteLength('Fixture-CMake\n'),
        sha256: digest('Fixture-CMake\n'),
        mode: '100755',
        linkTarget: null,
      },
      {
        path: 'NOTICE.txt',
        entryType: 'regular',
        byteLength: Buffer.byteLength('Fixture-Notice\n'),
        sha256: digest('Fixture-Notice\n'),
        mode: '100644',
        linkTarget: null,
      },
    ],
    xzDecoder: null,
  };
  return { archive, manifest };
}

async function assertZipMaterializationRejected(archive) {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-hosted-toolchain-'));
  const { manifest } = zipFixtureManifest(archive);
  const sources = fixtureSources(root, manifest);
  writeFileSync(sources['fixture-cmake'], archive);
  await assert.rejects(() =>
    materializeHostedToolchain({ attemptRoot: resolve(root, 'attempt'), manifest, sourceFiles: sources }),
  );
}

function networkProfile(os) {
  return {
    target: { os },
    tools: [
      { role: 'cmake', pathKind: 'systemAbsolute', path: '/tool/cmake' },
      { role: 'network-harness', pathKind: 'systemAbsolute', path: '/tool/unshare' },
      { role: 'network-probe-runtime', pathKind: 'systemAbsolute', path: '/tool/network-probe' },
    ],
  };
}

test('hosted toolchain fixture schema and lock contract reject mutable or incomplete inputs', () => {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const manifest = fixtureManifest();
  assert.equal(validateSchema(manifest), true, JSON.stringify(validateSchema.errors));
  assert.equal(validateHostedToolchainManifest(manifest), true);

  for (const mutate of [
    (candidate) => {
      candidate.records[0].origin.uri = 'https://mirror.invalid/local-whisper/fixture-cmake-v1.bin';
    },
    (candidate) => {
      candidate.records[0].origin.uri = 'https://fixture.invalid/local-whisper/latest/cmake.bin';
    },
    (candidate) => {
      candidate.records[0].provenance.sha256 = '0'.repeat(64);
    },
    (candidate) => {
      candidate.records[0].license.recordId = 'missing-license';
    },
    (candidate) => {
      candidate.records[0].materialization.entries[0].path = '../escape';
    },
    (candidate) => {
      candidate.records[0].target.os = 'linux';
    },
    (candidate) => {
      candidate.manifestMode = 'production';
    },
  ]) {
    const changed = globalThis.structuredClone(manifest);
    mutate(changed);
    assert.throws(() => validateHostedToolchainManifest(changed));
  }
});

test('hosted toolchain materializer only accepts exact objects into a fresh bounded root and detects mutation', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-hosted-toolchain-'));
  const manifest = fixtureManifest();
  const sources = fixtureSources(root, manifest);
  const attemptRoot = resolve(root, 'attempt');
  const materialized = await materializeHostedToolchain({ attemptRoot, manifest, sourceFiles: sources });
  assert.equal(materialized.files.length, 2);
  assert.equal(verifyHostedToolchainMaterialization({ manifest, materializedRoot: materialized.root }).files.length, 2);
  const compiler = resolve(materialized.root, 'fixture-cmake', 'bin', 'cmake.exe');
  chmodSync(compiler, 0o600);
  writeFileSync(compiler, 'changed\n');
  assert.throws(() => verifyHostedToolchainMaterialization({ manifest, materializedRoot: materialized.root }));
  await assert.rejects(() => materializeHostedToolchain({ attemptRoot, manifest, sourceFiles: sources }));
});

test('hosted toolchain materializer rejects changed bytes and undeclared source IDs before output admission', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-hosted-toolchain-'));
  const manifest = fixtureManifest();
  const sources = fixtureSources(root, manifest);
  writeFileSync(sources['fixture-cmake'], 'mutated-fixture\n');
  await assert.rejects(() =>
    materializeHostedToolchain({ attemptRoot: resolve(root, 'attempt-a'), manifest, sourceFiles: sources }),
  );
  const originalSources = fixtureSources(resolve(root, 'restored'), manifest);
  await assert.rejects(() =>
    materializeHostedToolchain({
      attemptRoot: resolve(root, 'attempt-b'),
      manifest,
      sourceFiles: { ...originalSources, 'ambient-tool': resolve(root, 'ambient-tool') },
    }),
  );
});

test('hosted toolchain materializer extracts only the declared checksum-locked ZIP members', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-hosted-toolchain-'));
  const { archive, manifest } = zipFixtureManifest();
  const sources = fixtureSources(root, manifest);
  writeFileSync(sources['fixture-cmake'], archive);
  const materialized = await materializeHostedToolchain({
    attemptRoot: resolve(root, 'attempt'),
    manifest,
    sourceFiles: sources,
  });
  assert.equal(
    readFileSync(resolve(materialized.root, 'fixture-cmake', 'bin', 'cmake.exe'), 'utf8'),
    'Fixture-CMake\n',
  );
  assert.equal(readFileSync(resolve(materialized.root, 'fixture-cmake', 'NOTICE.txt'), 'utf8'), 'Fixture-Notice\n');
  assert.equal(verifyHostedToolchainMaterialization({ manifest, materializedRoot: materialized.root }).files.length, 3);
});

test('hosted toolchain materializer streams bounded TAR.GZ entries and declared relative symbolic links', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-hosted-toolchain-'));
  const manifest = fixtureManifest();
  const archive = gzipSync(
    tar([
      { path: 'lib/libtool.so.1', contents: 'Fixture-Shared-Library\n' },
      { path: 'lib/libtool.so', type: '2', target: './libtool.so.1' },
    ]),
  );
  const archiveRecord = manifest.records[0];
  archiveRecord.transport = { byteLength: archive.byteLength, sha256: sha256(archive) };
  archiveRecord.provenance.sha256 = archiveRecord.transport.sha256;
  archiveRecord.materialization = {
    format: 'tar-gzip',
    expandedRegularBytes: Buffer.byteLength('Fixture-Shared-Library\n'),
    expandedRegularBytesCeiling: 1024,
    entries: [
      {
        path: 'lib/libtool.so.1',
        entryType: 'regular',
        byteLength: Buffer.byteLength('Fixture-Shared-Library\n'),
        sha256: digest('Fixture-Shared-Library\n'),
        mode: '100755',
        linkTarget: null,
      },
      {
        path: 'lib/libtool.so',
        entryType: 'symbolic-link',
        byteLength: Buffer.byteLength('./libtool.so.1'),
        sha256: digest('./libtool.so.1'),
        mode: '120777',
        linkTarget: './libtool.so.1',
      },
    ],
    xzDecoder: null,
  };
  const sources = fixtureSources(root, manifest);
  writeFileSync(sources['fixture-cmake'], archive);
  const materialized = await materializeHostedToolchain({
    attemptRoot: resolve(root, 'attempt'),
    manifest,
    sourceFiles: sources,
  });
  const link = resolve(materialized.root, 'fixture-cmake', 'lib', 'libtool.so');
  assert.equal(readlinkSync(link), './libtool.so.1');
  assert.equal(verifyHostedToolchainMaterialization({ manifest, materializedRoot: materialized.root }).files.length, 3);
});

test('hosted toolchain TAR materializer accepts the NVIDIA GNU USTAR magic variant', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-hosted-toolchain-'));
  const manifest = fixtureManifest();
  const contents = 'Fixture-GNU-USTAR\n';
  const longPath = `bin/${'a'.repeat(101)}.exe`;
  const archive = gzipSync(
    tar([
      { path: 'bin/', type: '5', magic: 'ustar ' },
      { path: 'bin/empty/', type: '5', magic: 'ustar ' },
      { path: '././@LongLink', type: 'L', contents: `${longPath}\0`, magic: 'ustar ', mode: 0o644 },
      { path: 'bin/placeholder', contents, magic: 'ustar ' },
    ]),
  );
  const archiveRecord = manifest.records[0];
  archiveRecord.transport = { byteLength: archive.byteLength, sha256: sha256(archive) };
  archiveRecord.provenance.sha256 = archiveRecord.transport.sha256;
  archiveRecord.materialization = {
    format: 'tar-gzip',
    expandedRegularBytes: Buffer.byteLength(contents),
    expandedRegularBytesCeiling: 1024,
    entries: [
      {
        path: longPath,
        entryType: 'regular',
        byteLength: Buffer.byteLength(contents),
        sha256: digest(contents),
        mode: '100755',
        linkTarget: null,
      },
    ],
    xzDecoder: null,
  };
  const sources = fixtureSources(root, manifest);
  writeFileSync(sources['fixture-cmake'], archive);
  const materialized = await materializeHostedToolchain({
    attemptRoot: resolve(root, 'attempt'),
    manifest,
    sourceFiles: sources,
  });
  assert.equal(readFileSync(resolve(materialized.root, 'fixture-cmake', longPath), 'utf8'), contents);

  const unsafeArchive = gzipSync(
    tar([
      { path: '././@LongLink', type: 'L', contents: '../escape\0', magic: 'ustar ', mode: 0o644 },
      { path: 'bin/placeholder', contents, magic: 'ustar ' },
    ]),
  );
  archiveRecord.transport = { byteLength: unsafeArchive.byteLength, sha256: sha256(unsafeArchive) };
  archiveRecord.provenance.sha256 = archiveRecord.transport.sha256;
  writeFileSync(sources['fixture-cmake'], unsafeArchive);
  await assert.rejects(() =>
    materializeHostedToolchain({ attemptRoot: resolve(root, 'unsafe-attempt'), manifest, sourceFiles: sources }),
  );
});

test('hosted toolchain TAR materializer rejects a truncated entry after closing its output once', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-hosted-toolchain-'));
  const manifest = fixtureManifest();
  const contents = 'Fixture-Truncated\n';
  const uncompressed = tar([{ path: 'bin/cmake.exe', contents }]);
  const archive = gzipSync(uncompressed.subarray(0, 512 + Buffer.byteLength(contents)));
  const archiveRecord = manifest.records[0];
  archiveRecord.transport = { byteLength: archive.byteLength, sha256: sha256(archive) };
  archiveRecord.provenance.sha256 = archiveRecord.transport.sha256;
  archiveRecord.materialization = {
    format: 'tar-gzip',
    expandedRegularBytes: Buffer.byteLength(contents),
    expandedRegularBytesCeiling: 1024,
    entries: [
      {
        path: 'bin/cmake.exe',
        entryType: 'regular',
        byteLength: Buffer.byteLength(contents),
        sha256: digest(contents),
        mode: '100755',
        linkTarget: null,
      },
    ],
    xzDecoder: null,
  };
  const sources = fixtureSources(root, manifest);
  writeFileSync(sources['fixture-cmake'], archive);

  await assert.rejects(
    () => materializeHostedToolchain({ attemptRoot: resolve(root, 'attempt'), manifest, sourceFiles: sources }),
    /record fixture-cmake TAR is truncated/u,
  );
});

test('hosted toolchain TAR.XZ materialization loads only a prior checksum-locked decoder record', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-hosted-toolchain-'));
  const manifest = fixtureManifest();
  const decoderContents = 'module.exports = { XzReadableStream: class { constructor(input) { return input; } } };\n';
  const decoderRecord = record({
    id: 'fixture-xz-decoder',
    path: 'decoder.cjs',
    contents: decoderContents,
    roles: ['xz-decoder'],
    license: manifest.records[1].license,
  });
  const archive = tar([{ path: 'bin/nvcc', contents: 'Fixture-NVCC\n' }]);
  const archiveRecord = manifest.records[0];
  archiveRecord.origin.uri = 'https://fixture.invalid/local-whisper/fixture-nvcc-v1.tar.xz';
  archiveRecord.transport = { byteLength: archive.byteLength, sha256: sha256(archive) };
  archiveRecord.provenance.sha256 = archiveRecord.transport.sha256;
  archiveRecord.materialization = {
    format: 'tar-xz',
    expandedRegularBytes: Buffer.byteLength('Fixture-NVCC\n'),
    expandedRegularBytesCeiling: 1024,
    entries: [
      {
        path: 'bin/nvcc',
        entryType: 'regular',
        byteLength: Buffer.byteLength('Fixture-NVCC\n'),
        sha256: digest('Fixture-NVCC\n'),
        mode: '100755',
        linkTarget: null,
      },
    ],
    xzDecoder: { recordId: 'fixture-xz-decoder', modulePath: 'decoder.cjs', exportName: 'XzReadableStream' },
  };
  manifest.records.unshift(decoderRecord);
  const sources = fixtureSources(root, manifest);
  writeFileSync(sources['fixture-xz-decoder'], decoderContents);
  writeFileSync(sources['fixture-cmake'], archive);
  const materialized = await materializeHostedToolchain({
    attemptRoot: resolve(root, 'attempt'),
    manifest,
    sourceFiles: sources,
  });
  assert.equal(readFileSync(resolve(materialized.root, 'fixture-cmake', 'bin', 'nvcc'), 'utf8'), 'Fixture-NVCC\n');
});

test('hosted toolchain ZIP extraction rejects untrusted central and local member metadata', async () => {
  await assertZipMaterializationRejected(
    zip([...ZIP_FIXTURE_ENTRIES, { path: 'unexpected.exe', contents: 'Unexpected\n' }]),
  );
  await assertZipMaterializationRejected(
    zip([{ ...ZIP_FIXTURE_ENTRIES[0], centralFlags: 0x1 }, ZIP_FIXTURE_ENTRIES[1]]),
  );
  await assertZipMaterializationRejected(
    zip([{ ...ZIP_FIXTURE_ENTRIES[0], externalAttributes: 0o120777 * 0x10000 }, ZIP_FIXTURE_ENTRIES[1]]),
  );
  await assertZipMaterializationRejected(
    zip([{ ...ZIP_FIXTURE_ENTRIES[0], localPath: 'bin/other.exe' }, ZIP_FIXTURE_ENTRIES[1]]),
  );
  await assertZipMaterializationRejected(zip([{ ...ZIP_FIXTURE_ENTRIES[0], centralCrc32: 0 }, ZIP_FIXTURE_ENTRIES[1]]));
});

test('hosted toolchain materializer rejects undeclared post-verification files', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-hosted-toolchain-'));
  const manifest = fixtureManifest();
  const materialized = await materializeHostedToolchain({
    attemptRoot: resolve(root, 'attempt'),
    manifest,
    sourceFiles: fixtureSources(root, manifest),
  });
  writeFileSync(resolve(materialized.root, 'unexpected.exe'), 'unexpected\n');
  assert.throws(() => verifyHostedToolchainMaterialization({ manifest, materializedRoot: materialized.root }));
});

test('archive preflight rejects traversal, links, case collisions, and extraction overflows', () => {
  const entry = {
    path: 'bin/tool.exe',
    entryType: 'regular',
    byteLength: 4,
    sha256: digest('tool'),
    mode: '100755',
    linkTarget: null,
  };
  assert.equal(validateHostedArchiveEntries([entry], 4), true);
  const canonicalCurrentDirectoryLink = {
    path: 'lib/tool.exe',
    entryType: 'symbolic-link',
    byteLength: Buffer.byteLength('./tool.exe'),
    sha256: digest('./tool.exe'),
    mode: '120777',
    linkTarget: './tool.exe',
  };
  assert.equal(validateHostedArchiveEntries([entry, canonicalCurrentDirectoryLink], 4), true);
  for (const entries of [
    [{ ...entry, path: '../escape.exe' }],
    [{ ...entry, entryType: 'symlink' }],
    [entry, { ...entry, path: 'BIN/TOOL.EXE' }],
    [entry, { ...entry, path: 'bin/second.exe' }],
    [{ ...canonicalCurrentDirectoryLink, linkTarget: '././tool.exe' }],
    [{ ...canonicalCurrentDirectoryLink, linkTarget: '../tool.exe' }],
  ]) {
    assert.throws(() => validateHostedArchiveEntries(entries, 4));
  }
});

test('hosted Windows builds fail closed until every executable input has a reviewed digest', () => {
  const incomplete = {
    target: { os: 'windows' },
    tools: [{ pathKind: 'toolchainRootRelative', sha256: null }],
    runtime: [],
    licenses: [],
  };
  assert.throws(() => assertClosedHostedWindowsProfile(incomplete), /ambient/u);
  const complete = globalThis.structuredClone(incomplete);
  complete.tools[0].sha256 = 'a'.repeat(64);
  complete.licenses = [{ pathKind: 'toolchainRootRelative', sha256: null }];
  assert.equal(assertClosedHostedWindowsProfile(complete), true);
});

test('disconnected build commands require an OS boundary and a same-boundary probe on both platforms', () => {
  const linux = resolveNetworkDeniedCommand({
    profile: networkProfile('linux'),
    toolchainRoot: '/toolchain',
    buildRoot: '/attempt/build',
    command: '/tool/cmake',
    arguments_: ['--build', '/attempt/build'],
  });
  assert.equal(linux.strategy, LINUX_NETWORK_DENIAL_STRATEGY);
  assert.deepEqual(linux.arguments.slice(0, 3), ['-Urn', '--', '/tool/cmake']);

  const windows = resolveNetworkDeniedCommand({
    profile: networkProfile('windows'),
    toolchainRoot: '/toolchain',
    buildRoot: '/attempt/build',
    command: '/tool/cmake',
    arguments_: ['--build', '/attempt/build'],
    allowedPrograms: ['/tool/cmake', '/tool/ninja'],
  });
  assert.equal(windows.strategy, WINDOWS_NETWORK_DENIAL_STRATEGY);
  assert.equal(
    windows.arguments.some((argument) => argument.startsWith('--network-probe=')),
    false,
  );
  assert.equal(windows.arguments.includes('--allowed-program=/tool/cmake'), true);
  assert.equal(windows.arguments.includes('--allowed-program=/tool/ninja'), true);

  const noPreparedPrograms = networkProfile('windows');
  assert.throws(() =>
    resolveNetworkDeniedCommand({
      profile: noPreparedPrograms,
      toolchainRoot: '/toolchain',
      buildRoot: '/attempt/build',
      command: '/tool/cmake',
      arguments_: [],
      allowedPrograms: [],
    }),
  );
});

test('network-denied lifecycle preserves the primary failure and always enforces cleanup', () => {
  const expected = new Error('setup failed');
  let cleanupCount = 0;
  assert.throws(
    () =>
      runWithRequiredCleanup(
        () => {
          throw expected;
        },
        () => {
          cleanupCount += 1;
        },
      ),
    (error) => error === expected,
  );
  assert.equal(cleanupCount, 1);
  assert.throws(
    () =>
      runWithRequiredCleanup(
        () => {
          throw expected;
        },
        () => {
          throw new Error('cleanup failed');
        },
      ),
    /setup failed; additionally, cleanup failed/u,
  );
});
