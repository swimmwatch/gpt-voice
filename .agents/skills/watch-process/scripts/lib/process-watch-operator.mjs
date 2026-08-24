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
import { ProcessWatchCancellationController } from './process-watch-cancellation-controller.mjs';
import { ProcessWatchLibraryIntegrity } from './process-watch-library-integrity.mjs';
import { normalizeProcessWatchInvocation } from './process-watch-invocation.mjs';
import { ProcessWatchSelectionStore } from './process-watch-selection-store.mjs';
import { ProcessWatchStopHookWatch, probeStopHookProcessLiveness } from './process-watch-stop-hook-watch.mjs';
import { ProcessWatchTerminalWaiter } from './process-watch-terminal-waiter.mjs';
import {
  digestNormalizedValue,
  freezeArray,
  freezeRecord,
  requireNonNegativeInteger,
  requirePositiveInteger,
  runtimeFail,
} from './runtime-core-support.mjs';
import { assertSupportedNodeRuntime } from './runtime-preflight.mjs';
import { WATCH_OUTCOMES, isTerminalPhase, validateSafeId, validateWatchId } from './runtime-state-contracts.mjs';
import { WatchRuntimeDirectory } from './watch-runtime-directory.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';
import { WatchScenarioRegistry } from './watch-scenario-registry.mjs';

const GIT_OPERATOR_ENVIRONMENT = freezeArray(['HOME', 'USERPROFILE', 'XDG_CONFIG_HOME']);
const CONTROL_ACTIONS = new Set(['begin-repair', 'begin-write', 'complete-write', 'restart', 'verify']);
const ACTIVE_BLOCKING_OUTCOMES = new Set(['integrity_failed', 'monitoring_failed', 'timed_out', 'watcher_lost']);

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

function validateContinuationOutcome(value) {
  if (typeof value !== 'string' || !WATCH_OUTCOMES.includes(value) || value === 'running') {
    runtimeFail('invalid-process-watch-continuation');
  }
  return value;
}

function continuationAction(state, outcome) {
  if (state.phase === 'Success' && outcome === 'succeeded') return 'report-success';
  if (state.phase === 'NeedsAgent' && outcome !== 'succeeded') return 'repair';
  if (state.phase === 'Blocked') return 'report-blocked';
  if (state.phase === 'Cancelled') return 'report-cancelled';
  if (!isTerminalPhase(state.phase) && ACTIVE_BLOCKING_OUTCOMES.has(outcome)) return 'report-blocked';
  runtimeFail('invalid-process-watch-continuation-state');
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
  #selectionStore;
  #sessionId;
  #terminalWaiter;
  #workspaceId;
  #workspaceRoot;
  #worktreeInspector;

  constructor({
    clock = () => Date.now(),
    coordinatorFactory,
    environment = process.env,
    libraryIntegrityFactory = () => new ProcessWatchLibraryIntegrity(),
    randomBytesFactory = randomBytes,
    selectionStore,
    terminalWaiter,
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
    this.#selectionStore = selectionStore ?? new ProcessWatchSelectionStore({ workspaceRoot: this.#workspaceRoot });
    this.#terminalWaiter = terminalWaiter ?? new ProcessWatchTerminalWaiter({ clock });
    if (typeof this.#selectionStore?.read !== 'function' || typeof this.#selectionStore?.write !== 'function') {
      runtimeFail('invalid-process-watch-operator');
    }
    if (typeof this.#terminalWaiter?.wait !== 'function') runtimeFail('invalid-process-watch-operator');
    this.#worktreeInspector = worktreeInspector ?? this.#createWorktreeInspector();
  }

  async start({ scenarioId, targetSelector = 'unspecified', timeoutSeconds } = {}) {
    assertSupportedNodeRuntime();
    const normalizedScenario = await this.#scenarioRegistry.load(validateWatchId(scenarioId, 'invalid-scenario-id'));
    const timeout = requirePositiveInteger(timeoutSeconds, 'invalid-watch-timeout', 604_800);
    await this.#assertNoActiveWatch();
    const initialWorktree = await this.#captureWorkspaceBaseline(normalizedScenario.scenario, timeout * 1_000);
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
    await this.#selectCurrentWatch(watchId);
    const launched = await launchContext.coordinator.launch({
      binding: launchContext.binding,
      invocation,
      mode: 'start',
      preflight: async () => {
        await this.#assertNoActiveWatch();
        await this.#assertCurrentSelection(watchId);
        const current = await this.#captureWorkspaceBaseline(normalizedScenario.scenario, timeout * 1_000);
        if (!GitWorktreeInspector.sameSnapshot(initialWorktree, current)) {
          runtimeFail('process-watch-source-changed');
        }
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
    return this.#statusSummary(record, record.state);
  }

  async #captureWorkspaceBaseline(scenario, timeoutMilliseconds) {
    const request = { timeoutMilliseconds };
    return scenario.delivery.strategy === 'git-delivery'
      ? this.#worktreeInspector.assertClean(request)
      : this.#worktreeInspector.snapshot(request);
  }

  async continuation({ generation, outcome, watchId } = {}) {
    const record = await this.#selectWatch(watchId);
    await this.#assertCurrentSelection(record.watchId);
    const expectedGeneration = requireNonNegativeInteger(
      generation,
      'invalid-process-watch-continuation',
      1_000_000_000,
    );
    const expectedOutcome = validateContinuationOutcome(outcome);
    const watch = new ProcessWatchStopHookWatch({ storage: record.storage });
    const acknowledgement = await watch.readAcknowledgement();
    if (
      acknowledgement === null ||
      acknowledgement.generation !== expectedGeneration ||
      acknowledgement.outcome !== expectedOutcome ||
      acknowledgement.sessionId !== this.#sessionId ||
      acknowledgement.watchId !== record.watchId ||
      record.state.generation !== expectedGeneration
    ) {
      runtimeFail('invalid-process-watch-continuation');
    }
    return freezeRecord({
      ...this.#statusSummary(record, record.state),
      action: continuationAction(record.state, expectedOutcome),
      outcome: expectedOutcome,
    });
  }

  async wait({ signal, watchId } = {}) {
    const record = await this.#selectWatch(watchId);
    await this.#assertCurrentSelection(record.watchId);
    const watch = new ProcessWatchStopHookWatch({ storage: record.storage });
    const result = await this.#terminalWaiter.wait({ sessionId: this.#sessionId, signal, watch });
    if (result.kind !== 'continue') runtimeFail('process-watch-wait-inactive');
    return freezeRecord({
      ...this.#statusSummary(record, result.state),
      action: continuationAction(result.state, result.outcome),
      outcome: result.outcome,
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
    await this.#selectCurrentWatch(record.watchId);
    const launched = await launchContext.coordinator.launch({
      binding: launchContext.binding,
      invocation,
      mode: 'resume',
      preflight: async () => {
        const current = await launchContext.stateStore.readState();
        await this.#assertCurrentSelection(record.watchId);
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
    const record = await this.#selectWatch(watchId);
    return new ProcessWatchCancellationController({
      clock: this.#clock,
      processStartToken: processStartToken(this.#randomBytesFactory),
      sessionId: this.#sessionId,
      stateStore: record.stateStore,
      storage: record.storage,
    }).cancel();
  }

  async control(action, { candidatePaths, watchId } = {}) {
    if (!CONTROL_ACTIONS.has(action)) runtimeFail('invalid-process-watch-control-action');
    const record = await this.#selectWatch(watchId);
    const control = await this.#loadControlContext(record);
    const invocation = control.envelope.invocation;
    if (action === 'begin-repair') return control.repairController.beginRepair({ invocation });
    if (action === 'begin-write') {
      return control.repairController.beginWrite({ candidatePaths: validateCandidatePaths(candidatePaths) });
    }
    if (action === 'complete-write') {
      return control.repairController.completeWrite({ candidatePaths: validateCandidatePaths(candidatePaths) });
    }
    if (action === 'verify') return control.repairController.verify({ invocation });
    return this.#restartInBackground({ control, record });
  }

  async #restartInBackground({ control, record }) {
    const launchContext = await this.#createLaunchContext({
      normalizedScenario: control.normalizedScenario,
      watchId: record.watchId,
    });
    const launched = await launchContext.coordinator.launch({
      binding: launchContext.binding,
      invocation: control.envelope.invocation,
      mode: 'repair-restart',
      preflight: async () => {
        await this.#assertCurrentSelection(record.watchId);
        const current = await launchContext.stateStore.readState();
        if (
          current === null ||
          current.generation !== record.state.generation ||
          current.phase !== 'Verifying'
        ) {
          runtimeFail('process-watch-repair-restart-state-changed');
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
    await this.#selectCurrentWatch(record.watchId);
    const current = await launchContext.stateStore.readState();
    if (current === null) runtimeFail('process-watch-repair-restart-state-missing');
    return freezeRecord({
      ...this.#statusSummary(record, current),
      phase: launched.heartbeat.phase,
      target: launched.heartbeat.target,
    });
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

  async #assertCurrentSelection(watchId) {
    const selection = await this.#selectionStore.read();
    if (
      selection === null ||
      selection.sessionId !== this.#sessionId ||
      selection.workspaceId !== this.#workspaceId ||
      selection.watchId !== watchId
    ) {
      runtimeFail('process-watch-selection-mismatch');
    }
  }

  async #selectCurrentWatch(watchId) {
    await this.#selectionStore.write({
      sessionId: this.#sessionId,
      watchId,
      workspaceId: this.#workspaceId,
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
    if (records.some((record) => this.#isActiveWatchState(record.state))) runtimeFail('active-watch-exists');
  }

  #isActiveWatchState(state) {
    if (isTerminalPhase(state.phase)) return false;
    return state.phase !== 'NeedsAgent' || state.deadlineEpochMilliseconds > this.#now();
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

  #statusSummary(record, state) {
    const startedAt = state.deadlineEpochMilliseconds - state.timeoutSeconds * 1_000;
    return freezeRecord({
      blocker: state.blocker,
      deadlineEpochMilliseconds: state.deadlineEpochMilliseconds,
      elapsedSeconds: Math.max(0, Math.floor((this.#now() - startedAt) / 1_000)),
      generation: state.generation,
      outcome: state.outcome,
      phase: state.phase,
      receiptIds: state.receiptIds,
      scenarioId: state.scenarioId,
      target: state.target,
      timeoutSeconds: state.timeoutSeconds,
      watchId: record.watchId,
    });
  }

  #belongsToCurrentOperator(state) {
    return state.sessionId === this.#sessionId && state.workspaceId === this.#workspaceId;
  }

  #now() {
    return requirePositiveInteger(this.#clock(), 'invalid-process-watch-operator-clock', Number.MAX_SAFE_INTEGER);
  }
}
