import { createHash } from 'node:crypto';
import * as path from 'node:path';
import process from 'node:process';

import { withVerifiedRegularFile } from './verifiedRegularFile';

export const MAXIMUM_PACKAGE_ATTESTATION_SUBJECT_BYTES = 4 * 1024 * 1024 * 1024;
const SAFE_RELATIVE_PATH = /^[a-z\d][a-z\d._/-]{0,255}$/u;

function fail(code: string): never {
  throw new Error(`PACKAGE_ATTESTATION_${code}`);
}

/** Reduces an unknown command failure to the bounded package-attestation error vocabulary. */
export function packageAttestationFailureMessage(error: unknown): string {
  return error instanceof Error && /^PACKAGE_ATTESTATION_[A-Z_]+$/u.test(error.message)
    ? error.message
    : 'PACKAGE_ATTESTATION_FAILED';
}

/** Reports one bounded package-attestation command failure without exposing its cause. */
export function reportPackageAttestationCommandFailure(error: unknown): void {
  process.stderr.write(`${packageAttestationFailureMessage(error)}\n`);
  process.exitCode = 1;
}

/** Resolves one bounded package-attestation path strictly below its workspace. */
export function resolvePackageAttestationWorkspacePath(workspaceRoot: string, value: string): string {
  if (!SAFE_RELATIVE_PATH.test(value)) fail('ARGUMENT_INVALID');
  const resolved = path.resolve(workspaceRoot, value);
  const relative = path.relative(workspaceRoot, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) fail('ARGUMENT_INVALID');
  return resolved;
}

/** Hashes one bounded package-attestation subject through its verified descriptor. */
export async function hashPackageAttestationSubject(filePath: string): Promise<string> {
  return await withVerifiedRegularFile(
    {
      filePath,
      invalid: () => fail('SUBJECT_INVALID'),
      maximumBytes: MAXIMUM_PACKAGE_ATTESTATION_SUBJECT_BYTES,
      minimumBytes: 1,
      unavailable: () => fail('SUBJECT_UNAVAILABLE'),
    },
    async (file, expectedSize) => {
      const hash = createHash('sha256');
      let byteLength = 0;
      for await (const chunk of file.createReadStream({ autoClose: false })) {
        const bytes = Buffer.from(chunk);
        byteLength += bytes.byteLength;
        if (byteLength > expectedSize) fail('SUBJECT_INVALID');
        hash.update(bytes);
      }
      if (byteLength !== expectedSize) fail('SUBJECT_INVALID');
      return hash.digest('hex');
    },
  );
}
