import process from 'node:process';

import { ProductionPromotionSourceVerifier } from './ProductionPromotionSourceVerifier';

function required(name: string, pattern: RegExp): string {
  const value = process.env[name];
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error('PRODUCTION_PROMOTION_INPUT_INVALID');
  return value;
}

async function main(): Promise<void> {
  const repository = required('GITHUB_REPOSITORY', /^[\w.-]+\/[\w.-]+$/u);
  const candidateRunId = required('LOCAL_WHISPER_CANDIDATE_RUN_ID', /^[1-9]\d{0,19}$/u);
  const sourceSha = required('GITHUB_SHA', /^[a-f\d]{40}$/u);
  const token = required('GH_TOKEN', /^\S+$/u);
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs/${candidateRunId}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'gpt-voice-ci' },
    redirect: 'error',
  });
  if (!response.ok) throw new Error('PRODUCTION_PROMOTION_SOURCE_UNAVAILABLE');
  const value: unknown = await response.json();
  const verifier: ProductionPromotionSourceVerifier = new ProductionPromotionSourceVerifier();
  verifier.verify(value, { candidateRunId, repository, sourceSha });
  process.stdout.write('Production promotion source accepted\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'PRODUCTION_PROMOTION_SOURCE_FAILED'}\n`);
  process.exitCode = 1;
});
