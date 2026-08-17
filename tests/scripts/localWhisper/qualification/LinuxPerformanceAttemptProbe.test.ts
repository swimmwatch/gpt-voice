import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { describe, it } from 'node:test';

import { LinuxPerformanceAttemptProbe } from '@scripts/local-whisper/qualification/LinuxPerformanceAttemptProbe';
import {
  PerformanceQualificationEventCollector,
  type PerformanceQualificationEventProof,
} from '@scripts/local-whisper/qualification/PerformanceQualificationEventProtocol';
import { performanceRequiredPhaseIds } from '@scripts/local-whisper/qualification/PerformanceQualification';

const NATIVE_PHASES = Object.freeze([
  'nativeModelGuardDigest',
  'nativeAuthorityDigest',
  'workerPreflightDigest',
  'workerLoaderDigest',
  'guardedProcessCreation',
  'authorityTransfer',
  'modelPreflight',
  'whisperLoad',
  'inferenceWarmup',
  'installationDecode',
  'installationWrite',
]);

function fixtureScript(
  nativePayload: string,
  modelGuardAcknowledgment = '',
  nativeDescriptor = 5,
  nativeLogPayload = '',
): string {
  return `
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const payload = ${JSON.stringify(nativePayload)};
const worker = payload.includes('__WORKER_PID__')
  ? spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  : null;
fs.writeSync(${nativeDescriptor}, payload.replace('__WORKER_PID__', String(worker?.pid ?? process.pid)));
if (${JSON.stringify(modelGuardAcknowledgment)}) fs.writeSync(4, ${JSON.stringify(modelGuardAcknowledgment)});
if (${JSON.stringify(nativeLogPayload)}) fs.writeSync(2, ${JSON.stringify(nativeLogPayload)});
let pending = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  pending += chunk;
  while (pending.includes('\\n')) {
    const index = pending.indexOf('\\n');
    const line = pending.slice(0, index);
    pending = pending.slice(index + 1);
    const requestId = line.split('\\t')[0];
    process.stdout.write(requestId + '\\t2\\tOK\\n');
  }
});
const stop = () => { worker?.kill('SIGKILL'); process.exit(0); };
process.stdin.on('end', stop);
process.on('SIGTERM', stop);
`;
}

async function sendRequest(
  child: ChildProcess,
  lines: ReturnType<typeof createInterface>,
  requestId: number,
  command: string,
  fields: readonly string[] = [],
): Promise<void> {
  const input = child.stdin;
  assert.ok(input);
  const response = once(lines, 'line');
  await new Promise<void>((resolve, reject) => {
    input.write(`${[requestId, 2, command, ...fields].join('\t')}\n`, 'utf8', (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  const [line] = (await response) as [string];
  assert.equal(line, `${requestId}\t2\tOK`);
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.stdin?.end();
  await once(child, 'exit');
}

describe('Linux performance attempt probe', () => {
  it('captures a real guard/worker process tree and emits the complete canonical CPU proof', async () => {
    const collector = new PerformanceQualificationEventCollector(
      'linux',
      'cpu',
      performanceRequiredPhaseIds('linux', 'cpu'),
    );
    const probe = new LinuxPerformanceAttemptProbe('cpu', (frame) => collector.append(frame));
    const payload = `${[
      'LWQP1\tworker\tpid\t__WORKER_PID__',
      ...NATIVE_PHASES.map((phase, index) => `LWQP1\tphase\t${phase}\t${index + 1}`),
    ].join('\n')}\n`;
    const child = probe.instrumentedSpawn()(process.execPath, ['-e', fixtureScript(payload)], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    assert.ok(child.pid);
    assert.ok(child.stdout);
    const lines = createInterface({ input: child.stdout });
    let proof: PerformanceQualificationEventProof;
    try {
      await probe.registerMain();
      await probe.registerGuard(child.pid);
      probe.beginLoadProofs();
      for (let requestId = 1; requestId <= 5; requestId += 1) {
        await sendRequest(child, lines, requestId, 'LIST');
      }
      await sendRequest(child, lines, 6, 'WRITE_FILE', ['token', Buffer.from('bytes').toString('base64url')]);
      await probe.finish();
      proof = collector.finish();
    } finally {
      lines.close();
      await stopChild(child);
    }
    assert.deepEqual(
      proof.roleRegistrations.map(({ role }) => role),
      ['main', 'guard', 'worker'],
    );
    assert.deepEqual(
      proof.phases.map(({ id }) => id),
      performanceRequiredPhaseIds('linux', 'cpu'),
    );
    assert.equal(new Set(proof.roleRegistrations.map(({ pid }) => pid)).size, 3);
  });

  it('turns malformed native framing into a bounded attempt failure instead of an uncaught callback error', async () => {
    const probe = new LinuxPerformanceAttemptProbe('cpu', () => undefined);
    const child = probe.instrumentedSpawn()(process.execPath, ['-e', fixtureScript('malformed\n')], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    assert.ok(child.pid);
    try {
      await probe.registerGuard(child.pid);
      await new Promise<void>((resolve) => setImmediate(resolve));
      await assert.rejects(probe.finish(), /ATTEMPT_PROBE_INVALID/u);
    } finally {
      if (child.exitCode === null && !child.killed) child.kill('SIGKILL');
      if (child.exitCode === null && child.signalCode === null) await once(child, 'exit');
    }
  });

  it('records only the closed primary-owner launch acknowledgment outcome', () => {
    const probe = new LinuxPerformanceAttemptProbe('cpu', () => undefined);
    probe.recordNativeLaunchAcknowledgment('rejected');
    assert.equal(probe.nativeLaunchAcknowledgmentState, 'rejected');
  });

  it('captures a content-free launcher stage on the standard-launcher descriptor', async () => {
    const diagnostics: string[] = [];
    const probe = new LinuxPerformanceAttemptProbe('cpu', () => undefined, (stage) => diagnostics.push(stage));
    const child = probe.instrumentedSpawn()(
      process.execPath,
      [
        '-e',
        fixtureScript(
          'LWQP1\tstage\tmodelGuardEntered\t1\nLWQP1\tstage\tmodelLauncherExecRequested\t1\nLWQP1\tstage\tlauncherEntered\t1\n',
          '',
          7,
        ),
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    assert.ok(child.pid);
    try {
      const standardLauncherEvents = child.stdio[7];
      assert.ok(standardLauncherEvents);
      await once(standardLauncherEvents, 'data');
      assert.equal(probe.nativeLaunchDiagnostic, 'entered');
      assert.deepEqual(diagnostics, [
        'nativeModelGuardEntered',
        'nativeLauncherExecRequested',
        'nativeLauncherEntered',
      ]);
    } finally {
      await stopChild(child);
    }
  });

  it('captures the worker exec-boundary marker without accepting arbitrary stages', async () => {
    const diagnostics: string[] = [];
    const probe = new LinuxPerformanceAttemptProbe('cpu', () => undefined, (stage) => diagnostics.push(stage));
    const child = probe.instrumentedSpawn()(
      process.execPath,
      [
        '-e',
        fixtureScript(
          'LWQP1\tstage\tworkerChildStarted\t1\nLWQP1\tstage\tworkerExecRequested\t1\nLWQP1\tstage\tworkerEntered\t1\n',
          '',
          7,
        ),
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    assert.ok(child.pid);
    try {
      const standardLauncherEvents = child.stdio[7];
      assert.ok(standardLauncherEvents);
      await once(standardLauncherEvents, 'data');
      assert.equal(probe.nativeWorkerExecution, 'entered');
      assert.deepEqual(diagnostics, [
        'nativeWorkerChildStarted',
        'nativeWorkerExecRequested',
        'nativeWorkerEntered',
      ]);
    } finally {
      await stopChild(child);
    }
  });

  it('captures only a closed worker lifecycle stage from validated native diagnostics', async () => {
    const diagnostics: string[] = [];
    const probe = new LinuxPerformanceAttemptProbe('cpu', () => undefined, (stage) => diagnostics.push(stage));
    const nativeLog =
      '{"component":"whisperWorker","elapsedMs":0,"event":"modelLoadStarted","level":"info","processInstanceId":"7bdf28c1-e1dc-4df9-abfe-78c8c0f8d7ff","schemaVersion":1,"sequence":1}\n';
    const child = probe.instrumentedSpawn()(
      process.execPath,
      ['-e', fixtureScript('', '', 5, nativeLog)],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    assert.ok(child.pid);
    try {
      assert.ok(child.stderr);
      await once(child.stderr, 'data');
      assert.equal(probe.nativeWorkerDiagnostic, 'loadStarted');
      assert.deepEqual(diagnostics, ['nativeWorkerModelLoadStarted']);
    } finally {
      await stopChild(child);
    }
  });

  it('does not replace the primary owner outcome with a later launcher event', () => {
    const probe = new LinuxPerformanceAttemptProbe('cpu', () => undefined);
    probe.recordNativeLaunchAcknowledgment('ready');
    probe.recordNativeLaunchAcknowledgment('closed');
    assert.equal(probe.nativeLaunchAcknowledgmentState, 'ready');
  });

  it('bounds diagnostic-pipe settlement when an owned native stream remains open', async () => {
    const probe = new LinuxPerformanceAttemptProbe('cpu', () => undefined);
    const child = probe.instrumentedSpawn()(process.execPath, ['-e', fixtureScript('')], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    assert.ok(child.pid);
    try {
      assert.equal(await probe.flushNativeDiagnostics(), 'timedOut');
    } finally {
      await stopChild(child);
    }
  });
});
