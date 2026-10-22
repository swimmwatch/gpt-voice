import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

const PACKAGE_NAME = 'app-builder-lib';
const PACKAGE_VERSION = '26.17.0';
const ORIGINAL_SHA256 = '70cdc560883573fa65246fbea08dd923a4905dc147769995ceb7257658a9980c';
const PATCHED_SHA256 = '8b2dc742316bb72fce2fc9efc0a1bb34c3e431b16feeb65b96eb1cab5cdab912';
const GENERATOR_PARTS = ['node_modules', PACKAGE_NAME, 'out', 'targets', 'appimage'];
const SOURCE_FILE = 'appImageUtil.js';
const MAX_MANIFEST_BYTES = 128 * 1024;

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sameIdentity(first, second) {
  return first.dev === second.dev && first.ino === second.ino && first.mode === second.mode;
}

async function readRegularFile(filePath, maximumBytes) {
  const identity = await lstat(filePath);
  if (!identity.isFile() || identity.isSymbolicLink() || identity.size > maximumBytes) {
    throw new Error('APPIMAGE_LAUNCHER_FILE_INVALID');
  }
  const handle = await open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (!sameIdentity(identity, opened)) throw new Error('APPIMAGE_LAUNCHER_IDENTITY_CHANGED');
    const bytes = await handle.readFile();
    if (bytes.length > maximumBytes) throw new Error('APPIMAGE_LAUNCHER_FILE_INVALID');
    return { bytes, identity };
  } finally {
    await handle.close();
  }
}

function patchSource(source) {
  const start = source.indexOf('HAVE_NO_SANDBOX=0\n');
  const end = source.indexOf('atexit()\n', start);
  if (start < 0 || end < start) throw new Error('APPIMAGE_LAUNCHER_PATCH_INVALID');
  const withoutFallback = source.slice(0, start) + source.slice(end);
  const patched = withoutFallback.replaceAll(' "\\${NO_SANDBOX[@]}"', '');
  if (digest(patched) !== PATCHED_SHA256) throw new Error('APPIMAGE_LAUNCHER_PATCH_INVALID');
  return patched;
}

/** Owns the exact-version, exact-byte AppImage generator patch after dependency installation. */
export class AppImageLauncherHardener {
  #root;

  constructor(projectDirectory = process.cwd()) {
    this.#root = path.resolve(projectDirectory);
  }

  async #inspect() {
    const directories = [];
    let directory = this.#root;
    for (const part of ['', ...GENERATOR_PARTS]) {
      directory = path.join(directory, part);
      const identity = await lstat(directory);
      if (!identity.isDirectory() || identity.isSymbolicLink()) {
        throw new Error('APPIMAGE_LAUNCHER_DIRECTORY_INVALID');
      }
      directories.push({ directory, identity });
    }
    const manifestPath = path.join(this.#root, 'node_modules', PACKAGE_NAME, 'package.json');
    const manifest = await readRegularFile(manifestPath, MAX_MANIFEST_BYTES);
    const metadata = JSON.parse(manifest.bytes.toString('utf8'));
    if (metadata.name !== PACKAGE_NAME || metadata.version !== PACKAGE_VERSION) {
      throw new Error('APPIMAGE_LAUNCHER_VERSION_UNSUPPORTED');
    }
    const filePath = path.join(directory, SOURCE_FILE);
    const source = await readRegularFile(filePath, 16 * 1024);
    return { directories, filePath, manifestPath, manifest, source };
  }

  async #revalidate(state) {
    for (const entry of state.directories) {
      if (!sameIdentity(entry.identity, await lstat(entry.directory))) {
        throw new Error('APPIMAGE_LAUNCHER_IDENTITY_CHANGED');
      }
    }
    const manifest = await readRegularFile(state.manifestPath, MAX_MANIFEST_BYTES);
    const source = await readRegularFile(state.filePath, 16 * 1024);
    if (
      !sameIdentity(state.manifest.identity, manifest.identity) ||
      !manifest.bytes.equals(state.manifest.bytes) ||
      !sameIdentity(state.source.identity, source.identity) ||
      !source.bytes.equals(state.source.bytes)
    ) {
      throw new Error('APPIMAGE_LAUNCHER_IDENTITY_CHANGED');
    }
  }

  async verify() {
    const state = await this.#inspect();
    if (digest(state.source.bytes) !== PATCHED_SHA256) throw new Error('APPIMAGE_LAUNCHER_NOT_PATCHED');
    await this.#revalidate(state);
  }

  async apply() {
    const state = await this.#inspect();
    const sourceHash = digest(state.source.bytes);
    if (sourceHash === PATCHED_SHA256) {
      await this.#revalidate(state);
      return;
    }
    if (sourceHash !== ORIGINAL_SHA256) throw new Error('APPIMAGE_LAUNCHER_SOURCE_UNREVIEWED');
    const patched = patchSource(state.source.bytes.toString('utf8'));
    const directory = path.dirname(state.filePath);
    // Linux writes stay anchored to the inspected directory even if its pathname is replaced.
    const directoryHandle =
      process.platform === 'linux'
        ? await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
        : null;
    let temporaryPath;
    try {
      if (directoryHandle && !sameIdentity(state.directories.at(-1).identity, await directoryHandle.stat())) {
        throw new Error('APPIMAGE_LAUNCHER_IDENTITY_CHANGED');
      }
      const writeRoot = directoryHandle ? `/proc/self/fd/${directoryHandle.fd}` : directory;
      temporaryPath = path.join(writeRoot, `.${SOURCE_FILE}.${randomUUID()}.tmp`);
      const temporary = await open(temporaryPath, 'wx', 0o644);
      try {
        await temporary.writeFile(patched, 'utf8');
        await temporary.sync();
      } finally {
        await temporary.close();
      }
      await this.#revalidate(state);
      await rename(temporaryPath, path.join(writeRoot, SOURCE_FILE));
      temporaryPath = undefined;
      await this.verify();
    } finally {
      try {
        if (temporaryPath) await unlink(temporaryPath);
      } finally {
        await directoryHandle?.close();
      }
    }
  }
}

/** Rejects sandbox bypasses in the extracted artifact, independently of its build configuration. */
export function assertSandboxedAppRun(source) {
  const forbidden = ['--no-sandbox', '--disable-setuid-sandbox', 'ELECTRON_DISABLE_SANDBOX', 'NO_SANDBOX'];
  const required = [
    'trap atexit EXIT',
    'if [ $isEulaAccepted == 1 ] ; then',
    'exec "$BIN"\n',
    'exec "$BIN" "${args[@]}"',
  ];
  if (forbidden.some((token) => source.includes(token)) || required.some((token) => !source.includes(token))) {
    throw new Error('APPIMAGE_LAUNCHER_ARTIFACT_UNSAFE');
  }
}
