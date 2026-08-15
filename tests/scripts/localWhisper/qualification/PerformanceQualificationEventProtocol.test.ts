import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { describe, it } from 'node:test';

import {
  PerformanceQualificationEventCollector,
  PerformanceQualificationEventWriter,
} from '@scripts/local-whisper/qualification/PerformanceQualificationEventProtocol';
import {
  performanceRequiredPhaseIds,
  type PerformanceBackend,
} from '@scripts/local-whisper/qualification/PerformanceQualification';
import { LOCAL_WHISPER_PERFORMANCE_PHASES } from '@scripts/local-whisper/qualification/QualificationContracts';

const DIGESTS = ['1'.repeat(64), '2'.repeat(64), '3'.repeat(64)] as const;

class BufferWriter extends Writable {
  public readonly chunks: Buffer[] = [];

  public override _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }
}

function validChannel(backend: PerformanceBackend): Buffer {
  const output = new BufferWriter();
  const writer = new PerformanceQualificationEventWriter(output);
  writer.role({ role: 'main', pid: 101, processStartIdentity: '1010', executableSha256: DIGESTS[0] });
  writer.role({ role: 'guard', pid: 102, processStartIdentity: '1020', executableSha256: DIGESTS[1] });
  writer.role({ role: 'worker', pid: 103, processStartIdentity: '1030', executableSha256: DIGESTS[2] });
  for (const { id } of LOCAL_WHISPER_PERFORMANCE_PHASES) {
    if (backend === 'cpu' && id === 'gpuUploadAllocation') writer.phase(id, null, 'notApplicable');
    else writer.phase(id, 100);
  }
  writer.success();
  return Buffer.concat(output.chunks);
}

describe('performance qualification private event protocol', () => {
  it('accepts fragmented canonical events and filters the CPU-only not-applicable phase', () => {
    const bytes = validChannel('cpu');
    const collector = new PerformanceQualificationEventCollector(
      'linux',
      'cpu',
      performanceRequiredPhaseIds('linux', 'cpu'),
    );
    for (let offset = 0; offset < bytes.byteLength; offset += 7) {
      collector.append(bytes.subarray(offset, Math.min(bytes.byteLength, offset + 7)));
    }
    const proof = collector.finish();
    assert.deepEqual(
      proof.phases.map(({ id, sequence }) => ({ id, sequence })),
      performanceRequiredPhaseIds('linux', 'cpu').map((id, sequence) => ({ id, sequence })),
    );
    assert.deepEqual(
      proof.roleRegistrations.map(({ role, executableSha256 }) => ({ role, executableSha256 })),
      [
        { role: 'main', executableSha256: DIGESTS[0] },
        { role: 'guard', executableSha256: DIGESTS[1] },
        { role: 'worker', executableSha256: DIGESTS[2] },
      ],
    );
  });

  it('accepts the applicable CUDA phase and rejects missing, duplicate, reordered, late, or malformed events', () => {
    const valid = validChannel('cuda');
    const accepted = new PerformanceQualificationEventCollector(
      'linux',
      'cuda',
      performanceRequiredPhaseIds('linux', 'cuda'),
    );
    accepted.append(valid);
    assert.equal(accepted.finish().phases.length, LOCAL_WHISPER_PERFORMANCE_PHASES.length);

    const lines = valid.toString('utf8').trimEnd().split('\n');
    const cases = [
      lines.slice(0, -2),
      [...lines.slice(0, -1), lines[lines.length - 2]!, lines[lines.length - 1]!],
      [lines[1]!, lines[0]!, ...lines.slice(2)],
      [...lines, lines[0]!],
      [lines[0]!.replace('"sequence":0', '"sequence":2'), ...lines.slice(1)],
    ];
    for (const frames of cases) {
      const collector = new PerformanceQualificationEventCollector(
        'linux',
        'cuda',
        performanceRequiredPhaseIds('linux', 'cuda'),
      );
      assert.throws(() => {
        collector.append(Buffer.from(`${frames.join('\n')}\n`, 'utf8'));
        collector.finish();
      }, /ATTEMPT_EVENT_PROTOCOL_INVALID/u);
    }
  });

  it('rejects role PID/start-identity reuse and private arbitrary metadata', () => {
    const lines = validChannel('cpu').toString('utf8').trimEnd().split('\n');
    const reusedPid = lines.map((line, index) => (index === 1 ? line.replace('"pid":102', '"pid":101') : line));
    const metadata = lines.map((line, index) => (index === 0 ? line.replace('{', '{"path":"/private/model",') : line));
    for (const frames of [reusedPid, metadata]) {
      const collector = new PerformanceQualificationEventCollector(
        'linux',
        'cpu',
        performanceRequiredPhaseIds('linux', 'cpu'),
      );
      assert.throws(
        () => collector.append(Buffer.from(`${frames.join('\n')}\n`, 'utf8')),
        /ATTEMPT_EVENT_PROTOCOL_INVALID/u,
      );
    }
  });
});
