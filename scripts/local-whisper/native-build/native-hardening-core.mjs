import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { validateRelativePath } from '../source-import/native-source-core.mjs';

const ELF_CLASS_64 = 2;
const ELF_DATA_LITTLE_ENDIAN = 1;
const ELF_DYNAMIC_ENTRY_SIZE = 16;
const ELF_ET_DYN = 3;
const ELF_HEADER_SIZE = 64;
const ELF_PHDR_SIZE = 56;
const ELF_PT_DYNAMIC = 2;
const ELF_PT_GNU_RELRO = 0x6474e552;
const ELF_PT_GNU_STACK = 0x6474e551;
const ELF_PF_X = 1;
const ELF_DT_BIND_NOW = 24n;
const ELF_DT_FLAGS = 30n;
const ELF_DT_FLAGS_1 = 0x6ffffffbn;
const ELF_DT_NULL = 0n;
const ELF_DT_TEXTREL = 22n;
const ELF_DF_BIND_NOW = 0x8n;
const ELF_DF_TEXTREL = 0x4n;
const ELF_DF_1_NOW = 0x1n;
const MAX_BINARY_BYTES = 512 * 1024 * 1024;
const PE_DLL_CHARACTERISTICS_DYNAMIC_BASE = 0x0040;
const PE_DLL_CHARACTERISTICS_HIGH_ENTROPY_VA = 0x0020;
const PE_DLL_CHARACTERISTICS_NX_COMPAT = 0x0100;
const PE_IMAGE_FILE_MACHINE_AMD64 = 0x8664;
const PE_LOAD_CONFIG_DIRECTORY_INDEX = 10;
const PE_LOAD_CONFIG_GUARD_CF_FUNCTION_TABLE_OFFSET = 128;
const PE_LOAD_CONFIG_GUARD_CF_FUNCTION_COUNT_OFFSET = 136;
const PE_LOAD_CONFIG_GUARD_FLAGS_OFFSET = 144;
const PE_LOAD_CONFIG_SECURITY_COOKIE_OFFSET = 88;
const PE_LOAD_CONFIG_SIZE = 148;
const PE_MAGIC = 0x20b;
const PE_OPTIONAL_HEADER_DATA_DIRECTORY_OFFSET = 112;
const PE_OPTIONAL_HEADER_DLL_CHARACTERISTICS_OFFSET = 70;
const PE_SECTION_HEADER_SIZE = 40;
const PE_GUARD_CF_INSTRUMENTED = 0x00000100;
const WINDOWS_CUDA_QUALIFICATION_BUILD = 'wcuda-engine-p20w-cuda-a';
const WINDOWS_CUDA_QUALIFICATION_PROFILE = 'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1';
export const WINDOWS_CUDA_QUALIFICATION_EVIDENCE_RELATIVE_PATH =
  '.cache/local-whisper/qualification/runtime-packs/cuda/runtime-reproducibility.json';

export const NATIVE_HARDENING_SCHEMA_ID = 'local-whisper-native-hardening-v1';

function assertByteRange(bytes, offset, length, label) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0) {
    throw new Error(`${label} has an invalid binary range`);
  }
  if (offset > bytes.length || length > bytes.length - offset) {
    throw new Error(`${label} is outside the binary`);
  }
}

function readU16(bytes, offset, label) {
  assertByteRange(bytes, offset, 2, label);
  return bytes.readUInt16LE(offset);
}

function readU32(bytes, offset, label) {
  assertByteRange(bytes, offset, 4, label);
  return bytes.readUInt32LE(offset);
}

function readU64(bytes, offset, label) {
  assertByteRange(bytes, offset, 8, label);
  const value = bytes.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} exceeds safe binary bounds`);
  return Number(value);
}

function readI64(bytes, offset, label) {
  assertByteRange(bytes, offset, 8, label);
  return bytes.readBigInt64LE(offset);
}

function requireElfHeader(bytes) {
  assertByteRange(bytes, 0, ELF_HEADER_SIZE, 'ELF header');
  if (!bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
    throw new Error('Expected an ELF binary');
  }
  if (bytes[4] !== ELF_CLASS_64 || bytes[5] !== ELF_DATA_LITTLE_ENDIAN) {
    throw new Error('Expected a little-endian ELF64 binary');
  }
}

/** Parses the ELF64 properties which must be present in a hardened native executable. */
export function inspectElfHardening(bytes) {
  requireElfHeader(bytes);
  if (readU16(bytes, 16, 'ELF type') !== ELF_ET_DYN) throw new Error('ELF binary is not position independent');

  const programHeaderOffset = readU64(bytes, 32, 'ELF program-header offset');
  const programHeaderSize = readU16(bytes, 54, 'ELF program-header size');
  const programHeaderCount = readU16(bytes, 56, 'ELF program-header count');
  if (programHeaderSize !== ELF_PHDR_SIZE) throw new Error('ELF program-header size is unsupported');
  assertByteRange(bytes, programHeaderOffset, programHeaderSize * programHeaderCount, 'ELF program headers');

  let hasRelro = false;
  let hasNonExecutableStack = false;
  let dynamicOffset = null;
  let dynamicSize = null;
  for (let index = 0; index < programHeaderCount; index += 1) {
    const offset = programHeaderOffset + index * programHeaderSize;
    const type = readU32(bytes, offset, 'ELF program-header type');
    if (type === ELF_PT_GNU_RELRO) hasRelro = true;
    if (type === ELF_PT_GNU_STACK) {
      const flags = readU32(bytes, offset + 4, 'ELF GNU stack flags');
      hasNonExecutableStack = (flags & ELF_PF_X) === 0;
    }
    if (type === ELF_PT_DYNAMIC) {
      dynamicOffset = readU64(bytes, offset + 8, 'ELF dynamic offset');
      dynamicSize = readU64(bytes, offset + 32, 'ELF dynamic size');
    }
  }
  if (!hasRelro) throw new Error('ELF binary is missing GNU RELRO');
  if (!hasNonExecutableStack) throw new Error('ELF binary has an executable stack');
  if (dynamicOffset === null || dynamicSize === null || dynamicSize % ELF_DYNAMIC_ENTRY_SIZE !== 0) {
    throw new Error('ELF binary has no valid dynamic section');
  }
  assertByteRange(bytes, dynamicOffset, dynamicSize, 'ELF dynamic section');

  let hasImmediateBinding = false;
  let hasTextRelocation = false;
  for (let offset = dynamicOffset; offset < dynamicOffset + dynamicSize; offset += ELF_DYNAMIC_ENTRY_SIZE) {
    const tag = readI64(bytes, offset, 'ELF dynamic tag');
    if (tag === ELF_DT_NULL) break;
    const value = bytes.readBigUInt64LE(offset + 8);
    if (tag === ELF_DT_BIND_NOW) hasImmediateBinding = true;
    if (tag === ELF_DT_FLAGS && (value & ELF_DF_BIND_NOW) !== 0n) hasImmediateBinding = true;
    if (tag === ELF_DT_FLAGS_1 && (value & ELF_DF_1_NOW) !== 0n) hasImmediateBinding = true;
    if (tag === ELF_DT_TEXTREL || (tag === ELF_DT_FLAGS && (value & ELF_DF_TEXTREL) !== 0n)) {
      hasTextRelocation = true;
    }
  }
  if (!hasImmediateBinding) throw new Error('ELF binary is missing immediate binding');
  if (hasTextRelocation) throw new Error('ELF binary has text relocations');

  return Object.freeze({
    immediateBinding: true,
    noTextRelocations: true,
    nonExecutableStack: true,
    pie: true,
    relro: true,
  });
}

function requirePeHeader(bytes) {
  assertByteRange(bytes, 0, 0x40, 'PE DOS header');
  if (!bytes.subarray(0, 2).equals(Buffer.from('MZ'))) throw new Error('Expected a PE binary');
  const peOffset = readU32(bytes, 0x3c, 'PE header offset');
  assertByteRange(bytes, peOffset, 24, 'PE header');
  if (!bytes.subarray(peOffset, peOffset + 4).equals(Buffer.from('PE\0\0'))) {
    throw new Error('PE signature is invalid');
  }
  return peOffset;
}

function peRvaToOffset(bytes, sectionOffset, sectionCount, rva) {
  for (let index = 0; index < sectionCount; index += 1) {
    const offset = sectionOffset + index * PE_SECTION_HEADER_SIZE;
    assertByteRange(bytes, offset, PE_SECTION_HEADER_SIZE, 'PE section header');
    const virtualSize = readU32(bytes, offset + 8, 'PE section virtual size');
    const virtualAddress = readU32(bytes, offset + 12, 'PE section virtual address');
    const rawSize = readU32(bytes, offset + 16, 'PE section raw size');
    const rawOffset = readU32(bytes, offset + 20, 'PE section raw offset');
    const sectionSize = Math.max(virtualSize, rawSize);
    if (rva < virtualAddress || rva >= virtualAddress + sectionSize) continue;
    const fileOffset = rawOffset + rva - virtualAddress;
    assertByteRange(bytes, fileOffset, 1, 'PE load-configuration offset');
    return fileOffset;
  }
  throw new Error('PE load-configuration directory is outside its sections');
}

/** Parses PE32+ load-configuration and mitigation metadata without executing the binary. */
export function inspectPeHardening(bytes) {
  const peOffset = requirePeHeader(bytes);
  const coffOffset = peOffset + 4;
  if (readU16(bytes, coffOffset, 'PE machine') !== PE_IMAGE_FILE_MACHINE_AMD64) {
    throw new Error('Expected an x64 PE binary');
  }
  const sectionCount = readU16(bytes, coffOffset + 2, 'PE section count');
  const optionalHeaderSize = readU16(bytes, coffOffset + 16, 'PE optional-header size');
  const optionalOffset = coffOffset + 20;
  assertByteRange(bytes, optionalOffset, optionalHeaderSize, 'PE optional header');
  if (readU16(bytes, optionalOffset, 'PE optional-header magic') !== PE_MAGIC) {
    throw new Error('Expected a PE32+ optional header');
  }
  if (optionalHeaderSize < PE_OPTIONAL_HEADER_DATA_DIRECTORY_OFFSET + (PE_LOAD_CONFIG_DIRECTORY_INDEX + 1) * 8) {
    throw new Error('PE optional header has no load-configuration directory');
  }
  const dllCharacteristics = readU16(
    bytes,
    optionalOffset + PE_OPTIONAL_HEADER_DLL_CHARACTERISTICS_OFFSET,
    'PE DLL characteristics',
  );
  if ((dllCharacteristics & PE_DLL_CHARACTERISTICS_DYNAMIC_BASE) === 0) {
    throw new Error('PE binary is missing dynamic-base ASLR');
  }
  if ((dllCharacteristics & PE_DLL_CHARACTERISTICS_NX_COMPAT) === 0) {
    throw new Error('PE binary is missing NX compatibility');
  }
  if ((dllCharacteristics & PE_DLL_CHARACTERISTICS_HIGH_ENTROPY_VA) === 0) {
    throw new Error('PE binary is missing high-entropy VA');
  }

  const loadConfigDirectory =
    optionalOffset + PE_OPTIONAL_HEADER_DATA_DIRECTORY_OFFSET + PE_LOAD_CONFIG_DIRECTORY_INDEX * 8;
  const loadConfigRva = readU32(bytes, loadConfigDirectory, 'PE load-configuration RVA');
  const loadConfigSize = readU32(bytes, loadConfigDirectory + 4, 'PE load-configuration size');
  if (loadConfigRva === 0 || loadConfigSize < PE_LOAD_CONFIG_SIZE) {
    throw new Error('PE binary is missing load-configuration metadata');
  }
  const sectionOffset = optionalOffset + optionalHeaderSize;
  assertByteRange(bytes, sectionOffset, sectionCount * PE_SECTION_HEADER_SIZE, 'PE section table');
  const loadConfigOffset = peRvaToOffset(bytes, sectionOffset, sectionCount, loadConfigRva);
  assertByteRange(bytes, loadConfigOffset, PE_LOAD_CONFIG_SIZE, 'PE load-configuration directory');
  if (readU32(bytes, loadConfigOffset, 'PE load-configuration structure size') < PE_LOAD_CONFIG_SIZE) {
    throw new Error('PE load-configuration structure is incomplete');
  }
  if (readU64(bytes, loadConfigOffset + PE_LOAD_CONFIG_SECURITY_COOKIE_OFFSET, 'PE security cookie') === 0) {
    throw new Error('PE binary is missing stack-cookie metadata');
  }
  const guardTable = readU64(
    bytes,
    loadConfigOffset + PE_LOAD_CONFIG_GUARD_CF_FUNCTION_TABLE_OFFSET,
    'PE Guard CF function table',
  );
  const guardCount = readU64(
    bytes,
    loadConfigOffset + PE_LOAD_CONFIG_GUARD_CF_FUNCTION_COUNT_OFFSET,
    'PE Guard CF function count',
  );
  const guardFlags = readU32(bytes, loadConfigOffset + PE_LOAD_CONFIG_GUARD_FLAGS_OFFSET, 'PE Guard CF flags');
  if (guardTable === 0 || guardCount === 0 || (guardFlags & PE_GUARD_CF_INSTRUMENTED) === 0) {
    throw new Error('PE binary is missing Control Flow Guard metadata');
  }

  return Object.freeze({
    aslr: true,
    cfg: true,
    highEntropyVa: true,
    nx: true,
    stackCookie: true,
  });
}

function assertOwnedPath(root, path, label) {
  const pathRelativeToRoot = relative(root, path);
  if (
    pathRelativeToRoot === '' ||
    pathRelativeToRoot === '..' ||
    pathRelativeToRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathRelativeToRoot)
  ) {
    throw new Error(`${label} escaped the Local Whisper workspace root`);
  }
}

function readOwnedFile(root, relativePath, label) {
  validateRelativePath(relativePath);
  const path = resolve(root, ...relativePath.split('/'));
  assertOwnedPath(root, path, label);
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    throw new Error(`${label} is missing`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} is not a regular file`);
  if (stat.size > MAX_BINARY_BYTES) throw new Error(`${label} exceeds the binary inspection limit`);
  let canonicalRoot;
  let canonicalPath;
  try {
    canonicalRoot = realpathSync(root);
    canonicalPath = realpathSync(path);
  } catch {
    throw new Error(`${label} cannot be resolved`);
  }
  assertOwnedPath(canonicalRoot, canonicalPath, label);
  return Object.freeze({ bytes: readFileSync(canonicalPath) });
}

function readOwnedJson(root, relativePath, label) {
  const { bytes } = readOwnedFile(root, relativePath, label);
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

function commandText(entry) {
  if (typeof entry.command === 'string') return entry.command;
  if (Array.isArray(entry.arguments) && entry.arguments.every((argument) => typeof argument === 'string')) {
    return entry.arguments.join(' ');
  }
  throw new Error('Compilation database entry has no command');
}

function verifyCompileEvidence(root, relativePath, requiredFlags) {
  const { bytes } = readOwnedFile(root, relativePath, 'Compilation database');
  let entries;
  try {
    entries = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('Compilation database is not valid JSON');
  }
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('Compilation database is empty');
  const localEntries = entries.filter((entry) => {
    if (entry === null || typeof entry !== 'object' || typeof entry.file !== 'string') return false;
    return entry.file.replaceAll('\\', '/').includes('/runtime/local-whisper/');
  });
  if (localEntries.length === 0) throw new Error('Compilation database has no Local Whisper sources');
  for (const entry of localEntries) {
    const command = commandText(entry);
    for (const requiredFlag of requiredFlags) {
      if (requiredFlag instanceof RegExp ? !requiredFlag.test(command) : !command.includes(requiredFlag)) {
        throw new Error(`Compilation database is missing required hardening evidence: ${requiredFlag}`);
      }
    }
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Returns the only permitted production-binary manifest for a host-native verification run. */
export function createNativeHardeningManifest(platform, { windowsCudaQualification = false } = {}) {
  if (platform !== 'linux' && platform !== 'windows')
    throw new Error('Native hardening supports Linux and Windows only');
  if (typeof windowsCudaQualification !== 'boolean' || (platform !== 'windows' && windowsCudaQualification)) {
    throw new Error('Native hardening qualification selection is invalid');
  }
  const extension = platform === 'windows' ? '.exe' : '';
  const buildPlatform = platform === 'windows' ? 'windows' : 'linux';
  const workerBuild = platform === 'windows' ? 'wcpu-engine' : 'linux-x64-cpu-baseline-v1-engine';
  const cudaWorkerBuild = windowsCudaQualification ? WINDOWS_CUDA_QUALIFICATION_BUILD : 'wcuda-engine';
  return Object.freeze({
    executables: Object.freeze([
      Object.freeze({
        compileCommandsRelativePath: `.cache/local-whisper/fs-guard/build-${buildPlatform}-release/compile_commands.json`,
        relativePath: `.cache/local-whisper/fs-guard/fs-guard${extension}`,
        role: 'fs-guard',
      }),
      Object.freeze({
        compileCommandsRelativePath: `.cache/local-whisper/launcher/build-${buildPlatform}-release/compile_commands.json`,
        relativePath: `.cache/local-whisper/launcher/local-whisper-launcher${extension}`,
        role: 'launcher',
      }),
      Object.freeze({
        compileCommandsRelativePath: `.cache/local-whisper/whisper-cpp/build/${workerBuild}/compile_commands.json`,
        relativePath: `.cache/local-whisper/whisper-cpp/build/${workerBuild}/bin/local-whisper-whisper-cpp-worker${extension}`,
        role: 'whisper-cpp-cpu-worker',
      }),
      ...(platform === 'windows'
        ? [
            Object.freeze({
              compileCommandsRelativePath: `.cache/local-whisper/whisper-cpp/build/${cudaWorkerBuild}/compile_commands.json`,
              relativePath: `.cache/local-whisper/whisper-cpp/build/${cudaWorkerBuild}/bin/local-whisper-whisper-cpp-worker.exe`,
              role: 'whisper-cpp-cuda-worker',
            }),
          ]
        : []),
    ]),
    platform,
    schemaId: NATIVE_HARDENING_SCHEMA_ID,
    windowsCudaQualification,
  });
}

export function hasWindowsCudaQualificationHardeningEvidence(workspaceRoot) {
  return existsSync(resolve(workspaceRoot, ...WINDOWS_CUDA_QUALIFICATION_EVIDENCE_RELATIVE_PATH.split('/')));
}

function qualificationCudaWorkerIdentity(workspaceRoot) {
  const reproducibility = readOwnedJson(
    workspaceRoot,
    WINDOWS_CUDA_QUALIFICATION_EVIDENCE_RELATIVE_PATH,
    'Windows CUDA runtime reproducibility record',
  );
  const pack = readOwnedJson(
    workspaceRoot,
    '.cache/local-whisper/qualification/runtime-packs/cuda/build-a/runtime-pack.json',
    'Windows CUDA runtime pack record',
  );
  if (
    reproducibility?.backend !== 'cuda' ||
    reproducibility.profileId !== WINDOWS_CUDA_QUALIFICATION_PROFILE ||
    reproducibility.cleanRootCount !== 2 ||
    reproducibility.networkIsolation !== 'fetchcontent-disconnected-isolated-toolchain' ||
    reproducibility.reproducible !== true ||
    pack?.profileId !== WINDOWS_CUDA_QUALIFICATION_PROFILE ||
    pack.archive?.sha256 !== reproducibility.archiveSha256 ||
    !Array.isArray(pack.expectedFiles)
  ) {
    throw new Error('Windows CUDA hardening evidence is not the reproducible Packet 20 runtime pack');
  }
  const workers = pack.expectedFiles.filter(
    (file) => file?.fileId === 'worker' && file.kind === 'executable' && /^[a-f0-9]{64}$/u.test(file.sha256),
  );
  if (workers.length !== 1 || !Number.isSafeInteger(workers[0].sizeBytes) || workers[0].sizeBytes <= 0) {
    throw new Error('Windows CUDA hardening evidence has no exact worker identity');
  }
  return workers[0];
}

/** Verifies only the generated manifest's exact production outputs and returns a privacy-bounded report. */
export function verifyNativeHardening({ manifest, workspaceRoot }) {
  if (manifest?.schemaId !== NATIVE_HARDENING_SCHEMA_ID) throw new Error('Native hardening manifest schema is invalid');
  if (manifest.platform !== 'linux' && manifest.platform !== 'windows')
    throw new Error('Native hardening platform is invalid');
  const expected = createNativeHardeningManifest(manifest.platform, {
    windowsCudaQualification: manifest.windowsCudaQualification,
  });
  if (!Array.isArray(manifest.executables) || manifest.executables.length !== expected.executables.length) {
    throw new Error(`Native hardening manifest must contain exactly ${expected.executables.length} executables`);
  }
  const expectedByRole = new Map(expected.executables.map((entry) => [entry.role, entry]));
  const observedRoles = new Set();
  const verifiedExecutables = [];
  for (const executable of manifest.executables) {
    if (executable === null || typeof executable !== 'object' || typeof executable.role !== 'string') {
      throw new Error('Native hardening manifest executable is invalid');
    }
    if (observedRoles.has(executable.role)) throw new Error(`Native hardening manifest repeats ${executable.role}`);
    observedRoles.add(executable.role);
    const expectedExecutable = expectedByRole.get(executable.role);
    if (
      !expectedExecutable ||
      executable.relativePath !== expectedExecutable.relativePath ||
      executable.compileCommandsRelativePath !== expectedExecutable.compileCommandsRelativePath
    ) {
      throw new Error(`Native hardening manifest contains an unexpected executable: ${executable.role}`);
    }
    verifiedExecutables.push(executable);
  }
  if (observedRoles.size !== expectedByRole.size) throw new Error('Native hardening manifest omitted an executable');

  const reports = [];
  const qualificationWorker = manifest.windowsCudaQualification ? qualificationCudaWorkerIdentity(workspaceRoot) : null;
  for (const executable of verifiedExecutables) {
    const { bytes } = readOwnedFile(workspaceRoot, executable.relativePath, `Native executable ${executable.role}`);
    if (
      executable.role === 'whisper-cpp-cuda-worker' &&
      qualificationWorker !== null &&
      (bytes.byteLength !== qualificationWorker.sizeBytes || sha256(bytes) !== qualificationWorker.sha256)
    ) {
      throw new Error('Windows CUDA hardening worker does not match the reproducible runtime pack');
    }
    if (manifest.platform === 'linux') {
      inspectElfHardening(bytes);
      verifyCompileEvidence(workspaceRoot, executable.compileCommandsRelativePath, [
        '-fPIE',
        '-fstack-protector-strong',
        /-D_FORTIFY_SOURCE=[23](?:\s|$)/u,
      ]);
      reports.push(
        Object.freeze({
          mitigations: Object.freeze([
            'fortification',
            'immediate-binding',
            'no-text-relocations',
            'non-executable-stack',
            'pie',
            'relro',
            'stack-protection',
          ]),
          path: executable.relativePath,
          role: executable.role,
          sha256: sha256(bytes),
        }),
      );
    } else {
      inspectPeHardening(bytes);
      verifyCompileEvidence(workspaceRoot, executable.compileCommandsRelativePath, ['/GS', '/guard:cf']);
      reports.push(
        Object.freeze({
          mitigations: Object.freeze(['aslr', 'cfg', 'high-entropy-va', 'nx', 'stack-cookie']),
          path: executable.relativePath,
          role: executable.role,
          sha256: sha256(bytes),
        }),
      );
    }
  }
  return Object.freeze({ executables: Object.freeze(reports), platform: manifest.platform });
}
