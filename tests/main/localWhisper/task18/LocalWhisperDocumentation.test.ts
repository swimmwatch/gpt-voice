import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('Local Whisper user, operator, developer, and analyzer documentation', () => {
  it('documents every model family estimate, lifecycle, privacy boundary, and honest platform gate', () => {
    const documentation = read('docs/local-whisper.md');
    for (const [family, pattern] of [
      ['Tiny', /\|\s*Tiny\s*\|\s*1–2 GiB\s*\|\s*2–4 GiB\s*\|/u],
      ['Base', /\|\s*Base\s*\|\s*1–2 GiB\s*\|\s*2–4 GiB\s*\|/u],
      ['Small', /\|\s*Small\s*\|\s*2–3 GiB\s*\|\s*4–6 GiB\s*\|/u],
      ['Medium', /\|\s*Medium\s*\|\s*3–6 GiB\s*\|\s*6–10 GiB\s*\|/u],
      ['Large-v3', /\|\s*Large-v3\s*\|\s*6–8 GiB\s*\|\s*10–16 GiB\s*\|/u],
      ['Large-v3-turbo', /\|\s*Large-v3-turbo\s*\|\s*3–6 GiB\s*\|\s*6–10 GiB\s*\|/u],
    ] as const) {
      assert.match(documentation, pattern, `${family} memory guidance`);
    }
    for (const expected of [
      'Preview · Untested',
      'Planned · Unavailable',
      'zero inference-network requests',
      'copied to the clipboard',
      'local transcription history',
      'short-lived in-memory cache',
      'Load now',
      '`Unload`',
      'Repository fixtures model that preceding registry/chooser contract, but they',
      'not real-binary evidence',
    ]) {
      assert.equal(documentation.includes(expected), true, expected);
    }
  });

  it('keeps native architecture, generated assets, source locks, and no-fallback rules explicit', () => {
    const runtime = read('runtime/local-whisper/README.md');
    for (const expected of [
      'C++20',
      '`common/`',
      '`fs-guard/`',
      '`launcher/`',
      '`whisper-cpp/`',
      '`sources/` and `toolchains/`',
      'Generated source objects',
      'path-free inherited model authority',
      'no mutable global runtime state',
      'CPU fallback',
    ]) {
      assert.equal(runtime.includes(expected), true, expected);
    }
  });

  it('keeps schema-v1/v2 analyzer guidance and qualification blockers aligned', () => {
    const analyzer = read('.agents/skills/analyze-diagnostics-archive/references/archive-schema.md');
    const skill = read('.agents/skills/analyze-diagnostics-archive/SKILL.md');
    const qualification = read('docs/specs/local-whisper/qualification/task19-evidence-template.md');
    assert.equal(analyzer.includes('local-whisper/snapshot.json'), true);
    assert.equal(analyzer.includes('65,536 bytes'), true);
    assert.equal(skill.includes('`absent`, `valid`, or `invalid`'), true);
    assert.equal(qualification.includes('Exact immediately preceding packaged binary'), true);
    assert.equal(qualification.includes('Representative Windows'), true);
    assert.equal(qualification.includes('AMD remains Preview · Untested'), true);
  });
});
