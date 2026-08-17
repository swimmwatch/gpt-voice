import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';

import { RepositorySecretPolicy, TRACKED_TEXT_GIT_ARGUMENTS, type RepositoryTextFile } from './repositorySecretPolicy';
import { readVerifiedRegularFile } from '../SecureFileReader';

const execFileAsync = promisify(execFile);
const workspaceRoot = path.resolve(__dirname, '..', '..');

function errorWithCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  Object.defineProperty(error, 'cause', { configurable: true, value: cause });
  return error;
}

async function trackedTextFiles(): Promise<readonly RepositoryTextFile[]> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync('git', TRACKED_TEXT_GIT_ARGUMENTS, {
      cwd: workspaceRoot,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    }));
  } catch {
    throw new Error('Repository secret policy violation: tracked-text evidence unavailable');
  }

  const files: RepositoryTextFile[] = [];
  for (const filePath of stdout.split('\0').filter((candidate) => candidate.length > 0)) {
    const absolutePath = path.resolve(workspaceRoot, filePath);
    if (!absolutePath.startsWith(`${workspaceRoot}${path.sep}`)) {
      throw new Error(`Repository secret policy violation: tracked path is outside the workspace: ${filePath}`);
    }
    try {
      const { bytes } = await readVerifiedRegularFile(absolutePath);
      files.push({ path: filePath, text: bytes.toString('utf8') });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Repository secret policy violation:')) throw error;
      throw errorWithCause('Repository secret policy violation: tracked text evidence unavailable', error);
    }
  }
  return files;
}

async function main(): Promise<void> {
  const findings = new RepositorySecretPolicy().scan(await trackedTextFiles());
  const blockingFindings = findings.filter((finding) => finding.severity === 'blocking');
  if (blockingFindings.length > 0) {
    const classifications = blockingFindings.map((finding) => `${finding.path} (${finding.rule})`).join(', ');
    throw new Error(`Repository secret policy violation: high-confidence secret detected: ${classifications}`);
  }
  const advisoryCount = findings.filter((finding) => finding.severity === 'advisory').length;
  process.stdout.write(`Repository secret policy verified (${advisoryCount} entropy advisory findings)\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Repository secret policy failed'}\n`);
  process.exitCode = 1;
});
