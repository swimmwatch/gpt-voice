import { closeSync, writeSync } from 'node:fs';

import { LinuxPerformanceAttemptApplication } from './LinuxPerformanceAttemptApplication';
import {
  MAXIMUM_PERFORMANCE_ATTEMPT_REQUEST_BYTES,
  PERFORMANCE_ATTEMPT_ARGUMENT,
  PerformanceQualificationAttemptRunner,
  performanceAttemptResponseLine,
  type PerformanceAttemptResponse,
} from './PerformanceQualificationAttemptRunner';

async function requestBytes(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.from(chunk);
    total += bytes.byteLength;
    if (total > MAXIMUM_PERFORMANCE_ATTEMPT_REQUEST_BYTES) throw new Error('ATTEMPT_REQUEST_INVALID');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

function failed(): PerformanceAttemptResponse {
  return Object.freeze({
    schemaVersion: 3,
    status: 'failed',
    failureReason: 'ATTEMPT_REQUEST_INVALID',
    endToEndNanoseconds: null,
    phases: Object.freeze([]),
  });
}

async function main(): Promise<void> {
  let response: PerformanceAttemptResponse;
  const arguments_ = process.argv[1] === PERFORMANCE_ATTEMPT_ARGUMENT ? process.argv.slice(1) : process.argv.slice(2);
  if (process.platform !== 'linux' || arguments_.length !== 1 || arguments_[0] !== PERFORMANCE_ATTEMPT_ARGUMENT) {
    response = failed();
  } else {
    try {
      const runner = new PerformanceQualificationAttemptRunner(new LinuxPerformanceAttemptApplication());
      response = await runner.run(await requestBytes(), (frame) => {
        writeSync(3, frame);
      });
    } catch {
      response = failed();
    }
  }
  try {
    closeSync(3);
  } catch {
    response = failed();
  }
  writeSync(1, performanceAttemptResponseLine(response));
}

void main().catch(() => {
  writeSync(1, performanceAttemptResponseLine(failed()));
});
