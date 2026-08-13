import process from 'node:process';

import { NativeSourceAdvisoryEvidenceVerifier } from './NativeSourceAdvisoryEvidence';

function evidenceDirectory(arguments_: readonly string[]): string {
  if (arguments_.length !== 1 || !arguments_[0]?.startsWith('--advisory-evidence-dir=')) {
    throw new Error('Expected --advisory-evidence-dir=...');
  }
  const result = arguments_[0].slice('--advisory-evidence-dir='.length);
  if (result.length === 0 || result.includes('\0')) throw new Error('Native advisory evidence directory is invalid');
  return result;
}

async function main(): Promise<void> {
  const verified = await new NativeSourceAdvisoryEvidenceVerifier().verify(evidenceDirectory(process.argv.slice(2)));
  process.stdout.write(`Native source advisory evidence: unaffected; reportDigest=${verified.reportDigest}\n`);
}

main().catch(() => {
  process.stderr.write('Native source advisory evidence is unavailable\n');
  process.exitCode = 1;
});
