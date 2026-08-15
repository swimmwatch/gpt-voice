import * as path from 'node:path';

import {
  GitPerformanceDerivedSourceAdapter,
  NodePerformanceDerivedSourceFilesystemAdapter,
  NodePerformanceDigestAdapter,
  PerformanceDerivedSourceProducer,
  UstarPerformanceSourceArchiveAdapter,
} from './PerformanceDerivedSourceProducer';
import { createLinuxPerformanceAttemptBuildAdapter } from './LinuxPerformanceAttemptBuildAdapter';
import { LinuxPerformancePrivateInputPreflight } from './LinuxPerformancePrivateInputs';
import { LinuxPerformanceRunPlanCommand } from './LinuxPerformanceRunPlanCommand';
import { LinuxPerformanceRunPlanProducer } from './LinuxPerformanceRunPlanProducer';
import { LinuxQualificationEvidenceLoader } from './LinuxQualificationEvidenceLoader';
import { PerformanceQualificationOverlayProducer } from './PerformanceQualificationOverlay';
import { LocalWhisperQualificationValidator } from './QualificationContracts';
import { LocalWhisperQualificationSourceBaselineVerifier } from './QualificationSourceBaseline';

async function main(): Promise<void> {
  const command = LinuxPerformanceRunPlanCommand.parse(process.argv.slice(2));
  const qualificationRoot = path.join(command.workspaceRoot, 'docs/specs/local-whisper/qualification');
  const validator = new LocalWhisperQualificationValidator(qualificationRoot);
  const abort = new AbortController();
  const cancel = (): void => abort.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const producer = new LinuxPerformanceRunPlanProducer(validator, {
      preflight: new LinuxPerformancePrivateInputPreflight(new LinuxQualificationEvidenceLoader()),
      overlay: new PerformanceQualificationOverlayProducer(),
      sourceBaseline: new LocalWhisperQualificationSourceBaselineVerifier(command.workspaceRoot),
      createDerivation: (overlay) =>
        new PerformanceDerivedSourceProducer(
          validator,
          {
            git: new GitPerformanceDerivedSourceAdapter('git'),
            archive: new UstarPerformanceSourceArchiveAdapter(),
            filesystem: new NodePerformanceDerivedSourceFilesystemAdapter(),
            digest: new NodePerformanceDigestAdapter(),
          },
          { bytes: overlay.bytes, sha256: overlay.sha256 },
        ),
      builder: createLinuxPerformanceAttemptBuildAdapter(command.workspaceRoot),
    });
    const result = await producer.produce({ ...command, signal: abort.signal });
    process.stdout.write(
      `${JSON.stringify({
        status: 'produced',
        overlaySha256: result.overlaySha256,
        overlayManifestSha256: result.overlayManifestSha256,
        cpuPerformanceRunPlanDigest: result.plans.cpu.performanceRunPlanDigest,
        cudaPerformanceRunPlanDigest: result.plans.cuda.performanceRunPlanDigest,
      })}\n`,
    );
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  const code = /^(?:PERFORMANCE|PRIVATE|QUALIFICATION|SOURCE)_[A-Z0-9_:.-]+$/u.test(message)
    ? message
    : 'PERFORMANCE_PLAN_PRODUCTION_FAILED';
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
});
