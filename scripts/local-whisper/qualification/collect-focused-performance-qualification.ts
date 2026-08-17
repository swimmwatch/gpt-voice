import * as path from 'node:path';

import { FocusedPerformanceQualificationCollector } from './FocusedPerformanceQualificationCollector';
import { LinuxPerformanceResourceSampler } from './LinuxPerformanceResourceSampler';
import {
  LinuxPerformanceAttemptProcessAdapter,
  LinuxPerformanceCachePreparationAdapter,
  LinuxPerformanceCollectionPlatformAdapter,
  LinuxPerformanceResourceAdapter,
} from './LinuxPerformanceQualificationAdapters';
import {
  MAXIMUM_PERFORMANCE_PRIVATE_BUNDLE_BYTES,
  PerformanceQualificationCommandArguments,
  PerformanceQualificationPrivateRoot,
} from './PerformanceQualificationCommand';
import type { FocusedPerformanceRunPlan } from './FocusedPerformanceQualification';
import { LocalWhisperQualificationValidator } from './QualificationContracts';

async function main(): Promise<void> {
  const command = PerformanceQualificationCommandArguments.parse(process.argv.slice(2));
  if (command.platform !== 'linux' || command.mode !== 'representativeHost') {
    throw new Error('FOCUSED_PERFORMANCE_COLLECTION_MODE_INVALID');
  }
  const root = await PerformanceQualificationPrivateRoot.create(command.root);
  const workspaceRoot = path.resolve(__dirname, '../../..');
  const validator = new LocalWhisperQualificationValidator(
    path.join(workspaceRoot, 'docs/specs/local-whisper/qualification'),
  );
  const plan = validator.validateAndFreezeDocument(
    'focusedPerformanceRunPlan',
    await root.readJson(command.input, MAXIMUM_PERFORMANCE_PRIVATE_BUNDLE_BYTES),
  ) as unknown as FocusedPerformanceRunPlan;
  if (plan.backend !== command.backend) throw new Error('FOCUSED_PERFORMANCE_COLLECTION_MODE_MISMATCH');
  const abort = new AbortController();
  const cancel = (): void => abort.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const collector = new FocusedPerformanceQualificationCollector(validator, {
      platform: new LinuxPerformanceCollectionPlatformAdapter(root),
      cache: new LinuxPerformanceCachePreparationAdapter(
        path.join(workspaceRoot, 'scripts/local-whisper/qualification/linux_performance_cache.py'),
      ),
      process: new LinuxPerformanceAttemptProcessAdapter(),
      resources: new LinuxPerformanceResourceAdapter(
        new LinuxPerformanceResourceSampler(
          path.join(workspaceRoot, 'scripts/local-whisper/qualification/linux_performance_resource_sampler.py'),
        ),
      ),
    });
    const bundle = await collector.collect(plan, abort.signal);
    await root.writeJsonExclusive(command.output, bundle, MAXIMUM_PERFORMANCE_PRIVATE_BUNDLE_BYTES);
    process.stdout.write(
      `${JSON.stringify({
        status: 'collected',
        backend: bundle.backend,
        candidateOnly: true,
        attemptCount: bundle.samples.length,
        focusedPerformanceBundleDigest: bundle.focusedPerformanceBundleDigest,
      })}\n`,
    );
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  process.stderr.write(
    /^(?:QUALIFICATION|PERFORMANCE|FOCUSED)_[A-Z0-9_]+$/u.test(message)
      ? `${message}\n`
      : 'FOCUSED_PERFORMANCE_COLLECTION_FAILED\n',
  );
  process.exitCode = 1;
});
