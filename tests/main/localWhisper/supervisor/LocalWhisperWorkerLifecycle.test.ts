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
} from '@main/localWhisper/supervisor/LocalWhisperWorkerSupervisor';
import type { LocalWhisperWorkerLaunchAuthority } from '@main/localWhisper/supervisor/WorkerProcessOwnership';
import type { ManagedArtifactLease } from '@main/localWhisper/filesystem/ManagedArtifactLease';

function success(state: 'handshaken' | 'idle' | 'loaded' | 'probed'): LocalWhisperSupervisorResult {
  return { success: true, state, value: undefined };
}

class RecordingSession implements LocalWhisperWorkerLifecycleSession {
  public readonly calls: string[] = [];

  public constructor(public readonly mode: LocalWhisperWorkerLaunchMode) {}

  public async startAndHandshake(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('start');
    return success('handshaken');
  }

  public async probe(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('probe');
    return success('probed');
  }

  public async load(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('load');
    return success('loaded');
  }

  public async shutdown(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('shutdown');
    return success('idle');
  }
}

const launchAuthority = {} as LocalWhisperWorkerLaunchAuthority;
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

  assert.equal((await lifecycle.probeOnce(launchAuthority, probeRequest)).success, true);
  assert.deepEqual(sessions[0]?.calls, ['start', 'probe', 'shutdown']);
  assert.equal((await lifecycle.startFullLoad(launchAuthority, loadRequest)).success, true);
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
  assert.equal((await lifecycle.probeOnce(launchAuthority, probeRequest)).success, true);
  await assert.rejects(() => lifecycle.startFullLoad(launchAuthority, loadRequest), /reused/u);
});
