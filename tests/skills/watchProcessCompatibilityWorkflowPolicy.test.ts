import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

const WORKSPACE_ROOT = process.cwd();
const WORKFLOW_PATH = path.join(WORKSPACE_ROOT, '.github', 'workflows', 'watch-process-compatibility.yml');
const QUALITY_WORKFLOW_PATH = path.join(WORKSPACE_ROOT, '.github', 'workflows', 'pr-checks.yml');
const LIBRARY_ROOT = path.join(WORKSPACE_ROOT, '.agents', 'skills', 'watch-process', 'scripts');
const CHECKOUT_ACTION = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1';
const SETUP_NODE_ACTION = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020';

type RecordValue = Record<string, unknown>;

function asArray(value: unknown, label: string): unknown[] {
  assert.equal(Array.isArray(value), true, `${label} must be an array`);
  return value as unknown[];
}

function asRecord(value: unknown, label: string): RecordValue {
  assert.equal(value !== null && typeof value === 'object' && !Array.isArray(value), true, `${label} must be a record`);
  return value as RecordValue;
}

function asText(value: unknown, label: string): string {
  assert.equal(typeof value, 'string', `${label} must be text`);
  return value as string;
}

function asInteger(value: unknown, label: string): number {
  assert.equal(typeof value === 'number' && Number.isInteger(value), true, `${label} must be an integer`);
  return value as number;
}

function jobSteps(job: RecordValue, label: string): RecordValue[] {
  return asArray(job.steps, `${label}.steps`).map((step, index) => asRecord(step, `${label}.steps[${index}]`));
}

function stepByName(job: RecordValue, name: string, label: string): RecordValue {
  const step = jobSteps(job, label).find((candidate) => candidate.name === name);
  assert.ok(step, `${label} must contain ${name}`);
  return step;
}

async function allModulePaths(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return allModulePaths(entryPath);
      return entry.isFile() && entry.name.endsWith('.mjs') ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

async function readWorkflow(pathname: string): Promise<RecordValue> {
  return asRecord(parse(await readFile(pathname, 'utf8')), pathname);
}

function job(workflow: RecordValue, name: string): RecordValue {
  return asRecord(asRecord(workflow.jobs, 'workflow.jobs')[name], `workflow.jobs.${name}`);
}

describe('watch-process compatibility workflow policy', () => {
  it('keeps the required cross-platform matrix separate from unchanged Quality Gates', async () => {
    const [workflow, qualityWorkflow] = await Promise.all([
      readWorkflow(WORKFLOW_PATH),
      readWorkflow(QUALITY_WORKFLOW_PATH),
    ]);
    const triggers = asRecord(workflow.on, 'workflow.on');
    const pullRequest = asRecord(triggers.pull_request, 'workflow.on.pull_request');
    const push = asRecord(triggers.push, 'workflow.on.push');
    const quality = job(qualityWorkflow, 'quality');

    assert.deepEqual(Object.keys(triggers).sort(), ['pull_request', 'push', 'workflow_dispatch']);
    assert.equal(Object.prototype.hasOwnProperty.call(pullRequest, 'paths'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(push, 'paths'), false);
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    assert.deepEqual(workflow.concurrency, {
      'cancel-in-progress': true,
      group: 'watch-process-compatibility-${{ github.workflow }}-${{ github.ref }}',
    });
    assert.equal(quality.name, 'Quality Gates');
    assert.deepEqual(quality.needs, ['quality-static', 'quality-tests', 'quality-codeql']);
  });

  it('uses validated Git scope classification and six direct no-install standalone cells', async () => {
    const workflow = await readWorkflow(WORKFLOW_PATH);
    const scope = job(workflow, 'scope');
    const compatibility = job(workflow, 'compatibility');
    const classify = stepByName(scope, 'Classify changed paths', 'scope');
    const scopeCheckout = stepByName(scope, 'Checkout', 'scope');
    const scopeNode = stepByName(scope, 'Set up Node.js', 'scope');
    const matrix = asRecord(asRecord(compatibility.strategy, 'compatibility.strategy').matrix, 'compatibility.matrix');
    const matrixSteps = jobSteps(compatibility, 'compatibility');
    const matrixNode = stepByName(compatibility, 'Set up Node.js', 'compatibility');
    const matrixCheckout = stepByName(compatibility, 'Checkout', 'compatibility');
    const testStep = stepByName(compatibility, 'Run standalone watch-process suite', 'compatibility');
    const matrixOs = asArray(matrix.os, 'compatibility.matrix.os').map((os, index) =>
      asText(os, `compatibility.matrix.os[${index}]`),
    );
    const matrixNodes = asArray(matrix.node, 'compatibility.matrix.node').map((node, index) =>
      asInteger(node, `compatibility.matrix.node[${index}]`),
    );
    const matrixCells = matrixOs.flatMap((os) => matrixNodes.map((node) => `${os}/${node}`));
    const classification = asText(classify.run, 'scope classify command');

    assert.equal(scope['runs-on'], 'ubuntu-latest');
    assert.equal(scope['timeout-minutes'], 10);
    assert.deepEqual(scope.outputs, { relevant: '${{ steps.classify.outputs.relevant }}' });
    assert.equal(scopeCheckout.uses, CHECKOUT_ACTION);
    assert.deepEqual(scopeCheckout.with, { 'fetch-depth': 0, 'persist-credentials': false });
    assert.equal(scopeNode.uses, SETUP_NODE_ACTION);
    assert.deepEqual(scopeNode.with, { 'node-version': '24' });
    assert.equal(classify.shell, 'bash');
    assert.match(classification, /\[\[ "\$1" =~ \^\[a-fA-F0-9\]\{40\}\$ \]\]/u);
    assert.match(classification, /git diff --name-only -z "\$base_sha" "\$head_sha" --/u);
    assert.match(classification, /git hash-object -t tree \/dev\/null/u);
    assert.match(classification, /git diff --name-only -z "\$empty_tree" "\$head_sha" --/u);
    assert.doesNotMatch(classification, /dorny\/paths-filter|tj-actions\/changed-files/u);

    assert.deepEqual(compatibility.needs, 'scope');
    assert.equal(compatibility.if, "${{ needs.scope.outputs.relevant == 'true' }}");
    assert.equal(compatibility['runs-on'], '${{ matrix.os }}');
    assert.equal(compatibility['timeout-minutes'], 15);
    assert.equal(asRecord(compatibility.strategy, 'compatibility.strategy')['fail-fast'], false);
    assert.deepEqual(matrixOs, ['ubuntu-latest', 'windows-latest', 'macos-latest']);
    assert.deepEqual(matrixNodes, [22, 24]);
    assert.equal(matrixCells.length, 6);
    assert.equal(new Set(matrixCells).size, 6);
    assert.equal(matrixCheckout.uses, CHECKOUT_ACTION);
    assert.deepEqual(matrixCheckout.with, { 'persist-credentials': false });
    assert.equal(matrixNode.uses, SETUP_NODE_ACTION);
    assert.deepEqual(matrixNode.with, { 'node-version': '${{ matrix.node }}' });
    assert.equal(testStep.run, 'node --test tests/skills/watchProcess/suite.test.mjs');
    assert.equal(JSON.stringify(matrixSteps).includes('npm ci'), false);
    assert.equal(JSON.stringify(matrixSteps).includes('npm install'), false);
  });

  it('fails closed for scope or matrix failure while allowing only a classifier-proven irrelevant skip', async () => {
    const workflow = await readWorkflow(WORKFLOW_PATH);
    const aggregate = job(workflow, 'aggregate');
    const command = asText(
      stepByName(aggregate, 'Require every relevant compatibility lane', 'aggregate').run,
      'aggregate command',
    );

    assert.equal(aggregate.name, 'Watch Process Compatibility');
    assert.equal(aggregate.if, '${{ always() }}');
    assert.deepEqual(aggregate.needs, ['scope', 'compatibility']);
    assert.equal(aggregate['runs-on'], 'ubuntu-latest');
    assert.equal(aggregate['timeout-minutes'], 5);
    assert.deepEqual(aggregate.env, {
      MATRIX_RESULT: '${{ needs.compatibility.result }}',
      SCOPE_RESULT: '${{ needs.scope.result }}',
      WATCH_PROCESS_RELEVANT: '${{ needs.scope.outputs.relevant }}',
    });
    assert.match(command, /\[\[ "\$SCOPE_RESULT" != 'success' \]\]/u);
    assert.match(command, /\[\[ "\$WATCH_PROCESS_RELEVANT" == 'false' \]\]/u);
    assert.match(command, /\[\[ "\$WATCH_PROCESS_RELEVANT" != 'true' \|\| "\$MATRIX_RESULT" != 'success' \]\]/u);
  });

  it('keeps dedicated GitLab artifacts absent and every watch-process child-process boundary shell-free', async () => {
    const modulePaths = await allModulePaths(LIBRARY_ROOT);
    const sources = await Promise.all(
      modulePaths.map(async (modulePath) => ({ modulePath, source: await readFile(modulePath, 'utf8') })),
    );
    const childProcessSources = sources.filter(({ source }) => source.includes('node:child_process'));

    assert.deepEqual(
      childProcessSources
        .map(({ modulePath }) => path.relative(LIBRARY_ROOT, modulePath).split(path.sep).join('/'))
        .sort(),
      ['lib/generated-watcher-artifact.mjs', 'lib/generated-watcher-launcher.mjs', 'lib/managed-process-runner.mjs'],
    );
    for (const { source } of sources) {
      assert.doesNotMatch(source, /(?:GitLabCiProcessAdapter|gitlab|\bglab\b)/iu);
    }
    for (const { source } of childProcessSources) {
      assert.match(source, /shell:\s*false/u);
      assert.doesNotMatch(source, /\b(?:exec|execSync|fork|spawnSync)\s*\(/u);
    }
  });
});
