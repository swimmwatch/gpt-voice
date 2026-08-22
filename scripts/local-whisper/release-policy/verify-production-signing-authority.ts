import process from 'node:process';

import { ProductionSigningAuthority } from './ProductionSigningAuthority';

try {
  const authority = ProductionSigningAuthority.fromEnvironment(process.env);
  const proof = authority.signArtifact(Buffer.from('gpt-voice-production-signing-readiness-v1', 'utf8'));
  if (proof.keyId !== authority.keyId || proof.signatureBase64.length === 0) {
    throw new Error('Production signing readiness proof failed');
  }
  process.stdout.write('Production Local Whisper signing authority verified\n');
} catch (error: unknown) {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Production signing authority verification failed'}\n`,
  );
  process.exitCode = 1;
}
