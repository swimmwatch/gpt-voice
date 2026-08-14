import { existsSync, readdirSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const PLATFORM_NAMES = Object.freeze(['linux', 'windows']);
const SOURCE_EXTENSION = '.cpp';
const HEADER_EXTENSION = '.hpp';
const SUPPORTED_EVIDENCE_KINDS = new Set([
  'analyze',
  'binary-inspection',
  'compile',
  'contract-inspection',
  'execute',
  'fuzz',
  'sanitize',
  'tsan',
]);

const PROJECTS = Object.freeze([
  Object.freeze({ id: 'common', root: ['runtime', 'local-whisper', 'common'] }),
  Object.freeze({ id: 'fs-guard', root: ['runtime', 'local-whisper', 'fs-guard'] }),
  Object.freeze({ id: 'launcher', root: ['runtime', 'local-whisper', 'launcher'] }),
  Object.freeze({ id: 'worker', root: ['runtime', 'local-whisper', 'whisper-cpp'] }),
]);
const FOCUSED_GCC_PROJECTS = Object.freeze(['fs-guard', 'launcher']);
const FOCUSED_GCC_DEPENDENCY_PROJECTS = new Set(['common', ...FOCUSED_GCC_PROJECTS]);

const LINUX_ONLY_BASENAMES = new Set([
  'authority_bootstrap.cpp',
  'device_authority_posix.cpp',
  'linux_backend.cpp',
  'linux_launcher.cpp',
  'linux_process_identity.cpp',
  'linux_process_identity.hpp',
  'model_authority_client.cpp',
  'model_authority_linux.cpp',
  'model_authority_server.cpp',
  'model_launch_application.cpp',
  'qualification_protocol_test.cpp',
  'worker_tsan_race_proof.cpp',
  'worker_protocol_posix.cpp',
]);

const WINDOWS_ONLY_BASENAMES = new Set([
  'cng_sha256.cpp',
  'device_authority_windows.cpp',
  'model_authority_windows.cpp',
  'windows_backend.cpp',
  'windows_launcher.cpp',
  'windows_model_authority_client.hpp',
  'windows_model_authority_server.hpp',
  'windows_model_authority_client.cpp',
  'windows_model_authority_server.cpp',
  'windows_model_launch_application.cpp',
  'windows_process_identity.cpp',
  'windows_process_identity.hpp',
  'worker_protocol_windows.cpp',
  'worker_protocol_windows_test.cpp',
]);

function bytewiseStringSort(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function normalizeRelativePath(workspaceRoot, candidate) {
  const absolutePath = isAbsolute(candidate) ? candidate : resolve(workspaceRoot, candidate);
  const normalized = relative(workspaceRoot, absolutePath).replaceAll('\\', '/');
  if (normalized.length === 0 || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`Native quality path escapes the workspace: ${candidate}`);
  }
  return normalized;
}

function collectProjectFiles(workspaceRoot, project) {
  const root = resolve(workspaceRoot, ...project.root);
  if (!existsSync(root)) throw new Error(`Native quality project root is unavailable: ${project.id}`);
  const result = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      bytewiseStringSort(left.name, right.name),
    )) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile() && (entry.name.endsWith(SOURCE_EXTENSION) || entry.name.endsWith(HEADER_EXTENSION))) {
        result.push(normalizeRelativePath(workspaceRoot, path));
      }
    }
  };
  visit(root);
  return result;
}

function platformsForPath(path) {
  const basename = path.slice(path.lastIndexOf('/') + 1);
  if (path.includes('/fuzz/')) return ['linux'];
  if (path.includes('/launcher/tests/integration/') || path.includes('/whisper-cpp/qualification/')) return ['linux'];
  if (path.includes('/platform/linux/') || LINUX_ONLY_BASENAMES.has(basename)) return ['linux'];
  if (path.includes('/platform/windows/') || WINDOWS_ONLY_BASENAMES.has(basename)) return ['windows'];
  return [...PLATFORM_NAMES];
}

function assertManifestShape(manifest) {
  const paths = new Set();
  for (const entry of manifest) {
    if (!PROJECTS.some((project) => project.id === entry.project)) {
      throw new Error(`Native quality manifest has an unknown project: ${entry.project}`);
    }
    if (!['header', 'translation-unit'].includes(entry.kind)) {
      throw new Error(`Native quality manifest has an unsupported entry kind: ${entry.kind}`);
    }
    if (!Array.isArray(entry.platforms) || entry.platforms.length === 0) {
      throw new Error(`Native quality manifest has no supported host: ${entry.path}`);
    }
    if (entry.platforms.some((platform) => !PLATFORM_NAMES.includes(platform))) {
      throw new Error(`Native quality manifest has an unsupported host: ${entry.path}`);
    }
    if (paths.has(entry.path)) throw new Error(`Native quality manifest has a duplicate path: ${entry.path}`);
    paths.add(entry.path);
  }
  return manifest;
}

/** Returns the canonical, project-owned C++ source/header inventory for both supported hosts. */
export function createNativeQualityManifest(workspaceRoot) {
  const manifest = PROJECTS.flatMap((project) =>
    collectProjectFiles(workspaceRoot, project).map((path) =>
      Object.freeze({
        kind: path.endsWith(SOURCE_EXTENSION) ? 'translation-unit' : 'header',
        path,
        platforms: Object.freeze(platformsForPath(path)),
        project: project.id,
      }),
    ),
  ).sort((left, right) => bytewiseStringSort(left.path, right.path));
  return Object.freeze(assertManifestShape(manifest));
}

function assertSupportedPlatform(platform) {
  if (!PLATFORM_NAMES.includes(platform)) throw new Error(`Unsupported native quality platform: ${platform}`);
  return platform;
}

/** Lists every manifest source/header owned by a specific host. */
export function manifestEntriesForPlatform(manifest, platform, { translationUnitsOnly = false } = {}) {
  assertSupportedPlatform(platform);
  assertManifestShape(manifest);
  return Object.freeze(
    manifest.filter(
      (entry) => entry.platforms.includes(platform) && (!translationUnitsOnly || entry.kind === 'translation-unit'),
    ),
  );
}

/** Rejects a real build that misses an owned translation unit or compiles a host-inapplicable one. */
export function assertPlatformCompilationCoverage(manifest, platform, compiledPaths) {
  const required = manifestEntriesForPlatform(manifest, platform, { translationUnitsOnly: true });
  const allTranslationUnits = manifest.filter((entry) => entry.kind === 'translation-unit');
  const compiled = new Set(compiledPaths);
  const missing = required.filter((entry) => !compiled.has(entry.path)).map((entry) => entry.path);
  if (missing.length > 0) throw new Error(`Native quality compilation is missing: ${missing.join(', ')}`);
  const inapplicable = allTranslationUnits
    .filter((entry) => compiled.has(entry.path) && !entry.platforms.includes(platform))
    .map((entry) => entry.path);
  if (inapplicable.length > 0) {
    throw new Error(`Native quality compilation includes host-inapplicable sources: ${inapplicable.join(', ')}`);
  }
  return Object.freeze(required.map((entry) => entry.path));
}

/** Creates a bounded, host-truthful native quality coverage summary. */
export function createNativeQualityCoverageReport({ compilerProfile, evidence, manifest, platform }) {
  assertSupportedPlatform(platform);
  if (typeof compilerProfile !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(compilerProfile)) {
    throw new Error('Native quality compiler profile is invalid');
  }
  if (!Array.isArray(evidence) || evidence.length === 0) throw new Error('Native quality evidence is required');
  const evidenceKinds = [...new Set(evidence)].sort();
  if (evidenceKinds.some((kind) => !SUPPORTED_EVIDENCE_KINDS.has(kind))) {
    throw new Error('Native quality coverage claims an unsupported evidence kind');
  }
  for (const required of ['analyze', 'compile', 'contract-inspection']) {
    if (!evidenceKinds.includes(required)) throw new Error(`Native quality evidence is missing ${required}`);
  }
  const sourceSet = manifestEntriesForPlatform(manifest, platform).map((entry) => entry.path);
  return Object.freeze({
    compilerProfile,
    evidenceKinds: Object.freeze(evidenceKinds),
    host: platform,
    schemaId: 'local-whisper-native-quality-coverage-v1',
    sourceSet: Object.freeze(sourceSet),
  });
}

/** Creates a source-truthful report for the Linux GCC guard and launcher execution slice. */
export function createFocusedGccQualityCoverageReport({ compilerProfile, evidence, manifest, compiledPaths }) {
  if (compilerProfile !== 'linux-x64-cpu-baseline-v1') {
    throw new Error('Focused GCC quality must use the pinned Linux CPU baseline profile');
  }
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new Error('Focused GCC quality evidence is required');
  }
  const evidenceKinds = [...new Set(evidence)].sort();
  if (evidenceKinds.length !== 2 || !evidenceKinds.includes('compile') || !evidenceKinds.includes('execute')) {
    throw new Error('Focused GCC quality evidence must be exactly compile and execute');
  }
  if (!Array.isArray(compiledPaths) || compiledPaths.length === 0) {
    throw new Error('Focused GCC quality compiled sources are required');
  }
  const entriesByPath = new Map(manifest.map((entry) => [entry.path, entry]));
  const sourceSet = [...new Set(compiledPaths)].sort(bytewiseStringSort);
  const projects = new Set();
  for (const path of sourceSet) {
    const entry = entriesByPath.get(path);
    if (!entry || entry.kind !== 'translation-unit' || !entry.platforms.includes('linux')) {
      throw new Error(`Focused GCC quality source is not a Linux project translation unit: ${path}`);
    }
    if (!FOCUSED_GCC_DEPENDENCY_PROJECTS.has(entry.project)) {
      throw new Error(`Focused GCC quality includes an out-of-scope project source: ${path}`);
    }
    projects.add(entry.project);
  }
  for (const project of FOCUSED_GCC_PROJECTS) {
    if (!projects.has(project)) throw new Error(`Focused GCC quality is missing ${project} sources`);
  }
  return Object.freeze({
    compilerProfile,
    evidenceKinds: Object.freeze(evidenceKinds),
    host: 'linux',
    projects: FOCUSED_GCC_PROJECTS,
    schemaId: 'local-whisper-focused-gcc-quality-coverage-v1',
    sourceSet: Object.freeze(sourceSet),
  });
}

export function normalizeNativeCompilationPath(workspaceRoot, candidate) {
  return normalizeRelativePath(workspaceRoot, candidate);
}
