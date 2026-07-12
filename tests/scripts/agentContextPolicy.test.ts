import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const AGENTS_PATH = path.join(PROJECT_ROOT, 'AGENTS.md');
const SKILLS_DIRECTORY = path.join(PROJECT_ROOT, '.agents/skills');
const PLUGIN_PATH = path.join(PROJECT_ROOT, '.agents/plugin.json');
const REMOVED_SKILLS = [
  'api-and-interface-design',
  'browser-testing-with-devtools',
  'ci-cd-and-automation',
  'debugging-and-error-recovery',
  'deprecation-and-migration',
  'frontend-ui-engineering',
  'git-workflow-and-versioning',
  'observability-and-instrumentation',
  'shipping-and-launch',
  'source-driven-development',
  'test-driven-development',
  'using-agent-skills',
];
const REMOVED_REFERENCES = ['observability-checklist.md', 'testing-patterns.md'];

function skillNames(): string[] {
  return readdirSync(SKILLS_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function skillDescriptions(): string[] {
  return skillNames()
    .map((skillName) => readFileSync(path.join(SKILLS_DIRECTORY, skillName, 'SKILL.md'), 'utf8'))
    .map((skill) => {
      const lines = skill.split('\n');
      const descriptionLine = lines.findIndex((line) => line.startsWith('description:'));

      if (descriptionLine < 0) {
        return '';
      }

      const inlineDescription = lines[descriptionLine]?.replace(/^description:\s*/u, '').trim();
      if (inlineDescription && inlineDescription !== '>-') {
        return inlineDescription;
      }

      return (
        lines
          .slice(descriptionLine + 1)
          .find((line) => line.startsWith('  '))
          ?.trim() || ''
      );
    });
}

describe('agent context policy', () => {
  it('keeps the always-on router compact and defers detailed conventions', () => {
    const router = readFileSync(AGENTS_PATH, 'utf8');

    assert.ok(router.split('\n').length <= 80);
    assert.match(router, /Read the full text of a selected skill only after selection/u);
    assert.match(router, /at most one primary skill/u);
    assert.doesNotMatch(router, /Common Rationalizations|Daily Commands|Typical skill sequence/u);
  });

  it('keeps every remaining catalog trigger narrow', () => {
    assert.ok(skillDescriptions().every((description) => /^Use only /u.test(description)));
  });

  it('keeps the user-selected skills and their dedicated references removed', () => {
    const availableSkillNames = skillNames();

    for (const skillName of REMOVED_SKILLS) {
      assert.equal(availableSkillNames.includes(skillName), false, `${skillName} must remain removed`);
    }

    for (const referenceName of REMOVED_REFERENCES) {
      assert.equal(existsSync(path.join(PROJECT_ROOT, '.agents/references', referenceName)), false);
    }
  });

  it('keeps personas explicit and does not advertise lifecycle activation', () => {
    const plugin = readFileSync(PLUGIN_PATH, 'utf8');

    assert.match(plugin, /On-demand engineering skills/u);
    assert.doesNotMatch(plugin, /full software development lifecycle from spec to ship/u);
  });
});
