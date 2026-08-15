import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';

import { canonicalCatalogJson, canonicalDigest, readJson, sha256 } from '../source-import/native-source-core.mjs';
import { readVerifiedRegularFileSync } from '../secure-file-reader.mjs';
import {
  buildIdentity,
  limitTablePath,
  nlohmannSource,
  nlohmannSourceLockPath,
  patchLockPath,
  patchedSourceRoot,
  removeTaskOwnedTree,
  taskCacheRoot,
  toolchainRoot,
} from '../whisper-cpp-build-core.mjs';
import { resolveProfileTool } from './native-toolchain-core.mjs';
import { verifyWindowsPeDependencyClosure } from './windows-pe-dependency-core.mjs';
import { resolveWindowsRuntimeDependencyIdentities } from './windows-runtime-materializer-core.mjs';

const WINDOWS_RUNTIME_LOCK_PATH = resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'runtime',
  'local-whisper',
  'toolchains',
  'locks',
  'microsoft-vc-runtime-14.51.36247.0-x64-v1.json',
);

const WINDOWS_CUDA_RUNTIME_DEPENDENCIES = Object.freeze(
  new Map([
    ['cuda-runtime-12.8.1', 'cudart64_12.dll'],
    ['cublas-12.8.1', 'cublas64_12.dll'],
    ['cublas-lt-12.8.1', 'cublasLt64_12.dll'],
  ]),
);

export const WINDOWS_SYSTEM_DEPENDENCIES = Object.freeze(
  [
    ['windows-api-core-console', 'api-ms-win-core-console-l1-1-0.dll'],
    ['windows-api-core-debug', 'api-ms-win-core-debug-l1-1-0.dll'],
    ['windows-api-core-error-handling', 'api-ms-win-core-errorhandling-l1-1-0.dll'],
    ['windows-api-core-file', 'api-ms-win-core-file-l1-1-0.dll'],
    ['windows-api-core-handle', 'api-ms-win-core-handle-l1-1-0.dll'],
    ['windows-api-core-heap', 'api-ms-win-core-heap-l1-1-0.dll'],
    ['windows-api-core-interlocked', 'api-ms-win-core-interlocked-l1-1-0.dll'],
    ['windows-api-core-library-loader', 'api-ms-win-core-libraryloader-l1-2-0.dll'],
    ['windows-api-core-localization', 'api-ms-win-core-localization-l1-2-0.dll'],
    ['windows-api-core-process-environment', 'api-ms-win-core-processenvironment-l1-1-0.dll'],
    ['windows-api-core-process-threads', 'api-ms-win-core-processthreads-l1-1-0.dll'],
    ['windows-api-core-process-threads-1', 'api-ms-win-core-processthreads-l1-1-1.dll'],
    ['windows-api-core-profile', 'api-ms-win-core-profile-l1-1-0.dll'],
    ['windows-api-core-rtl-support', 'api-ms-win-core-rtlsupport-l1-1-0.dll'],
    ['windows-api-core-string', 'api-ms-win-core-string-l1-1-0.dll'],
    ['windows-api-core-sync', 'api-ms-win-core-synch-l1-1-0.dll'],
    ['windows-api-core-sync-1', 'api-ms-win-core-synch-l1-2-0.dll'],
    ['windows-api-core-system-info', 'api-ms-win-core-sysinfo-l1-1-0.dll'],
    ['windows-api-security-system-functions', 'api-ms-win-security-systemfunctions-l1-1-0.dll'],
    ['windows-advapi32', 'ADVAPI32.dll'],
    ['windows-kernel32', 'KERNEL32.dll'],
    ['windows-nvidia-driver', 'nvcuda.dll'],
    ['windows-ucrt-convert', 'api-ms-win-crt-convert-l1-1-0.dll'],
    ['windows-ucrt-environment', 'api-ms-win-crt-environment-l1-1-0.dll'],
    ['windows-ucrt-filesystem', 'api-ms-win-crt-filesystem-l1-1-0.dll'],
    ['windows-ucrt-heap', 'api-ms-win-crt-heap-l1-1-0.dll'],
    ['windows-ucrt-locale', 'api-ms-win-crt-locale-l1-1-0.dll'],
    ['windows-ucrt-math', 'api-ms-win-crt-math-l1-1-0.dll'],
    ['windows-ucrt-runtime', 'api-ms-win-crt-runtime-l1-1-0.dll'],
    ['windows-ucrt-stdio', 'api-ms-win-crt-stdio-l1-1-0.dll'],
    ['windows-ucrt-string', 'api-ms-win-crt-string-l1-1-0.dll'],
    ['windows-ucrt-time', 'api-ms-win-crt-time-l1-1-0.dll'],
    ['windows-ucrt-utility', 'api-ms-win-crt-utility-l1-1-0.dll'],
  ].map(([id, name]) => Object.freeze({ id, name })),
);

function assertOwnedPath(path) {
  const child = relative(taskCacheRoot, path);
  if (child.length === 0 || child.startsWith('..') || isAbsolute(child)) {
    throw new Error('Windows runtime staging path escaped the private task root');
  }
}

function writeJson(path, value) {
  writeFileSync(path, canonicalCatalogJson(value), { mode: 0o600 });
}

function fileEvidence(root, relativePath, id) {
  const path = resolve(root, ...relativePath.split('/'));
  const { bytes, stat: metadata } = readVerifiedRegularFileSync(path);
  return Object.freeze({
    id,
    relativePath,
    mode: 0,
    sizeBytes: metadata.size,
    sha256: sha256(bytes),
  });
}

function componentPath(component) {
  if (component.pathKind !== 'toolchainRootRelative') {
    throw new Error(`Windows runtime pack rejects non-toolchain input: ${component.id}`);
  }
  return resolve(toolchainRoot, ...component.path.split('/'));
}

function inspectorEnvironment(inspector) {
  const systemRoot = process.env.SystemRoot;
  const temporaryRoot = process.env.TEMP;
  const windowsRoot = process.env.WINDIR;
  if (!systemRoot || !temporaryRoot || !windowsRoot) {
    throw new Error('Windows PE inspection requires SystemRoot, TEMP, and WINDIR');
  }
  return Object.freeze({
    PATH: [
      dirname(inspector),
      resolve(toolchainRoot, 'vc-runtime-14.51.36247.0-x64', 'bin'),
      resolve(systemRoot, 'System32'),
    ].join(';'),
    SystemRoot: systemRoot,
    TEMP: temporaryRoot,
    TMP: process.env.TMP ?? temporaryRoot,
    WINDIR: windowsRoot,
  });
}

function requiredLicense(profile, id) {
  const license = profile.licenses.find((candidate) => candidate.id === id);
  if (!license) throw new Error(`Windows runtime license identity is missing: ${id}`);
  return license;
}

function assertCudaArchitecture(worker) {
  const bytes = readFileSync(worker);
  if (!bytes.includes(Buffer.from('sm_120a', 'ascii'))) {
    throw new Error('Windows CUDA worker does not contain sm_120a generated-code identity');
  }
  for (const forbidden of ['sm_86', 'sm_89']) {
    if (bytes.includes(Buffer.from(forbidden, 'ascii'))) {
      throw new Error(`Windows CUDA worker contains an out-of-scope architecture: ${forbidden}`);
    }
  }
}

/** Resolves the acquired VC Runtime and captured CUDA DLL identities without allowing ambient substitution. */
export function resolveWindowsPackRuntimeDependencies({ backend, profile, lock }) {
  const vcDependencies = profile.dynamicDependencies.filter(({ id }) => id.startsWith('microsoft-vc-runtime-'));
  const cudaDependencies = profile.dynamicDependencies.filter(({ id }) => !id.startsWith('microsoft-vc-runtime-'));
  const resolvedVcDependencies = resolveWindowsRuntimeDependencyIdentities({ dependencies: vcDependencies, lock });
  if (backend === 'cpu') {
    if (cudaDependencies.length !== 0) throw new Error('Windows CPU runtime pack contains an accelerator dependency');
    return resolvedVcDependencies;
  }
  if (backend !== 'cuda' || cudaDependencies.length !== WINDOWS_CUDA_RUNTIME_DEPENDENCIES.size) {
    throw new Error('Windows CUDA runtime dependency set is incomplete');
  }
  const resolvedCudaIds = new Set();
  const resolvedCudaDependencies = cudaDependencies.map((dependency) => {
    const expectedName = WINDOWS_CUDA_RUNTIME_DEPENDENCIES.get(dependency.id);
    const runtimeIdentity = profile.runtime.find(({ id }) => id === dependency.id);
    if (
      !expectedName ||
      resolvedCudaIds.has(dependency.id) ||
      dependency.pathKind !== 'toolchainRootRelative' ||
      dependency.path !== `cuda-12.8.1/bin/${expectedName}` ||
      !/^[a-f\d]{64}$/u.test(dependency.sha256) ||
      !runtimeIdentity ||
      runtimeIdentity.pathKind !== dependency.pathKind ||
      runtimeIdentity.path !== dependency.path ||
      runtimeIdentity.sha256 !== dependency.sha256
    ) {
      throw new Error(`Windows CUDA runtime dependency identity changed: ${dependency.id}`);
    }
    resolvedCudaIds.add(dependency.id);
    return Object.freeze({ ...dependency });
  });
  if (resolvedCudaIds.size !== WINDOWS_CUDA_RUNTIME_DEPENDENCIES.size) {
    throw new Error('Windows CUDA runtime dependency set is incomplete');
  }
  return Object.freeze([...resolvedVcDependencies, ...resolvedCudaDependencies]);
}

export function stageWindowsRuntimePack({ backend, buildRoot, profile, tools = null }) {
  if (profile.target.os !== 'windows' || profile.target.architecture !== 'x64') {
    throw new Error('Windows runtime staging requires a Windows x64 execution profile');
  }
  const expectedBackend = backend === 'cuda' ? 'cuda' : 'cpu';
  if ((profile.profileId.includes('cuda') ? 'cuda' : 'cpu') !== expectedBackend) {
    throw new Error('Windows runtime staging backend/profile mismatch');
  }
  const stagingRoot = resolve(taskCacheRoot, 'stage', profile.profileId);
  assertOwnedPath(stagingRoot);
  removeTaskOwnedTree(stagingRoot);
  for (const directory of ['bin', 'licenses']) {
    mkdirSync(resolve(stagingRoot, directory), { mode: 0o700, recursive: true });
  }

  const workerName = 'local-whisper-whisper-cpp-worker.exe';
  const worker = resolve(stagingRoot, 'bin', workerName);
  copyFileSync(resolve(buildRoot, 'bin', workerName), worker);
  if (backend === 'cuda') assertCudaArchitecture(worker);

  const stagedRuntimeEvidence = [];
  const stagedDependencies = [];
  const runtimeDependencies = resolveWindowsPackRuntimeDependencies({
    backend,
    profile,
    lock: readJson(WINDOWS_RUNTIME_LOCK_PATH),
  });
  for (const dependency of runtimeDependencies) {
    const name = basename(dependency.path);
    const target = resolve(stagingRoot, 'bin', name);
    copyFileSync(componentPath(dependency), target);
    const stagedSha256 = sha256(readFileSync(target));
    if (stagedSha256 !== dependency.sha256) {
      throw new Error(`Staged Windows runtime identity changed: ${dependency.id}`);
    }
    stagedRuntimeEvidence.push(
      Object.freeze({ id: dependency.id, name, sha256: stagedSha256, sourceSha256: dependency.sha256 }),
    );
    stagedDependencies.push(Object.freeze({ id: dependency.id, name, path: target }));
  }

  const inspector = tools?.peInspector ?? resolveProfileTool(profile, toolchainRoot, 'pe-inspector');
  const dependencyClosure = verifyWindowsPeDependencyClosure({
    entrypoint: worker,
    environment: inspectorEnvironment(inspector),
    inspector,
    permittedUnreferenced: backend === 'cuda' ? ['cudart64_12.dll'] : [],
    stagedDependencies,
    systemDependencies: WINDOWS_SYSTEM_DEPENDENCIES,
  });

  copyFileSync(resolve(patchedSourceRoot, 'LICENSE'), resolve(stagingRoot, 'licenses', 'whisper-cpp.LICENSE'));
  copyFileSync(resolve(nlohmannSource, 'LICENSE.MIT'), resolve(stagingRoot, 'licenses', 'nlohmann-json.LICENSE.MIT'));
  copyFileSync(
    componentPath(requiredLicense(profile, 'microsoft-vc-runtime-14.51.36247.0-license')),
    resolve(stagingRoot, 'licenses', 'Microsoft-VC-Runtime.html'),
  );
  const licenseFiles = [
    ['licenses/whisper-cpp.LICENSE', 'whisper-cpp-license'],
    ['licenses/nlohmann-json.LICENSE.MIT', 'nlohmann-json-license'],
    ['licenses/Microsoft-VC-Runtime.html', 'microsoft-vc-runtime-license'],
  ];
  if (backend === 'cuda') {
    copyFileSync(
      componentPath(requiredLicense(profile, 'cuda-eula-12.8.1')),
      resolve(stagingRoot, 'licenses', 'NVIDIA-CUDA-EULA.txt'),
    );
    licenseFiles.push(['licenses/NVIDIA-CUDA-EULA.txt', 'cuda-eula']);
  }
  const noticeLines = [
    '# Third-party notices',
    '',
    '- whisper.cpp v1.9.1 (`f049fff`), MIT; see `licenses/whisper-cpp.LICENSE`.',
    '- nlohmann/json v3.12.0 (`55f9368`), MIT; see `licenses/nlohmann-json.LICENSE.MIT`.',
    '- Microsoft Visual C++ Runtime 14.51.36247.0; see `licenses/Microsoft-VC-Runtime.html`.',
  ];
  if (backend === 'cuda') {
    noticeLines.push(
      '- NVIDIA CUDA Toolkit 12.8.1 redistributable runtime libraries; see `licenses/NVIDIA-CUDA-EULA.txt`.',
    );
  }
  noticeLines.push('');
  writeFileSync(resolve(stagingRoot, 'THIRD_PARTY_NOTICES.md'), noticeLines.join('\n'), { mode: 0o600 });

  const patchLock = readJson(patchLockPath);
  const nlohmannLock = readJson(nlohmannSourceLockPath);
  const table = readJson(limitTablePath);
  const runtimeBuildDigest = buildIdentity(profile.profileId, profile);
  const runtimeRevision =
    backend === 'cuda' ? 'whisper-cpp-windows-x64-cuda-12.8.1-sm120a-v1' : 'whisper-cpp-windows-x64-cpu-v1';
  writeJson(resolve(stagingRoot, 'provenance.json'), {
    schemaId: 'local-whisper-whisper-cpp-provenance-v1',
    profileId: profile.profileId,
    profileInputDigest: canonicalDigest(profile),
    sourceLockId: patchLock.sourceLockId,
    originalManifestSha256: patchLock.originalManifestSha256,
    patchLockId: patchLock.lockId,
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
    requestedCudaArchitectures: backend === 'cuda' ? ['120a-real'] : [],
    effectiveCudaArchitectures: backend === 'cuda' ? ['120a-real'] : [],
    stagedRuntimeDependencies: stagedRuntimeEvidence,
    dependencyClosure,
    runtimePathPolicy: { policyId: 'local-whisper-windows-app-local-dll-v1', stagedValue: 'bin' },
    runtimeBuildDigest,
    modelIncluded: false,
  });

  writeJson(resolve(stagingRoot, 'sbom.spdx.json'), {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `gpt-voice-local-whisper-windows-${backend}-pack`,
    documentNamespace: `https://gpt-voice.local/sbom/${runtimeBuildDigest}`,
    creationInfo: { created: '2026-08-06T00:00:00Z', creators: ['Tool: GPT-Voice locked native build'] },
    packages: [
      ['gpt-voice-local-whisper-worker', 'SPDXRef-Package-Worker', runtimeBuildDigest, 'NOASSERTION'],
      ['whisper.cpp', 'SPDXRef-Package-WhisperCpp', '1.9.1-f049fff', 'MIT'],
      ['nlohmann/json', 'SPDXRef-Package-NlohmannJson', '3.12.0-55f9368', 'MIT'],
      ...stagedRuntimeEvidence.map((dependency, index) => [
        dependency.name,
        `SPDXRef-Runtime-${index}`,
        dependency.id,
        dependency.name.toLowerCase().startsWith('c') ? 'LicenseRef-NVIDIA-CUDA-EULA' : 'NOASSERTION',
      ]),
    ].map(([name, SPDXID, versionInfo, license]) => ({
      name,
      SPDXID,
      versionInfo,
      downloadLocation: 'NOASSERTION',
      filesAnalyzed: false,
      licenseConcluded: license,
      licenseDeclared: license,
      copyrightText: 'NOASSERTION',
    })),
    relationships: [
      {
        spdxElementId: 'SPDXRef-DOCUMENT',
        relationshipType: 'DESCRIBES',
        relatedSpdxElement: 'SPDXRef-Package-Worker',
      },
      ...stagedRuntimeEvidence.map((_, index) => ({
        spdxElementId: 'SPDXRef-Package-Worker',
        relationshipType: 'DEPENDS_ON',
        relatedSpdxElement: `SPDXRef-Runtime-${index}`,
      })),
    ],
  });

  const payloadFiles = [
    fileEvidence(stagingRoot, `bin/${workerName}`, 'worker'),
    ...stagedRuntimeEvidence.map((dependency) =>
      fileEvidence(stagingRoot, `bin/${dependency.name}`, `runtime-${dependency.id}`),
    ),
    ...licenseFiles.map(([path, id]) => fileEvidence(stagingRoot, path, id)),
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
    target: backend === 'cuda' ? 'gpu' : 'cpu',
    backend,
    platform: 'win32',
    architecture: 'x64',
    profileId: profile.profileId,
    runtimeRevision,
    runtimeBuildDigest,
    executable: `bin/${workerName}`,
    libraryDirectory: 'bin',
    dynamicBackendDiscovery: false,
    stagedRuntimeDependencies: stagedRuntimeEvidence,
    systemRuntimeDependencies: WINDOWS_SYSTEM_DEPENDENCIES,
    gpuBackends: backend === 'cuda' ? ['cuda'] : [],
    requestedCudaArchitectures: backend === 'cuda' ? ['120a-real'] : [],
    effectiveCudaArchitectures: backend === 'cuda' ? ['120a-real'] : [],
    minimumDriver: backend === 'cuda' ? profile.minimumDriver : null,
    runtimePathPolicy: { policyId: 'local-whisper-windows-app-local-dll-v1', stagedValue: 'bin' },
    modelIncluded: false,
    signed: false,
    productionOrigin: false,
    expectedFiles,
    payloadManifestSha256: canonicalDigest(payloadFiles),
  });
  return stagingRoot;
}
