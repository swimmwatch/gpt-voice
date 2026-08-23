import { lstat, readdir, realpath, stat } from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';

import { freezeArray, isRecord, requireString, runtimeFail } from './runtime-core-support.mjs';
import { validateWatchId } from './runtime-state-contracts.mjs';

const MAX_WATCH_DIRECTORIES = 100;
const RUNTIME_DIRECTORY_SEGMENTS = Object.freeze(['.codex', 'runtime', 'process-watch']);
const REQUIRED_FILE_SYSTEM_METHODS = Object.freeze(['lstat', 'readdir', 'realpath', 'stat']);
const REQUIRED_PATH_METHODS = Object.freeze(['isAbsolute', 'join', 'relative', 'resolve']);
const DEFAULT_FILE_SYSTEM = Object.freeze({ lstat, readdir, realpath, stat });

function isDirectory(metadata) {
  return typeof metadata?.isDirectory === 'function' && metadata.isDirectory();
}

function isMissingError(error) {
  return error?.code === 'ENOENT';
}

function isPathInside(rootPath, candidatePath, pathApi) {
  const relativePath = pathApi.relative(rootPath, candidatePath);
  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${pathApi.sep}`) && relativePath !== '..' && !pathApi.isAbsolute(relativePath))
  );
}

function isSymbolicLink(metadata) {
  return typeof metadata?.isSymbolicLink === 'function' && metadata.isSymbolicLink();
}

function pathsEqual(left, right, platform) {
  return platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function validateWorkspaceRoot(value) {
  const workspaceRoot = requireString(value, 'invalid-runtime-workspace-root', { minimum: 1, maximum: 4_096 });
  for (const character of workspaceRoot) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) runtimeFail('invalid-runtime-workspace-root');
  }
  return workspaceRoot;
}

/** Reads existing private watch directories without creating or repairing them. */
export class WatchRuntimeDirectory {
  #fileSystem;
  #pathApi;
  #platform;
  #workspaceRoot;

  constructor({ fileSystem = DEFAULT_FILE_SYSTEM, pathApi = path, platform = process.platform, workspaceRoot } = {}) {
    if (
      !isRecord(fileSystem) ||
      REQUIRED_FILE_SYSTEM_METHODS.some((method) => typeof fileSystem[method] !== 'function')
    ) {
      runtimeFail('invalid-runtime-directory-file-system');
    }
    if (
      !isRecord(pathApi) ||
      typeof pathApi.sep !== 'string' ||
      pathApi.sep.length === 0 ||
      REQUIRED_PATH_METHODS.some((method) => typeof pathApi[method] !== 'function')
    ) {
      runtimeFail('invalid-runtime-directory-path-api');
    }
    if (typeof platform !== 'string') runtimeFail('invalid-runtime-directory-platform');
    this.#fileSystem = fileSystem;
    this.#pathApi = pathApi;
    this.#platform = platform;
    this.#workspaceRoot = validateWorkspaceRoot(workspaceRoot);
  }

  async matchesCwd(cwd) {
    if (typeof cwd !== 'string' || !this.#pathApi.isAbsolute(cwd)) return false;
    try {
      const workspacePath = await this.#resolveWorkspace();
      const cwdPath = await this.#fileSystem.realpath(this.#pathApi.resolve(cwd));
      const metadata = await this.#fileSystem.stat(cwdPath);
      return isDirectory(metadata) && isPathInside(workspacePath, cwdPath, this.#pathApi);
    } catch {
      return false;
    }
  }

  async listWatchIds() {
    const workspacePath = await this.#resolveWorkspace();
    const runtimePath = await this.#resolveRuntimeRootIfPresent(workspacePath);
    if (runtimePath === null) return freezeArray([]);

    let entries;
    try {
      entries = await this.#fileSystem.readdir(runtimePath);
    } catch {
      runtimeFail('runtime-directory-read-failed');
    }
    if (!Array.isArray(entries) || entries.length > MAX_WATCH_DIRECTORIES) runtimeFail('runtime-directory-read-failed');

    const watchIds = [];
    for (const entry of entries) {
      const watchId = validateWatchId(entry, 'runtime-directory-entry-invalid');
      const watchPath = this.#pathApi.join(runtimePath, watchId);
      const resolvedWatchPath = await this.#resolveDirectoryIfPresent(watchPath, workspacePath);
      if (resolvedWatchPath === null || !pathsEqual(watchPath, resolvedWatchPath, this.#platform)) {
        runtimeFail('runtime-directory-entry-invalid');
      }
      watchIds.push(watchId);
    }
    return freezeArray(watchIds.sort((left, right) => left.localeCompare(right)));
  }

  async #resolveDirectoryIfPresent(candidatePath, workspacePath) {
    let metadata;
    try {
      metadata = await this.#fileSystem.lstat(candidatePath);
    } catch (error) {
      if (isMissingError(error)) return null;
      runtimeFail('runtime-directory-validation-failed');
    }
    if (!isDirectory(metadata) || isSymbolicLink(metadata)) runtimeFail('runtime-directory-link-rejected');

    let resolvedPath;
    try {
      resolvedPath = await this.#fileSystem.realpath(candidatePath);
    } catch {
      runtimeFail('runtime-directory-validation-failed');
    }
    if (!isPathInside(workspacePath, resolvedPath, this.#pathApi)) runtimeFail('runtime-directory-link-rejected');
    return resolvedPath;
  }

  async #resolveRuntimeRootIfPresent(workspacePath) {
    let currentPath = workspacePath;
    for (const segment of RUNTIME_DIRECTORY_SEGMENTS) {
      const candidatePath = this.#pathApi.join(currentPath, segment);
      const resolvedPath = await this.#resolveDirectoryIfPresent(candidatePath, workspacePath);
      if (resolvedPath === null) return null;
      if (!pathsEqual(candidatePath, resolvedPath, this.#platform)) runtimeFail('runtime-directory-link-rejected');
      currentPath = resolvedPath;
    }
    return currentPath;
  }

  async #resolveWorkspace() {
    let workspacePath;
    try {
      workspacePath = await this.#fileSystem.realpath(this.#pathApi.resolve(this.#workspaceRoot));
      const metadata = await this.#fileSystem.stat(workspacePath);
      if (!isDirectory(metadata)) runtimeFail('invalid-runtime-workspace-root');
    } catch (error) {
      if (error?.name === 'RuntimeCoreError') throw error;
      runtimeFail('invalid-runtime-workspace-root');
    }
    return workspacePath;
  }
}
