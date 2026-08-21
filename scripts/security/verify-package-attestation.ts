import { spawn } from 'node:child_process';
import * as path from 'node:path';
import process from 'node:process';

import {
  GitHubAttestationVerifier,
  PackageAttestationInputPolicy,
  PackageAttestationVerifier,
  PACKAGE_ATTESTATION_SUBJECT_NAMES,
  type GitHubAttestationCommand,
  type PackageAttestationSubjectName,
} from './packageAttestationPolicy';
import {
  hashPackageAttestationSubject,
  resolvePackageAttestationWorkspacePath,
} from './packageAttestationCommandSupport';
import { SecurityCommandOptions } from './securityCommandOptions';
import { withVerifiedRegularFile } from './verifiedRegularFile';

const workspaceRoot = path.resolve(__dirname, '..', '..');
const MAXIMUM_INPUT_BYTES = 16 * 1024;
const SOURCE_COMMIT = /^[a-f0-9]{40}$/u;
const REPOSITORY = /^\w[\w.-]{0,99}\/\w[\w.-]{0,99}$/u;

function fail(code: string): never {
  throw new Error(`PACKAGE_ATTESTATION_${code}`);
}

const commandOptions = new SecurityCommandOptions(process.argv, () => fail('ARGUMENT_INVALID'));

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

/** Invokes the installed GitHub-native verifier without emitting its output. */
class GitHubCliAttestationCommand implements GitHubAttestationCommand {
  public constructor(private readonly workingDirectory: string) {}

  public async verify(
    subjectPath: string,
    expectation: { readonly repository: string; readonly sourceCommit: string; readonly workflowPath: string },
  ): Promise<'verified' | 'invalid' | 'unavailable' | 'unsupported'> {
    const result = await new Promise<number | null>((resolve) => {
      const child = spawn(
        'gh',
        [
          'attestation',
          'verify',
          subjectPath,
          `--repo=${expectation.repository}`,
          `--signer-workflow=${expectation.repository}/${expectation.workflowPath}`,
          `--source-digest=${expectation.sourceCommit}`,
          '--predicate-type=https://slsa.dev/provenance/v1',
        ],
        {
          cwd: this.workingDirectory,
          stdio: 'ignore',
          windowsHide: true,
        },
      );
      child.once('error', () => resolve(null));
      child.once('close', (code) => resolve(code));
    });
    return result === 0 ? 'verified' : result === null ? 'unavailable' : 'invalid';
  }
}

async function main(): Promise<void> {
  const inputPath = resolvePackageAttestationWorkspacePath(workspaceRoot, commandOptions.required('input'));
  const repository = commandOptions.required('repository');
  const sourceCommit = commandOptions.required('source-commit');
  const platform_ = commandOptions.platform();
  const invocation = commandOptions.required('invocation');
  const workflowPath = commandOptions.optional('workflow-path') ?? '.github/workflows/pr-checks.yml';
  if (!REPOSITORY.test(repository) || !SOURCE_COMMIT.test(sourceCommit)) fail('ARGUMENT_INVALID');
  const inputText = new TextDecoder('utf-8', { fatal: true }).decode(
    await readVerified(inputPath, MAXIMUM_INPUT_BYTES),
  );
  const subjectsDirectory = path.join(path.dirname(inputPath), 'subject');
  const subjects = Object.fromEntries(
    await Promise.all(
      PACKAGE_ATTESTATION_SUBJECT_NAMES.map(
        async (name) => [name, await hashPackageAttestationSubject(path.join(subjectsDirectory, name))] as const,
      ),
    ),
  ) as Record<PackageAttestationSubjectName, string>;
  const input = new PackageAttestationInputPolicy().parse(inputText);
  new PackageAttestationVerifier().verify({
    expected: {
      invocation,
      platform: platform_,
      repository,
      sourceCommit,
      workflowPath: workflowPath as '.github/workflows/pr-checks.yml' | '.github/workflows/release-builds.yml',
    },
    input,
    subjects,
  });
  if (process.argv.includes('--verify-github')) {
    await new GitHubAttestationVerifier(new GitHubCliAttestationCommand(path.dirname(inputPath))).verify({
      repository,
      sourceCommit,
      subjectPaths: ['attestation-input.json', ...PACKAGE_ATTESTATION_SUBJECT_NAMES.map((name) => `subject/${name}`)],
      workflowPath,
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
