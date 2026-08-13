import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import process from 'node:process';

import {
  GitHubAttestationVerifier,
  PackageAttestationInputPolicy,
  PackageAttestationVerifier,
  PACKAGE_ATTESTATION_SUBJECT_NAMES,
  type GitHubAttestationCommand,
  type PackageAttestationPlatform,
  type PackageAttestationSubjectName,
} from './packageAttestationPolicy';
import { withVerifiedRegularFile } from './verifiedRegularFile';

const workspaceRoot = path.resolve(__dirname, '..', '..');
const MAXIMUM_INPUT_BYTES = 16 * 1024;
const MAXIMUM_PACKAGE_BYTES = 4 * 1024 * 1024 * 1024;
const SOURCE_COMMIT = /^[a-f0-9]{40}$/u;
const REPOSITORY = /^\w[\w.-]{0,99}\/\w[\w.-]{0,99}$/u;
const SAFE_RELATIVE_PATH = /^[a-z\d][a-z\d._/-]{0,255}$/u;

function fail(code: string): never {
  throw new Error(`PACKAGE_ATTESTATION_${code}`);
}

function option(name: string): string | null {
  const prefix = `--${name}=`;
  const values = process.argv.filter((argument_) => argument_.startsWith(prefix));
  if (values.length > 1) fail('ARGUMENT_INVALID');
  return values.length === 1 ? (values[0]?.slice(prefix.length) ?? null) : null;
}

function requiredOption(name: string): string {
  const value = option(name);
  if (!value) fail('ARGUMENT_INVALID');
  return value;
}

function platform(value: string): PackageAttestationPlatform {
  if (value !== 'linux' && value !== 'win32') fail('ARGUMENT_INVALID');
  return value;
}

function safeWorkspacePath(value: string): string {
  if (!SAFE_RELATIVE_PATH.test(value)) fail('ARGUMENT_INVALID');
  const resolved = path.resolve(workspaceRoot, value);
  const relative = path.relative(workspaceRoot, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) fail('ARGUMENT_INVALID');
  return resolved;
}

async function readVerified(filePath: string, maximumBytes: number): Promise<Buffer> {
  return await withVerifiedRegularFile(
    {
      filePath,
      invalid: () => fail('SUBJECT_INVALID'),
      maximumBytes,
      minimumBytes: 1,
      unavailable: () => fail('SUBJECT_UNAVAILABLE'),
    },
    async (file, expectedSize) => {
      const bytes = await file.readFile().catch(() => fail('SUBJECT_UNAVAILABLE'));
      if (bytes.byteLength !== expectedSize) fail('SUBJECT_INVALID');
      return bytes;
    },
  );
}

async function hashVerified(filePath: string): Promise<string> {
  return await withVerifiedRegularFile(
    {
      filePath,
      invalid: () => fail('SUBJECT_INVALID'),
      maximumBytes: MAXIMUM_PACKAGE_BYTES,
      minimumBytes: 1,
      unavailable: () => fail('SUBJECT_UNAVAILABLE'),
    },
    async (file, expectedSize) => {
      const hash = createHash('sha256');
      let byteLength = 0;
      for await (const chunk of file.createReadStream({ autoClose: false })) {
        const bytes = Buffer.from(chunk);
        byteLength += bytes.byteLength;
        if (byteLength > expectedSize) fail('SUBJECT_INVALID');
        hash.update(bytes);
      }
      if (byteLength !== expectedSize) fail('SUBJECT_INVALID');
      return hash.digest('hex');
    },
  );
}

/** Invokes the installed GitHub-native verifier without emitting its output. */
class GitHubCliAttestationCommand implements GitHubAttestationCommand {
  public constructor(private readonly workingDirectory: string) {}

  public async verify(
    subjectPath: string,
    repository: string,
  ): Promise<'verified' | 'invalid' | 'unavailable' | 'unsupported'> {
    const result = await new Promise<number | null>((resolve) => {
      const child = spawn('gh', ['attestation', 'verify', subjectPath, `--repo=${repository}`], {
        cwd: this.workingDirectory,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.once('error', () => resolve(null));
      child.once('close', (code) => resolve(code));
    });
    return result === 0 ? 'verified' : result === null ? 'unavailable' : 'invalid';
  }
}

async function main(): Promise<void> {
  const inputPath = safeWorkspacePath(requiredOption('input'));
  const repository = requiredOption('repository');
  const sourceCommit = requiredOption('source-commit');
  const platform_ = platform(requiredOption('platform'));
  const invocation = requiredOption('invocation');
  if (!REPOSITORY.test(repository) || !SOURCE_COMMIT.test(sourceCommit)) fail('ARGUMENT_INVALID');
  const inputText = new TextDecoder('utf-8', { fatal: true }).decode(
    await readVerified(inputPath, MAXIMUM_INPUT_BYTES),
  );
  const subjectsDirectory = path.join(path.dirname(inputPath), 'subject');
  const subjects = Object.fromEntries(
    await Promise.all(
      PACKAGE_ATTESTATION_SUBJECT_NAMES.map(
        async (name) => [name, await hashVerified(path.join(subjectsDirectory, name))] as const,
      ),
    ),
  ) as Record<PackageAttestationSubjectName, string>;
  const input = new PackageAttestationInputPolicy().parse(inputText);
  new PackageAttestationVerifier().verify({
    expected: { invocation, platform: platform_, repository, sourceCommit },
    input,
    subjects,
  });
  if (process.argv.includes('--verify-github')) {
    await new GitHubAttestationVerifier(new GitHubCliAttestationCommand(path.dirname(inputPath))).verify({
      repository,
      subjectPaths: PACKAGE_ATTESTATION_SUBJECT_NAMES.map((name) => `subject/${name}`),
    });
  }
  process.stdout.write(`Package attestation verified for ${platform_}\n`);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error && /^PACKAGE_ATTESTATION_[A-Z_]+$/u.test(error.message)
      ? error.message
      : 'PACKAGE_ATTESTATION_FAILED';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
