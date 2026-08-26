import { Buffer } from 'node:buffer';

import { canonicalDigest, canonicalJson, sha256 } from '../source-import/native-source-core.mjs';

export const PERFORMANCE_PROFILE_IDS = Object.freeze([
  'linux-x64-cpu-baseline-v1',
  'linux-x64-cuda-12.8.1-sm120a-v1',
  'windows-x64-cpu-msvc-19.51-v1',
  'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1',
]);

const SOURCE_LOCK_ID = 'whisper-cpp-v1.9.1-f049fff';
const SOURCE_MANIFEST_SHA256 = 'aeaed8ce38467815c0b3ee64f05bd7989bba42bb0baccd5dba853247a7f680de';
const MSVC_UNAVAILABLE_OPTIONS = Object.freeze(['GGML_AMX_BF16', 'GGML_AMX_INT8', 'GGML_F16C', 'GGML_FMA']);
const DISABLED_SHARED_OPTIONS = Object.freeze([
  'BUILD_SHARED_LIBS',
  'GGML_ACCELERATE',
  'GGML_AMX_BF16',
  'GGML_AMX_INT8',
  'GGML_AVX',
  'GGML_AVX2',
  'GGML_AVX512',
  'GGML_AVX512_BF16',
  'GGML_AVX512_VBMI',
  'GGML_AVX512_VNNI',
  'GGML_BACKEND_DL',
  'GGML_BLAS',
  'GGML_BMI2',
  'GGML_CANN',
  'GGML_CCACHE',
  'GGML_CPU_KLEIDIAI',
  'GGML_CPU_REPACK',
  'GGML_CUDA_FA',
  'GGML_CUDA_NCCL',
  'GGML_F16C',
  'GGML_FMA',
  'GGML_HIP',
  'GGML_HIP_GRAPHS',
  'GGML_HIP_MMQ_MFMA',
  'GGML_HIP_NO_VMM',
  'GGML_LASX',
  'GGML_LSX',
  'GGML_METAL',
  'GGML_MUSA',
  'GGML_NATIVE',
  'GGML_OPENCL',
  'GGML_OPENCL_EMBED_KERNELS',
  'GGML_OPENCL_USE_ADRENO_KERNELS',
  'GGML_OPENMP',
  'GGML_RPC',
  'GGML_RVV',
  'GGML_RV_ZFH',
  'GGML_RV_ZICBOP',
  'GGML_RV_ZIHINTPAUSE',
  'GGML_RV_ZVFH',
  'GGML_SSE42',
  'GGML_SYCL',
  'GGML_SYCL_DNN',
  'GGML_SYCL_GRAPH',
  'GGML_SYCL_HOST_MEM_FALLBACK',
  'GGML_SYCL_SUPPORT_LEVEL_ZERO',
  'GGML_VULKAN',
  'GGML_WEBGPU_JSPI',
  'GGML_ZDNN',
  'WHISPER_BUILD_EXAMPLES',
  'WHISPER_BUILD_TESTS',
  'WHISPER_CURL',
]);
const DISABLED_WINDOWS_CUDA_OPTIONS = Object.freeze([
  'GGML_CUDA_FA_ALL_QUANTS',
  'GGML_CUDA_FORCE_CUBLAS',
  'GGML_CUDA_FORCE_MMQ',
  'GGML_CUDA_GRAPHS',
  'GGML_CUDA_NO_PEER_COPY',
  'GGML_CUDA_NO_VMM',
]);

function expectedProfileOptions(profileId) {
  const windows = profileId.startsWith('windows-');
  const cuda = profileId.includes('-cuda-');
  const options = Object.fromEntries(DISABLED_SHARED_OPTIONS.map((name) => [name, 'OFF']));
  options.GGML_CPU = 'ON';
  options.GGML_CUDA = cuda ? 'ON' : 'OFF';
  options.GGML_STATIC = cuda && !windows ? 'OFF' : 'ON';
  if (cuda) {
    options.GGML_CUDA_CUB_3DOT2 = 'OFF';
  }
  if (cuda && windows) {
    for (const name of DISABLED_WINDOWS_CUDA_OPTIONS) options[name] = 'OFF';
    options.GGML_CUDA_COMPRESSION_MODE = 'size';
    options.GGML_CUDA_PEER_MAX_BATCH_SIZE = '128';
  }
  if (windows) {
    for (const name of MSVC_UNAVAILABLE_OPTIONS) delete options[name];
  }
  return Object.freeze(
    Object.fromEntries(Object.entries(options).sort(([left], [right]) => left.localeCompare(right))),
  );
}

export const PERFORMANCE_OPTION_INVENTORY = Object.freeze({
  schemaId: 'local-whisper-whisper-cpp-performance-options-v1',
  sourceLockId: SOURCE_LOCK_ID,
  sourceManifestSha256: SOURCE_MANIFEST_SHA256,
  profiles: Object.freeze(Object.fromEntries(PERFORMANCE_PROFILE_IDS.map((id) => [id, expectedProfileOptions(id)]))),
  platformDifferences: Object.freeze({
    msvcUnavailableOptions: MSVC_UNAVAILABLE_OPTIONS,
    windowsExplicitCudaDefaults: Object.freeze({
      options: Object.freeze([
        ...DISABLED_WINDOWS_CUDA_OPTIONS,
        'GGML_CUDA_COMPRESSION_MODE',
        'GGML_CUDA_PEER_MAX_BATCH_SIZE',
      ]),
      linuxBaseline: 'qualified-upstream-default',
      windowsCandidate: 'explicit-current-value',
    }),
    windowsCudaStaticValue: Object.freeze({
      option: 'GGML_STATIC',
      linux: 'OFF',
      windows: 'ON',
      sourceGuard: 'if (NOT MSVC)',
    }),
  }),
});

export const PERFORMANCE_OPTION_INVENTORY_DIGEST = canonicalDigest(PERFORMANCE_OPTION_INVENTORY);

function performanceOptions(cache) {
  return Object.fromEntries(
    Object.entries(cache)
      .filter(([name]) => name === 'BUILD_SHARED_LIBS' || name.startsWith('GGML_') || name.startsWith('WHISPER_'))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function assertWhisperCppPerformanceProfile(profile) {
  const expected = PERFORMANCE_OPTION_INVENTORY.profiles[profile.profileId];
  if (!expected) return true;
  const actual = performanceOptions(profile.cmakeCache);
  const missing = Object.keys(expected).filter((name) => !(name in actual));
  const unknown = Object.keys(actual).filter((name) => !(name in expected));
  const drifted = Object.keys(expected).filter((name) => name in actual && actual[name] !== expected[name]);
  if (missing.length > 0) throw new Error(`Whisper.cpp performance option missing: ${missing.join(', ')}`);
  if (unknown.length > 0) throw new Error(`Whisper.cpp performance option unknown: ${unknown.join(', ')}`);
  if (drifted.length > 0) throw new Error(`Whisper.cpp performance option drifted: ${drifted.join(', ')}`);
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error('Whisper.cpp performance option inventory changed');
  }
  return true;
}

function cmakeCacheObjectText(profileText) {
  const marker = '"cmakeCache"';
  const markerIndex = profileText.indexOf(marker);
  const start = profileText.indexOf('{', markerIndex + marker.length);
  if (markerIndex < 0 || start < 0) throw new Error('Native profile CMake cache object is missing');
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < profileText.length; index += 1) {
    const character = profileText[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return profileText.slice(start, index + 1);
    }
  }
  throw new Error('Native profile CMake cache object is unterminated');
}

export function assertWhisperCppPerformanceProfileText(profileText) {
  const profile = JSON.parse(profileText);
  assertWhisperCppPerformanceProfile(profile);
  if (!PERFORMANCE_OPTION_INVENTORY.profiles[profile.profileId]) return true;
  const keys = [...cmakeCacheObjectText(profileText).matchAll(/"([^"\\]+)"\s*:/gu)].map((match) => match[1]);
  const duplicates = [...new Set(keys.filter((key, index) => keys.indexOf(key) !== index))];
  if (duplicates.length > 0) throw new Error(`Whisper.cpp performance option duplicated: ${duplicates.join(', ')}`);
  return true;
}

export function assertPinnedWhisperCppPerformanceSources(sourceLock, sourceFiles) {
  if (sourceLock.lockId !== SOURCE_LOCK_ID || sourceLock.materialization?.manifestSha256 !== SOURCE_MANIFEST_SHA256) {
    throw new Error('Whisper.cpp performance inventory source lock changed');
  }
  const cmakeFiles = sourceFiles.filter(({ path }) => path.endsWith('CMakeLists.txt') || path.endsWith('.cmake'));
  const lockedCmakePaths = sourceLock.manifest
    .map(({ path }) => path)
    .filter((path) => path.endsWith('CMakeLists.txt') || path.endsWith('.cmake'))
    .sort();
  if (canonicalJson(cmakeFiles.map(({ path }) => path).sort()) !== canonicalJson(lockedCmakePaths)) {
    throw new Error('Whisper.cpp performance inventory source set is incomplete');
  }
  const source = cmakeFiles
    .map((entry) => {
      const locked = sourceLock.manifest.find(({ path }) => path === entry.path);
      if (!locked || locked.sha256 !== entry.sha256 || sha256(Buffer.from(entry.text, 'utf8')) !== entry.sha256) {
        throw new Error(`Whisper.cpp performance inventory source changed: ${entry.path}`);
      }
      return entry.text;
    })
    .join('\n');
  const names = new Set(
    Object.values(PERFORMANCE_OPTION_INVENTORY.profiles).flatMap((options) => Object.keys(options)),
  );
  for (const name of names) {
    const declared = new RegExp(`\\b(?:option|set)\\s*\\(\\s*${name}\\b`, 'u').test(source);
    const backendName = name.startsWith('GGML_') ? name.slice('GGML_'.length) : '';
    const indirectlyConsumed =
      source.includes(name) ||
      (backendName.length > 0 && new RegExp(`ggml_add_backend\\(\\s*${backendName}\\s*\\)`, 'iu').test(source));
    if (!declared && !indirectlyConsumed) {
      throw new Error(`Whisper.cpp performance option is not consumed by pinned source: ${name}`);
    }
  }
  if (source.includes('GGML_CUDA_F16') || names.has('GGML_CUDA_F16')) {
    throw new Error('Removed Whisper.cpp CUDA F16 option must not enter the current inventory');
  }
  const ggmlRoot = cmakeFiles.find(({ path }) => path === 'ggml/CMakeLists.txt')?.text ?? '';
  const ggmlBuild = cmakeFiles.find(({ path }) => path === 'ggml/src/CMakeLists.txt')?.text ?? '';
  if (
    !/if\s*\(NOT MSVC\)[\s\S]*option\(GGML_FMA[\s\S]*option\(GGML_F16C[\s\S]*option\(GGML_AMX_INT8[\s\S]*option\(GGML_AMX_BF16[\s\S]*endif\(\)/u.test(
      ggmlRoot,
    ) ||
    !/if\s*\(NOT MSVC\)[\s\S]*if\s*\(GGML_STATIC\)/u.test(ggmlBuild)
  ) {
    throw new Error('Whisper.cpp MSVC performance-option classification source changed');
  }
  return PERFORMANCE_OPTION_INVENTORY_DIGEST;
}
