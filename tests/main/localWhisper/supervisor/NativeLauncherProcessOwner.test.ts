import assert from 'node:assert/strict';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, it } from 'node:test';

import {
  createNativeRuntimeProcessInstanceIds,
  getLocalWhisperLauncherAcknowledgmentTimeoutMs,
} from '@main/localWhisper/supervisor/NativeLauncherProcessOwner';
import { NativeOwnedWorkerProcess } from '@main/localWhisper/supervisor/NativeOwnedWorkerProcess';
import {
  NATIVE_LAUNCHER_PROCESS_INSTANCE_ID_ENVIRONMENT_KEY,
  NATIVE_PROCESS_INSTANCE_ID_ENVIRONMENT_KEY,
  NATIVE_WORKER_PROCESS_INSTANCE_ID_ENVIRONMENT_KEY,
} from '@main/localWhisper/supervisor/NativeRuntimeLogLaunchEnvironment';
import { WindowsJobObjectOwner } from '@main/localWhisper/supervisor/WindowsJobObjectOwner';
import { LOCAL_WHISPER_LOAD_TIMEOUT_MS } from '@main/localWhisper/supervisor/LocalWhisperSupervisorConstants';
import type { LocalWhisperWorkerLaunchAuthority } from '@main/localWhisper/supervisor/WorkerProcessOwnership';
import { toLocalWhisperRevisionId, type LocalWhisperRevisionId } from '@shared/localWhisper';

const WORKER_IDENTITY = Object.freeze({
  deviceOrVolumeId: 'fixture-volume',
  fileId: 'fixture-worker',
  linkCount: 1,
  mode: 0,
  parentFileId: 'fixture-runtime',
  sizeBytes: 1,
  type: 'regular' as const,
});

const RUNTIME_IDENTITY = Object.freeze({
  deviceOrVolumeId: 'fixture-volume',
  fileId: 'fixture-runtime',
  linkCount: 1,
  mode: 0,
  parentFileId: 'fixture-parent',
  sizeBytes: 1,
  type: 'directory' as const,
});

function revision(value: string): LocalWhisperRevisionId {
  const parsed = toLocalWhisperRevisionId(value);
  if (!parsed) throw new Error('Invalid fixture revision');
  return parsed;
}

function ordinaryLaunchAuthority(): LocalWhisperWorkerLaunchAuthority {
  return {
    configurationEpoch: 1,
    expectedHandshake: {
      engine: 'whisperCpp',
      runtimeRevision: revision('whisper-cpp-windows-x64-cuda-12.8.1-sm120a-v1'),
      runtimeBuildDigest: 'a'.repeat(64),
      backend: 'cuda',
      capabilities: ['cuda-sm-120a'],
    },
    launchMode: 'registry',
    runtimeIdentityKey: 'fixture-runtime',
    runtimeLease: {
      assertActive: () => undefined,
      metadata: { identity: RUNTIME_IDENTITY, purpose: 'load' },
    } as never,
    workerExecutablePath: 'C:\\managed\\runtime\\worker.exe',
    workerFileIdentity: WORKER_IDENTITY,
    workerFileSha256: 'b'.repeat(64),
    workingDirectoryPath: 'C:\\managed\\runtime',
    revalidate: () => Promise.resolve(),
  };
}

describe('NativeLauncherProcessOwner acknowledgment policy', () => {
  it('preserves the narrow timeout for ordinary launcher startup', () => {
    assert.equal(getLocalWhisperLauncherAcknowledgmentTimeoutMs(false), 10_000);
  });

  it('allows the bounded model-load budget for pre-launch model hashing', () => {
    assert.equal(getLocalWhisperLauncherAcknowledgmentTimeoutMs(true), LOCAL_WHISPER_LOAD_TIMEOUT_MS);
  });
});

describe('NativeLauncherProcessOwner logging identities', () => {
  it('allocates one distinct parent-authorized identity per native process', () => {
    const available = [
      '11111111-1111-1111-8111-111111111111',
      '22222222-2222-2222-8222-222222222222',
      '33333333-3333-3333-8333-333333333333',
    ];
    assert.deepEqual(
      createNativeRuntimeProcessInstanceIds(() => available.shift() ?? '', 3),
      [
        '11111111-1111-1111-8111-111111111111',
        '22222222-2222-2222-8222-222222222222',
        '33333333-3333-3333-8333-333333333333',
      ],
    );
    assert.throws(
      () => createNativeRuntimeProcessInstanceIds(() => '11111111-1111-1111-8111-111111111111', 2),
      /process instance ID/u,
    );
  });

  it('authorizes a distinct worker identity before launching the Windows launcher', async () => {
    const control = new PassThrough();
    const acknowledgment = new PassThrough();
    const child = Object.assign(new EventEmitter(), {
      exitCode: null,
      kill: () => true,
      pid: 4242,
      signalCode: null,
      stderr: new PassThrough(),
      stdin: new PassThrough(),
      stdio: [new PassThrough(), new PassThrough(), new PassThrough(), control, acknowledgment],
      stdout: new PassThrough(),
    }) as unknown as ChildProcess;
    const identities = ['11111111-1111-1111-8111-111111111111', '22222222-2222-2222-8222-222222222222'];
    let capturedEnvironment: NodeJS.ProcessEnv | undefined;
    const owner = new WindowsJobObjectOwner({
      environment: { SystemRoot: 'C:\\Windows' },
      generateProcessInstanceId: () => identities.shift() ?? '',
      getProcessStartIdentity: () => Promise.resolve('fixture-process-start'),
      launcherExecutablePath: 'C:\\native\\launcher.exe',
      spawnProcess: ((_command: string, _arguments: readonly string[], options: SpawnOptions) => {
        capturedEnvironment = options?.env;
        control.once('data', () => setImmediate(() => acknowledgment.end('READY\t4242\n')));
        return child;
      }) as never,
    });

    const owned = await owner.launch(ordinaryLaunchAuthority(), 'fixture_nonce_1234');

    assert.deepEqual(owned.nativeRuntimeProcessInstanceIds, [
      '11111111-1111-1111-8111-111111111111',
      '22222222-2222-2222-8222-222222222222',
    ]);
    assert.equal(
      capturedEnvironment?.[NATIVE_PROCESS_INSTANCE_ID_ENVIRONMENT_KEY],
      owned.nativeRuntimeProcessInstanceIds[0],
    );
    assert.equal(
      capturedEnvironment?.[NATIVE_WORKER_PROCESS_INSTANCE_ID_ENVIRONMENT_KEY],
      owned.nativeRuntimeProcessInstanceIds[1],
    );
    assert.equal(capturedEnvironment?.[NATIVE_LAUNCHER_PROCESS_INSTANCE_ID_ENVIRONMENT_KEY], undefined);
  });

  it('authorizes distinct launcher and worker identities before launching the Windows model guard', async () => {
    const control = new PassThrough();
    const acknowledgment = new PassThrough();
    const child = Object.assign(new EventEmitter(), {
      exitCode: null,
      kill: () => true,
      pid: 4243,
      signalCode: null,
      stderr: new PassThrough(),
      stdin: new PassThrough(),
      stdio: [new PassThrough(), new PassThrough(), new PassThrough(), control, acknowledgment],
      stdout: new PassThrough(),
    }) as unknown as ChildProcess;
    const identities = [
      '11111111-1111-1111-8111-111111111111',
      '22222222-2222-2222-8222-222222222222',
      '33333333-3333-3333-8333-333333333333',
    ];
    let capturedEnvironment: NodeJS.ProcessEnv | undefined;
    const owner = new WindowsJobObjectOwner({
      environment: { SystemRoot: 'C:\\Windows' },
      generateProcessInstanceId: () => identities.shift() ?? '',
      getProcessStartIdentity: () => Promise.resolve('fixture-process-start'),
      launcherExecutablePath: 'C:\\native\\launcher.exe',
      launcherExecutableSha256: 'c'.repeat(64),
      modelGuardExecutablePath: 'C:\\native\\fs-guard.exe',
      spawnProcess: ((_command: string, _arguments: readonly string[], options: SpawnOptions) => {
        capturedEnvironment = options?.env;
        control.once('data', () => setImmediate(() => acknowledgment.end('READY\t4243\n')));
        return child;
      }) as never,
    });
    const authority: LocalWhisperWorkerLaunchAuthority = {
      ...ordinaryLaunchAuthority(),
      launchMode: 'fullLoad',
      modelGuardAuthority: {
        modelFileIdentity: WORKER_IDENTITY,
        modelFilePath: 'C:\\managed\\models\\model.bin',
        modelFileSha256: 'd'.repeat(64),
        modelFileSizeBytes: 1,
        modelIdentityKey: 'fixture-model',
        modelLease: {
          assertActive: () => undefined,
          metadata: { identity: WORKER_IDENTITY, purpose: 'load' },
        } as never,
        modelLeaseTokenDigest: 'e'.repeat(64),
        operationNonce: new Uint8Array(32),
        revalidate: () => Promise.resolve(),
      },
    };

    const owned = await owner.launch(authority, 'fixture_nonce_1234');

    assert.deepEqual(owned.nativeRuntimeProcessInstanceIds, [
      '11111111-1111-1111-8111-111111111111',
      '22222222-2222-2222-8222-222222222222',
      '33333333-3333-3333-8333-333333333333',
    ]);
    assert.equal(
      capturedEnvironment?.[NATIVE_PROCESS_INSTANCE_ID_ENVIRONMENT_KEY],
      owned.nativeRuntimeProcessInstanceIds[0],
    );
    assert.equal(
      capturedEnvironment?.[NATIVE_LAUNCHER_PROCESS_INSTANCE_ID_ENVIRONMENT_KEY],
      owned.nativeRuntimeProcessInstanceIds[1],
    );
    assert.equal(
      capturedEnvironment?.[NATIVE_WORKER_PROCESS_INSTANCE_ID_ENVIRONMENT_KEY],
      owned.nativeRuntimeProcessInstanceIds[2],
    );
  });
});

describe('NativeOwnedWorkerProcess exit confirmation', () => {
  it('waits for closed stdio after process exit before confirming cleanup', async () => {
    const child = new EventEmitter() as ChildProcess;
    const control = new PassThrough();
    const input = new PassThrough();
    const output = new PassThrough();
    const stderr = new PassThrough();
    const owned = new NativeOwnedWorkerProcess({
      child,
      control,
      input,
      nativeRuntimeProcessInstanceIds: ['11111111-1111-1111-8111-111111111111'],
      output,
      platform: 'win32',
      processStartIdentity: 'fixture-process-start',
      stderr,
      workerProcessGroupId: 4242,
    });
    let settled = false;
    const waiting = owned.waitForExit(1_000).then((value) => {
      settled = true;
      return value;
    });

    child.emit('exit', 0, null);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
    child.emit('close', 0, null);
    assert.equal(await waiting, true);
    assert.equal(await owned.waitForExit(0), true);
  });
});
