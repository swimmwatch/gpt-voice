import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as path from 'node:path';

const WORKSPACE_PATH = path.resolve(__dirname, '../..');
const SKILL_PATH = path.join(WORKSPACE_PATH, '.agents/skills/watch-process');
const SKILL_INSTRUCTIONS_PATH = path.join(SKILL_PATH, 'SKILL.md');
const SKILL_METADATA_PATH = path.join(SKILL_PATH, 'agents/openai.yaml');
const RUNTIME_IGNORE_ENTRY = '.codex/runtime/process-watch/';
const RUNTIME_ROOT = path.join(WORKSPACE_PATH, '.codex/runtime/process-watch');
const SCENARIOS_ROOT = path.join(WORKSPACE_PATH, '.codex/process-watch/scenarios');
const HOOKS_PATH = path.join(WORKSPACE_PATH, '.codex/hooks.json');

function readText(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

function normalizeText(value: string): string {
  return value.replace(/\s+/gu, ' ').toLowerCase();
}

function assertContainsEvery(haystack: string, values: readonly string[]): void {
  for (const value of values) assert.equal(haystack.includes(value), true, value);
}

describe('watch-process skill surface', () => {
  it('publishes one explicit, repository-neutral skill with safe metadata', () => {
    const skill = readText(SKILL_INSTRUCTIONS_PATH);
    const metadata = readText(SKILL_METADATA_PATH);
    const normalizedSkill = normalizeText(skill);

    assert.match(skill, /^name: watch-process$/mu);
    assert.match(skill, /^description: Use only /mu);
    assertContainsEvery(normalizedSkill, [
      'explicitly invokes `$watch-process`',
      'not a general status watcher',
      'a global daemon',
      'exactly one logical target',
      'does not override codex sandbox, approval, hook-trust, repository, branch-protection',
      'repository-neutral entry point',
    ]);
    assert.match(metadata, /display_name:\s+['"]Watch Process['"]/u);
    assert.equal(metadata.includes('$watch-process'), true);
    assert.doesNotMatch(metadata, /(?:permission|credential|token|secret)/iu);
  });

  it('requires an explicit finite timeout and exposes only the declared lifecycle commands', () => {
    const normalizedSkill = normalizeText(readText(SKILL_INSTRUCTIONS_PATH));

    assertContainsEvery(normalizedSkill, [
      '$watch-process scenario=<scenario-id> target=<validated-selector>',
      '$watch-process scenario=<scenario-id>',
      '$watch-process status',
      '$watch-process resume',
      '$watch-process cancel',
      "ask in the user's language for a finite timeout",
      'prevents indefinite waiting',
      'expected process duration plus a practical margin',
      'about 40 minutes',
      'normally takes 30 minutes',
      'there is no default timeout',
      'status` is read-only',
      'resume` requires the timeout decision again',
      'does not imply remote target cancellation',
    ]);
  });

  it('keeps Goal state and inactive process signals outside watch authority', () => {
    const normalizedSkill = normalizeText(readText(SKILL_INSTRUCTIONS_PATH));

    assertContainsEvery(normalizedSkill, [
      'a discussion of ci, a process result, a state file, a hook event, a notification, or a codex goal does not activate it',
      'codex goal is optional, user-owned ux',
      'never inspect, create, replace, clear, or complete a goal',
      'goal state neither authorizes nor blocks a watch request',
      'never copy natural-language input into a command, path, environment variable, or process argument',
    ]);
  });

  it('keeps the runtime private while leaving tracked scenario and future-library roots available', () => {
    const ignoredEntries = readText(path.join(WORKSPACE_PATH, '.gitignore')).split(/\r?\n/u);

    assert.equal(ignoredEntries.includes(RUNTIME_IGNORE_ENTRY), true);
    assert.equal(ignoredEntries.includes('.codex/'), false);
    assert.equal(ignoredEntries.includes('.codex/process-watch/'), false);
    assert.equal(existsSync(path.join(SKILL_PATH, 'scripts/lib/.gitkeep')), true);
    assert.equal(existsSync(path.join(SKILL_PATH, 'references/.gitkeep')), true);
    assert.equal(existsSync(path.join(SCENARIOS_ROOT, '.gitkeep')), true);
    assert.equal(existsSync(RUNTIME_ROOT), false);
  });

  it('keeps explicit invocation separate from the trusted project hook and GitLab-specific behavior', () => {
    const activeSurface = [readText(SKILL_INSTRUCTIONS_PATH), readText(SKILL_METADATA_PATH)].join('\n');

    assert.equal(existsSync(HOOKS_PATH), true);
    assert.equal(existsSync(path.join(SKILL_PATH, 'scripts/process-watch-stop-hook.mjs')), true);
    assert.doesNotMatch(activeSurface, /GitLabCiProcessAdapter|\bglab\b/iu);
    assertContainsEvery(normalizeText(activeSurface), [
      'does not override codex sandbox, approval, hook-trust',
      'change user-level configuration',
      'start a target',
      'execute a scenario command',
      'add a dependency',
    ]);
  });
});
