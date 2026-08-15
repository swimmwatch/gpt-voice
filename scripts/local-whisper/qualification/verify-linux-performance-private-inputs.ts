import { LinuxPerformancePrivateInputCommand } from './LinuxPerformancePrivateInputCommand';
import { LinuxPerformancePrivateInputPreflight } from './LinuxPerformancePrivateInputs';
import { LinuxQualificationEvidenceLoader } from './LinuxQualificationEvidenceLoader';

async function main(): Promise<void> {
  const command = LinuxPerformancePrivateInputCommand.parse(process.argv.slice(2));
  const proof = await new LinuxPerformancePrivateInputPreflight(new LinuxQualificationEvidenceLoader()).verify(command);
  process.stdout.write(
    `${JSON.stringify({
      status: 'verified',
      cacheSnapshotDigest: proof.cacheSnapshot.digest,
      evidenceIdentityDigest: proof.evidenceIdentityDigest,
      cacheEntryCount: proof.cacheSnapshot.entryCount,
      cacheFileCount: proof.cacheSnapshot.fileCount,
      privateRunRootState: 'absent',
    })}\n`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  const code = /^PRIVATE_[A-Z0-9_]+$/u.test(message) ? message : 'PRIVATE_INPUT_VERIFICATION_FAILED';
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
});
