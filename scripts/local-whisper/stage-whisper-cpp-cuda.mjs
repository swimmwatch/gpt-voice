import assert from 'node:assert/strict';
import {
  chmodSync,
  closeSync,
  copyFileSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import { canonicalDigest, readJson, sha256 } from './source-import/native-source-core.mjs';
import {
  buildIdentity,
  limitTablePath,
  nlohmannSource,
  nlohmannSourceLockPath,
  patchLockPath,
  patchedSourceRoot,
  removeTaskOwnedTree,
  requireProfile,
  taskCacheRoot,
  toolchainRoot,
} from './whisper-cpp-build-core.mjs';

const CUDA_PROFILE = 'linux-x64-cuda-12.8.1-sm120a-v1';
const ELF_DYNAMIC = 2;
const ELF_RPATH = 15n;
const ELF_RUNPATH = 29n;

function assertOwnedPath(path) {
  const child = relative(taskCacheRoot, path);
  if (child.length === 0 || child.startsWith('..') || isAbsolute(child))
    throw new Error('CUDA staging path escaped the private task root');
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o400 });
}

function fileEvidence(root, relativePath, id) {
  const path = resolve(root, ...relativePath.split('/'));
  const metadata = statSync(path);
  return Object.freeze({
    id,
    relativePath,
    mode: metadata.mode & 0o777,
    sizeBytes: metadata.size,
    sha256: sha256(readFileSync(path)),
  });
}

function sourcePath(input) {
  if (input.pathKind === 'toolchainRootRelative') return resolve(toolchainRoot, ...input.path.split('/'));
  if (input.pathKind === 'systemAbsolute') return input.path;
  throw new Error(`Unsupported CUDA pack input path kind: ${input.pathKind}`);
}

function assertSafeOffset(offset, size) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < 0 || size < 0)
    throw new Error('Staged CUDA ELF offset is unsafe');
}

function readExact(descriptor, buffer, position) {
  let offset = 0;
  while (offset < buffer.length) {
    const count = readSync(descriptor, buffer, offset, buffer.length - offset, position + offset);
    if (count === 0) throw new Error('Truncated staged CUDA ELF');
    offset += count;
  }
}

/** Converts only DT_RUNPATH to DT_RPATH so staged dependencies ignore hostile loader search paths. */
function lockElfRuntimePath(path) {
  const descriptor = openSync(path, 'r+');
  try {
    const header = Buffer.alloc(64);
    readExact(descriptor, header, 0);
    if (!header.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) || header[4] !== 2 || header[5] !== 1)
      throw new Error('Staged CUDA dependency is not little-endian ELF64');
    const programHeaderOffset = Number(header.readBigUInt64LE(32));
    const programHeaderSize = header.readUInt16LE(54);
    const programHeaderCount = header.readUInt16LE(56);
    assertSafeOffset(programHeaderOffset, programHeaderSize * programHeaderCount);
    let dynamicOffset = null;
    let dynamicSize = null;
    for (let index = 0; index < programHeaderCount; index += 1) {
      const programHeader = Buffer.alloc(programHeaderSize);
      readExact(descriptor, programHeader, programHeaderOffset + index * programHeaderSize);
      if (programHeader.readUInt32LE(0) !== ELF_DYNAMIC) continue;
      if (dynamicOffset !== null) throw new Error('Staged CUDA ELF has multiple dynamic segments');
      dynamicOffset = Number(programHeader.readBigUInt64LE(8));
      dynamicSize = Number(programHeader.readBigUInt64LE(32));
    }
    if (dynamicOffset === null || dynamicSize === null || dynamicSize % 16 !== 0)
      throw new Error('Staged CUDA ELF dynamic segment is invalid');
    assertSafeOffset(dynamicOffset, dynamicSize);
    let runpathOffset = null;
    let hasRpath = false;
    const entry = Buffer.alloc(16);
    for (let offset = 0; offset < dynamicSize; offset += entry.length) {
      readExact(descriptor, entry, dynamicOffset + offset);
      const tag = entry.readBigUInt64LE(0);
      if (tag === 0n) break;
      if (tag === ELF_RPATH) hasRpath = true;
      if (tag === ELF_RUNPATH) {
        if (runpathOffset !== null) throw new Error('Staged CUDA ELF has multiple RUNPATH tags');
        runpathOffset = dynamicOffset + offset;
      }
    }
    if (runpathOffset === null) return false;
    if (hasRpath) throw new Error('Staged CUDA ELF mixes RPATH and RUNPATH');
    const encoded = Buffer.alloc(8);
    encoded.writeBigUInt64LE(ELF_RPATH);
    assert.equal(writeSync(descriptor, encoded, 0, encoded.length, runpathOffset), encoded.length);
    return true;
  } finally {
    closeSync(descriptor);
  }
}

export function cudaStageRoot(profileId) {
  return resolve(taskCacheRoot, 'stage', profileId);
}

export function stageCudaPack(profileId, buildRoot) {
  if (profileId !== CUDA_PROFILE) throw new Error(`Task 11 stages only ${CUDA_PROFILE}`);
  const profile = requireProfile(profileId);
  const patchLock = readJson(patchLockPath);
  const nlohmannLock = readJson(nlohmannSourceLockPath);
  const table = readJson(limitTablePath);
  const runtimeBuildDigest = buildIdentity(profileId);
  const stagingRoot = cudaStageRoot(profileId);
  assertOwnedPath(stagingRoot);
  mkdirSync(resolve(taskCacheRoot, 'stage'), { mode: 0o700, recursive: true });
  removeTaskOwnedTree(stagingRoot);
  for (const directory of ['bin', 'lib', 'licenses'])
    mkdirSync(resolve(stagingRoot, directory), { mode: 0o700, recursive: true });

  const executable = resolve(buildRoot, 'bin', 'local-whisper-whisper-cpp-worker');
  copyFileSync(executable, resolve(stagingRoot, 'bin', 'local-whisper-whisper-cpp-worker'));
  chmodSync(resolve(stagingRoot, 'bin', 'local-whisper-whisper-cpp-worker'), 0o500);

  const stagedRuntimeDependencies = profile.dynamicDependencies.filter(
    (dependency) => dependency.pathKind === 'toolchainRootRelative',
  );
  const systemRuntimeDependencies = profile.dynamicDependencies
    .filter((dependency) => dependency.pathKind === 'systemAbsolute')
    .map(({ id, sha256: dependencySha256, soname }) => ({ id, soname, sha256: dependencySha256 }));
  const stagedRuntimeEvidence = [];
  for (const dependency of stagedRuntimeDependencies) {
    const target = resolve(stagingRoot, 'lib', dependency.soname);
    copyFileSync(sourcePath(dependency), target);
    if (sha256(readFileSync(target)) !== dependency.sha256)
      throw new Error(`Staged CUDA runtime identity changed: ${dependency.id}`);
    const runtimePathLocked = lockElfRuntimePath(target);
    chmodSync(target, 0o400);
    stagedRuntimeEvidence.push({
      id: dependency.id,
      soname: dependency.soname,
      sha256: sha256(readFileSync(target)),
      sourceSha256: dependency.sha256,
      runtimePathLocked,
    });
  }

  copyFileSync(resolve(patchedSourceRoot, 'LICENSE'), resolve(stagingRoot, 'licenses', 'whisper-cpp.LICENSE'));
  copyFileSync(resolve(nlohmannSource, 'LICENSE.MIT'), resolve(stagingRoot, 'licenses', 'nlohmann-json.LICENSE.MIT'));
  const cudaLicense = profile.licenses.find((license) => license.id === 'cuda-eula-12.8.1');
  if (!cudaLicense) throw new Error('Qualified CUDA EULA evidence is missing');
  copyFileSync(sourcePath(cudaLicense), resolve(stagingRoot, 'licenses', 'NVIDIA-CUDA-EULA.txt'));
  for (const name of ['whisper-cpp.LICENSE', 'nlohmann-json.LICENSE.MIT', 'NVIDIA-CUDA-EULA.txt'])
    chmodSync(resolve(stagingRoot, 'licenses', name), 0o400);
  writeFileSync(
    resolve(stagingRoot, 'THIRD_PARTY_NOTICES.md'),
    [
      '# Third-party notices',
      '',
      '- whisper.cpp v1.9.1 (`f049fff`), MIT; see `licenses/whisper-cpp.LICENSE`.',
      '- nlohmann/json v3.12.0 (`55f9368`), MIT; see `licenses/nlohmann-json.LICENSE.MIT`.',
      '- NVIDIA CUDA Toolkit 12.8.1 redistributable runtime libraries; see `licenses/NVIDIA-CUDA-EULA.txt`.',
      '',
    ].join('\n'),
    { mode: 0o400 },
  );

  const patchEvidence = patchLock.patches.map(({ patchId, relativePath, sha256: patchSha256 }) => ({
    patchId,
    relativePath,
    sha256: patchSha256,
  }));
  writeJson(resolve(stagingRoot, 'provenance.json'), {
    schemaId: 'local-whisper-whisper-cpp-provenance-v1',
    profileId,
    profileEvidenceDigest: profile.evidenceDigest,
    sourceLockId: patchLock.sourceLockId,
    originalManifestSha256: patchLock.originalManifestSha256,
    intermediateManifests: patchLock.intermediateManifests,
    patchLockId: patchLock.lockId,
    patches: patchEvidence,
    patchedManifestSha256: patchLock.finalManifestSha256,
    licenseProvenance: patchLock.licenseProvenance,
    nlohmannSourceLockId: nlohmannLock.lockId,
    nlohmannSourceManifestSha256: nlohmannLock.materialization.manifestSha256,
    loaderLimitTableId: table.tableId,
    loaderLimitTableSha256: table.tableSha256,
    requestedCudaArchitectures: profile.architectureTargets,
    effectiveCudaArchitectures: ['120a-real'],
    stagedRuntimeDependencies: stagedRuntimeEvidence,
    runtimePathPolicy: {
      policyId: 'local-whisper-elf64-rpath-lock-v1',
      stagedValue: '$ORIGIN',
    },
    systemRuntimeDependencies,
    runtimeBuildDigest,
    modelIncluded: false,
  });

  const allRuntimeDependencies = [
    ...stagedRuntimeEvidence.map(({ id, sha256: stagedSha256, soname, sourceSha256 }) => ({
      id,
      soname,
      staged: true,
      sha256: stagedSha256,
      sourceSha256,
    })),
    ...systemRuntimeDependencies.map(({ id, sha256: systemSha256, soname }) => ({
      id,
      soname,
      staged: false,
      sha256: systemSha256,
      sourceSha256: systemSha256,
    })),
  ];
  writeJson(resolve(stagingRoot, 'sbom.spdx.json'), {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: 'gpt-voice-local-whisper-cuda-pack',
    documentNamespace: `https://gpt-voice.local/sbom/${runtimeBuildDigest}`,
    creationInfo: {
      created: '2026-08-02T00:00:00Z',
      creators: ['Tool: GPT-Voice locked native build'],
    },
    packages: [
      {
        name: 'gpt-voice-local-whisper-worker',
        SPDXID: 'SPDXRef-Package-Worker',
        versionInfo: runtimeBuildDigest,
        downloadLocation: 'NOASSERTION',
        filesAnalyzed: false,
        licenseConcluded: 'LicenseRef-PolyForm-Noncommercial-1.0.0',
        licenseDeclared: 'LicenseRef-PolyForm-Noncommercial-1.0.0',
        copyrightText: 'NOASSERTION',
      },
      {
        name: 'whisper.cpp',
        SPDXID: 'SPDXRef-Package-WhisperCpp',
        versionInfo: '1.9.1-f049fff',
        downloadLocation: 'https://github.com/ggml-org/whisper.cpp',
        filesAnalyzed: false,
        licenseConcluded: 'MIT',
        licenseDeclared: 'MIT',
        copyrightText: 'NOASSERTION',
      },
      {
        name: 'nlohmann/json',
        SPDXID: 'SPDXRef-Package-NlohmannJson',
        versionInfo: '3.12.0-55f9368',
        downloadLocation: 'https://github.com/nlohmann/json',
        filesAnalyzed: false,
        licenseConcluded: 'MIT',
        licenseDeclared: 'MIT',
        copyrightText: 'NOASSERTION',
      },
      ...allRuntimeDependencies.map((dependency, index) => ({
        name: dependency.soname,
        SPDXID: `SPDXRef-Runtime-${index}`,
        versionInfo: dependency.id,
        downloadLocation: 'NOASSERTION',
        filesAnalyzed: false,
        licenseConcluded: dependency.staged ? 'LicenseRef-NVIDIA-CUDA-EULA' : 'NOASSERTION',
        licenseDeclared: dependency.staged ? 'LicenseRef-NVIDIA-CUDA-EULA' : 'NOASSERTION',
        copyrightText: 'NOASSERTION',
        checksums: [{ algorithm: 'SHA256', checksumValue: dependency.sha256 }],
        externalRefs: [
          {
            referenceCategory: 'OTHER',
            referenceType: 'gpt-voice-source-sha256',
            referenceLocator: dependency.sourceSha256,
          },
        ],
      })),
    ],
    relationships: [
      {
        spdxElementId: 'SPDXRef-DOCUMENT',
        relationshipType: 'DESCRIBES',
        relatedSpdxElement: 'SPDXRef-Package-Worker',
      },
      ...allRuntimeDependencies.map((_, index) => ({
        spdxElementId: 'SPDXRef-Package-Worker',
        relationshipType: 'DEPENDS_ON',
        relatedSpdxElement: `SPDXRef-Runtime-${index}`,
      })),
    ],
  });

  const payloadFiles = [
    fileEvidence(stagingRoot, 'bin/local-whisper-whisper-cpp-worker', 'worker'),
    ...stagedRuntimeDependencies.map((dependency) =>
      fileEvidence(stagingRoot, `lib/${dependency.soname}`, `runtime-${dependency.id}`),
    ),
    fileEvidence(stagingRoot, 'licenses/whisper-cpp.LICENSE', 'whisper-cpp-license'),
    fileEvidence(stagingRoot, 'licenses/nlohmann-json.LICENSE.MIT', 'nlohmann-json-license'),
    fileEvidence(stagingRoot, 'licenses/NVIDIA-CUDA-EULA.txt', 'cuda-eula'),
    fileEvidence(stagingRoot, 'THIRD_PARTY_NOTICES.md', 'third-party-notices'),
    fileEvidence(stagingRoot, 'provenance.json', 'provenance'),
    fileEvidence(stagingRoot, 'sbom.spdx.json', 'spdx-sbom'),
  ];
  writeJson(resolve(stagingRoot, 'expected-files.json'), {
    schemaId: 'local-whisper-expected-files-v1',
    files: payloadFiles,
  });
  const expectedFiles = fileEvidence(stagingRoot, 'expected-files.json', 'expected-files');
  writeJson(resolve(stagingRoot, 'runtime-manifest.json'), {
    schemaId: 'local-whisper-runtime-manifest-v1',
    engine: 'whisperCpp',
    target: 'gpu',
    backend: 'cuda',
    profileId,
    runtimeRevision: 'whisper-cpp-linux-x64-cuda-12.8.1-sm120a-v1',
    runtimeBuildDigest,
    executable: 'bin/local-whisper-whisper-cpp-worker',
    libraryDirectory: 'lib',
    dynamicBackendDiscovery: false,
    stagedRuntimeDependencies: stagedRuntimeEvidence,
    runtimePathPolicy: {
      policyId: 'local-whisper-elf64-rpath-lock-v1',
      stagedValue: '$ORIGIN',
    },
    systemRuntimeDependencies,
    gpuBackends: ['cuda'],
    requestedCudaArchitectures: ['120a-real'],
    effectiveCudaArchitectures: ['120a-real'],
    modelIncluded: false,
    signed: false,
    productionOrigin: false,
    expectedFiles,
    payloadManifestSha256: canonicalDigest(payloadFiles),
  });
  chmodSync(resolve(stagingRoot, 'bin'), 0o500);
  chmodSync(resolve(stagingRoot, 'lib'), 0o500);
  chmodSync(resolve(stagingRoot, 'licenses'), 0o500);
  chmodSync(stagingRoot, 0o500);
  return stagingRoot;
}
