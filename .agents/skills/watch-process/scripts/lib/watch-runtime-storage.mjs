import { randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { chmod, lstat, mkdir, open, readFile, readdir, realpath, rename, stat, unlink } from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';
import { TextDecoder } from 'node:util';

import { freezeArray, freezeRecord, isRecord, requirePositiveInteger, requireString, runtimeFail } from './runtime-core-support.mjs';
import { validateRuntimeRelativePath, validateWatchId } from './runtime-state-contracts.mjs';

export const MAX_PRIVATE_RUNTIME_FILE_BYTES = 1_048_576;

const RUNTIME_DIRECTORY_SEGMENTS = Object.freeze(['.codex', 'runtime', 'process-watch']);
const TEMPORARY_TOKEN_PATTERN = /^[a-f0-9]{16,64}$/u;
const REQUIRED_PATH_API_METHODS = Object.freeze(['basename', 'dirname', 'isAbsolute', 'join', 'relative', 'resolve']);
const DEFAULT_FILE_SYSTEM = Object.freeze({
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  stat,
  unlink,
});

function isMissingError(error) {
  return error?.code === 'ENOENT';
}

function pathsEqual(firstPath, secondPath, platform) {
  if (platform === 'win32') return firstPath.toLowerCase() === secondPath.toLowerCase();
  return firstPath === secondPath;
}

function isDirectory(metadata) {
  return typeof metadata?.isDirectory === 'function' && metadata.isDirectory();
}

function isRegularFile(metadata) {
  return typeof metadata?.isFile === 'function' && metadata.isFile();
}

function isSymbolicLink(metadata) {
  return typeof metadata?.isSymbolicLink === 'function' && metadata.isSymbolicLink();
}

function createTemporaryToken() {
  return randomBytes(16).toString('hex');
}

function validateWorkspaceRoot(value) {
  const workspaceRoot = requireString(value, 'invalid-runtime-workspace-root', { minimum: 1, maximum: 4_096 });
  for (const character of workspaceRoot) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) runtimeFail('invalid-runtime-workspace-root');
  }
  return workspaceRoot;
}

/**
 * Owns a single validated private watch directory and atomic regular-file I/O.
 * Absolute paths remain private implementation details and are never serialized
 * by this class.
 */
export class WatchRuntimeStorage {
  #fileSystem;
  #initializedRoot = null;
  #pathApi;
  #platform;
  #temporaryTokenFactory;
  #watchId;
  #workspacePath = null;
  #workspaceRoot;

  constructor({
    fileSystem = DEFAULT_FILE_SYSTEM,
    pathApi = path,
    platform = process.platform,
    temporaryTokenFactory = createTemporaryToken,
    watchId,
    workspaceRoot,
  } = {}) {
    if (!isRecord(fileSystem)) runtimeFail('invalid-runtime-file-system');
    for (const method of ['lstat', 'mkdir', 'open', 'readFile', 'readdir', 'realpath', 'rename', 'stat', 'unlink']) {
      if (typeof fileSystem[method] !== 'function') runtimeFail('invalid-runtime-file-system');
    }
    if (
      !isRecord(pathApi) ||
      typeof pathApi.sep !== 'string' ||
      pathApi.sep.length === 0 ||
      REQUIRED_PATH_API_METHODS.some((method) => typeof pathApi[method] !== 'function')
    ) {
      runtimeFail('invalid-runtime-path-api');
    }
    if (typeof platform !== 'string' || typeof temporaryTokenFactory !== 'function') {
      runtimeFail('invalid-runtime-storage-dependency');
    }
    this.#fileSystem = fileSystem;
    this.#pathApi = pathApi;
    this.#platform = platform;
    this.#temporaryTokenFactory = temporaryTokenFactory;
    this.#watchId = validateWatchId(watchId, 'invalid-runtime-watch-id');
    this.#workspaceRoot = validateWorkspaceRoot(workspaceRoot);
  }

  get watchId() {
    return this.#watchId;
  }

  get rootPath() {
    if (this.#initializedRoot === null) runtimeFail('runtime-storage-not-initialized');
    return this.#initializedRoot;
  }

  async initialize() {
    if (this.#initializedRoot !== null) return this.#validatedRuntimeRoot();
    let workspacePath;
    try {
      workspacePath = await this.#fileSystem.realpath(this.#pathApi.resolve(this.#workspaceRoot));
      const workspaceMetadata = await this.#fileSystem.stat(workspacePath);
      if (!isDirectory(workspaceMetadata)) runtimeFail('invalid-runtime-workspace-root');
    } catch (error) {
      if (error?.name === 'RuntimeCoreError') throw error;
      runtimeFail('invalid-runtime-workspace-root');
    }

    this.#workspacePath = workspacePath;
    let currentPath = workspacePath;
    for (const segment of [...RUNTIME_DIRECTORY_SEGMENTS, this.#watchId]) {
      currentPath = await this.#ensurePrivateDirectory(currentPath, segment, workspacePath);
    }
    this.#initializedRoot = currentPath;
    return this.#validatedRuntimeRoot();
  }

  async readJson(relativePath, { maximumBytes = MAX_PRIVATE_RUNTIME_FILE_BYTES } = {}) {
    const text = await this.readText(relativePath, { maximumBytes });
    if (text === null) return null;
    try {
      return JSON.parse(text);
    } catch {
      runtimeFail('runtime-json-corrupt');
    }
  }

  async readText(relativePath, { maximumBytes = MAX_PRIVATE_RUNTIME_FILE_BYTES } = {}) {
    const maximum = requirePositiveInteger(maximumBytes, 'invalid-runtime-file-limit', MAX_PRIVATE_RUNTIME_FILE_BYTES);
    const filePath = await this.#resolveChildPath(relativePath);
    const before = await this.#lstatRegularFile(filePath, true);
    if (before === null) return null;
    if (before.size > maximum) runtimeFail('runtime-file-too-large');
    let contents;
    try {
      contents = await this.#fileSystem.readFile(filePath);
    } catch {
      runtimeFail('runtime-file-read-failed');
    }
    if (!Buffer.isBuffer(contents)) {
      try {
        contents = Buffer.from(contents);
      } catch {
        runtimeFail('runtime-file-read-failed');
      }
    }
    if (contents.byteLength > maximum) runtimeFail('runtime-file-too-large');
    await this.#lstatRegularFile(filePath, false);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(contents);
    } catch {
      runtimeFail('runtime-file-encoding-invalid');
    }
  }

  async writeJson(relativePath, value, { maximumBytes = MAX_PRIVATE_RUNTIME_FILE_BYTES } = {}) {
    let text;
    try {
      text = `${JSON.stringify(value)}\n`;
    } catch {
      runtimeFail('runtime-json-not-serializable');
    }
    await this.writeText(relativePath, text, { maximumBytes });
  }

  async writeText(relativePath, text, { maximumBytes = MAX_PRIVATE_RUNTIME_FILE_BYTES } = {}) {
    const maximum = requirePositiveInteger(maximumBytes, 'invalid-runtime-file-limit', MAX_PRIVATE_RUNTIME_FILE_BYTES);
    const content = requireString(text, 'invalid-runtime-file-content', { minimum: 0, maximum });
    const bytes = Buffer.from(content, 'utf8');
    if (bytes.byteLength > maximum) runtimeFail('runtime-file-too-large');
    const filePath = await this.#resolveChildPath(relativePath);
    await this.#atomicWrite(filePath, bytes);
  }

  async createExclusiveJson(relativePath, value, { maximumBytes = MAX_PRIVATE_RUNTIME_FILE_BYTES } = {}) {
    let text;
    try {
      text = `${JSON.stringify(value)}\n`;
    } catch {
      runtimeFail('runtime-json-not-serializable');
    }
    return this.createExclusiveText(relativePath, text, { maximumBytes });
  }

  async createExclusiveText(relativePath, text, { maximumBytes = MAX_PRIVATE_RUNTIME_FILE_BYTES } = {}) {
    const maximum = requirePositiveInteger(maximumBytes, 'invalid-runtime-file-limit', MAX_PRIVATE_RUNTIME_FILE_BYTES);
    const content = requireString(text, 'invalid-runtime-file-content', { minimum: 0, maximum });
    const bytes = Buffer.from(content, 'utf8');
    if (bytes.byteLength > maximum) runtimeFail('runtime-file-too-large');
    const filePath = await this.#resolveChildPath(relativePath);
    const existing = await this.#lstatRegularFile(filePath, true);
    if (existing !== null) return false;
    let handle;
    try {
      handle = await this.#fileSystem.open(filePath, 'wx', 0o600);
      await handle.writeFile(bytes);
      await handle.sync();
    } catch (error) {
      if (isMissingError(error)) runtimeFail('runtime-file-create-failed');
      if (error?.code === 'EEXIST') {
        await this.#lstatRegularFile(filePath, false);
        return false;
      }
      runtimeFail('runtime-file-create-failed');
    } finally {
      if (handle !== undefined) await handle.close().catch(() => undefined);
    }
    await this.#applyOwnerOnlyPermissions(filePath, 0o600);
    await this.#lstatRegularFile(filePath, false);
    return true;
  }

  async removeRegularFile(relativePath) {
    const filePath = await this.#resolveChildPath(relativePath);
    const metadata = await this.#lstatRegularFile(filePath, true);
    if (metadata === null) return false;
    try {
      await this.#fileSystem.unlink(filePath);
    } catch {
      runtimeFail('runtime-file-remove-failed');
    }
    return true;
  }

  async assertRegularFiles(relativePaths) {
    if (!Array.isArray(relativePaths) || relativePaths.length > 100) runtimeFail('invalid-runtime-file-list');
    for (const relativePath of relativePaths) {
      const filePath = await this.#resolveChildPath(relativePath);
      await this.#lstatRegularFile(filePath, true);
    }
  }

  async listEntries() {
    const rootPath = await this.initialize();
    let names;
    try {
      names = await this.#fileSystem.readdir(rootPath);
    } catch {
      runtimeFail('runtime-directory-read-failed');
    }
    if (!Array.isArray(names) || names.length > 1_000) runtimeFail('runtime-directory-read-failed');
    const result = [];
    for (const name of names) {
      const relativePath = validateRuntimeRelativePath(name, 'runtime-directory-entry-invalid');
      const filePath = await this.#resolveChildPath(relativePath);
      let metadata;
      try {
        metadata = await this.#fileSystem.lstat(filePath);
      } catch {
        runtimeFail('runtime-directory-entry-invalid');
      }
      if (isSymbolicLink(metadata)) runtimeFail('runtime-file-link-rejected');
      if (isRegularFile(metadata)) {
        result.push(freezeRecord({ kind: 'file', name: relativePath }));
      } else if (isDirectory(metadata)) {
        result.push(freezeRecord({ kind: 'directory', name: relativePath }));
      } else {
        runtimeFail('runtime-directory-entry-invalid');
      }
    }
    return freezeArray(result.sort((left, right) => left.name.localeCompare(right.name)));
  }

  async listRegularFileNames() {
    return freezeArray(
      (await this.listEntries())
        .filter((entry) => entry.kind === 'file')
        .map((entry) => entry.name),
    );
  }

  async #ensurePrivateDirectory(parentPath, segment, workspacePath) {
    const candidatePath = this.#pathApi.join(parentPath, segment);
    try {
      await this.#fileSystem.mkdir(candidatePath, { mode: 0o700 });
    } catch (error) {
      if (error?.code !== 'EEXIST') runtimeFail('runtime-directory-create-failed');
    }
    let metadata;
    let resolvedPath;
    try {
      metadata = await this.#fileSystem.lstat(candidatePath);
      if (!isDirectory(metadata) || isSymbolicLink(metadata)) runtimeFail('runtime-directory-link-rejected');
      resolvedPath = await this.#fileSystem.realpath(candidatePath);
    } catch (error) {
      if (error?.name === 'RuntimeCoreError') throw error;
      runtimeFail('runtime-directory-validation-failed');
    }
    if (!this.#isPathInside(workspacePath, resolvedPath) || !pathsEqual(candidatePath, resolvedPath, this.#platform)) {
      runtimeFail('runtime-directory-link-rejected');
    }
    await this.#applyOwnerOnlyPermissions(candidatePath, 0o700);
    return resolvedPath;
  }

  async #resolveChildPath(relativePath) {
    const normalizedPath = validateRuntimeRelativePath(relativePath);
    const rootPath = await this.initialize();
    const candidatePath = this.#pathApi.resolve(rootPath, ...normalizedPath.split('/'));
    if (!this.#isPathInside(rootPath, candidatePath)) runtimeFail('runtime-path-outside-watch-root');
    const parentPath = this.#pathApi.dirname(candidatePath);
    if (!pathsEqual(parentPath, rootPath, this.#platform)) runtimeFail('runtime-child-directory-not-supported');
    return candidatePath;
  }

  async #lstatRegularFile(filePath, allowMissing) {
    let metadata;
    try {
      metadata = await this.#fileSystem.lstat(filePath);
    } catch (error) {
      if (allowMissing && isMissingError(error)) return null;
      runtimeFail('runtime-file-validation-failed');
    }
    if (isSymbolicLink(metadata) || !isRegularFile(metadata)) runtimeFail('runtime-file-link-rejected');
    return metadata;
  }

  async #validatedRuntimeRoot() {
    const rootPath = this.#initializedRoot;
    const workspacePath = this.#workspacePath;
    if (rootPath === null || workspacePath === null) runtimeFail('runtime-storage-not-initialized');
    let metadata;
    let resolvedPath;
    try {
      metadata = await this.#fileSystem.lstat(rootPath);
      if (!isDirectory(metadata) || isSymbolicLink(metadata)) runtimeFail('runtime-directory-link-rejected');
      resolvedPath = await this.#fileSystem.realpath(rootPath);
    } catch (error) {
      if (error?.name === 'RuntimeCoreError') throw error;
      runtimeFail('runtime-directory-validation-failed');
    }
    if (!pathsEqual(rootPath, resolvedPath, this.#platform) || !this.#isPathInside(workspacePath, resolvedPath)) {
      runtimeFail('runtime-directory-link-rejected');
    }
    return rootPath;
  }

  async #atomicWrite(filePath, bytes) {
    await this.#lstatRegularFile(filePath, true);
    const directoryPath = this.#pathApi.dirname(filePath);
    const temporaryToken = this.#temporaryTokenFactory();
    if (typeof temporaryToken !== 'string' || !TEMPORARY_TOKEN_PATTERN.test(temporaryToken)) {
      runtimeFail('invalid-runtime-temporary-token');
    }
    const temporaryPath = this.#pathApi.join(directoryPath, `.${this.#pathApi.basename(filePath)}.${temporaryToken}.tmp`);
    let handle;
    let temporaryCreated = false;
    try {
      handle = await this.#fileSystem.open(temporaryPath, 'wx', 0o600);
      temporaryCreated = true;
      await handle.writeFile(bytes);
      await handle.sync();
      await handle.close();
      handle = undefined;
      await this.#lstatRegularFile(filePath, true);
      await this.#fileSystem.rename(temporaryPath, filePath);
      temporaryCreated = false;
    } catch {
      runtimeFail('runtime-atomic-write-failed');
    } finally {
      if (handle !== undefined) await handle.close().catch(() => undefined);
      if (temporaryCreated) await this.#fileSystem.unlink(temporaryPath).catch(() => undefined);
    }
    await this.#applyOwnerOnlyPermissions(filePath, 0o600);
    await this.#lstatRegularFile(filePath, false);
  }

  async #applyOwnerOnlyPermissions(targetPath, mode) {
    if (typeof this.#fileSystem.chmod !== 'function') return;
    await this.#fileSystem.chmod(targetPath, mode).catch(() => undefined);
  }

  #isPathInside(rootPath, candidatePath) {
    const relativePath = this.#pathApi.relative(rootPath, candidatePath);
    return (
      relativePath === '' ||
      (!relativePath.startsWith(`..${this.#pathApi.sep}`) &&
        relativePath !== '..' &&
        !this.#pathApi.isAbsolute(relativePath))
    );
  }
}
