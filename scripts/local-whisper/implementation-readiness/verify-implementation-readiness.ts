import * as path from 'node:path';

import { ImplementationReadinessError } from './ImplementationReadinessTypes';
import { LocalWhisperImplementationReadinessVerifier } from './LocalWhisperImplementationReadinessVerifier';
import { NodeImplementationReadinessRepository } from './NodeImplementationReadinessRepository';

async function main(): Promise<void> {
  const workspaceRoot = path.resolve(__dirname, '..', '..', '..');
  const verifier = new LocalWhisperImplementationReadinessVerifier(
    new NodeImplementationReadinessRepository(workspaceRoot),
  );
  const result = await verifier.verify();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

void main().catch((error: unknown) => {
  const message =
    error instanceof ImplementationReadinessError
      ? error.message
      : 'IMPLEMENTATION_CONTRACT_INVALID:unexpected-verifier-failure';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
