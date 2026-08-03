import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LocalWhisperWorkerLifecycle,
  type LocalWhisperWorkerLaunchMode,
  type LocalWhisperWorkerLifecycleSession,
} from '@main/localWhisper/supervisor/LocalWhisperWorkerLifecycle';
import type {
  LocalWhisperLoadRequest,
  LocalWhisperProbeRequest,
  LocalWhisperSupervisorResult,
  LocalWhisperTranscriptionRequest,
} from '@main/localWhisper/supervisor/LocalWhisperWorkerSupervisor';
import type { LocalWhisperWorkerLaunchAuthority } from '@main/localWhisper/supervisor/WorkerProcessOwnership';
import type { ManagedArtifactLease } from '@main/localWhisper/filesystem/ManagedArtifactLease';

function success(state: 'handshaken' | 'idle' | 'loaded' | 'probed'): LocalWhisperSupervisorResult {
  return { success: true, state, value: undefined };
}

class RecordingSession implements LocalWhisperWorkerLifecycleSession {
  public readonly calls: string[] = [];

  public constructor(
    public readonly mode: LocalWhisperWorkerLaunchMode,
    private readonly loadGate: Promise<void> = Promise.resolve(),
  ) {}

  public async startAndHandshake(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('start');
    return success('handshaken');
  }

  public async cancel(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('cancel');
    return success('idle');
  }

  public async forceCleanup(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('forceCleanup');
    return success('idle');
  }

  public async probe(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('probe');
    return success('probed');
  }

  public async load(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('load');
    await this.loadGate;
    return success('loaded');
  }

  public async shutdown(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('shutdown');
    return success('idle');
  }

  public async transcribe(_request: LocalWhisperTranscriptionRequest): Promise<LocalWhisperSupervisorResult<string>> {
    this.calls.push('transcribe');
    return { success: true, state: 'loaded', value: 'transcript' };
  }

  public async unload(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('unload');
    return success('idle');
  }

  public async warmup(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('warmup');
    return { success: true, state: 'warmed', value: undefined };
  }
}

const probeLaunchAuthority = { launchMode: 'probe' } as LocalWhisperWorkerLaunchAuthority;
const fullLoadLaunchAuthority = { launchMode: 'fullLoad' } as LocalWhisperWorkerLaunchAuthority;
const probeRequest = {} as LocalWhisperProbeRequest;
const modelLease = { assertActive: () => undefined } as ManagedArtifactLease;
const loadRequest = { modelLease } as LocalWhisperLoadRequest;

test('probe process exits before a fresh full-load process is created', async () => {
  const sessions: RecordingSession[] = [];
  const lifecycle = new LocalWhisperWorkerLifecycle({
    createSession: (mode, modelAuthority) => {
      assert.equal(modelAuthority, mode === 'fullLoad' ? loadRequest.modelLease : null);
      const session = new RecordingSession(mode);
      sessions.push(session);
      return session;
    },
  });

  assert.equal((await lifecycle.probeOnce(probeLaunchAuthority, probeRequest)).success, true);
  assert.deepEqual(sessions[0]?.calls, ['start', 'probe', 'shutdown']);
  assert.equal((await lifecycle.startFullLoad(fullLoadLaunchAuthority, loadRequest)).success, true);
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0]?.mode, 'probe');
  assert.equal(sessions[1]?.mode, 'fullLoad');
  assert.deepEqual(sessions[1]?.calls, ['start', 'load']);
  assert.equal(lifecycle.activeFullLoadSession, sessions[1]);
  assert.equal((await lifecycle.shutdownFullLoad())?.success, true);
  assert.deepEqual(sessions[1]?.calls, ['start', 'load', 'shutdown']);
});

test('factory cannot upgrade or reuse the disposable probe session', async () => {
  const session = new RecordingSession('probe');
  const lifecycle = new LocalWhisperWorkerLifecycle({ createSession: () => session });
  assert.equal((await lifecycle.probeOnce(probeLaunchAuthority, probeRequest)).success, true);
  await assert.rejects(() => lifecycle.startFullLoad(fullLoadLaunchAuthority, loadRequest), /reused/u);
});

test('force cleanup owns an in-flight full-load session and prevents late residency', async () => {
  const continuations: Array<() => void> = [];
  const loadGate = new Promise<void>((resolve) => continuations.push(resolve));
  const session = new RecordingSession('fullLoad', loadGate);
  const lifecycle = new LocalWhisperWorkerLifecycle({ createSession: () => session });
  const starting = lifecycle.startFullLoad(fullLoadLaunchAuthority, loadRequest);
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(lifecycle.activeFullLoadSession, session);
  assert.equal((await lifecycle.forceCleanupFullLoad())?.success, true);
  assert.equal(lifecycle.activeFullLoadSession, null);
  const continueLoad = continuations.shift();
  assert.ok(continueLoad);
  continueLoad();
  await assert.rejects(starting, /terminated during startup/u);
  assert.deepEqual(session.calls, ['start', 'load', 'forceCleanup']);
});
