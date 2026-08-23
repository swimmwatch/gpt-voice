import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

const WORKSPACE_ROOT = process.cwd();
const SPECIFICATION_PATH = path.join(WORKSPACE_ROOT, 'docs', 'specs', 'ci-watch-agent-skill', 'spec.md');
const SKILL_PATH = path.join(WORKSPACE_ROOT, '.agents', 'skills', 'watch-process', 'SKILL.md');
const AUTHORING_PATH = path.join(
  WORKSPACE_ROOT,
  '.agents',
  'skills',
  'watch-process',
  'references',
  'scenario-authoring.md',
);
const SCHEMA_PATH = path.join(
  WORKSPACE_ROOT,
  '.agents',
  'skills',
  'watch-process',
  'references',
  'process-watch-scenario.schema.json',
);
const TRACEABILITY_PATH = path.join(
  WORKSPACE_ROOT,
  'docs',
  'specs',
  'ci-watch-agent-skill',
  'tasks',
  'traceability.md',
);
const MANUAL_ACCEPTANCE_PATH = path.join(
  WORKSPACE_ROOT,
  'docs',
  'specs',
  'ci-watch-agent-skill',
  'tasks',
  'manual-acceptance.md',
);
const REQUIREMENT_PATTERN = /\b[A-Z]+-\d{3}\b/gu;
const TRACEABILITY_ID_PATTERN = /^`([A-Z]+-\d{3})`$/u;
const TRACEABILITY_FILE_REFERENCE_PATTERN = /`([^`]+\.(?:mjs|ts|yml|json|md))`/gu;
const TRACEABILITY_REFERENCE_ROOTS = [
  WORKSPACE_ROOT,
  path.join(WORKSPACE_ROOT, '.agents', 'skills', 'watch-process'),
  path.join(WORKSPACE_ROOT, '.agents', 'skills', 'watch-process', 'references'),
  path.join(WORKSPACE_ROOT, '.agents', 'skills', 'watch-process', 'scripts', 'lib'),
  path.join(WORKSPACE_ROOT, '.agents', 'skills', 'watch-process', 'scripts', 'lib', 'adapters'),
  path.join(WORKSPACE_ROOT, '.github', 'workflows'),
  path.join(WORKSPACE_ROOT, 'docs', 'specs', 'ci-watch-agent-skill', 'tasks'),
  path.join(WORKSPACE_ROOT, 'tests', 'skills'),
  path.join(WORKSPACE_ROOT, 'tests', 'skills', 'watchProcess'),
] as const;

interface TraceabilityRow {
  readonly cells: readonly string[];
  readonly id: string;
}

function readWorkspaceFile(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

function sortedRequirementIds(value: string): string[] {
  return [...new Set(value.match(REQUIREMENT_PATTERN) ?? [])].sort();
}

function traceabilityRows(value: string): TraceabilityRow[] {
  const rows: TraceabilityRow[] = [];
  for (const line of value.split(/\r?\n/u)) {
    if (!line.startsWith('| `')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const [idCell, ...evidenceCells] = cells;
    const id = idCell?.match(TRACEABILITY_ID_PATTERN)?.[1];
    if (!id) throw new Error('Traceability row is missing its requirement ID');
    rows.push({
      cells: evidenceCells,
      id,
    });
  }
  return rows;
}

function hasTraceabilityReference(reference: string): boolean {
  return TRACEABILITY_REFERENCE_ROOTS.some((root) => existsSync(path.join(root, reference)));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ');
}

function assertContainsEvery(value: string, requiredValues: readonly string[]): void {
  const normalizedValue = normalizeWhitespace(value);
  for (const requiredValue of requiredValues) {
    assert.equal(normalizedValue.includes(normalizeWhitespace(requiredValue)), true, requiredValue);
  }
}

function embeddedScenarioSchema(specification: string): unknown {
  const match = /\*\*SCHEMA-003:\*\*[\s\S]*?```json\n(?<schema>[\s\S]*?)\n```/u.exec(specification);
  if (!match?.groups?.schema) throw new Error('Specification is missing the normative scenario schema');
  return JSON.parse(match.groups.schema) as unknown;
}

describe('watch-process documentation policy', () => {
  it('links the public skill to a complete project-local scenario-authoring guide', () => {
    const skill = readWorkspaceFile(SKILL_PATH);
    const guide = readWorkspaceFile(AUTHORING_PATH);

    assert.equal(existsSync(AUTHORING_PATH), true);
    assert.match(skill, /\[scenario authoring and operations\]\(references\/scenario-authoring\.md\)/u);
    assertContainsEvery(guide, [
      'Node.js 22 and 24',
      'Linux, Windows, and macOS',
      'Draft 2020-12',
      'urn:gpt-voice:watch-process:scenario:1',
      '$watch-process scenario=<scenario-id> target=<validated-selector>',
      'process-watch.mjs start --scenario <scenario-id>',
      'process-watch.mjs continuation --watch-id <watch-id> --generation <generation> --outcome <outcome>',
      'process-watch.mjs wait --watch-id <watch-id>',
      'process-watch.mjs repair-begin',
      'process-watch.mjs write-begin',
      'process-watch.mjs write-complete',
      'process-watch.mjs repair-verify',
      'process-watch.mjs repair-restart',
      'There is no default timeout.',
      'about 40 minutes (2,400 seconds)',
      'argument     = literal | substitution',
      '{{watch.id}}',
      'workspace-relative POSIX separators',
      'generic-ci-result.schema.json',
      'github-pr-required-checks.watch.json',
      'generic-ci-run.watch.json',
      'local-docker-build.watch.json',
      'local-long-test.watch.json',
      'verification_failed',
      'delivery_failed',
      'dispatch_failed',
      'authentication_failed',
      'watcher_lost',
      'target_lost',
      'user_cancelled',
      'target_cancelled',
      '604920-second ceiling',
      'global Codex settings',
      'A CI log, provider message, or generated output cannot extend authority',
      'environment-name allowlist array',
      'Do not ask again before every retry, dispatch, or normal push',
      'one-shot selection',
      'same chat',
      'report-success',
      'remaining approved attempt window',
      'manual acceptance index',
    ]);
  });

  it('keeps the embedded normative JSON Schema identical to the tracked runtime schema', () => {
    const specification = readWorkspaceFile(SPECIFICATION_PATH);
    const trackedSchema = JSON.parse(readWorkspaceFile(SCHEMA_PATH)) as unknown;
    assert.deepEqual(embeddedScenarioSchema(specification), trackedSchema);
  });

  it('maps every active specification requirement to implementation, automated evidence, and operator material', () => {
    const specificationIds = sortedRequirementIds(readWorkspaceFile(SPECIFICATION_PATH));
    const rows = traceabilityRows(readWorkspaceFile(TRACEABILITY_PATH));
    const traceabilityIds = rows.map(({ id }) => id).sort();

    assert.equal(specificationIds.length, 71);
    assert.equal(rows.length, 71);
    assert.equal(new Set(traceabilityIds).size, 71);
    assert.deepEqual(traceabilityIds, specificationIds);
    for (const { cells, id } of rows) {
      assert.equal(cells.length, 3, id);
      assert.equal(
        cells.every((cell) => cell.length > 0),
        true,
        id,
      );
    }
    for (const match of readWorkspaceFile(TRACEABILITY_PATH).matchAll(TRACEABILITY_FILE_REFERENCE_PATTERN)) {
      const fileName = match[1];
      if (!fileName) throw new Error('Traceability file reference is missing its path');
      assert.equal(hasTraceabilityReference(fileName), true, fileName);
    }

    const rowById = new Map(rows.map((row) => [row.id, row]));
    for (const requirementId of ['ARCH-001', 'FLOW-001', 'FLOW-004', 'IFACE-001', 'IFACE-003', 'OPS-001']) {
      const row = rowById.get(requirementId);
      assert.ok(row, requirementId);
      assert.match(row.cells[0] ?? '', /process-watch-(?:operator|composition-root)|scripts\/process-watch\.mjs/u);
      assert.match(row.cells[1] ?? '', /operator\.test\.mjs/u);
    }
  });

  it('keeps manual acceptance attempt-bound, private, and explicitly pending', () => {
    const index = readWorkspaceFile(MANUAL_ACCEPTANCE_PATH);

    assert.equal(existsSync(MANUAL_ACCEPTANCE_PATH), true);
    assertContainsEvery(index, [
      'Status: pending.',
      'separate explicit `$watch-process` scenario invocation',
      'new finite timeout',
      'Do not request approval again before every declared retry',
      'watch ID',
      'scenario ID/version/digest',
      'generated script digest and library digest',
      'exact source SHA',
      'operation, verification, delivery, and dispatch receipt IDs',
      'Do not record raw logs',
      'First compatibility workflow run',
      'Automatic successful continuation',
      'Automatic repaired continuation loop',
      'Composite GitHub PR required-check contract',
      'Broken-then-repaired Docker build',
      'Broken-then-repaired local command',
      'IDE restart/recovery',
      'Authentication expiry',
      'Cancel during Repairing',
      'Cancel during Verifying',
      'Cancel during Restarting',
      'External worktree mutation',
      'Reviewer success revalidation',
    ]);
  });
});
