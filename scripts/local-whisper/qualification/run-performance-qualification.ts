import * as path from 'node:path';

import { LocalWhisperQualificationValidator } from './QualificationContracts';
import {
  MAXIMUM_PERFORMANCE_AGGREGATE_BYTES,
  MAXIMUM_PERFORMANCE_PRIVATE_BUNDLE_BYTES,
  PerformanceQualificationCommandArguments,
  PerformanceQualificationPrivateRoot,
} from './PerformanceQualificationCommand';
import type { PerformanceQualificationBundle } from './PerformanceQualification';
import { LocalWhisperPerformanceResultProducer } from './PerformanceQualificationResultProducer';

async function main(): Promise<void> {
  const command = PerformanceQualificationCommandArguments.parse(process.argv.slice(2));
  const root = await PerformanceQualificationPrivateRoot.create(command.root);
  const workspaceRoot = path.resolve(__dirname, '../../..');
  const validator = new LocalWhisperQualificationValidator(
    path.join(workspaceRoot, 'docs/specs/local-whisper/qualification'),
  );
  const bundle = validator.validateAndFreezeDocument(
    'performanceBundle',
    await root.readJson(command.input, MAXIMUM_PERFORMANCE_PRIVATE_BUNDLE_BYTES),
  ) as unknown as PerformanceQualificationBundle;
  if (
    bundle.platform !== command.platform ||
    bundle.backend !== command.backend ||
    bundle.executionMode !== command.mode
  ) {
    throw new Error('PERFORMANCE_QUALIFICATION_MODE_MISMATCH');
  }
  const result = new LocalWhisperPerformanceResultProducer(validator).produce(bundle);
  await root.writeJsonExclusive(command.output, result, MAXIMUM_PERFORMANCE_AGGREGATE_BYTES);
  process.stdout.write(
    `${JSON.stringify({
      status: 'produced',
      platform: result.platform,
      backend: result.backend,
      executionMode: result.executionMode,
      evidenceClaim: result.evidenceClaim,
      selectionStatus: result.selectionStatus,
      selectedInFlightWindow: result.selectedInFlightWindow,
      performanceResultDigest: result.performanceResultDigest,
    })}\n`,
  );
}

void main().catch(() => {
  process.stderr.write('PERFORMANCE_QUALIFICATION_FAILED\n');
  process.exitCode = 1;
});
