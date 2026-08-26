import { spawn } from 'node:child_process';
import * as path from 'node:path';
import process from 'node:process';

import {
  RuntimeCoreError,
  digestNormalizedValue,
  freezeRecord,
  isRecord,
  runtimeFail,
} from './runtime-core-support.mjs';
import { validateDigest, validateWatchId } from './runtime-state-contracts.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

export const GENERATED_WATCHER_FILE_NAME = 'watch-process.mjs';
export const GENERATED_WATCHER_ENTRYPOINT =
  '../../../../.agents/skills/watch-process/scripts/lib/process-watch-generated-watcher-runtime.mjs';

function assertClosedRecord(value, fields, code) {
  if (!isRecord(value)) runtimeFail(code);
  for (const field of Object.keys(value)) {
    if (!fields.has(field)) runtimeFail(code);
  }
  return value;
}

function normalizeBinding(value, entrypoint) {
  const binding = assertClosedRecord(
    value,
    new Set(['libraryDigest', 'scenarioDigest', 'scenarioId', 'scriptDigest', 'watchId']),
    'invalid-generated-watcher-binding',
  );
  for (const field of ['libraryDigest', 'scenarioDigest', 'scenarioId', 'scriptDigest', 'watchId']) {
    if (!Object.hasOwn(binding, field)) runtimeFail('invalid-generated-watcher-binding');
  }
  const normalized = freezeRecord({
    libraryDigest: validateDigest(binding.libraryDigest, 'invalid-generated-watcher-binding'),
    scenarioDigest: validateDigest(binding.scenarioDigest, 'invalid-generated-watcher-binding'),
    scenarioId: validateWatchId(binding.scenarioId, 'invalid-generated-watcher-binding'),
    scriptDigest: validateDigest(binding.scriptDigest, 'invalid-generated-watcher-binding'),
    watchId: validateWatchId(binding.watchId, 'invalid-generated-watcher-binding'),
  });
  if (normalized.scriptDigest !== scriptDigestFor(normalized, entrypoint))
    runtimeFail('generated-watcher-script-digest-mismatch');
  return normalized;
}

function scriptDigestFor(binding, entrypoint) {
  return digestNormalizedValue('gpt-voice/watch-process/generated-watcher/v1', {
    entrypoint,
    libraryDigest: binding.libraryDigest,
    scenarioDigest: binding.scenarioDigest,
    scenarioId: binding.scenarioId,
    watchId: binding.watchId,
  });
}

function renderScript(binding, entrypoint) {
  return [
    `const { runGeneratedProcessWatcher } = await import('${entrypoint}');`,
    '',
    `const binding = Object.freeze(${JSON.stringify(binding)});`,
    '',
    'await runGeneratedProcessWatcher(binding, { scriptUrl: import.meta.url });',
    '',
  ].join('\n');
}

/** Renders and validates the tiny private launcher without copying watcher logic. */
export class GeneratedWatcherArtifact {
  #entrypoint;

  constructor({ entrypoint = GENERATED_WATCHER_ENTRYPOINT } = {}) {
    if (entrypoint !== GENERATED_WATCHER_ENTRYPOINT) {
      runtimeFail('invalid-generated-watcher-entrypoint');
    }
    this.#entrypoint = entrypoint;
  }

  createBinding({ libraryDigest, scenarioDigest, scenarioId, watchId } = {}) {
    const seed = freezeRecord({
      libraryDigest: validateDigest(libraryDigest, 'invalid-generated-watcher-binding'),
      scenarioDigest: validateDigest(scenarioDigest, 'invalid-generated-watcher-binding'),
      scenarioId: validateWatchId(scenarioId, 'invalid-generated-watcher-binding'),
      watchId: validateWatchId(watchId, 'invalid-generated-watcher-binding'),
    });
    return freezeRecord({ ...seed, scriptDigest: scriptDigestFor(seed, this.#entrypoint) });
  }

  render(binding) {
    return renderScript(normalizeBinding(binding, this.#entrypoint), this.#entrypoint);
  }

  async write({ binding, storage } = {}) {
    if (!(storage instanceof WatchRuntimeStorage)) runtimeFail('invalid-generated-watcher-storage');
    const normalized = normalizeBinding(binding, this.#entrypoint);
    await storage.writeText(GENERATED_WATCHER_FILE_NAME, renderScript(normalized, this.#entrypoint));
    return freezeRecord({ binding: normalized, path: path.join(storage.rootPath, GENERATED_WATCHER_FILE_NAME) });
  }

  async verify({ binding, storage } = {}) {
    if (!(storage instanceof WatchRuntimeStorage)) runtimeFail('invalid-generated-watcher-storage');
    const normalized = normalizeBinding(binding, this.#entrypoint);
    const text = await storage.readText(GENERATED_WATCHER_FILE_NAME);
    if (text === null || text !== renderScript(normalized, this.#entrypoint)) runtimeFail('generated-watcher-tampered');
    return freezeRecord({ binding: normalized, path: path.join(storage.rootPath, GENERATED_WATCHER_FILE_NAME) });
  }

  async assertSyntax({ artifactPath, nodeExecutable = process.execPath, spawnProcess = spawn } = {}) {
    if (
      typeof artifactPath !== 'string' ||
      artifactPath.length === 0 ||
      typeof nodeExecutable !== 'string' ||
      typeof spawnProcess !== 'function'
    ) {
      runtimeFail('invalid-generated-watcher-syntax-check');
    }
    await new Promise((resolve, reject) => {
      let child;
      try {
        child = spawnProcess(nodeExecutable, ['--check', artifactPath], {
          shell: false,
          stdio: 'ignore',
          windowsHide: true,
        });
      } catch {
        reject(new RuntimeCoreError('generated-watcher-syntax-check-failed'));
        return;
      }
      child.once('error', () => reject(new RuntimeCoreError('generated-watcher-syntax-check-failed')));
      child.once('close', (exitCode) => {
        if (exitCode === 0) resolve();
        else reject(new RuntimeCoreError('generated-watcher-syntax-check-failed'));
      });
    });
  }
}

export { scriptDigestFor };
