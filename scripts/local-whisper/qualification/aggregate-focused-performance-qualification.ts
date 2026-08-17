import * as path from 'node:path';

import { FocusedPerformanceDocumentProducer, type FocusedPerformanceBundle } from './FocusedPerformanceQualification';
import {
  MAXIMUM_PERFORMANCE_AGGREGATE_BYTES,
  MAXIMUM_PERFORMANCE_PRIVATE_BUNDLE_BYTES,
  PerformanceQualificationCommandArguments,
  PerformanceQualificationPrivateRoot,
} from './PerformanceQualificationCommand';
import { LocalWhisperQualificationValidator } from './QualificationContracts';

async function main(): Promise<void> {
  const command = PerformanceQualificationCommandArguments.parse(process.argv.slice(2));
  if (command.platform !== 'linux' || command.mode !== 'representativeHost') {
    throw new Error('FOCUSED_PERFORMANCE_AGGREGATE_MODE_INVALID');
  }
  const root = await PerformanceQualificationPrivateRoot.create(command.root);
  const validator = new LocalWhisperQualificationValidator(
    path.resolve(__dirname, '../../../docs/specs/local-whisper/qualification'),
  );
  const bundle = validator.validateAndFreezeDocument(
    'focusedPerformanceBundle',
    await root.readJson(command.input, MAXIMUM_PERFORMANCE_PRIVATE_BUNDLE_BYTES),
  ) as unknown as FocusedPerformanceBundle;
  if (bundle.backend !== command.backend) throw new Error('FOCUSED_PERFORMANCE_AGGREGATE_MODE_MISMATCH');
  const result = new FocusedPerformanceDocumentProducer(validator).produceResult(bundle);
  await root.writeJsonExclusive(command.output, result, MAXIMUM_PERFORMANCE_AGGREGATE_BYTES);
  process.stdout.write(
    `${JSON.stringify({
      status: 'produced',
      backend: result.backend,
      candidateOnly: true,
      timingGate: result.timingGate,
      focusedPerformanceResultDigest: result.focusedPerformanceResultDigest,
    })}\n`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  process.stderr.write(
    /^(?:QUALIFICATION|PERFORMANCE|FOCUSED)_[A-Z0-9_]+$/u.test(message)
      ? `${message}\n`
      : 'FOCUSED_PERFORMANCE_AGGREGATE_FAILED\n',
  );
  process.exitCode = 1;
});
