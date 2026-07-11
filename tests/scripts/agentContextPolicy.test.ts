import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const AGENTS_PATH = path.join(PROJECT_ROOT, 'AGENTS.md');
const SKILLS_DIRECTORY = path.join(PROJECT_ROOT, '.agents/skills');
const USING_SKILLS_PATH = path.join(SKILLS_DIRECTORY, 'using-agent-skills/SKILL.md');
const PLUGIN_PATH = path.join(PROJECT_ROOT, '.agents/plugin.json');

function skillDescriptions(): string[] {
  return readdirSync(SKILLS_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readFileSync(path.join(SKILLS_DIRECTORY, entry.name, 'SKILL.md'), 'utf8'))
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

  it('keeps skill discovery on demand and every catalog trigger narrow', () => {
    const usingSkills = readFileSync(USING_SKILLS_PATH, 'utf8');

    assert.doesNotMatch(usingSkills, /Use when starting a session|Lifecycle Sequence/u);
    assert.match(usingSkills, /Do not read any `SKILL\.md` while deciding/u);
    assert.ok(skillDescriptions().every((description) => /^Use only /u.test(description)));
  });

  it('keeps personas explicit and does not advertise lifecycle activation', () => {
    const plugin = readFileSync(PLUGIN_PATH, 'utf8');

    assert.match(plugin, /On-demand engineering skills/u);
    assert.doesNotMatch(plugin, /full software development lifecycle from spec to ship/u);
  });
});
