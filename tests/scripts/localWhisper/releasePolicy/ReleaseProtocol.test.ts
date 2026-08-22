import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  LOCAL_WHISPER_RELEASE_TARGETS,
  type AlphaDeployment,
  type ReleaseAsset,
  type ReleaseCandidate,
  type ReleaseStaging,
  ReleaseProtocolError,
  ReleaseProtocolVerifier,
} from '@scripts/local-whisper/release-policy/ReleaseProtocol';
import { ReleaseWorkflowPolicyVerifier } from '@scripts/local-whisper/release-policy/ReleaseWorkflowPolicyVerifier';

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DIGEST = 'a'.repeat(64);
const OTHER_DIGEST = 'b'.repeat(64);

function asset(
  platform: 'linux' | 'win32',
  role: 'application' | 'runtime',
  target: 'app' | 'cpu' | 'sm_120a-real',
): ReleaseAsset {
  return {
    fileName: `${platform}-${role}-${target}.bin`,
    length: 1,
    platform,
    role,
    sha256: target === 'app' ? DIGEST : OTHER_DIGEST,
    signature: `signature-${platform}-${target}`,
    target,
  };
}

function candidate(): ReleaseCandidate {
  return {
    assets: [
      asset('linux', 'application', 'app'),
      asset('win32', 'application', 'app'),
      asset('linux', 'runtime', 'cpu'),
      asset('win32', 'runtime', 'cpu'),
      asset('linux', 'runtime', 'sm_120a-real'),
      asset('win32', 'runtime', 'sm_120a-real'),
    ],
    candidateInputDigest: DIGEST,
    manifestSignature: 'manifest-signature',
    releaseCandidateDigest: OTHER_DIGEST,
    target: LOCAL_WHISPER_RELEASE_TARGETS.alpha,
  };
}

function staging(): ReleaseStaging {
  return {
    candidateInputDigest: DIGEST,
    releaseCandidateDigest: OTHER_DIGEST,
    releaseStagingDigest: 'c'.repeat(64),
    stagedAssets: candidate().assets,
    tag: LOCAL_WHISPER_RELEASE_TARGETS.alpha,
  };
}

function deployment(): AlphaDeployment {
  return {
    deploymentDigest: 'd'.repeat(64),
    prerelease: true,
    public: true,
    releaseStagingDigest: staging().releaseStagingDigest,
    target: LOCAL_WHISPER_RELEASE_TARGETS.alpha,
  };
}

describe('Local Whisper release protocol', () => {
  it('accepts the exact six frozen candidate outputs and public alpha-before-smoke ordering', () => {
    const verifier = new ReleaseProtocolVerifier();
    verifier.verifyPreparation({
      branch: 'release/v2.4.0-alpha.1',
      changelogCommitted: true,
      cleanHead: true,
      manualRegistryCommitted: true,
      mergePolicy: 'preserving-merge-only',
      tag: LOCAL_WHISPER_RELEASE_TARGETS.alpha,
      target: LOCAL_WHISPER_RELEASE_TARGETS.alpha,
      versionCommitted: true,
    });
    verifier.verifyStaging(candidate(), staging());
    verifier.verifyAlphaDeployment(staging(), deployment());
    verifier.verifySmokeEligibility(deployment(), {
      deploymentDigest: deployment().deploymentDigest,
      platform: 'linux',
      status: 'Pass',
    });
  });

  it('rejects missing outputs, changed staged bytes, and prepublication smoke', () => {
    const verifier = new ReleaseProtocolVerifier();
    assert.throws(
      () => verifier.verifyCandidate({ ...candidate(), assets: candidate().assets.slice(1) }),
      ReleaseProtocolError,
    );
    assert.throws(
      () =>
        verifier.verifyStaging(candidate(), {
          ...staging(),
          stagedAssets: [...staging().stagedAssets.slice(0, 5), asset('win32', 'runtime', 'cpu')],
        }),
      ReleaseProtocolError,
    );
    assert.throws(
      () =>
        verifier.verifySmokeEligibility(
          { ...deployment(), public: false },
          { deploymentDigest: deployment().deploymentDigest, platform: 'linux', status: 'Pass' },
        ),
      ReleaseProtocolError,
    );
  });

  it('requires independent Linux and Windows passes before feedback can select final', () => {
    const verifier = new ReleaseProtocolVerifier();
    assert.throws(
      () =>
        verifier.verifyFinalTransition(
          deployment(),
          [{ deploymentDigest: deployment().deploymentDigest, platform: 'linux', status: 'Pass' }],
          'final',
        ),
      ReleaseProtocolError,
    );
    assert.throws(
      () =>
        verifier.verifyFinalTransition(
          deployment(),
          [
            { deploymentDigest: deployment().deploymentDigest, platform: 'linux', status: 'Pass' },
            { deploymentDigest: deployment().deploymentDigest, platform: 'win32', status: 'Fail' },
          ],
          'final',
        ),
      ReleaseProtocolError,
    );
    verifier.verifyFinalTransition(
      deployment(),
      [
        { deploymentDigest: deployment().deploymentDigest, platform: 'linux', status: 'Pass' },
        { deploymentDigest: deployment().deploymentDigest, platform: 'win32', status: 'Fail' },
      ],
      'next-alpha',
    );
    verifier.verifyFinalTransition(
      deployment(),
      [
        { deploymentDigest: deployment().deploymentDigest, platform: 'linux', status: 'Pass' },
        { deploymentDigest: deployment().deploymentDigest, platform: 'win32', status: 'Pass' },
      ],
      'final',
    );
  });

  it('permits one manual non-clobbering tag stage and rejects release-time mutation', async () => {
    const workflow = await readFile(path.join(WORKSPACE_ROOT, '.github', 'workflows', 'release-builds.yml'), 'utf8');
    const verifier = new ReleaseWorkflowPolicyVerifier();
    verifier.verify(workflow);
    assert.throws(() => verifier.verify(`${workflow}\n# --clobber`), /MUTATION_FORBIDDEN/u);
    assert.throws(
      () => verifier.verify(workflow.replace('Release tag already exists', 'missing existing-tag guard')),
      /PUBLICATION_FORBIDDEN/u,
    );
    assert.throws(
      () => verifier.verify(workflow.replace('workflow_dispatch:', 'release:\n    types: [published]')),
      /TRIGGER_INVALID|PUBLICATION_FORBIDDEN/u,
    );
  });
});
