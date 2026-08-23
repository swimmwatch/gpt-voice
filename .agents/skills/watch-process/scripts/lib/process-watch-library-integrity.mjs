import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { URL, fileURLToPath } from 'node:url';

import { freezeArray, runtimeFail } from './runtime-core-support.mjs';
import { validateDigest, validateRuntimeRelativePath } from './runtime-state-contracts.mjs';

const MAX_LIBRARY_MODULE_BYTES = 1_048_576;

export const PROCESS_WATCH_LIBRARY_FILES = freezeArray([
  'adapters/adapter-support.mjs',
  'adapters/declared-output-verifier.mjs',
  'adapters/docker-build-process-adapter.mjs',
  'adapters/docker-command-policy.mjs',
  'adapters/generic-ci-cli-process-adapter.mjs',
  'adapters/generic-ci-json-output-collector.mjs',
  'adapters/generic-ci-result-contract.mjs',
  'adapters/github-actions-json-output-collector.mjs',
  'adapters/github-actions-process-adapter.mjs',
  'adapters/github-actions-response-contract.mjs',
  'adapters/local-command-process-adapter.mjs',
  'adapters/owned-process-adapter.mjs',
  'atomic-state-store.mjs',
  'audit-journal.mjs',
  'bounded-evidence-buffer.mjs',
  'deadline-aware-poller.mjs',
  'failure-fingerprint.mjs',
  'focused-verification-runner.mjs',
  'generated-watcher-artifact.mjs',
  'generated-watcher-invocation.mjs',
  'generated-watcher-launch-coordinator.mjs',
  'generated-watcher-launcher.mjs',
  'generated-watcher-startup-monitor.mjs',
  'git-command-runner.mjs',
  'git-delivery-service.mjs',
  'git-worktree-inspector.mjs',
  'managed-process-execution.mjs',
  'managed-process-runner.mjs',
  'managed-process-support.mjs',
  'monotonic-deadline.mjs',
  'operation-receipt-store.mjs',
  'process-watch-adapter-registry.mjs',
  'process-watch-composition-root.mjs',
  'process-watch-generated-watcher-runtime.mjs',
  'process-watch-invocation.mjs',
  'process-watch-library-integrity.mjs',
  'process-watch-orchestrator.mjs',
  'process-watch-operator.mjs',
  'process-watch-repair-controller.mjs',
  'process-watch-runtime-core.mjs',
  'process-watch-selection-store.mjs',
  'process-watch-stop-hook-contracts.mjs',
  'process-watch-stop-hook.mjs',
  'process-watch-stop-hook-repository.mjs',
  'process-watch-stop-hook-watch.mjs',
  'process-watch-terminal-waiter.mjs',
  'process-watch-transition-table.mjs',
  'runtime-contracts.mjs',
  'runtime-core-support.mjs',
  'runtime-preflight.mjs',
  'runtime-state-contracts.mjs',
  'repair-control-contracts.mjs',
  'repair-ownership-ledger.mjs',
  'scenario-command-arguments.mjs',
  'scenario-command-capability-policy.mjs',
  'scenario-contract-support.mjs',
  'scenario-repair-scope.mjs',
  'success-attestation.mjs',
  'watch-runtime-storage.mjs',
  'watch-runtime-directory.mjs',
  'watch-scenario-normalizer.mjs',
  'watch-scenario-registry.mjs',
  'watch-scenario-validator.mjs',
]);

function defaultLibraryRoot() {
  return fileURLToPath(new URL('.', import.meta.url));
}

function normalizeRelativeFiles(files) {
  if (!Array.isArray(files) || files.length === 0) runtimeFail('invalid-library-integrity-files');
  const normalized = files.map((file) => validateRuntimeRelativePath(file, 'invalid-library-integrity-files')).sort();
  if (new Set(normalized).size !== normalized.length) runtimeFail('invalid-library-integrity-files');
  return freezeArray(normalized);
}

/** Computes a bounded manifest digest of the tracked code the watcher imports. */
export class ProcessWatchLibraryIntegrity {
  #files;
  #libraryRoot;
  #readFile;

  constructor({
    files = PROCESS_WATCH_LIBRARY_FILES,
    libraryRoot = defaultLibraryRoot(),
    readFile: read = readFile,
  } = {}) {
    if (typeof libraryRoot !== 'string' || libraryRoot.length === 0 || typeof read !== 'function') {
      runtimeFail('invalid-library-integrity-dependency');
    }
    this.#files = normalizeRelativeFiles(files);
    this.#libraryRoot = path.resolve(libraryRoot);
    this.#readFile = read;
  }

  async digest() {
    const manifestHash = createHash('sha256');
    for (const relativePath of this.#files) {
      let contents;
      try {
        contents = await this.#readFile(path.join(this.#libraryRoot, relativePath));
      } catch {
        runtimeFail('library-integrity-read-failed');
      }
      const bytes = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
      if (bytes.byteLength > MAX_LIBRARY_MODULE_BYTES) runtimeFail('library-integrity-file-too-large');
      manifestHash.update(relativePath, 'utf8');
      manifestHash.update('\0', 'utf8');
      manifestHash.update(createHash('sha256').update(bytes).digest('hex'), 'utf8');
      manifestHash.update('\n', 'utf8');
    }
    return manifestHash.digest('hex');
  }

  async assertDigest(expectedDigest) {
    const expected = validateDigest(expectedDigest, 'invalid-library-integrity-digest');
    if ((await this.digest()) !== expected) runtimeFail('library-digest-mismatch');
  }
}
