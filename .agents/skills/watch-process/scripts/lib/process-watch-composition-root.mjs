import { AtomicStateStore } from './atomic-state-store.mjs';
import { AuditJournal } from './audit-journal.mjs';
import { DeadlineAwarePoller } from './deadline-aware-poller.mjs';
import { ManagedProcessRunner } from './managed-process-runner.mjs';
import { OperationReceiptStore } from './operation-receipt-store.mjs';
import { ProcessWatchAdapterRegistry } from './process-watch-adapter-registry.mjs';
import { ProcessWatchOrchestrator } from './process-watch-orchestrator.mjs';
import {
  validateDigest,
  validateProcessStartToken,
  validateSafeId,
  validateWatchId,
} from './runtime-state-contracts.mjs';
import { isRecord, runtimeFail } from './runtime-core-support.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

/**
 * The sole composition root for one generated watcher process. It creates the
 * mutable runner, lock, receipts, adapter, journal, and orchestrator together.
 */
export class ProcessWatchCompositionRoot {
  #adapterRegistry;
  #clock;
  #environmentAllowlist;
  #libraryDigest;
  #poller;
  #scenario;
  #scenarioDigest;
  #scriptDigest;
  #sessionId;
  #watchId;
  #workspaceId;
  #workspaceRoot;

  constructor({
    adapterRegistry = new ProcessWatchAdapterRegistry(),
    clock = () => Date.now(),
    environmentAllowlist = [],
    libraryDigest,
    poller,
    scenario,
    scenarioDigest,
    scriptDigest,
    sessionId,
    watchId,
    workspaceId,
    workspaceRoot,
  } = {}) {
    if (!(adapterRegistry instanceof ProcessWatchAdapterRegistry) || typeof clock !== 'function') {
      runtimeFail('invalid-process-watch-composition-root');
    }
    if (!Array.isArray(environmentAllowlist) || !isRecord(scenario) || typeof workspaceRoot !== 'string') {
      runtimeFail('invalid-process-watch-composition-root');
    }
    if (poller !== undefined && !(poller instanceof DeadlineAwarePoller))
      runtimeFail('invalid-process-watch-composition-root');
    this.#adapterRegistry = adapterRegistry;
    this.#clock = clock;
    this.#environmentAllowlist = Object.freeze([...environmentAllowlist]);
    this.#libraryDigest = validateDigest(libraryDigest, 'invalid-process-watch-composition-root');
    this.#poller = poller;
    this.#scenario = scenario;
    this.#scenarioDigest = validateDigest(scenarioDigest, 'invalid-process-watch-composition-root');
    this.#scriptDigest = validateDigest(scriptDigest, 'invalid-process-watch-composition-root');
    this.#sessionId = validateSafeId(sessionId, 'invalid-process-watch-composition-root');
    this.#watchId = validateWatchId(watchId, 'invalid-process-watch-composition-root');
    this.#workspaceId = validateSafeId(workspaceId, 'invalid-process-watch-composition-root');
    this.#workspaceRoot = workspaceRoot;
  }

  create({ processStartToken } = {}) {
    const token = validateProcessStartToken(processStartToken, 'invalid-process-watch-composition-root');
    const storage = new WatchRuntimeStorage({ watchId: this.#watchId, workspaceRoot: this.#workspaceRoot });
    const stateStore = new AtomicStateStore({
      clock: this.#clock,
      sessionId: this.#sessionId,
      storage,
      workspaceId: this.#workspaceId,
    });
    const receiptStore = new OperationReceiptStore({ stateStore, storage });
    const runner = new ManagedProcessRunner({
      environmentAllowlist: this.#environmentAllowlist,
      workspaceRoot: this.#workspaceRoot,
    });
    const adapter = this.#adapterRegistry.create({
      adapterName: this.#scenario.adapter,
      options: {
        environmentAllowlist: this.#environmentAllowlist,
        receiptStore,
        runner,
        scenario: this.#scenario,
        scenarioDigest: this.#scenarioDigest,
        watchId: this.#watchId,
        workspaceRoot: this.#workspaceRoot,
      },
    });
    const auditJournal = new AuditJournal({ clock: this.#clock, stateStore, storage });
    const orchestrator = new ProcessWatchOrchestrator({
      adapter,
      auditJournal,
      clock: this.#clock,
      libraryDigest: this.#libraryDigest,
      ...(this.#poller === undefined ? {} : { poller: this.#poller }),
      processStartToken: token,
      scenario: this.#scenario,
      scenarioDigest: this.#scenarioDigest,
      scriptDigest: this.#scriptDigest,
      sessionId: this.#sessionId,
      stateStore,
      storage,
      workspaceId: this.#workspaceId,
    });
    return Object.freeze({ adapter, orchestrator, receiptStore, runner, stateStore, storage });
  }
}
