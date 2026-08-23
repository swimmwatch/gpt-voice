import { realpath, stat } from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';

import {
  RUNTIME_CODE_PATTERN,
  SUPPORTED_NODE_MAJORS,
  freezeArray,
  freezeRecord,
  isRecord,
  requirePositiveInteger,
  requireRecord,
  requireString,
  runtimeFail,
} from './runtime-core-support.mjs';

export const MAX_ARGUMENT_COUNT = 200;
export const MAX_ARGUMENT_BYTES = 8_192;
export const MAX_ENVIRONMENT_ENTRIES = 100;
export const MAX_EXECUTABLE_BYTES = 4_096;
export const MAX_TIMEOUT_MILLISECONDS = 604_800_000;

const ENVIRONMENT_NAME_PATTERN = /^[A-Za-z_]\w{0,127}$/u;
const EXECUTABLE_OPERATOR_PATTERN = /[;&|<>`]/u;
const EXECUTABLE_INTERPOLATION_PATTERN = /\$\(|\$\{|\{\{|\}\}|%[A-Za-z_]\w*%/u;
const DECLARED_SECRET_NAME_PATTERN =
  /api_?key|auth(?:orization)?|cookie|credential|pass(?:word|wd)?|private|secret|token/iu;
const DEFAULT_FILE_SYSTEM = Object.freeze({ realpath, stat });

function assertSafeText(value, code, maximum, minimum = 1) {
  const text = requireString(value, code, { minimum, maximum });
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) runtimeFail(code);
  }
  return text;
}

function assertEnvironmentName(value, code) {
  const name = requireString(value, code, { minimum: 1, maximum: 128 });
  if (!ENVIRONMENT_NAME_PATTERN.test(name)) runtimeFail(code);
  return name;
}

function isPortableAbsolutePath(value) {
  return path.isAbsolute(value) || path.win32.isAbsolute(value);
}

function hasRelativeTraversal(value) {
  return /(?:^|[\\/])\.\.(?:[\\/]|$)/u.test(value);
}

function readInheritedEnvironment(source, requestedName, platform) {
  if (platform !== 'win32') return source[requestedName];
  const normalizedName = requestedName.toUpperCase();
  for (const [name, value] of Object.entries(source)) {
    if (name.toUpperCase() === normalizedName) return value;
  }
  return undefined;
}

function validateEnvironmentEntries(environment) {
  const value = requireRecord(environment, 'invalid-declared-environment');
  const entries = Object.entries(value);
  if (entries.length > MAX_ENVIRONMENT_ENTRIES) runtimeFail('invalid-declared-environment');
  for (const [name, entry] of entries) {
    assertEnvironmentName(name, 'invalid-declared-environment');
    if (DECLARED_SECRET_NAME_PATTERN.test(name)) runtimeFail('declared-secret-environment-not-allowed');
    assertSafeText(entry, 'invalid-declared-environment', MAX_ARGUMENT_BYTES, 0);
  }
  return entries;
}

/** Validates the Node major before the runtime imports provider-facing code. */
export function assertSupportedNodeRuntime(version = process.versions.node) {
  const value = requireString(version, 'unsupported-node-runtime', { minimum: 5, maximum: 128 });
  const match = /^v?(?<major>\d+)\.\d+\.\d+(?:[-+][\w.-]+)?$/u.exec(value);
  if (match === null) runtimeFail('unsupported-node-runtime');
  const major = Number(match.groups?.major);
  if (!SUPPORTED_NODE_MAJORS.includes(major)) runtimeFail('unsupported-node-runtime');
  return freezeRecord({ major, version: value });
}

/** Validates one executable that will be passed directly to spawn, never to a shell. */
export function validateExecutable(executable) {
  const value = assertSafeText(executable, 'invalid-executable', MAX_EXECUTABLE_BYTES);
  if (
    value !== value.trim() ||
    EXECUTABLE_OPERATOR_PATTERN.test(value) ||
    EXECUTABLE_INTERPOLATION_PATTERN.test(value)
  ) {
    runtimeFail('invalid-executable');
  }
  if (/\s/u.test(value) && !isPortableAbsolutePath(value)) runtimeFail('invalid-executable');
  if (!isPortableAbsolutePath(value) && hasRelativeTraversal(value)) runtimeFail('invalid-executable');
  return value;
}

/** Preserves argument bytes and ordering while rejecting values unsafe for OS process APIs. */
export function validateProcessArguments(arguments_) {
  if (!Array.isArray(arguments_) || arguments_.length > MAX_ARGUMENT_COUNT) runtimeFail('invalid-process-arguments');
  return freezeArray(
    arguments_.map((argument) => assertSafeText(argument, 'invalid-process-arguments', MAX_ARGUMENT_BYTES, 0)),
  );
}

/** Builds the complete child environment from an explicit inherited allowlist and non-secret values. */
export function buildAllowlistedEnvironment({
  declaredEnvironment = {},
  inheritedEnvironment = process.env,
  names = [],
  platform = process.platform,
} = {}) {
  if (!isRecord(inheritedEnvironment) || !Array.isArray(names) || names.length > MAX_ENVIRONMENT_ENTRIES) {
    runtimeFail('invalid-environment-allowlist');
  }
  const result = {};
  const seenNames = new Set();
  for (const name of names) {
    const validatedName = assertEnvironmentName(name, 'invalid-environment-allowlist');
    const canonicalName = platform === 'win32' ? validatedName.toUpperCase() : validatedName;
    if (seenNames.has(canonicalName)) runtimeFail('invalid-environment-allowlist');
    seenNames.add(canonicalName);
    const value = readInheritedEnvironment(inheritedEnvironment, validatedName, platform);
    if (typeof value === 'string') result[validatedName] = value;
  }
  for (const [name, value] of validateEnvironmentEntries(declaredEnvironment)) result[name] = value;
  return freezeRecord(result);
}

/** Validates declarative spawn input before filesystem lookup or process creation. */
export function validateProcessCommand(command) {
  const value = requireRecord(command, 'invalid-process-command');
  const allowedFields = new Set(['args', 'cwd', 'env', 'environmentAllowlist', 'executable', 'timeoutMilliseconds']);
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) runtimeFail('invalid-process-command');
  }
  const executable = validateExecutable(value.executable);
  const args = validateProcessArguments(value.args === undefined ? [] : value.args);
  const cwd = assertSafeText(value.cwd, 'invalid-working-directory', MAX_EXECUTABLE_BYTES);
  const environmentAllowlist = value.environmentAllowlist === undefined ? [] : value.environmentAllowlist;
  if (!Array.isArray(environmentAllowlist)) runtimeFail('invalid-environment-allowlist');
  const timeoutMilliseconds = requirePositiveInteger(
    value.timeoutMilliseconds,
    'invalid-process-timeout',
    MAX_TIMEOUT_MILLISECONDS,
  );
  const env = value.env === undefined ? {} : value.env;
  validateEnvironmentEntries(env);
  return freezeRecord({
    args,
    cwd,
    env: freezeRecord(env),
    environmentAllowlist: freezeArray(environmentAllowlist),
    executable,
    timeoutMilliseconds,
  });
}

/** Compares resolved paths through a platform-specific Node path implementation. */
export function isPathInside(rootPath, candidatePath, pathApi = path) {
  const relative = pathApi.relative(rootPath, candidatePath);
  return (
    relative === '' || (!relative.startsWith(`..${pathApi.sep}`) && relative !== '..' && !pathApi.isAbsolute(relative))
  );
}

/**
 * Resolves a real directory inside the real workspace. The second containment
 * check rejects symlink/reparse-point escapes after filesystem resolution.
 */
export async function resolveValidatedWorkingDirectory({
  cwd,
  fileSystem = DEFAULT_FILE_SYSTEM,
  pathApi = path,
  workspaceRoot,
}) {
  const root = assertSafeText(workspaceRoot, 'invalid-workspace-root', MAX_EXECUTABLE_BYTES);
  const requestedCwd = assertSafeText(cwd, 'invalid-working-directory', MAX_EXECUTABLE_BYTES);
  if (!isRecord(fileSystem) || typeof fileSystem.realpath !== 'function' || typeof fileSystem.stat !== 'function') {
    runtimeFail('invalid-file-system');
  }
  try {
    const resolvedRoot = await fileSystem.realpath(pathApi.resolve(root));
    const candidate = pathApi.resolve(resolvedRoot, requestedCwd);
    if (!isPathInside(resolvedRoot, candidate, pathApi)) runtimeFail('working-directory-outside-workspace');
    const resolvedCwd = await fileSystem.realpath(candidate);
    if (!isPathInside(resolvedRoot, resolvedCwd, pathApi)) runtimeFail('working-directory-outside-workspace');
    const metadata = await fileSystem.stat(resolvedCwd);
    if (typeof metadata?.isDirectory !== 'function' || !metadata.isDirectory())
      runtimeFail('invalid-working-directory');
    return resolvedCwd;
  } catch (error) {
    if (error?.name === 'RuntimeCoreError') throw error;
    runtimeFail('invalid-working-directory');
  }
}

/** Validates codes recorded as bounded, sanitized failure metadata. */
export function validateRuntimeCode(value) {
  const code = requireString(value, 'invalid-runtime-code', { minimum: 3, maximum: 64 });
  if (!RUNTIME_CODE_PATTERN.test(code)) runtimeFail('invalid-runtime-code');
  return code;
}
