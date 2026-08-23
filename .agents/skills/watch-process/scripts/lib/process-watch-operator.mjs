import { randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import * as path from 'node:path';
import process from 'node:process';

import { AtomicStateStore } from './atomic-state-store.mjs';
import { GeneratedWatcherArtifact } from './generated-watcher-artifact.mjs';
import { GeneratedWatcherInvocationStore } from './generated-watcher-invocation.mjs';
import { GeneratedWatcherLaunchCoordinator } from './generated-watcher-launch-coordinator.mjs';
import { GeneratedWatcherLauncher } from './generated-watcher-launcher.mjs';
import { GeneratedWatcherStartupMonitor } from './generated-watcher-startup-monitor.mjs';
import { GitCommandRunner } from './git-command-runner.mjs';
import { GitWorktreeInspector } from './git-worktree-inspector.mjs';
import { ManagedProcessRunner } from './managed-process-runner.mjs';
import { ProcessWatchCompositionRoot } from './process-watch-composition-root.mjs';
import { ProcessWatchLibraryIntegrity } from './process-watch-library-integrity.mjs';
import { normalizeProcessWatchInvocation } from './process-watch-invocation.mjs';
import { probeStopHookProcessLiveness } from './process-watch-stop-hook-watch.mjs';
import {
  digestNormalizedValue,
  freezeArray,
  freezeRecord,
  requirePositiveInteger,
  runtimeFail,
} from './runtime-core-support.mjs';
import { assertSupportedNodeRuntime } from './runtime-preflight.mjs';
import { isTerminalPhase, validateSafeId, validateWatchId } from './runtime-state-contracts.mjs';
import { WatchRuntimeDirectory } from './watch-runtime-directory.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';
import { WatchScenarioRegistry } from './watch-scenario-registry.mjs';

const GIT_OPERATOR_ENVIRONMENT = freezeArray(['HOME', 'USERPROFILE', 'XDG_CONFIG_HOME']);
const CONTROL_ACTIONS = new Set(['begin-repair', 'begin-write', 'complete-write', 'restart', 'verify']);

function defaultWorkspaceRoot() {
  return path.resolve(import.meta.dirname, '..', '..', '..', '..', '..');
}

function processSessionId(environment) {
  return validateSafeId(
    environment.CODEX_SESSION_ID ?? environment.CODEX_THREAD_ID,
    'process-watch-session-unavailable',
  );
}

function processStartToken(randomBytesFactory) {
  const bytes = randomBytesFactory(16);
  if (!Buffer.isBuffer(bytes) || bytes.byteLength !== 16) runtimeFail('process-watch-random-source-invalid');
  return bytes.toString('hex');
}

function watchIdForScenario(scenarioId, randomBytesFactory) {
  const suffixBytes = randomBytesFactory(6);
  if (!Buffer.isBuffer(suffixBytes) || suffixBytes.byteLength !== 6) runtimeFail('process-watch-random-source-invalid');
  const suffix = suffixBytes.toString('hex');
  const prefix = scenarioId.slice(0, 64 - suffix.length - 1);
  return validateWatchId(`${prefix}-${suffix}`, 'process-watch-id-invalid');
}

function validateCandidatePaths(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) runtimeFail('repair-candidate-paths-required');
  return freezeArray(
    value.map((candidate) => {
      if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 512) {
        runtimeFail('repair-candidate-path-invalid');
      }
      return candidate;
    }),
  );
}

/** Owns the explicit operator surface from scenario launch through repair control and recovery. */
export class ProcessWatchOperator {
  #clock;
  #coordinatorFactory;
  #environment;
  #libraryIntegrityFactory;
  #randomBytesFactory;
  #runtimeDirectory;
  #scenarioRegistry;
  #sessionId;
  #workspaceId;
  #workspaceRoot;
  #worktreeInspector;

  constructor({
    clock = () => Date.now(),
    coordinatorFactory,
    environment = process.env,
    libraryIntegrityFactory = () => new ProcessWatchLibraryIntegrity(),
    randomBytesFactory = randomBytes,
    workspaceRoot = defaultWorkspaceRoot(),
    worktreeInspector,
  } = {}) {
    if (
      typeof clock !== 'function' ||
      typeof libraryIntegrityFactory !== 'function' ||
      typeof randomBytesFactory !== 'function'
    ) {
      runtimeFail('invalid-process-watch-operator');
    }
    this.#workspaceRoot = path.resolve(workspaceRoot);
    this.#environment = environment;
    this.#sessionId = processSessionId(environment);
    this.#workspaceId = digestNormalizedValue('gpt-voice/watch-process/workspace/v1', this.#workspaceRoot);
    this.#clock = clock;
    this.#coordinatorFactory = coordinatorFactory;
    this.#libraryIntegrityFactory = libraryIntegrityFactory;
    this.#randomBytesFactory = randomBytesFactory;
    this.#runtimeDirectory = new WatchRuntimeDirectory({ workspaceRoot: this.#workspaceRoot });
    this.#scenarioRegistry = new WatchScenarioRegistry(
      path.join(this.#workspaceRoot, '.codex', 'process-watch', 'scenarios'),
    );
    this.#worktreeInspector = worktreeInspector ?? this.#createWorktreeInspector();
  }

  async start({ scenarioId, targetSelector = 'unspecified', timeoutSeconds } = {}) {
    assertSupportedNodeRuntime();
    const normalizedScenario = await this.#scenarioRegistry.load(validateWatchId(scenarioId, 'invalid-scenario-id'));
    const timeout = requirePositiveInteger(timeoutSeconds, 'invalid-watch-timeout', 604_800);
    await this.#assertNoActiveWatch();
    const initialWorktree = await this.#worktreeInspector.assertClean({ timeoutMilliseconds: timeout * 1_000 });
    const watchId = watchIdForScenario(normalizedScenario.scenario.id, this.#randomBytesFactory);
    const invocation = normalizeProcessWatchInvocation(
      {
        deadlineEpochMilliseconds: this.#now() + timeout * 1_000,
        inputDigest: digestNormalizedValue('gpt-voice/watch-process/operator-input/v1', {
          scenarioDigest: normalizedScenario.canonicalDigest,
          sourceSha: initialWorktree.headSha,
          targetSelector,
          workspaceId: this.#workspaceId,
        }),
        sourceSha: initialWorktree.headSha,
        target: null,
        targetSelector,
        timeoutSeconds: timeout,
      },
      normalizedScenario.scenario,
    );
    const launchContext = await this.#createLaunchContext({
      invocation,
      normalizedScenario,
      watchId,
    });
    const launched = await launchContext.coordinator.launch({
      binding: launchContext.binding,
      invocation,
      mode: 'start',
      preflight: async () => {
        await this.#assertNoActiveWatch();
        const current = await this.#worktreeInspector.assertClean({ timeoutMilliseconds: timeout * 1_000 });
        if (current.headSha !== initialWorktree.headSha) runtimeFail('process-watch-source-changed');
      },
      processStartToken: launchContext.processStartToken,
      scenario: normalizedScenario.scenario,
      scenarioDigest: normalizedScenario.canonicalDigest,
      sessionId: this.#sessionId,
      stateReader: () => launchContext.stateStore.readState(),
      workspaceId: this.#workspaceId,
      workspaceRoot: this.#workspaceRoot,
    });
    return freezeRecord({
      phase: launched.heartbeat.phase,
      target: launched.heartbeat.target,
      timeoutSeconds: timeout,
      watchId,
    });
  }

  async status({ watchId } = {}) {
    const record = await this.#selectWatch(watchId);
    const startedAt = record.state.deadlineEpochMilliseconds - record.state.timeoutSeconds * 1_000;
    return freezeRecord({
      blocker: record.state.blocker,
      deadlineEpochMilliseconds: record.state.deadlineEpochMilliseconds,
      elapsedSeconds: Math.max(0, Math.floor((this.#now() - startedAt) / 1_000)),
      generation: record.state.generation,
      outcome: record.state.outcome,
      phase: record.state.phase,
      receiptIds: record.state.receiptIds,
      scenarioId: record.state.scenarioId,
      target: record.state.target,
      timeoutSeconds: record.state.timeoutSeconds,
      watchId: record.watchId,
    });
  }

  async resume({ timeoutSeconds, watchId } = {}) {
    assertSupportedNodeRuntime();
    const record = await this.#selectWatch(watchId);
    if (record.state.phase === 'Success' || record.state.phase === 'Cancelled') {
      runtimeFail('process-watch-resume-not-available');
    }
    const timeout = requirePositiveInteger(timeoutSeconds, 'invalid-watch-timeout', 604_800);
    const control = await this.#loadControlContext(record);
    const invocation = normalizeProcessWatchInvocation(
      {
        ...control.envelope.invocation,
        deadlineEpochMilliseconds: this.#now() + timeout * 1_000,
        sourceSha: record.state.target?.sourceSha ?? control.envelope.invocation.sourceSha,
        target: record.state.target,
        timeoutSeconds: timeout,
      },
      control.normalizedScenario.scenario,
    );
    const recovery = await record.stateStore.recoverAbandonedLock();
    if (!['missing', 'recovered-abandoned-lock'].includes(recovery.kind)) {
      runtimeFail('process-watch-resume-lock-ambiguous');
    }
    const launchContext = await this.#createLaunchContext({
      invocation,
      normalizedScenario: control.normalizedScenario,
      watchId: record.watchId,
    });
    const launched = await launchContext.coordinator.launch({
      binding: launchContext.binding,
      invocation,
      mode: 'resume',
      preflight: async () => {
        const current = await launchContext.stateStore.readState();
        if (current === null || current.generation !== record.state.generation) {
          runtimeFail('process-watch-resume-state-changed');
        }
      },
      processStartToken: launchContext.processStartToken,
      scenario: control.normalizedScenario.scenario,
      scenarioDigest: control.normalizedScenario.canonicalDigest,
      sessionId: this.#sessionId,
      stateReader: () => launchContext.stateStore.readState(),
      workspaceId: this.#workspaceId,
      workspaceRoot: this.#workspaceRoot,
    });
    return freezeRecord({
      phase: launched.heartbeat.phase,
      target: launched.heartbeat.target,
      timeoutSeconds: timeout,
      watchId: record.watchId,
    });
  }

  async cancel({ watchId } = {}) {
    const control = await this.#loadControlContext(await this.#selectWatch(watchId));
    return control.repairController.cancel();
  }

  async control(action, { candidatePaths, watchId } = {}) {
    if (!CONTROL_ACTIONS.has(action)) runtimeFail('invalid-process-watch-control-action');
    const control = await this.#loadControlContext(await this.#selectWatch(watchId));
    const invocation = control.envelope.invocation;
    if (action === 'begin-repair') return control.repairController.beginRepair({ invocation });
    if (action === 'begin-write') {
      return control.repairController.beginWrite({ candidatePaths: validateCandidatePaths(candidatePaths) });
    }
    if (action === 'complete-write') {
      return control.repairController.completeWrite({ candidatePaths: validateCandidatePaths(candidatePaths) });
    }
    if (action === 'verify') return control.repairController.verify({ invocation });
    return control.repairController.deliverAndRestart({ invocation });
  }

  async #createLaunchContext({ normalizedScenario, watchId }) {
    const storage = new WatchRuntimeStorage({ watchId, workspaceRoot: this.#workspaceRoot });
    const stateStore = this.#createStateStore(storage);
    const invocationStore = new GeneratedWatcherInvocationStore({ storage });
    const artifact = new GeneratedWatcherArtifact();
    const libraryIntegrity = this.#libraryIntegrityFactory();
    const libraryDigest = await libraryIntegrity.digest();
    const binding = artifact.createBinding({
      libraryDigest,
      scenarioDigest: normalizedScenario.canonicalDigest,
      scenarioId: normalizedScenario.scenario.id,
      watchId,
    });
    const coordinator =
      this.#coordinatorFactory?.({ artifact, invocationStore, libraryIntegrity, storage }) ??
      new GeneratedWatcherLaunchCoordinator({
        artifact,
        invocationStore,
        launcher: new GeneratedWatcherLauncher(),
        libraryIntegrity,
        startupMonitor: new GeneratedWatcherStartupMonitor(),
      });
    if (typeof coordinator?.launch !== 'function') runtimeFail('invalid-process-watch-operator-coordinator');
    return freezeRecord({
      binding,
      coordinator,
      processStartToken: processStartToken(this.#randomBytesFactory),
      stateStore,
      storage,
    });
  }

  async #loadControlContext(record) {
    const normalizedScenario = await this.#scenarioRegistry.load(record.state.scenarioId);
    if (normalizedScenario.canonicalDigest !== record.state.scenarioDigest) runtimeFail('scenario-digest-mismatch');
    const libraryIntegrity = this.#libraryIntegrityFactory();
    const libraryDigest = await libraryIntegrity.digest();
    if (libraryDigest !== record.state.libraryDigest) runtimeFail('library-digest-mismatch');
    const artifact = new GeneratedWatcherArtifact();
    const binding = artifact.createBinding({
      libraryDigest,
      scenarioDigest: normalizedScenario.canonicalDigest,
      scenarioId: normalizedScenario.scenario.id,
      watchId: record.watchId,
    });
    await artifact.verify({ binding, storage: record.storage });
    const envelope = await new GeneratedWatcherInvocationStore({ storage: record.storage }).read({
      scenario: normalizedScenario.scenario,
      scenarioDigest: normalizedScenario.canonicalDigest,
    });
    if (envelope.sessionId !== this.#sessionId || envelope.workspaceId !== this.#workspaceId) {
      runtimeFail('process-watch-operator-identity-mismatch');
    }
    const processStartToken_ = processStartToken(this.#randomBytesFactory);
    const root = new ProcessWatchCompositionRoot({
      libraryDigest,
      scenario: normalizedScenario.scenario,
      scenarioDigest: normalizedScenario.canonicalDigest,
      scriptDigest: binding.scriptDigest,
      sessionId: this.#sessionId,
      watchId: record.watchId,
      workspaceId: this.#workspaceId,
      workspaceRoot: this.#workspaceRoot,
    });
    const composed = root.create({ processStartToken: processStartToken_ });
    if (composed.repairController === null) runtimeFail('process-watch-repair-control-unavailable');
    return freezeRecord({
      ...composed,
      binding,
      envelope,
      normalizedScenario,
      processStartToken: processStartToken_,
    });
  }

  async #selectWatch(requestedWatchId) {
    const records = await this.#readWatchRecords();
    if (requestedWatchId !== undefined) {
      const selectedId = validateWatchId(requestedWatchId, 'invalid-watch-id');
      const selected = records.find((record) => record.watchId === selectedId);
      if (selected === undefined || !this.#belongsToCurrentOperator(selected.state)) runtimeFail('watch-not-found');
      return selected;
    }
    const matching = records.filter((record) => this.#belongsToCurrentOperator(record.state));
    const active = matching.filter((record) => !isTerminalPhase(record.state.phase));
    if (active.length === 1) return active[0];
    if (active.length > 1 || matching.length > 1) runtimeFail('watch-id-required');
    if (matching.length === 1) return matching[0];
    runtimeFail('watch-not-found');
  }

  async #assertNoActiveWatch() {
    const records = await this.#readWatchRecords();
    if (records.some((record) => !isTerminalPhase(record.state.phase))) runtimeFail('active-watch-exists');
  }

  async #readWatchRecords() {
    const records = [];
    for (const watchId of await this.#runtimeDirectory.listWatchIds()) {
      const storage = new WatchRuntimeStorage({ watchId, workspaceRoot: this.#workspaceRoot });
      const stateStore = this.#createStateStore(storage);
      const state = await stateStore.readState();
      if (state !== null) records.push(freezeRecord({ state, stateStore, storage, watchId }));
    }
    return freezeArray(records);
  }

  #createStateStore(storage) {
    return new AtomicStateStore({
      livenessProbe: probeStopHookProcessLiveness,
      sessionId: this.#sessionId,
      storage,
      workspaceId: this.#workspaceId,
    });
  }

  #createWorktreeInspector() {
    const runner = new ManagedProcessRunner({
      inheritedEnvironment: this.#environment,
      workspaceRoot: this.#workspaceRoot,
    });
    const commandRunner = new GitCommandRunner({
      environmentAllowlist: GIT_OPERATOR_ENVIRONMENT,
      runner,
    });
    return new GitWorktreeInspector({ commandRunner, workspaceRoot: this.#workspaceRoot });
  }

  #belongsToCurrentOperator(state) {
    return state.sessionId === this.#sessionId && state.workspaceId === this.#workspaceId;
  }

  #now() {
    return requirePositiveInteger(this.#clock(), 'invalid-process-watch-operator-clock', Number.MAX_SAFE_INTEGER);
  }
}
