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

  it('documents the integrated performance, compatibility, and rollback contracts without raw evidence', () => {
    const user = read('docs/local-whisper.md');
    const maintainer = read('docs/specs/local-whisper-performance-remediation/maintainer-integration-contract.md');

    for (const expected of [
      'GPU CPU threads',
      '`auto` resolves to the current sanitized logical-processor',
      'active GPU configuration receives 4 GPU CPU threads',
      '`SETTINGS_VERSION_UNSUPPORTED`',
      'compatible version-1 backup',
      'host, selected CPU',
      'cold and warm states',
      'separate, confirmed action.',
    ]) {
      assert.equal(user.includes(expected), true, expected);
    }

    for (const expected of [
      'Protocol 2',
      'Worker protocol 1',
      'Document 2 and nested settings 2',
      '262,144 - 4,096 - 70 = 257,978 bytes',
      '193,483 bytes',
      'excludes the terminating',
      'Candidate in-flight windows are exactly 1, 2, 4, and 8',
      '32 MiB aggregate owned-byte',
      'Packet 15 alone selects',
      'median of paired percentages',
      'absolute deviation',
      'use the scalar transform',
      'windows-x64-cpu-msvc-19.51-v1',
      'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1',
      'Native log schema 1',
      'maximum 4,096 bytes including',
      'Linux x64 CPU/CUDA',
      'Packet 14 must run',
      'invoke artifact removal',
      'Direct Windows proof of',
    ]) {
      assert.equal(maintainer.includes(expected), true, expected);
    }

    for (const prohibited of ['raw qualification inputs', 'private hardware identifiers']) {
      assert.equal(maintainer.includes(prohibited), false, prohibited);
    }
  });
});
