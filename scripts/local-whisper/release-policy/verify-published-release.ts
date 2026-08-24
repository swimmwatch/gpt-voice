import process from 'node:process';

import { PublishedReleaseVerifier } from './PublishedReleaseVerifier';

function required(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0) throw new Error('PUBLISHED_RELEASE_INPUT_INVALID');
  return value;
}

new PublishedReleaseVerifier()
  .verify(required('LOCAL_WHISPER_CANDIDATE_DESCRIPTOR'), {
    outputPath: required('LOCAL_WHISPER_DEPLOYMENT_EVIDENCE'),
    repository: required('GITHUB_REPOSITORY'),
    sourceSha: required('GITHUB_SHA'),
    tag: required('LOCAL_WHISPER_RELEASE_TAG'),
    token: required('GH_TOKEN'),
  })
  .then(() => process.stdout.write('Published Local Whisper release verified\n'))
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'PUBLISHED_RELEASE_VERIFICATION_FAILED'}\n`);
    process.exitCode = 1;
  });
