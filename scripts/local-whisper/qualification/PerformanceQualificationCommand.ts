import { lstat, open, realpath, unlink, type FileHandle } from 'node:fs/promises';
import * as path from 'node:path';

import { withVerifiedRegularFile } from '@scripts/security/verifiedRegularFile';

import { qualificationCanonicalJson } from './QualificationContracts';
import type { PerformanceBackend, PerformanceExecutionMode, PerformancePlatform } from './PerformanceQualification';

export const MAXIMUM_PERFORMANCE_PRIVATE_BUNDLE_BYTES = 8 * 1024 * 1024;
export const MAXIMUM_PERFORMANCE_AGGREGATE_BYTES = 1024 * 1024;

const ARGUMENT_NAMES = ['platform', 'backend', 'mode', 'root', 'input', 'output'] as const;
const RELATIVE_PATH_SEGMENT = /^[\w.-]+$/u;

export interface PerformanceQualificationCommandInput {
  readonly platform: PerformancePlatform;
  readonly backend: PerformanceBackend;
  readonly mode: PerformanceExecutionMode;
  readonly root: string;
  readonly input: string;
  readonly output: string;
}

function invalidArgument(): never {
  throw new Error('PERFORMANCE_QUALIFICATION_ARGUMENT_INVALID');
}

function relativePath(value: string): string {
  if (value.length === 0 || value.length > 512 || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) {
    invalidArgument();
  }
  const segments = value.split(/[\\/]/u);
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === '.' || segment === '..' || !RELATIVE_PATH_SEGMENT.test(segment),
    )
  ) {
    invalidArgument();
  }
  return segments.join(path.sep);
}

/** Parses the exact six-field performance command contract and rejects aliases or extras. */
export class PerformanceQualificationCommandArguments {
  public static parse(argv: readonly string[]): PerformanceQualificationCommandInput {
    if (argv.length !== ARGUMENT_NAMES.length) invalidArgument();
    const values = new Map<string, string>();
    for (const argument of argv) {
      const match = /^--([a-z]+)=([\s\S]*)$/u.exec(argument);
      if (!match) invalidArgument();
      const [, name, value] = match;
      if (!name || !ARGUMENT_NAMES.includes(name as (typeof ARGUMENT_NAMES)[number]) || !value || values.has(name)) {
        invalidArgument();
      }
      values.set(name, value);
    }
    const platform = values.get('platform');
    const backend = values.get('backend');
    const mode = values.get('mode');
    const root = values.get('root');
    const input = values.get('input');
    const output = values.get('output');
    if (
      (platform !== 'linux' && platform !== 'win32') ||
      (backend !== 'cpu' && backend !== 'cuda') ||
      (mode !== 'hostedFixture' && mode !== 'representativeHost') ||
      !root ||
      !input ||
      !output ||
      !path.isAbsolute(root)
    ) {
      invalidArgument();
    }
    return Object.freeze({
      platform,
      backend,
      mode,
      root,
      input: relativePath(input),
      output: relativePath(output),
    });
  }
}

function invalidRoot(): never {
  throw new Error('PERFORMANCE_QUALIFICATION_ROOT_INVALID');
}

function invalidInput(): never {
  throw new Error('PERFORMANCE_QUALIFICATION_INPUT_INVALID');
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readExpectedBytes(file: FileHandle, expectedBytes: number): Promise<Buffer> {
  const bytes = Buffer.allocUnsafe(expectedBytes);
  let offset = 0;
  while (offset < expectedBytes) {
    const { bytesRead } = await file.read(bytes, offset, expectedBytes - offset, offset).catch(invalidInput);
    if (bytesRead === 0) invalidInput();
    offset += bytesRead;
  }
  const trailing = Buffer.allocUnsafe(1);
  const { bytesRead } = await file.read(trailing, 0, trailing.byteLength, expectedBytes).catch(invalidInput);
  if (bytesRead !== 0) invalidInput();
  return bytes;
}

/** Owns one validated non-root disposable directory and bounded private document I/O. */
export class PerformanceQualificationPrivateRoot {
  private constructor(public readonly absolutePath: string) {}

  public static async create(root: string): Promise<PerformanceQualificationPrivateRoot> {
    if (!path.isAbsolute(root)) invalidRoot();
    const resolved = path.resolve(root);
    if (resolved === path.parse(resolved).root) invalidRoot();
    const metadata = await lstat(resolved).catch(invalidRoot);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) invalidRoot();
    const canonical = await realpath(resolved).catch(invalidRoot);
    if (canonical === path.parse(canonical).root) invalidRoot();
    return new PerformanceQualificationPrivateRoot(canonical);
  }

  public async resolveExistingDirectory(value: string): Promise<string> {
    const candidate = this.resolveContained(value);
    const metadata = await lstat(candidate).catch(invalidInput);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) invalidInput();
    const canonical = await realpath(candidate).catch(invalidInput);
    this.assertContained(canonical);
    return canonical;
  }

  public async resolveExistingFile(value: string): Promise<string> {
    const candidate = this.resolveContained(value);
    const parent = await realpath(path.dirname(candidate)).catch(invalidInput);
    this.assertContained(parent);
    return path.join(parent, path.basename(candidate));
  }

  public async readJson(value: string, maximumBytes: number): Promise<unknown> {
    const inputPath = await this.resolveExistingFile(value);
    const bytes = await withVerifiedRegularFile(
      {
        filePath: inputPath,
        invalid: invalidInput,
        maximumBytes,
        minimumBytes: 1,
        unavailable: invalidInput,
      },
      readExpectedBytes,
    );
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
    } catch {
      return invalidInput();
    }
  }

  public async writeJsonExclusive(
    value: string,
    document: Readonly<Record<string, unknown>>,
    maximumBytes: number,
  ): Promise<void> {
    const outputPath = this.resolveContained(value);
    const parent = await realpath(path.dirname(outputPath)).catch(invalidInput);
    this.assertContained(parent);
    const canonicalOutput = path.join(parent, path.basename(outputPath));
    const bytes = Buffer.from(`${qualificationCanonicalJson(document)}\n`, 'utf8');
    if (bytes.byteLength === 0 || bytes.byteLength > maximumBytes) {
      throw new Error('PERFORMANCE_QUALIFICATION_OUTPUT_OVERSIZED');
    }
    let handle: FileHandle | null = null;
    try {
      handle = await open(canonicalOutput, 'wx', 0o600).catch((error: unknown) => {
        if (isRecord(error) && error.code === 'EEXIST') {
          throw new Error('PERFORMANCE_QUALIFICATION_OUTPUT_EXISTS');
        }
        throw new Error('PERFORMANCE_QUALIFICATION_OUTPUT_INVALID');
      });
      await handle.writeFile(bytes);
      await handle.sync();
    } catch (error) {
      if (handle) {
        let cleanupFailed = false;
        await handle.close().catch(() => {
          cleanupFailed = true;
        });
        handle = null;
        await unlink(canonicalOutput).catch(() => {
          cleanupFailed = true;
        });
        if (cleanupFailed) throw new Error('PERFORMANCE_QUALIFICATION_OUTPUT_CLEANUP_FAILED', { cause: error });
      }
      throw error;
    } finally {
      await handle?.close().catch(() => undefined);
    }
  }

  private resolveContained(value: string): string {
    const normalized = relativePath(value);
    const resolved = path.resolve(this.absolutePath, normalized);
    this.assertContained(resolved);
    return resolved;
  }

  private assertContained(candidate: string): void {
    const relative = path.relative(this.absolutePath, candidate);
    if (relative.startsWith('..') || path.isAbsolute(relative)) invalidInput();
  }
}
