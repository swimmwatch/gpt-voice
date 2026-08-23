import { GeneratedWatcherArtifact } from './generated-watcher-artifact.mjs';
import { GeneratedWatcherInvocationStore } from './generated-watcher-invocation.mjs';
import { GeneratedWatcherLauncher } from './generated-watcher-launcher.mjs';
import { GeneratedWatcherStartupMonitor } from './generated-watcher-startup-monitor.mjs';
import { ProcessWatchLibraryIntegrity } from './process-watch-library-integrity.mjs';
import { freezeRecord, runtimeFail } from './runtime-core-support.mjs';

/** Coordinates preflight, private input, generated artifact, launch, and heartbeat proof. */
export class GeneratedWatcherLaunchCoordinator {
  #artifact;
  #invocationStore;
  #libraryIntegrity;
  #launcher;
  #startupMonitor;

  constructor({
    artifact,
    invocationStore,
    launcher,
    libraryIntegrity = new ProcessWatchLibraryIntegrity(),
    startupMonitor,
  } = {}) {
    if (
      !(artifact instanceof GeneratedWatcherArtifact) ||
      !(invocationStore instanceof GeneratedWatcherInvocationStore) ||
      !(launcher instanceof GeneratedWatcherLauncher) ||
      !(libraryIntegrity instanceof ProcessWatchLibraryIntegrity) ||
      !(startupMonitor instanceof GeneratedWatcherStartupMonitor)
    ) {
      runtimeFail('invalid-generated-watcher-launch-coordinator');
    }
    this.#artifact = artifact;
    this.#invocationStore = invocationStore;
    this.#libraryIntegrity = libraryIntegrity;
    this.#launcher = launcher;
    this.#startupMonitor = startupMonitor;
  }

  async launch({
    binding,
    invocation,
    preflight,
    processStartToken,
    scenario,
    scenarioDigest,
    sessionId,
    stateReader,
    workspaceId,
    workspaceRoot,
  } = {}) {
    if (typeof preflight !== 'function' || typeof stateReader !== 'function') {
      runtimeFail('invalid-generated-watcher-launch-coordinator-request');
    }
    this.#artifact.render(binding);
    if (binding.libraryDigest !== (await this.#libraryIntegrity.digest())) runtimeFail('library-digest-mismatch');
    await preflight();
    await this.#invocationStore.storage.initialize();
    await this.#invocationStore.write({ invocation, scenario, scenarioDigest, sessionId, workspaceId });
    const artifact = await this.#artifact.write({ binding, storage: this.#invocationStore.storage });
    await this.#artifact.assertSyntax({ artifactPath: artifact.path });
    const launch = this.#launcher.launch({ artifactPath: artifact.path, processStartToken, workspaceRoot });
    const heartbeat = await this.#startupMonitor.waitForHeartbeat({ processStartToken, readState: stateReader });
    return freezeRecord({ artifact, heartbeat, launch });
  }
}
