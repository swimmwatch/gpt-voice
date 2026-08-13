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
      /package-smoke:\n {4}name: Package Smoke \(\$\{\{ matrix\.checkName \}\}\)\n {4}needs: quality/u,
    );
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
});
