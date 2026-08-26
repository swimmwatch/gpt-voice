import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  GENERATED_WATCHER_FILE_NAME,
  GeneratedWatcherArtifact,
  GeneratedWatcherInvocationStore,
  GeneratedWatcherLaunchCoordinator,
  GeneratedWatcherLauncher,
  GeneratedWatcherStartupMonitor,
  ProcessWatchLibraryIntegrity,
  WatchRuntimeStorage,
} from '../../../.agents/skills/watch-process/scripts/lib/process-watch-runtime-core.mjs';

const WATCH_ID = 'watch-001';
const START_TOKEN = 'a'.repeat(32);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const runFile = promisify(execFile);
const DIGESTS = Object.freeze({
  input: '1'.repeat(64),
  library: '2'.repeat(64),
  scenario: '3'.repeat(64),
});

function scenario() {
  return {
    adapter: 'local-command',
    id: 'watch-scenario-001',
    schemaVersion: '1.0.0',
    target: { requireExactSourceRevision: false, selectorKinds: ['start'] },
    timing: {
      maxTimeoutSeconds: 5,
      minTimeoutSeconds: 1,
      poll: { initialSeconds: 1, maxSeconds: 1, multiplier: 1 },
    },
  };
}

function invocation() {
  return {
    deadlineEpochMilliseconds: 100_000,
    inputDigest: DIGESTS.input,
    sourceSha: null,
    target: null,
    targetSelector: 'start',
    timeoutSeconds: 1,
  };
}

function target() {
  return {
    attempt: 1,
    identityDigest: '4'.repeat(64),
    sourceSha: null,
    targetId: 'target-001',
  };
}

async function withWorkspace(run) {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'watch-generated-'));
  try {
    return await run(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}

describe('generated process watcher', () => {
  it('renders a syntactically valid, digest-bound private watcher without command or output leakage', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const storage = new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot });
      await storage.initialize();
      const artifact = new GeneratedWatcherArtifact();
      const binding = artifact.createBinding({
        libraryDigest: DIGESTS.library,
        scenarioDigest: DIGESTS.scenario,
        scenarioId: scenario().id,
        watchId: WATCH_ID,
      });
      const written = await artifact.write({ binding, storage });
      await artifact.assertSyntax({ artifactPath: written.path });
      assert.deepEqual(await artifact.verify({ binding, storage }), written);
      const source = await readFile(written.path, 'utf8');
      assert.equal(source.includes('npm test'), false);
      assert.equal(source.includes('secret'), false);
      assert.equal(source.includes('target-001'), false);
      assert.match(source, /runGeneratedProcessWatcher/u);
      assert.equal(path.basename(written.path), GENERATED_WATCHER_FILE_NAME);
      await runFile(
        'git',
        ['check-ignore', '-q', `.codex/runtime/process-watch/${WATCH_ID}/${GENERATED_WATCHER_FILE_NAME}`],
        {
          cwd: repositoryRoot,
        },
      );
    });
  });

  it('detects script tampering before importing the generated watcher', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const storage = new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot });
      await storage.initialize();
      const artifact = new GeneratedWatcherArtifact();
      const binding = artifact.createBinding({
        libraryDigest: DIGESTS.library,
        scenarioDigest: DIGESTS.scenario,
        scenarioId: scenario().id,
        watchId: WATCH_ID,
      });
      await artifact.write({ binding, storage });
      await storage.writeText(GENERATED_WATCHER_FILE_NAME, 'export {}\n');
      await assert.rejects(() => artifact.verify({ binding, storage }), { code: 'generated-watcher-tampered' });
    });
  });

  it('binds private invocation data to the exact scenario and limits library integrity to a manifest', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const storage = new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot });
      await storage.initialize();
      const invocationStore = new GeneratedWatcherInvocationStore({ storage });
      await invocationStore.write({
        invocation: invocation(),
        scenario: scenario(),
        scenarioDigest: DIGESTS.scenario,
        sessionId: 'session-001',
        workspaceId: 'workspace-001',
      });
      assert.equal(
        (await invocationStore.read({ scenario: scenario(), scenarioDigest: DIGESTS.scenario })).watchId,
        WATCH_ID,
      );
      await assert.rejects(() => invocationStore.read({ scenario: scenario(), scenarioDigest: '9'.repeat(64) }), {
        code: 'generated-watcher-invocation-mismatch',
      });

      await writeFile(path.join(workspaceRoot, 'module.mjs'), 'export const value = 1;\n');
      const integrity = new ProcessWatchLibraryIntegrity({ files: ['module.mjs'], libraryRoot: workspaceRoot });
      const digest = await integrity.digest();
      await integrity.assertDigest(digest);
      await writeFile(path.join(workspaceRoot, 'module.mjs'), 'export const value = 2;\n');
      await assert.rejects(() => integrity.assertDigest(digest), { code: 'library-digest-mismatch' });
    });
  });

  it('uses a shell-free Node launch and requires a fresh heartbeat/start-token binding', async () => {
    const launches = [];
    const launcher = new GeneratedWatcherLauncher({
      platform: 'linux',
      spawnProcess: (executable, arguments_, options) => {
        launches.push({ arguments_, executable, options });
        return { pid: 4242, unref() {} };
      },
    });
    const launch = launcher.launch({
      artifactPath: path.resolve('/tmp/watch-process.mjs'),
      processStartToken: START_TOKEN,
      workspaceRoot: path.resolve('/tmp'),
    });
    assert.equal(launch.processId, 4242);
    assert.equal(launches[0].options.shell, false);
    assert.deepEqual(launches[0].arguments_.slice(1), ['--process-start-token', START_TOKEN, '--mode', 'start']);

    launcher.launch({
      artifactPath: path.resolve('/tmp/watch-process.mjs'),
      mode: 'resume',
      processStartToken: START_TOKEN,
      workspaceRoot: path.resolve('/tmp'),
    });
    assert.deepEqual(launches[1].arguments_.slice(1), ['--process-start-token', START_TOKEN, '--mode', 'resume']);

    launcher.launch({
      artifactPath: path.resolve('/tmp/watch-process.mjs'),
      mode: 'repair-restart',
      processStartToken: START_TOKEN,
      workspaceRoot: path.resolve('/tmp'),
    });
    assert.deepEqual(launches[2].arguments_.slice(1), [
      '--process-start-token',
      START_TOKEN,
      '--mode',
      'repair-restart',
    ]);

    let reads = 0;
    let now = 0;
    const monitor = new GeneratedWatcherStartupMonitor({
      clock: () => now++,
      pollMilliseconds: 1,
      sleep: async () => undefined,
      startupTimeoutMilliseconds: 10,
    });
    const heartbeat = await monitor.waitForHeartbeat({
      processStartToken: START_TOKEN,
      readState: async () => {
        reads += 1;
        return reads === 1 ? null : { heartbeat: { startToken: START_TOKEN }, phase: 'Watching', target: target() };
      },
    });
    assert.equal(heartbeat.phase, 'Watching');

    const restartingHeartbeat = await monitor.waitForHeartbeat({
      processStartToken: START_TOKEN,
      readState: async () => ({ heartbeat: { startToken: START_TOKEN }, phase: 'Restarting', target: target() }),
    });
    assert.equal(restartingHeartbeat.phase, 'Restarting');
  });

  it('runs preflight before writing and launching a generated watcher', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const storage = new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot });
      const artifact = new GeneratedWatcherArtifact();
      const libraryDigest = await new ProcessWatchLibraryIntegrity().digest();
      const binding = artifact.createBinding({
        libraryDigest,
        scenarioDigest: DIGESTS.scenario,
        scenarioId: scenario().id,
        watchId: WATCH_ID,
      });
      const launches = [];
      const coordinator = new GeneratedWatcherLaunchCoordinator({
        artifact,
        invocationStore: new GeneratedWatcherInvocationStore({ storage }),
        launcher: new GeneratedWatcherLauncher({
          platform: 'win32',
          spawnProcess: (_executable, arguments_, options) => {
            launches.push({ arguments_, options });
            return { pid: 501, unref() {} };
          },
        }),
        startupMonitor: new GeneratedWatcherStartupMonitor({
          clock: () => 0,
          pollMilliseconds: 1,
          sleep: async () => undefined,
          startupTimeoutMilliseconds: 1,
        }),
      });
      let preflightCompleted = false;
      const result = await coordinator.launch({
        binding,
        invocation: invocation(),
        preflight: async () => {
          preflightCompleted = true;
        },
        processStartToken: START_TOKEN,
        scenario: scenario(),
        scenarioDigest: DIGESTS.scenario,
        sessionId: 'session-001',
        stateReader: async () => ({ heartbeat: { startToken: START_TOKEN }, phase: 'Watching', target: target() }),
        workspaceId: 'workspace-001',
        workspaceRoot,
      });
      assert.equal(preflightCompleted, true);
      assert.equal(result.heartbeat.phase, 'Watching');
      assert.equal(launches[0].options.detached, false);
    });
  });
});
