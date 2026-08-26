import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const DEFAULT_LOCK_IDS = Object.freeze([
  'nlohmann-json-v3.12.0-subset',
  'googletest-v1.17.0-52eb810',
  'whisper-cpp-v1.9.1-f049fff',
]);
const MAX_PROCESS_OUTPUT_BYTES = 4 * 1024 * 1024;

function parseArguments(arguments_) {
  const parsed = new Map();
  for (const argument of arguments_) {
    const match = /^--([a-z][a-z0-9-]*)=(.+)$/u.exec(argument);
    if (!match || parsed.has(match[1])) throw new Error(`Invalid or duplicate argument: ${argument}`);
    parsed.set(match[1], match[2]);
  }
  return parsed;
}

function isStrictDescendant(parent, candidate) {
  const path = relative(parent, candidate);
  return path.length > 0 && !path.startsWith('..') && !isAbsolute(path);
}

/** Provisions approved native test sources through the locked Task-08 importer. */
export class VerifiedNativeTestSourceProvisioner {
  constructor({ privateRoot, storeRoot, workspaceRoot }) {
    this.privateRoot = privateRoot;
    this.storeRoot = storeRoot;
    this.workspaceRoot = workspaceRoot;
  }

  provision(lockIds) {
    mkdirSync(this.privateRoot, { mode: 0o700, recursive: true });
    mkdirSync(this.storeRoot, { mode: 0o700, recursive: true });
    const canonicalPrivateRoot = realpathSync(this.privateRoot);
    for (const lockId of lockIds) this.provisionOne(lockId, canonicalPrivateRoot);
  }

  provisionOne(lockId, canonicalPrivateRoot) {
    if (this.verify(lockId)) {
      process.stdout.write(`${lockId}\talready-verified\n`);
      return;
    }

    const runRoot = mkdtempSync(resolve(canonicalPrivateRoot, `${lockId}-`));
    if (!isStrictDescendant(canonicalPrivateRoot, runRoot)) {
      throw new Error('Native source import root escaped its private parent');
    }
    try {
      const candidatePath = resolve(runRoot, 'candidate.json');
      this.runScript('import', 'source-import/import-native-source.mjs', [
        `--lock=${lockId}`,
        `--private-root=${runRoot}`,
        `--candidate-output=${candidatePath}`,
        '--image-identity=github-actions-locked-source-v1',
      ]);
      const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
      const repositoryRoot =
        typeof candidate.privateRepositoryRoot === 'string' ? realpathSync(candidate.privateRepositoryRoot) : null;
      if (repositoryRoot === null || !isStrictDescendant(runRoot, repositoryRoot)) {
        throw new Error('Native source importer returned an invalid private repository root');
      }

      this.runScript('materialization', 'source-import/materialize-native-source.mjs', [
        `--lock-file=${resolve(this.workspaceRoot, 'runtime', 'local-whisper', 'sources', 'locks', `${lockId}.json`)}`,
        `--repository-root=${repositoryRoot}`,
        `--store-root=${this.storeRoot}`,
      ]);
      if (!this.verify(lockId)) throw new Error(`Native source verification failed for ${lockId}`);
      process.stdout.write(`${lockId}\tmaterialized-and-verified\n`);
    } finally {
      rmSync(runRoot, { force: true, recursive: true });
    }
  }

  verify(lockId) {
    return (
      this.spawnScript('source-import/verify-native-source.mjs', [`--lock=${lockId}`, `--store-root=${this.storeRoot}`])
        .status === 0
    );
  }

  runScript(stage, script, arguments_) {
    const result = this.spawnScript(script, arguments_);
    if (result.error || result.status !== 0) {
      throw new Error(`Native source ${stage} failed`);
    }
  }

  spawnScript(script, arguments_) {
    return spawnSync(
      process.execPath,
      [resolve(this.workspaceRoot, 'scripts', 'local-whisper', script), ...arguments_],
      {
        cwd: this.workspaceRoot,
        encoding: 'utf8',
        maxBuffer: MAX_PROCESS_OUTPUT_BYTES,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  }
}

function runCli() {
  try {
    const workspaceRoot = resolve(import.meta.dirname, '..', '..');
    const arguments_ = parseArguments(process.argv.slice(2));
    const lockIds = (arguments_.get('locks') ?? DEFAULT_LOCK_IDS.join(','))
      .split(',')
      .filter((value) => value.length > 0);
    if (lockIds.length === 0 || lockIds.some((lockId) => !DEFAULT_LOCK_IDS.includes(lockId))) {
      throw new Error('Only approved Local Whisper native test source locks may be provisioned');
    }
    new VerifiedNativeTestSourceProvisioner({
      privateRoot: resolve(
        arguments_.get('private-root') ?? resolve(workspaceRoot, '.cache', 'local-whisper', 'native-source-imports'),
      ),
      storeRoot: resolve(
        arguments_.get('store-root') ?? resolve(workspaceRoot, '.cache', 'local-whisper', 'native-sources'),
      ),
      workspaceRoot,
    }).provision(lockIds);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Native test source provisioning failed'}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli();
