import * as path from 'node:path';

import { LinuxPerformanceResourceSampler } from './LinuxPerformanceResourceSampler';
import {
  ContractOnlyPerformanceCacheAdapter,
  ContractOnlyPerformanceResourceAdapter,
  LinuxPerformanceAttemptProcessAdapter,
  LinuxPerformanceCachePreparationAdapter,
  LinuxPerformanceCollectionPlatformAdapter,
  LinuxPerformanceResourceAdapter,
} from './LinuxPerformanceQualificationAdapters';
import {
  LocalWhisperPerformanceCollector,
  PerformanceCollectionError,
  PerformanceQualificationPhaseParser,
} from './PerformanceQualificationCollector';
import {
  MAXIMUM_PERFORMANCE_PRIVATE_BUNDLE_BYTES,
  PerformanceQualificationCommandArguments,
  PerformanceQualificationPrivateRoot,
} from './PerformanceQualificationCommand';
import type { PerformanceQualificationRunPlan } from './PerformanceQualification';
import { LocalWhisperQualificationValidator } from './QualificationContracts';

async function main(): Promise<void> {
  const command = PerformanceQualificationCommandArguments.parse(process.argv.slice(2));
  if (command.mode !== 'representativeHost') {
    throw new PerformanceCollectionError('COLLECTION_MODE_INVALID');
  }
  const root = await PerformanceQualificationPrivateRoot.create(command.root);
  const workspaceRoot = path.resolve(__dirname, '../../..');
  const validator = new LocalWhisperQualificationValidator(
    path.join(workspaceRoot, 'docs/specs/local-whisper/qualification'),
  );
  const plan = validator.validateAndFreezeDocument(
    'performanceRunPlan',
    await root.readJson(command.input, MAXIMUM_PERFORMANCE_PRIVATE_BUNDLE_BYTES),
  ) as unknown as PerformanceQualificationRunPlan;
  if (plan.platform !== command.platform || plan.backend !== command.backend || plan.executionMode !== command.mode) {
    throw new PerformanceCollectionError('COLLECTION_MODE_MISMATCH');
  }
  if (command.platform === 'win32') throw new PerformanceCollectionError('WINDOWS_ADAPTER_UNAVAILABLE');
  const abort = new AbortController();
  const cancel = (): void => abort.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const contractOnly = plan.evidenceClaim === 'contractOnly';
    const collector = new LocalWhisperPerformanceCollector(validator, {
      platform: new LinuxPerformanceCollectionPlatformAdapter(root),
      cache: contractOnly
        ? new ContractOnlyPerformanceCacheAdapter()
        : new LinuxPerformanceCachePreparationAdapter(
            path.join(workspaceRoot, 'scripts/local-whisper/qualification/linux_performance_cache.py'),
          ),
      process: new LinuxPerformanceAttemptProcessAdapter(),
      phases: new PerformanceQualificationPhaseParser(),
      resources: contractOnly
        ? new ContractOnlyPerformanceResourceAdapter()
        : new LinuxPerformanceResourceAdapter(
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
        platform: bundle.platform,
        backend: bundle.backend,
        executionMode: bundle.executionMode,
        evidenceClaim: bundle.evidenceClaim,
        attemptCount: bundle.samples.length,
        performanceBundleDigest: bundle.performanceBundleDigest,
      })}\n`,
    );
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  const code =
    error instanceof PerformanceCollectionError
      ? error.code
      : /^(?:QUALIFICATION|PERFORMANCE)_[A-Z0-9_]+$/u.test(message)
        ? message
        : 'PERFORMANCE_COLLECTION_FAILED';
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
});
