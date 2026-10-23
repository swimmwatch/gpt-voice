import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { it } from 'node:test';
import {
  productionReleaseStagingDigest,
  publishedAlphaDeploymentDigest,
} from '@scripts/local-whisper/release-policy/ReleaseProtocol';

it('preserves the published v1 property order byte for byte', () => {
  const input = {
    assets: [{ length: 3, name: 'release.json', sha256: 'a'.repeat(64) }],
    candidateInputDigest: 'b'.repeat(64),
    releaseCandidateDigest: 'c'.repeat(64),
    sourceSha: 'd'.repeat(40),
    tag: 'v2.4.0-alpha.1',
  };
  const originalStaging = createHash('sha256')
    .update(
      JSON.stringify({
        assets: input.assets,
        candidateInputDigest: input.candidateInputDigest,
        releaseCandidateDigest: input.releaseCandidateDigest,
        sourceSha: input.sourceSha,
        tag: input.tag,
      }),
    )
    .digest('hex');
  assert.equal(productionReleaseStagingDigest(input), originalStaging);
  const deployment = {
    releaseId: 100,
    releaseStagingDigest: originalStaging,
    releaseUrl: 'https://github.com/swimmwatch/gpt-voice/releases/tag/v2.4.0-alpha.1',
    sourceSha: input.sourceSha,
    tag: input.tag,
  };
  const originalDeployment = createHash('sha256')
    .update(
      JSON.stringify({
        releaseId: deployment.releaseId,
        releaseStagingDigest: deployment.releaseStagingDigest,
        releaseUrl: deployment.releaseUrl,
        sourceSha: deployment.sourceSha,
        tag: deployment.tag,
      }),
    )
    .digest('hex');
  assert.equal(publishedAlphaDeploymentDigest(deployment), originalDeployment);
});
