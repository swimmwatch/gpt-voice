import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it } from 'node:test';

const workspaceRoot = process.cwd();

async function readWorkspaceFile(...segments: string[]): Promise<string> {
  return readFile(path.join(workspaceRoot, ...segments), 'utf8');
}

describe('Application artifact security workflow', () => {
  it('requires separate Linux and Windows primary package candidates and installer smoke', async () => {
    const workflow = await readWorkspaceFile('.github', 'workflows', 'pr-checks.yml');
    const fedoraEntrypoint = await readWorkspaceFile('build', 'fedora-release', 'fedora-release-entrypoint.mjs');

    assert.match(
      workflow,
      /package-smoke:\n {4}name: Package Smoke \(\$\{\{ matrix\.checkName \}\}\)\n {4}runs-on: \$\{\{ matrix\.runner \}\}/u,
    );
    const packageSmokeHeader = workflow.slice(
      workflow.indexOf('  package-smoke:'),
      workflow.indexOf('    steps:', workflow.indexOf('  package-smoke:')),
    );
    assert.doesNotMatch(packageSmokeHeader, /\n {4}needs:/u);
    assert.match(
      workflow,
      /checkName: Fedora Linux\n {12}artifactPlatform: linux\n {12}platform: linux\n {12}runner: \$\{\{ vars\.CI_LINUX_RUNNER \}\}/u,
    );
    assert.match(
      workflow,
      /checkName: Windows\n {12}artifactPlatform: win32\n {12}platform: windows\n {12}runner: \$\{\{ vars\.CI_WINDOWS_RUNNER \}\}/u,
    );
    assert.match(workflow, /--mode=release --release-date=\$\{\{ vars\.CI_FIXTURE_RELEASE_DATE \}\}/u);
    assert.match(workflow, /npx electron-builder --win --publish never/u);
    assert.match(workflow, /npm run verify:installers -- --platform=win32/u);
    assert.match(fedoraEntrypoint, /npm', \['run', 'verify:installers', '--', '--platform=linux'\]/u);
  });

  it('uses the reviewed immutable Trivy binary and a bounded platform-specific evidence directory', async () => {
    const workflow = await readWorkspaceFile('.github', 'workflows', 'pr-checks.yml');

    assert.match(
      workflow,
      /aquasecurity\/setup-trivy@81e514348e19b6112ce2a7e3ecbafe19c1e1f567 # v0\.3\.1\n {8}with:\n {10}path: \$\{\{ runner\.temp \}\}\/trivy\n {10}version: v0\.69\.3/u,
    );
    assert.match(workflow, /npm run scan:security:application-artifacts --/u);
    assert.match(workflow, /--platform=\$\{\{ matrix\.artifactPlatform \}\}/u);
    assert.match(
      workflow,
      /--output-directory=release-artifacts\/application-security-\$\{\{ matrix\.artifactPlatform \}\}/u,
    );
    assert.match(
      workflow,
      /name: gpt-voice-application-security-\$\{\{ matrix\.artifactPlatform \}\}\n {10}path: release-artifacts\/application-security-\$\{\{ matrix\.artifactPlatform \}\}/u,
    );
    assert.doesNotMatch(workflow, /application-security-linux[\s\S]{0,200}application-security-win32/u);
  });

  it('keeps security-record production and platform-specific smoke in the same mandatory matrix lane', async () => {
    const workflow = await readWorkspaceFile('.github', 'workflows', 'pr-checks.yml');
    const packageSmoke = workflow.slice(workflow.indexOf('  package-smoke:'), workflow.length);

    assert.match(packageSmoke, /fail-fast: false/u);
    assert.equal(packageSmoke.includes('continue-on-error: true'), false);
    assert.equal(packageSmoke.includes("if: matrix.platform == 'windows' && false"), false);
    assert.match(packageSmoke, /if: matrix\.platform == 'linux'/u);
    assert.match(packageSmoke, /if: matrix\.platform == 'windows'/u);
    assert.match(packageSmoke, /artifactPlatform: linux/u);
    assert.match(packageSmoke, /artifactPlatform: win32/u);
  });

  it('validates transferred bindings before a token-minimal GitHub-native attestation job', async () => {
    const workflow = await readWorkspaceFile('.github', 'workflows', 'pr-checks.yml');
    const inputVerification = workflow.slice(
      workflow.indexOf('  package-attestation-input:'),
      workflow.indexOf('  package-attestation:'),
    );
    const attestation = workflow.slice(workflow.indexOf('  package-attestation:'), workflow.length);

    assert.match(workflow, /package-smoke:[\s\S]*?permissions:\n {6}contents: read/u);
    assert.match(
      workflow,
      /Upload exact attestation subjects[\s\S]*?gpt-voice-attestation-subjects-\$\{\{ matrix\.artifactPlatform \}\}/u,
    );
    assert.match(workflow, /Prepare digest-bound attestation subjects[\s\S]*?prepare:security:package-attestation/u);
    assert.match(inputVerification, /needs: package-smoke/u);
    assert.match(inputVerification, /verify:security:package-attestation/u);
    assert.doesNotMatch(inputVerification, /id-token: write|attestations: write/u);
    assert.match(attestation, /needs: package-attestation-input/u);
    assert.match(attestation, /attestations: write\n {6}contents: read\n {6}id-token: write/u);
    assert.match(attestation, /runs-on: \$\{\{ vars\.CI_LINUX_RUNNER \}\}/u);
    assert.match(attestation, /actions\/attest-build-provenance@[a-f\d]{40} # v3/u);
    assert.match(attestation, /attestation-subjects\/attestation-input\.json/u);
    assert.match(attestation, /attestation-subjects\/subject\/(?:package|checksum|sbom|scanner|smoke)/u);
    assert.match(
      attestation,
      /Verify GitHub-native attestations\n {8}shell: bash\n {8}env:\n {10}GH_TOKEN: \$\{\{ github\.token \}\}/u,
    );
    assert.match(attestation, /--signer-workflow/u);
    assert.match(attestation, /--source-digest/u);
    assert.doesNotMatch(attestation, /actions\/checkout|setup-ci-project|npm run/u);
  });

  it('scans and attests immutable candidate artifacts before exact private-candidate verification', async () => {
    const workflow = await readWorkspaceFile('.github', 'workflows', 'release-builds.yml');
    const attestation = workflow.slice(
      workflow.indexOf('  attest-release:'),
      workflow.indexOf('  verify-production-candidate:'),
    );
    const candidateVerification = workflow.slice(
      workflow.indexOf('  verify-production-candidate:'),
      workflow.indexOf('\n  publish:\n'),
    );
    const publication = workflow.slice(workflow.indexOf('\n  publish:\n') + 1);
    const signingAuthority = workflow.slice(
      workflow.indexOf('  verify-production-signing-authority:'),
      workflow.indexOf('  build-linux-runtimes:'),
    );
    const bundleSigning = workflow.slice(
      workflow.indexOf('  produce-production-bundles:'),
      workflow.indexOf('  build-linux:'),
    );
    const linuxRuntime = workflow.slice(
      workflow.indexOf('  build-linux-runtimes:'),
      workflow.indexOf('  build-windows-runtimes:'),
    );
    const windowsRuntime = workflow.slice(
      workflow.indexOf('  build-windows-runtimes:'),
      workflow.indexOf('  produce-production-bundles:'),
    );
    const linuxApplication = workflow.slice(workflow.indexOf('  build-linux:'), workflow.indexOf('  build-windows:'));
    const windowsApplication = workflow.slice(
      workflow.indexOf('  build-windows:'),
      workflow.indexOf('  verify-release-attestation-input:'),
    );

    assert.match(workflow, /Generate and scan exact Linux release security evidence/u);
    assert.match(workflow, /Generate and scan exact Windows release security evidence/u);
    assert.match(workflow, /verify-release-attestation-input:[\s\S]*verify:security:package-attestation/u);
    assert.match(attestation, /needs:\n {6}- verify-release-attestation-input/u);
    assert.match(attestation, /release-assets\/\*/u);
    assert.match(attestation, /runtime-assets\/\*\/\*\.tar\.gz/u);
    assert.match(attestation, /security-evidence\/\*/u);
    assert.match(attestation, /--signer-workflow "\$GH_REPO\/\.github\/workflows\/release-builds\.yml"/u);
    assert.match(candidateVerification, /- validate-production-inputs/u);
    assert.match(candidateVerification, /- produce-production-bundles/u);
    assert.match(candidateVerification, /- build-linux/u);
    assert.match(candidateVerification, /- build-windows/u);
    assert.match(candidateVerification, /- attest-release/u);
    assert.match(candidateVerification, /construct:local-whisper:production-candidate/u);
    assert.match(candidateVerification, /verify:local-whisper:production-candidate/u);
    assert.match(candidateVerification, /--target-kind="\$TARGET_KIND"/u);
    assert.match(candidateVerification, /--expected-target="\$CANDIDATE_TARGET"/u);
    assert.doesNotMatch(candidateVerification, /CI_LOCAL_WHISPER_PRODUCTION_CANDIDATE_/u);
    assert.match(candidateVerification, /gpt-voice-production-candidate/u);
    assert.doesNotMatch(candidateVerification, /gh release|contents: write|--clobber/u);
    assert.match(workflow, /build-linux:[\s\S]*environment: local-whisper-production/u);
    assert.match(workflow, /build-windows:[\s\S]*environment: local-whisper-production/u);
    assert.match(signingAuthority, /environment: local-whisper-production/u);
    assert.match(signingAuthority, /verify:local-whisper:production-signing-authority/u);
    assert.match(
      signingAuthority,
      /CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_PEM: \$\{\{ secrets\.CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_PEM \}\}/u,
    );
    assert.match(bundleSigning, /construct:local-whisper:production-bundle/u);
    assert.match(bundleSigning, /secrets\.CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_PEM/u);
    assert.match(candidateVerification, /secrets\.CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_PEM/u);
    assert.doesNotMatch(linuxRuntime, /secrets\.CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_PEM/u);
    assert.doesNotMatch(windowsRuntime, /secrets\.CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_PEM/u);
    assert.doesNotMatch(linuxApplication, /secrets\.CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_PEM/u);
    assert.doesNotMatch(windowsApplication, /secrets\.CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_PEM/u);
    assert.equal(workflow.match(/secrets\.CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_PEM/gu)?.length, 3);
    assert.match(candidateVerification, /environment: local-whisper-production/u);
    assert.match(workflow, /publish:\n {8}description:[\s\S]*default: false\n {8}type: boolean/u);
    assert.match(publication, /needs:\n {6}- verify-production-candidate/u);
    assert.match(publication, /if: \$\{\{ inputs\.publish == true \}\}/u);
    assert.match(publication, /permissions:\n {6}contents: write/u);
    assert.match(publication, /gpt-voice-production-candidate-descriptor/u);
    assert.match(publication, /verify:local-whisper:production-candidate/u);
    assert.match(publication, /--target-kind=release/u);
    assert.match(publication, /candidate_target/u);
    assert.match(publication, /gh api "repos\/\$GH_REPO\/git\/ref\/tags\/\$RELEASE_TAG"/u);
    assert.match(publication, /gh release view/u);
    assert.match(publication, /gh release create/u);
    assert.doesNotMatch(workflow, /github\.event\.release|--clobber/u);
  });
});
