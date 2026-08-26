import { AtomicStateStore } from './atomic-state-store.mjs';
import { AuditJournal } from './audit-journal.mjs';
import { DeadlineAwarePoller } from './deadline-aware-poller.mjs';
import { FocusedVerificationRunner } from './focused-verification-runner.mjs';
import { GIT_ENVIRONMENT_ALLOWLIST, GitCommandRunner } from './git-command-runner.mjs';
import { GitDeliveryService } from './git-delivery-service.mjs';
import { GitWorktreeInspector } from './git-worktree-inspector.mjs';
import { ManagedProcessRunner } from './managed-process-runner.mjs';
import { OperationReceiptStore } from './operation-receipt-store.mjs';
import { ProcessWatchAdapterRegistry } from './process-watch-adapter-registry.mjs';
import { ProcessWatchOrchestrator } from './process-watch-orchestrator.mjs';
import { ProcessWatchRepairController } from './process-watch-repair-controller.mjs';
import { RepairOwnershipLedger } from './repair-ownership-ledger.mjs';
import {
  validateDigest,
  validateProcessStartToken,
  validateSafeId,
  validateWatchId,
} from './runtime-state-contracts.mjs';
import { isRecord, runtimeFail } from './runtime-core-support.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

function hasRepairControls(scenario) {
  return isRecord(scenario.repair) && isRecord(scenario.delivery) && Array.isArray(scenario.verification);
}

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
    const core = Object.freeze({ adapter, orchestrator, receiptStore, runner, stateStore, storage });
    if (!hasRepairControls(this.#scenario)) return Object.freeze({ ...core, repairController: null });
    const gitRunner = new ManagedProcessRunner({
      environmentAllowlist: GIT_ENVIRONMENT_ALLOWLIST,
      workspaceRoot: this.#workspaceRoot,
    });
    const gitCommandRunner = new GitCommandRunner({ runner: gitRunner });
    const worktreeInspector = new GitWorktreeInspector({
      commandRunner: gitCommandRunner,
      workspaceRoot: this.#workspaceRoot,
    });
    const ownershipLedger = new RepairOwnershipLedger({
      repair: this.#scenario.repair,
      requireCleanBaseline: this.#scenario.delivery.strategy === 'git-delivery',
      scenarioDigest: this.#scenarioDigest,
      stateStore,
      storage,
      workspaceRoot: this.#workspaceRoot,
      worktreeInspector,
    });
    const verificationRunner = new FocusedVerificationRunner({
      clock: this.#clock,
      environmentAllowlist: this.#environmentAllowlist,
      runner,
      scenario: this.#scenario,
      scenarioDigest: this.#scenarioDigest,
      storage,
      workspaceRoot: this.#workspaceRoot,
    });
    const deliveryService = new GitDeliveryService({
      commandRunner: gitCommandRunner,
      receiptStore,
      scenarioDigest: this.#scenarioDigest,
      stateStore,
      storage,
      worktreeInspector,
    });
    const repairController = new ProcessWatchRepairController({
      adapter,
      clock: this.#clock,
      deliveryService,
      orchestrator,
      ownershipLedger,
      processStartToken: token,
      scenario: this.#scenario,
      scenarioDigest: this.#scenarioDigest,
      sessionId: this.#sessionId,
      stateStore,
      storage,
      verificationRunner,
    });
    return Object.freeze({
      ...core,
      deliveryService,
      gitCommandRunner,
      gitRunner,
      orchestrator,
      ownershipLedger,
      repairController,
      verificationRunner,
      worktreeInspector,
    });
  }
}
