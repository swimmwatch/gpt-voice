import { chmodSync, copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
} from './whisper-cpp-build-core.mjs';

function assertOwnedPath(path) {
  const child = relative(taskCacheRoot, path);
  if (child.length === 0 || child.startsWith('..') || isAbsolute(child))
    throw new Error('CPU staging path escaped the private task root');
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

export function cpuStageRoot(profileId) {
  return resolve(taskCacheRoot, 'stage', profileId);
}

export function stageCpuPack(profileId, buildRoot) {
  if (profileId !== 'linux-x64-cpu-baseline-v1') throw new Error('Task 10 stages only the qualified Linux CPU profile');
  const profile = requireProfile(profileId);
  const patchLock = readJson(patchLockPath);
  const nlohmannLock = readJson(nlohmannSourceLockPath);
  const table = readJson(limitTablePath);
  const systemRuntimeDependencies = profile.dynamicDependencies.map((dependency) => ({
    id: dependency.id,
    soname: dependency.soname,
    sha256: dependency.sha256,
  }));
  const stagingRoot = cpuStageRoot(profileId);
  const stagingParent = resolve(taskCacheRoot, 'stage');
  assertOwnedPath(stagingRoot);
  mkdirSync(stagingParent, { mode: 0o700, recursive: true });
  chmodSync(stagingParent, 0o700);
  removeTaskOwnedTree(stagingRoot);
  mkdirSync(stagingRoot, { mode: 0o700, recursive: true });
  for (const directory of ['bin', 'licenses']) mkdirSync(resolve(stagingRoot, directory), { mode: 0o700 });

  const executable = resolve(buildRoot, 'bin', 'local-whisper-whisper-cpp-worker');
  const stagedExecutable = resolve(stagingRoot, 'bin', 'local-whisper-whisper-cpp-worker');
  copyFileSync(executable, stagedExecutable);
  chmodSync(stagedExecutable, 0o500);
  const license = resolve(stagingRoot, 'licenses', 'whisper-cpp.LICENSE');
  copyFileSync(resolve(patchedSourceRoot, 'LICENSE'), license);
  chmodSync(license, 0o400);
  const nlohmannLicense = resolve(stagingRoot, 'licenses', 'nlohmann-json.LICENSE.MIT');
  copyFileSync(resolve(nlohmannSource, 'LICENSE.MIT'), nlohmannLicense);
  chmodSync(nlohmannLicense, 0o400);
  writeFileSync(
    resolve(stagingRoot, 'THIRD_PARTY_NOTICES.md'),
    [
      '# Third-party notices',
      '',
      '- whisper.cpp v1.9.1 (`f049fff`), MIT License; see `licenses/whisper-cpp.LICENSE`.',
      '- nlohmann/json v3.12.0 (`55f9368`), MIT License; see `licenses/nlohmann-json.LICENSE.MIT`.',
      '',
    ].join('\n'),
    { mode: 0o400 },
  );
  writeJson(resolve(stagingRoot, 'provenance.json'), {
    schemaId: 'local-whisper-whisper-cpp-provenance-v1',
    profileId,
    profileEvidenceDigest: profile.evidenceDigest,
    sourceLockId: patchLock.sourceLockId,
    originalManifestSha256: patchLock.originalManifestSha256,
    patchLockId: patchLock.lockId,
    patchSha256: patchLock.patches[0].sha256,
    patches: patchLock.patches.map(({ patchId, relativePath, sha256: patchSha256 }) => ({
      patchId,
      relativePath,
      sha256: patchSha256,
    })),
    patchedManifestSha256: patchLock.finalManifestSha256,
    nlohmannSourceLockId: nlohmannLock.lockId,
    nlohmannSourceManifestSha256: nlohmannLock.materialization.manifestSha256,
    loaderLimitTableId: table.tableId,
    loaderLimitTableSha256: table.tableSha256,
    systemRuntimeDependencies,
    runtimeBuildDigest: buildIdentity(),
    modelIncluded: false,
  });
  writeJson(resolve(stagingRoot, 'sbom.spdx.json'), {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: 'gpt-voice-local-whisper-cpu-pack',
    documentNamespace: `https://gpt-voice.local/sbom/${buildIdentity()}`,
    creationInfo: {
      created: '2026-08-02T00:00:00Z',
      creators: ['Tool: GPT-Voice locked native build'],
    },
    packages: [
      {
        name: 'gpt-voice-local-whisper-worker',
        SPDXID: 'SPDXRef-Package-Worker',
        versionInfo: buildIdentity(),
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
      ...systemRuntimeDependencies.map((dependency, index) => ({
        name: dependency.soname,
        SPDXID: `SPDXRef-SystemRuntime-${index}`,
        versionInfo: dependency.id,
        downloadLocation: 'NOASSERTION',
        filesAnalyzed: false,
        licenseConcluded: 'NOASSERTION',
        licenseDeclared: 'NOASSERTION',
        copyrightText: 'NOASSERTION',
      })),
    ],
    relationships: [
      {
        spdxElementId: 'SPDXRef-DOCUMENT',
        relationshipType: 'DESCRIBES',
        relatedSpdxElement: 'SPDXRef-Package-Worker',
      },
      {
        spdxElementId: 'SPDXRef-Package-Worker',
        relationshipType: 'DEPENDS_ON',
        relatedSpdxElement: 'SPDXRef-Package-WhisperCpp',
      },
      {
        spdxElementId: 'SPDXRef-Package-Worker',
        relationshipType: 'DEPENDS_ON',
        relatedSpdxElement: 'SPDXRef-Package-NlohmannJson',
      },
      ...systemRuntimeDependencies.map((dependency, index) => ({
        spdxElementId: 'SPDXRef-Package-Worker',
        relationshipType: 'DEPENDS_ON',
        relatedSpdxElement: `SPDXRef-SystemRuntime-${index}`,
        comment: `System runtime dependency ${dependency.id}`,
      })),
    ],
  });

  const payloadFiles = [
    fileEvidence(stagingRoot, 'bin/local-whisper-whisper-cpp-worker', 'worker'),
    fileEvidence(stagingRoot, 'licenses/whisper-cpp.LICENSE', 'whisper-cpp-license'),
    fileEvidence(stagingRoot, 'licenses/nlohmann-json.LICENSE.MIT', 'nlohmann-json-license'),
    fileEvidence(stagingRoot, 'THIRD_PARTY_NOTICES.md', 'third-party-notices'),
    fileEvidence(stagingRoot, 'provenance.json', 'provenance'),
    fileEvidence(stagingRoot, 'sbom.spdx.json', 'spdx-sbom'),
  ];
  writeJson(resolve(stagingRoot, 'expected-files.json'), {
    schemaId: 'local-whisper-expected-files-v1',
    files: payloadFiles,
  });
  const expectedFilesEvidence = fileEvidence(stagingRoot, 'expected-files.json', 'expected-files');
  writeJson(resolve(stagingRoot, 'runtime-manifest.json'), {
    schemaId: 'local-whisper-runtime-manifest-v1',
    engine: 'whisperCpp',
    target: 'cpu',
    backend: 'cpu',
    profileId,
    runtimeRevision: 'whisper-cpp-linux-x64-cpu-baseline-v1',
    runtimeBuildDigest: buildIdentity(),
    executable: 'bin/local-whisper-whisper-cpp-worker',
    dynamicBackendDiscovery: false,
    systemRuntimeDependencies,
    gpuBackends: [],
    modelIncluded: false,
    signed: false,
    productionOrigin: false,
    expectedFiles: expectedFilesEvidence,
    payloadManifestSha256: canonicalDigest(payloadFiles),
  });
  chmodSync(resolve(stagingRoot, 'bin'), 0o500);
  chmodSync(resolve(stagingRoot, 'licenses'), 0o500);
  chmodSync(stagingRoot, 0o500);
  return stagingRoot;
}
