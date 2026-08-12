import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';

import { RepositorySecretPolicy, type RepositoryTextFile } from './repositorySecretPolicy';
import { readVerifiedRegularFile } from '../SecureFileReader';

const execFileAsync = promisify(execFile);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const TEXT_FILENAMES = new Set(['cmakelists.txt', 'dockerfile', 'license', 'makefile']);
const TEXT_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.cmake',
  '.cpp',
  '.css',
  '.h',
  '.hpp',
  '.html',
  '.ini',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ps1',
  '.py',
  '.scss',
  '.sh',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

function isTextRepositoryFile(filePath: string): boolean {
  if (filePath.length === 0) return false;
  const basename = path.posix.basename(filePath).toLowerCase();
  const inPolicyScope =
    filePath.startsWith('.github/') ||
    filePath.startsWith('build/') ||
    filePath.startsWith('docs/') ||
    filePath.startsWith('runtime/') ||
    filePath.startsWith('scripts/') ||
    filePath.startsWith('src/') ||
    !filePath.includes('/');
  return (
    inPolicyScope &&
    (!filePath.includes('/') || TEXT_FILENAMES.has(basename) || TEXT_EXTENSIONS.has(path.posix.extname(basename)))
  );
}

function errorWithCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  Object.defineProperty(error, 'cause', { configurable: true, value: cause });
  return error;
}

async function trackedTextFiles(): Promise<readonly RepositoryTextFile[]> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync('git', ['ls-files', '-z'], { cwd: workspaceRoot, encoding: 'utf8' }));
  } catch {
    throw new Error('Repository secret policy violation: tracked-file evidence unavailable');
  }

  const files: RepositoryTextFile[] = [];
  for (const filePath of stdout.split('\0').filter(isTextRepositoryFile)) {
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
