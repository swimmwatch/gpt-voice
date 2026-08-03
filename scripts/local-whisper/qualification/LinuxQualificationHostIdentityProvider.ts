import { lstat, readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { sha256Bytes, sha256File } from '../packaging/fileIntegrity';
import type { QualificationCommandPort } from './QualificationCommandRunner';
import type { QualificationCandidateSeed, QualificationToolIdentity } from './QualificationInputProducer';

const SOURCE_LOCK_PATH = 'runtime/local-whisper/sources/locks/whisper-cpp-v1.9.1-f049fff.json';
const PATCH_LOCK_PATH =
  'runtime/local-whisper/whisper-cpp/patches/device-cancel/local-whisper-whisper-cpp-device-cancel-v1.json';
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SOURCE_LOCK_MAXIMUM_BYTES = 2 * 1024 * 1024;

export interface LinuxQualificationSourceIdentityInput {
  readonly candidateWorktree: string;
  readonly sourceCommit: string;
}

export interface LinuxQualificationSourceIdentity {
  readonly candidate: QualificationCandidateSeed['source'];
  readonly sharedTools: readonly QualificationToolIdentity[];
}

export interface LinuxQualificationHostIdentityPort {
  readonly source: (input: LinuxQualificationSourceIdentityInput) => Promise<LinuxQualificationSourceIdentity>;
  readonly operatingSystem: () => Promise<string>;
  readonly platformTools: (
    worktree: string,
    sharedTools: readonly QualificationToolIdentity[],
  ) => Promise<readonly QualificationToolIdentity[]>;
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

async function readTrackedSourceLock(filePath: string): Promise<Readonly<Record<string, unknown>>> {
  const metadata = await lstat(filePath);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size <= 0 ||
    metadata.size > SOURCE_LOCK_MAXIMUM_BYTES
  ) {
    throw new Error('Qualification source lock invalid');
  }
  try {
    return record(JSON.parse(await readFile(filePath, 'utf8')) as unknown, 'Qualification source lock invalid');
  } catch {
    throw new Error('Qualification source lock invalid');
  }
}

function digestField(value: Readonly<Record<string, unknown>>, field: string, code: string): string {
  const result = value[field];
  if (typeof result !== 'string' || !SHA256_PATTERN.test(result)) throw new Error(code);
  return result;
}

function isDigits(value: string): boolean {
  if (value.length === 0) return false;
  for (const character of value) {
    if (character < '0' || character > '9') return false;
  }
  return true;
}

function sanitizeVersion(value: string, code: string): string {
  for (const candidate of value.split(/\s/u)) {
    const parts = candidate.split('.');
    if (candidate.length <= 32 && parts.length >= 2 && parts.length <= 4 && parts.every(isDigits)) {
      return candidate;
    }
  }
  throw new Error(code);
}

function normalizeOsIdentity(value: string): string {
  let normalized = '';
  for (const character of value) {
    const asciiLetter = (character >= 'A' && character <= 'Z') || (character >= 'a' && character <= 'z');
    const digit = character >= '0' && character <= '9';
    normalized += asciiLetter || digit || ['_', '.', '-'].includes(character) ? character : '-';
  }
  return normalized;
}

export function qualificationToolIdentity(id: string, version: string, sha256: string): QualificationToolIdentity {
  if (!/^[\dA-Za-z][\w.-]{0,255}$/u.test(id) || !/^[\dA-Za-z][\w.-]{0,255}$/u.test(version)) {
    throw new Error('Qualification tool identity invalid');
  }
  if (!SHA256_PATTERN.test(sha256)) throw new Error('Qualification tool digest invalid');
  return Object.freeze({ id, version, sha256 });
}

/** Collects privacy-safe, digest-bound identities for the qualification host and source tree. */
export class LinuxQualificationHostIdentityProvider implements LinuxQualificationHostIdentityPort {
  public constructor(private readonly commands: QualificationCommandPort) {}

  public async source(input: LinuxQualificationSourceIdentityInput): Promise<LinuxQualificationSourceIdentity> {
    const status = await this.commands.run({
      command: 'git',
      arguments: ['status', '--porcelain=v1', '--untracked-files=no'],
      cwd: input.candidateWorktree,
    });
    const commit = await this.commands.run({
      command: 'git',
      arguments: ['rev-parse', 'HEAD'],
      cwd: input.candidateWorktree,
    });
    if (status !== '' || commit !== input.sourceCommit) {
      throw new Error('Qualification source worktree is not clean');
    }
    const tree = await this.commands.run({
      command: 'git',
      arguments: ['ls-tree', '-r', '--full-tree', 'HEAD'],
      cwd: input.candidateWorktree,
    });
    const sourceLock = await readTrackedSourceLock(path.join(input.candidateWorktree, SOURCE_LOCK_PATH));
    const materialization = record(sourceLock.materialization, 'Qualification source materialization invalid');
    const gitVersion = sanitizeVersion(
      await this.commands.run({ command: '/usr/bin/git', arguments: ['--version'], cwd: input.candidateWorktree }),
      'Qualification Git version invalid',
    );
    return Object.freeze({
      candidate: Object.freeze({
        commit,
        treeDigest: sha256Bytes(tree),
        sharedSourceManifestDigest: digestField(
          materialization,
          'manifestSha256',
          'Qualification source manifest digest invalid',
        ),
        patchLockDigest: await sha256File(path.join(input.candidateWorktree, PATCH_LOCK_PATH)),
      }),
      sharedTools: Object.freeze([
        qualificationToolIdentity('git', gitVersion, await sha256File('/usr/bin/git')),
        qualificationToolIdentity('node', process.version, await sha256File(process.execPath)),
      ]),
    });
  }

  public async operatingSystem(): Promise<string> {
    const text = await readFile('/etc/os-release', 'utf8');
    const values = new Map<string, string>();
    for (const line of text.split('\n')) {
      const match = /^([A-Z_]+)=(?:"([^"]*)"|(.*))$/u.exec(line);
      const key = match?.[1];
      if (key) values.set(key, match[2] ?? match[3] ?? '');
    }
    const id = values.get('ID');
    const version = values.get('VERSION_ID');
    if (!id || !version) throw new Error('Qualification OS identity unavailable');
    return `${normalizeOsIdentity(id)}-${normalizeOsIdentity(version)}-x64`;
  }

  public async platformTools(
    worktree: string,
    sharedTools: readonly QualificationToolIdentity[],
  ): Promise<readonly QualificationToolIdentity[]> {
    const version = sanitizeVersion(
      await this.commands.run({ command: '/usr/bin/openssl', arguments: ['version'], cwd: worktree }),
      'Qualification OpenSSL version invalid',
    );
    return Object.freeze([
      ...sharedTools,
      qualificationToolIdentity('openssl', version, await sha256File('/usr/bin/openssl')),
    ]);
  }
}
