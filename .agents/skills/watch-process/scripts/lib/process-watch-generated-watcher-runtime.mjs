import * as path from 'node:path';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { GeneratedWatcherArtifact } from './generated-watcher-artifact.mjs';
import { GeneratedWatcherInvocationStore } from './generated-watcher-invocation.mjs';
import { ProcessWatchCompositionRoot } from './process-watch-composition-root.mjs';
import { ProcessWatchLibraryIntegrity } from './process-watch-library-integrity.mjs';
import { validateProcessStartToken, validateWatchId } from './runtime-state-contracts.mjs';
import { freezeRecord, runtimeFail } from './runtime-core-support.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';
import { WatchScenarioRegistry } from './watch-scenario-registry.mjs';

function parseWatcherArguments(arguments_) {
  if (
    !Array.isArray(arguments_) ||
    arguments_.length !== 4 ||
    arguments_[0] !== '--process-start-token' ||
    arguments_[2] !== '--mode' ||
    !['resume', 'start'].includes(arguments_[3])
  ) {
    runtimeFail('invalid-generated-watcher-arguments');
  }
  return freezeRecord({
    mode: arguments_[3],
    processStartToken: validateProcessStartToken(arguments_[1], 'invalid-generated-watcher-arguments'),
  });
}

function samePath(left, right) {
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function deriveWorkspaceRoot({ scriptUrl, watchId }) {
  if (typeof scriptUrl !== 'string') runtimeFail('invalid-generated-watcher-script-url');
  let scriptPath;
  try {
    scriptPath = path.resolve(fileURLToPath(scriptUrl));
  } catch {
    runtimeFail('invalid-generated-watcher-script-url');
  }
  const workspaceRoot = path.resolve(path.dirname(scriptPath), '..', '..', '..', '..');
  const expectedPath = path.join(workspaceRoot, '.codex', 'runtime', 'process-watch', watchId, 'watch-process.mjs');
  if (!samePath(scriptPath, expectedPath)) runtimeFail('generated-watcher-path-mismatch');
  return workspaceRoot;
}

/**
 * Entrypoint imported by the generated watcher. All command-bearing behavior
 * stays in reviewed scenario and library code; the generated file carries only
 * digest-bound identifiers.
 */
export async function runGeneratedProcessWatcher(binding, { arguments_ = process.argv.slice(2), scriptUrl } = {}) {
  const artifact = new GeneratedWatcherArtifact();
  artifact.render(binding);
  const watchId = validateWatchId(binding.watchId, 'invalid-generated-watcher-binding');
  const { mode, processStartToken } = parseWatcherArguments(arguments_);
  const workspaceRoot = deriveWorkspaceRoot({ scriptUrl, watchId });
  const storage = new WatchRuntimeStorage({ watchId, workspaceRoot });
  await storage.initialize();
  const verifiedArtifact = await artifact.verify({ binding, storage });
  const integrity = new ProcessWatchLibraryIntegrity();
  await integrity.assertDigest(verifiedArtifact.binding.libraryDigest);
  const scenarioRegistry = new WatchScenarioRegistry(path.join(workspaceRoot, '.codex', 'process-watch', 'scenarios'));
  const normalizedScenario = await scenarioRegistry.load(verifiedArtifact.binding.scenarioId);
  if (normalizedScenario.canonicalDigest !== verifiedArtifact.binding.scenarioDigest)
    runtimeFail('scenario-digest-mismatch');
  const invocationStore = new GeneratedWatcherInvocationStore({ storage });
  const envelope = await invocationStore.read({
    scenario: normalizedScenario.scenario,
    scenarioDigest: normalizedScenario.canonicalDigest,
  });
  const root = new ProcessWatchCompositionRoot({
    libraryDigest: verifiedArtifact.binding.libraryDigest,
    scenario: normalizedScenario.scenario,
    scenarioDigest: normalizedScenario.canonicalDigest,
    scriptDigest: verifiedArtifact.binding.scriptDigest,
    sessionId: envelope.sessionId,
    watchId,
    workspaceId: envelope.workspaceId,
    workspaceRoot,
  });
  const { orchestrator } = root.create({ processStartToken });
  return mode === 'resume' ? orchestrator.resume(envelope.invocation) : orchestrator.run(envelope.invocation);
}

export function generatedWatcherRuntimeBindingSummary(binding) {
  const artifact = new GeneratedWatcherArtifact();
  const rendered = artifact.render(binding);
  return freezeRecord({ bytes: Buffer.byteLength(rendered, 'utf8'), watchId: binding.watchId });
}
