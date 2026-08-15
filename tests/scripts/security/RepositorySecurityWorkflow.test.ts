import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

import { TRIVY_IMAGE } from '@scripts/security/dockerBuilderPolicy';

const workspaceRoot = process.cwd();

async function readWorkspaceFile(...segments: string[]): Promise<string> {
  return readFile(path.join(workspaceRoot, ...segments), 'utf8');
}

describe('Repository security workflow', () => {
  it('verifies registry signatures before any dependency lifecycle scripts', async () => {
    const setupAction = await readWorkspaceFile('.github', 'actions', 'setup-ci-project', 'action.yml');
    const signatureGate = setupAction.indexOf('verify-npm-signatures-preinstall.mjs');
    const installation = setupAction.indexOf('npm run ci:install');
    assert.ok(signatureGate >= 0 && installation > signatureGate);

    const releaseWorkflow = await readWorkspaceFile('.github', 'workflows', 'release-builds.yml');
    const baselineGate = releaseWorkflow.indexOf(
      'node scripts/security/verify-npm-signatures-preinstall.mjs --workspace=.size-baseline',
    );
    const baselineInstall = releaseWorkflow.indexOf('npm run ci:install', baselineGate);
    assert.ok(baselineGate >= 0 && baselineInstall > baselineGate);

    const fedoraEntrypoint = await readWorkspaceFile('build', 'fedora-release', 'fedora-release-entrypoint.mjs');
    assert.ok(
      fedoraEntrypoint.indexOf('verify-npm-signatures-preinstall.mjs') < fedoraEntrypoint.indexOf("'ci:install'"),
    );
  });

  it('runs every repository-control gate with immutable inputs', async () => {
    const workflow = await readWorkspaceFile('.github', 'workflows', 'repository-security.yml');
    for (const command of [
      'npm run audit:prod',
      'npm run test:security:dependency-policy',
      'npm run test:security:npm-signatures',
      'npm run test:security:secret-policy',
      'npm run test:security:docker-policy',
      'npm run test:security:repository-gates',
      'npm run test:security:evidence-policy',
      'npm run test:security:aggregate-gates',
    ]) {
      assert.equal(workflow.includes(command), true, command);
    }
    assert.match(workflow, /actions\/checkout@[a-f\d]{40}\s+# v7/u);
    assert.match(workflow, /actions\/upload-artifact@[a-f\d]{40}\s+# v7/u);
    assert.match(
      await readWorkspaceFile('scripts', 'security', 'dockerBuilderPolicy.ts'),
      new RegExp(TRIVY_IMAGE, 'u'),
    );
  });

  it('uses Dependency Review only for supported npm manifest and lockfile changes', async () => {
    const workflow = parse(await readWorkspaceFile('.github', 'workflows', 'dependency-review.yml')) as {
      jobs?: Record<string, unknown>;
      on?: { pull_request?: { paths?: unknown } };
    };
    assert.deepEqual(workflow.on?.pull_request?.paths, ['package.json', 'package-lock.json']);
    assert.deepEqual(workflow.jobs?.['dependency-review'], {
      name: 'Dependency Review (npm)',
      'runs-on': '${{ vars.CI_LINUX_RUNNER }}',
      'timeout-minutes': 10,
      steps: [
        {
          name: 'Review supported npm dependency changes',
          uses: 'actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294',
          with: { 'fail-on-severity': 'high' },
        },
      ],
    });
  });

  it('assigns weekly Docker monitoring to the reviewed Fedora Dockerfile without automatic acceptance', async () => {
    const dependabot = parse(await readWorkspaceFile('.github', 'dependabot.yml')) as {
      updates?: unknown[];
    };
    const docker = dependabot.updates?.find(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        (entry as { 'package-ecosystem'?: unknown })['package-ecosystem'] === 'docker',
    ) as Record<string, unknown> | undefined;
    assert.deepEqual(docker?.directory, '/build/fedora-release');
    assert.deepEqual(docker?.schedule, { day: 'monday', interval: 'weekly', time: '07:00', timezone: 'Etc/UTC' });
    assert.equal(docker?.['open-pull-requests-limit'], 1);
    assert.equal('allow' in (docker ?? {}), false);
  });
});
