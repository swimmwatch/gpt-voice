import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  LOCAL_WHISPER_RELEASE_TARGETS,
  type AlphaDeployment,
  type ReleaseAsset,
  type ReleaseAssetFormat,
  type ReleaseAssetPlatform,
  type ReleaseAssetRole,
  type ReleaseAssetTarget,
  type ReleaseCandidate,
  type ReleaseStaging,
  ReleaseProtocolError,
  ReleaseProtocolVerifier,
  isReleaseCandidateTarget,
} from '@scripts/local-whisper/release-policy/ReleaseProtocol';
import { ReleaseWorkflowPolicyVerifier } from '@scripts/local-whisper/release-policy/ReleaseWorkflowPolicyVerifier';
import { resolveProductionWorkflowInputs } from '@scripts/local-whisper/release-policy/ProductionWorkflowInputs';

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DIGEST = 'a'.repeat(64);
const OTHER_DIGEST = 'b'.repeat(64);

function asset(
  platform: ReleaseAssetPlatform,
  role: ReleaseAssetRole,
  target: ReleaseAssetTarget,
  format: ReleaseAssetFormat,
): ReleaseAsset {
  const identity = `${platform}-${role}-${target}-${format}`;
  return {
    fileName: `${identity}.artifact`,
    format,
    length: 1,
    platform,
    role,
    sha256: role === 'application' ? DIGEST : OTHER_DIGEST,
    signature: {
      fileName: `${identity}.signature`,
      keyId: 'production-release-key-v1',
      length: 1,
      sha256: DIGEST,
    },
    target,
  };
}

function candidateAssets(): readonly ReleaseAsset[] {
  return [
    asset('linux', 'application', 'app', 'appimage'),
    asset('linux', 'application', 'app', 'deb'),
    asset('linux', 'application', 'app', 'rpm'),
    asset('win32', 'application', 'app', 'nsis'),
    asset('linux', 'runtime', 'cpu', 'restricted-tar-gzip-v1'),
    asset('win32', 'runtime', 'cpu', 'restricted-tar-gzip-v1'),
    asset('linux', 'runtime', 'sm_120a-real', 'restricted-tar-gzip-v1'),
    asset('win32', 'runtime', 'sm_120a-real', 'restricted-tar-gzip-v1'),
    asset('global', 'catalog', 'release', 'json'),
    asset('global', 'keyring', 'release', 'json'),
    asset('global', 'checksums', 'release', 'text'),
    asset('global', 'manifest', 'release', 'json'),
    asset('global', 'sbom', 'release', 'json'),
    asset('global', 'notices', 'release', 'text'),
    asset('global', 'provenance', 'release', 'json'),
    asset('global', 'compatibility', 'release', 'json'),
  ];
}

function candidate(): ReleaseCandidate {
  const assets = candidateAssets();
  const manifest = assets.find((entry) => entry.role === 'manifest');
  if (!manifest) throw new Error('Missing release manifest fixture');
  return {
    assets,
    candidateInputDigest: DIGEST,
    manifestSignature: manifest.signature,
    purpose: 'production',
    releaseCandidateDigest: OTHER_DIGEST,
    target: LOCAL_WHISPER_RELEASE_TARGETS.alpha,
  };
}

function staging(): ReleaseStaging {
  return {
    candidateInputDigest: DIGEST,
    purpose: 'production',
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
  it('resolves private construction, versioned candidate, and prior-run publication inputs', () => {
    assert.deepEqual(
      resolveProductionWorkflowInputs({ appRevision: '1.4.0', candidateLabel: 'task32-proof-1', publish: false }),
      { appRevision: '1.4.0', candidateRunId: null, candidateTarget: 'task32-proof-1', targetKind: 'private' },
    );
    assert.deepEqual(
      resolveProductionWorkflowInputs({
        appRevision: '2.4.0-alpha.1',
        candidateLabel: 'task32-alpha-construction',
        publish: false,
        releaseTag: LOCAL_WHISPER_RELEASE_TARGETS.alpha,
      }),
      {
        appRevision: '2.4.0-alpha.1',
        candidateRunId: null,
        candidateTarget: LOCAL_WHISPER_RELEASE_TARGETS.alpha,
        targetKind: 'release',
      },
    );
    assert.deepEqual(
      resolveProductionWorkflowInputs({
        appRevision: '2.4.0-alpha.1',
        candidateLabel: 'task32-alpha-construction',
        candidateRunId: '32594163793',
        publish: true,
        releaseTag: LOCAL_WHISPER_RELEASE_TARGETS.alpha,
      }),
      {
        appRevision: '2.4.0-alpha.1',
        candidateRunId: '32594163793',
        candidateTarget: LOCAL_WHISPER_RELEASE_TARGETS.alpha,
        targetKind: 'release',
      },
    );
    assert.equal(isReleaseCandidateTarget('task32-proof-1', 'private'), true);
    assert.equal(isReleaseCandidateTarget(LOCAL_WHISPER_RELEASE_TARGETS.alpha, 'release'), true);
    assert.throws(
      () =>
        resolveProductionWorkflowInputs({
          appRevision: '1.4.0',
          candidateLabel: 'task32-proof-1',
          candidateRunId: '32594163793',
          publish: false,
        }),
      /rejects a prior candidate run/u,
    );
    assert.throws(
      () =>
        resolveProductionWorkflowInputs({
          appRevision: '2.4.0-alpha.2',
          candidateLabel: 'task32-proof-1',
          publish: true,
          releaseTag: 'v2.4.0-alpha.2',
        }),
      /approved release target/u,
    );
  });

  it('accepts the exact physical production inventory and public alpha-before-smoke ordering', () => {
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

  it('rejects incomplete, disabled, duplicate, cross-platform, and unsigned physical inventories', () => {
    const verifier = new ReleaseProtocolVerifier();
    assert.throws(
      () => verifier.verifyCandidate({ ...candidate(), assets: candidate().assets.slice(1) }),
      ReleaseProtocolError,
    );
    assert.throws(
      () => verifier.verifyCandidate({ ...candidate(), purpose: 'qualification' as never }),
      ReleaseProtocolError,
    );
    const duplicate = candidate().assets.map((entry) => ({ ...entry, signature: { ...entry.signature } }));
    duplicate[1] = { ...duplicate[1], fileName: duplicate[0].fileName };
    assert.throws(() => verifier.verifyCandidate({ ...candidate(), assets: duplicate }), ReleaseProtocolError);
    const crossed = candidate().assets.map((entry) => ({ ...entry, signature: { ...entry.signature } }));
    crossed[3] = { ...crossed[3], platform: 'linux' };
    assert.throws(() => verifier.verifyCandidate({ ...candidate(), assets: crossed }), ReleaseProtocolError);
    const unsigned = candidate().assets.map((entry) => ({ ...entry, signature: { ...entry.signature } }));
    unsigned[4] = { ...unsigned[4], signature: { ...unsigned[4].signature, keyId: '' } };
    assert.throws(() => verifier.verifyCandidate({ ...candidate(), assets: unsigned }), ReleaseProtocolError);
  });

  it('rejects missing runtime/trust records, substituted formats, and changed staged bytes', () => {
    const verifier = new ReleaseProtocolVerifier();
    const withoutRuntime = candidate().assets.filter(
      (entry) => !(entry.platform === 'win32' && entry.role === 'runtime' && entry.target === 'cpu'),
    );
    assert.throws(() => verifier.verifyCandidate({ ...candidate(), assets: withoutRuntime }), ReleaseProtocolError);
    const withoutCatalog = candidate().assets.filter((entry) => entry.role !== 'catalog');
    assert.throws(() => verifier.verifyCandidate({ ...candidate(), assets: withoutCatalog }), ReleaseProtocolError);
    const substituted = candidate().assets.map((entry) => ({ ...entry, signature: { ...entry.signature } }));
    substituted[0] = { ...substituted[0], format: 'nsis' };
    assert.throws(() => verifier.verifyCandidate({ ...candidate(), assets: substituted }), ReleaseProtocolError);
    const changedStaging = staging().stagedAssets.map((entry) => ({ ...entry, signature: { ...entry.signature } }));
    changedStaging[0] = { ...changedStaging[0], sha256: 'c'.repeat(64) };
    assert.throws(
      () => verifier.verifyStaging(candidate(), { ...staging(), stagedAssets: changedStaging }),
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

  it('keeps candidate construction nonpublishing by default and preserves guarded publication', async () => {
    const workflow = await readFile(path.join(WORKSPACE_ROOT, '.github', 'workflows', 'release-builds.yml'), 'utf8');
    const verifier = new ReleaseWorkflowPolicyVerifier();
    verifier.verify(workflow);
    assert.throws(
      () => verifier.verify(workflow.replace('--mode=production', '--mode=disabled')),
      /PRODUCTION_INPUTS_REQUIRED/u,
    );
    assert.throws(
      () => verifier.verify(workflow.replace('provision:local-whisper:ninja-license', '')),
      /PRODUCTION_INPUTS_REQUIRED/u,
    );
    assert.throws(
      () => verifier.verify(workflow.replace('kernel.apparmor_restrict_unprivileged_userns=0', '')),
      /PRODUCTION_INPUTS_REQUIRED/u,
    );
    assert.throws(
      () => verifier.verify(workflow.replace("steps.linux-network-namespace.outcome != 'skipped'", '')),
      /PRODUCTION_INPUTS_REQUIRED/u,
    );
    assert.throws(
      () => verifier.verify(workflow.replace('provision:local-whisper:windows-vc-runtime-license', '')),
      /PRODUCTION_INPUTS_REQUIRED/u,
    );
    assert.throws(
      () => verifier.verify(workflow.replace('permissions:\n  contents: read', 'permissions:\n  contents: write')),
      /MUTATION_FORBIDDEN/u,
    );
    assert.throws(
      () =>
        verifier.verify(
          workflow.replace('default: false\n        type: boolean', 'default: true\n        type: boolean'),
        ),
      /PUBLICATION_INPUT_INVALID/u,
    );
    assert.throws(
      () => verifier.verify(workflow.replace('on:\n  workflow_dispatch:', 'on:\n  push:\n  workflow_dispatch:')),
      /TRIGGER_INVALID/u,
    );
    assert.throws(
      () =>
        verifier.verify(
          workflow.replace(
            'run-name: ${{ inputs.watch_correlation || inputs.candidate_label }}',
            'run-name: uncorrelated-candidate',
          ),
        ),
      /MUTATION_FORBIDDEN/u,
    );
    assert.throws(
      () => verifier.verify(workflow.replace('watch_correlation:', 'unreviewed_input:')),
      /PUBLICATION_INPUT_INVALID/u,
    );
    assert.throws(
      () => verifier.verify(workflow.replace('inputs.publish == true', 'true')),
      /PUBLICATION_GATE_INVALID/u,
    );
    assert.throws(
      () => verifier.verify(workflow.replace('environment: local-whisper-production', 'environment: unsafe')),
      /PROTECTED_ENVIRONMENT_REQUIRED/u,
    );
    assert.throws(
      () =>
        verifier.verify(
          workflow.replace(
            'secrets.CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_PEM',
            'vars.CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_PEM',
          ),
        ),
      /SIGNING_AUTHORITY_REQUIRED/u,
    );
    assert.throws(
      () =>
        verifier.verify(
          workflow.replace(
            '  build-linux-runtimes:\n',
            '  build-linux-runtimes:\n    env:\n      LEAKED_KEY: ${{ secrets.CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_PEM }}\n',
          ),
        ),
      /SIGNING_AUTHORITY_LEAKED/u,
    );
    assert.throws(
      () => verifier.verify(workflow.replace("toolset-version: '14.51'", "toolset-version: '14.39'")),
      /CONSTRUCTION_GRAPH_INVALID/u,
    );
    assert.throws(
      () =>
        verifier.verify(
          workflow.replace(
            'Start-Process -FilePath $installer -ArgumentList $installerArguments -Wait -PassThru',
            'Start-Process -FilePath $installer -ArgumentList $installerArguments -PassThru',
          ),
        ),
      /CONSTRUCTION_GRAPH_INVALID/u,
    );
    assert.throws(
      () => verifier.verify(workflow.replace('$installation.ExitCode -ne 0', '$false')),
      /CONSTRUCTION_GRAPH_INVALID/u,
    );
    assert.throws(
      () =>
        verifier.verify(
          workflow.replace(
            '          - target: sm_120a-real\n            runner: windows-2022',
            '          - target: sm_120a-real\n            runner: ${{ vars.CI_WINDOWS_RUNNER }}',
          ),
        ),
      /CONSTRUCTION_GRAPH_INVALID/u,
    );
    assert.throws(
      () => verifier.verify(workflow.replace("        if: matrix.target == 'cpu'", '')),
      /CONSTRUCTION_GRAPH_INVALID/u,
    );
    assert.throws(
      () => verifier.verify(workflow.replace('          merge-multiple: true', '')),
      /CONSTRUCTION_GRAPH_INVALID/u,
    );
    assert.throws(
      () => verifier.verify(workflow.slice(0, workflow.indexOf('\n  publish:\n'))),
      /PUBLICATION_GATE_INVALID/u,
    );
    assert.throws(
      () =>
        verifier.verify(
          workflow.replace('      - verify-production-candidate\n    if:', '      - build-linux\n    if:'),
        ),
      /PUBLICATION_GATE_INVALID/u,
    );
    assert.throws(
      () => verifier.verify(workflow.replace('gh release view', 'gh release inspect')),
      /PUBLICATION_INCOMPLETE/u,
    );
    assert.throws(
      () =>
        verifier.verify(
          workflow.replace(
            '\n  publish:\n',
            '\n  unauthorized-release:\n    permissions:\n      contents: write\n    steps: []\n\n  publish:\n',
          ),
        ),
      /CANDIDATE_MUTATION_FORBIDDEN/u,
    );
    assert.throws(() => verifier.verify(`${workflow}\n# --clobber`), /MUTATION_FORBIDDEN/u);
  });
});
