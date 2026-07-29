import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import be from '@main/i18n/be';
import de from '@main/i18n/de';
import en from '@main/i18n/en';
import es from '@main/i18n/es';
import fr from '@main/i18n/fr';
import hi from '@main/i18n/hi';
import ja from '@main/i18n/ja';
import ptBr from '@main/i18n/pt-BR';
import ru from '@main/i18n/ru';
import uk from '@main/i18n/uk';
import zh from '@main/i18n/zh';
import { APP_LOCALE_IDS } from '@shared/appLocale';

const WORKSPACE_PATH = path.resolve(__dirname, '../..');
const ANALYSIS_SKILL_PATH = path.join(WORKSPACE_PATH, '.agents/skills/analyze-diagnostics-archive/SKILL.md');
const ARCHIVE_SCHEMA_PATH = path.join(
  WORKSPACE_PATH,
  '.agents/skills/analyze-diagnostics-archive/references/archive-schema.md',
);
const README_PATH = path.join(WORKSPACE_PATH, 'README.md');
const SECURITY_PATH = path.join(WORKSPACE_PATH, 'SECURITY.md');
const PROVIDER_AUDIT_HANDOFF_RELATIVE_PATH = 'docs/specs/provider-audit-logging/tasks/handoff.md';
const PROVIDER_AUDIT_TODO_RELATIVE_PATH = 'docs/specs/provider-audit-logging/tasks/todo.md';
const TASK_23_COMMIT = '89e8e833';
const TASK_23_SUBJECT = 'docs(diagnostics): complete integration gate';
const PRODUCER_LIMITS = ['64 MiB', '128 MiB', '8 MiB', '100,000', '1 MiB', '130 MiB', '1000:1'] as const;
const TRANSLATIONS_BY_LOCALE = {
  be,
  de,
  en,
  es,
  fr,
  hi,
  ja,
  'pt-BR': ptBr,
  ru,
  uk,
  zh,
} as const;
const CANONICAL_ADVISORY_ROW =
  '| `GHSA-r292-9mhp-454m` | `cloakbrowser@0.5.2 -> tar@7.5.19` | moderate | ' +
  'Uncontrolled recursion and uncatchable stack-overflow denial of service for crafted long-path tar member ' +
  'selection. | No compatible CloakBrowser resolution has been validated; a forced transitive override can break ' +
  'its archive/runtime behavior. | `cloakbrowser` | `2026-07-29` | Any CloakBrowser or lockfile change, advisory ' +
  'update, or compatible upstream fix. |';

interface RepositoryHistoryReader {
  isTracked(relativePath: string): boolean;
  readCommitPaths(commit: string): readonly string[];
  readCommitSubject(commit: string): string;
}

class GitRepositoryHistoryReader implements RepositoryHistoryReader {
  public constructor(private readonly workspacePath: string) {}

  public isTracked(relativePath: string): boolean {
    return this.run(['ls-files', '--error-unmatch', '--', relativePath], true) !== null;
  }

  public readCommitPaths(commit: string): readonly string[] {
    return this.requireOutput(['show', '--format=', '--name-only', commit]).split(/\r?\n/u).filter(Boolean);
  }

  public readCommitSubject(commit: string): string {
    return this.requireOutput(['show', '-s', '--format=%s', commit]);
  }

  private requireOutput(args: readonly string[]): string {
    const output = this.run(args, false);
    assert.notEqual(output, null, 'required repository history is unavailable');
    return output ?? '';
  }

  private run(args: readonly string[], allowFailure: boolean): string | null {
    const result = spawnSync('git', args, {
      cwd: this.workspacePath,
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.status !== 0) {
      assert.equal(allowFailure, true, 'required repository history is unavailable');
      return null;
    }
    return result.stdout.trim();
  }
}

function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function normalizeText(value: string): string {
  return value.replace(/\s+/gu, ' ').toLowerCase();
}

function getPlaceholders(message: string): readonly string[] {
  return Array.from(message.matchAll(/\{([a-z][a-zA-Z0-9]*)\}/gu), (match) => match[1]).sort();
}

function assertContainsEvery(source: string, expectedValues: readonly string[]): void {
  for (const expected of expectedValues) assert.equal(source.includes(expected), true, expected);
}

describe('current branch remediation documentation contract', () => {
  it('keeps every active archive guide aligned with the exact producer envelope', () => {
    const activeArchiveGuides = [
      readText(ANALYSIS_SKILL_PATH),
      readText(ARCHIVE_SCHEMA_PATH),
      readText(README_PATH),
      readText(SECURITY_PATH),
    ];

    for (const guide of activeArchiveGuides) assertContainsEvery(guide, PRODUCER_LIMITS);

    assertContainsEvery(normalizeText(activeArchiveGuides.join('\n')), [
      'app-owned schema-v1',
      'zip',
      'tar.gz',
      '64 mib per member',
      '128 mib total uncompressed payload',
      '8 mib per jsonl line',
      'excluding its terminator',
      '100,000 records per jsonl member',
      '1 mib of archive structure',
      '130 mib outer archive',
      '1000:1',
    ]);
  });

  it('keeps analysis instruction-only and preserves private-report residual risks', () => {
    const skill = normalizeText(readText(ANALYSIS_SKILL_PATH));
    const schema = normalizeText(readText(ARCHIVE_SCHEMA_PATH));
    const publicGuidance = normalizeText([readText(README_PATH), readText(SECURITY_PATH)].join('\n'));
    const activeGuidance = [skill, schema, publicGuidance].join('\n');

    assertContainsEvery(activeGuidance, [
      'instruction-only',
      'selective',
      'best-effort',
      'tool-dependent',
      'no parser',
      'validator',
      'extractor',
      'launcher',
      'process adapter',
      'report writer',
      'portable analysis runtime',
      'complete schema validation',
      'prompt-injection isolation',
      'stable-file handling',
      'resource containment',
      'tool-created temporary data',
    ]);
    assertContainsEvery(skill, [
      'exactly one local markdown report',
      '.artifacts/diagnostics/<archive-id>/report.md',
      'refuse an existing target by default',
      'replacement requires separate explicit authorization',
      'unavailable advanced checks as residual risk',
      'prompt-injection residual risk',
      'tool allocation, parsing, decompression, buffering, caching, temporary files',
      'do not claim stable handles, no-follow creation, exact windows dacls',
    ]);
    assertContainsEvery(publicGuidance, [
      'diagnostic database',
      'archive',
      'report',
      'local',
      'unencrypted',
      'private',
      'best-effort-redacted',
      'review',
      'before sharing',
    ]);
    for (const forbiddenRuntimeClaim of ['python', 'py -', 'inspect_diagnostics_archive']) {
      assert.equal(activeGuidance.includes(forbiddenRuntimeClaim), false, forbiddenRuntimeClaim);
    }
  });

  it('separates dependency evidence tiers and preserves the canonical advisory', () => {
    const security = readText(SECURITY_PATH);
    const normalizedSecurity = normalizeText(security);

    assert.equal(security.split(/\r?\n/u).filter((line) => line === CANONICAL_ADVISORY_ROW).length, 1);
    assertContainsEvery(normalizedSecurity, [
      'host-independent lockfile analysis',
      'linux x64 and windows x64',
      'installed-artifact inspection proves only the current matching host target',
      'native installed and packaged-runtime proof',
      'remediation packet 10',
      'archiver -> tar-stream -> bare-fs',
      'predates the reviewed six-commit range',
      'any cloakbrowser or lockfile change, advisory update, or compatible upstream fix',
      'mach-o classifier fixtures do not imply current macos packaging evidence',
      'macos distribution remains paused',
    ]);
    for (const unsupportedClaim of [
      'current-host scan is exhaustive',
      'matching host target is exhaustive',
      'filename suffixes prove cross-platform safety',
      'mocked platforms prove cross-platform safety',
    ]) {
      assert.equal(normalizedSecurity.includes(unsupportedClaim), false, unsupportedClaim);
    }
  });

  it('keeps all eleven locale catalogs key- and placeholder-aligned', () => {
    assert.equal(APP_LOCALE_IDS.length, 11);
    const english = en as Readonly<Record<string, string>>;
    const expectedKeys = Object.keys(english).sort();

    for (const locale of APP_LOCALE_IDS) {
      const catalog = TRANSLATIONS_BY_LOCALE[locale] as Readonly<Record<string, string>>;
      assert.deepEqual(Object.keys(catalog).sort(), expectedKeys, locale);
      for (const key of expectedKeys) {
        assert.deepEqual(getPlaceholders(catalog[key] ?? ''), getPlaceholders(english[key] ?? ''), `${locale}:${key}`);
      }
    }
  });

  it('pins the Provider Audit task state to tracked repository history', () => {
    const history = new GitRepositoryHistoryReader(WORKSPACE_PATH);
    const handoff = readText(path.join(WORKSPACE_PATH, PROVIDER_AUDIT_HANDOFF_RELATIVE_PATH));
    const normalizedHandoff = handoff.replace(/\s+/gu, ' ');
    const todo = readText(path.join(WORKSPACE_PATH, PROVIDER_AUDIT_TODO_RELATIVE_PATH));

    assert.equal(history.isTracked(PROVIDER_AUDIT_HANDOFF_RELATIVE_PATH), true);
    assert.equal(history.isTracked(PROVIDER_AUDIT_TODO_RELATIVE_PATH), true);
    assert.equal(history.readCommitSubject(TASK_23_COMMIT), TASK_23_SUBJECT);

    const commitPaths = history.readCommitPaths(TASK_23_COMMIT);
    assert.equal(commitPaths.includes(PROVIDER_AUDIT_HANDOFF_RELATIVE_PATH), true);
    assert.equal(commitPaths.includes(PROVIDER_AUDIT_TODO_RELATIVE_PATH), true);

    assert.match(todo, /^- \[x\] \[23 Integration gate\]/mu);
    assert.match(todo, /^- \[ \] \[24 Sanitized manual verification\]/mu);
    assert.match(handoff, /Tasks 01–23 are committed/u);
    assert.match(handoff, /89e8e833 docs\(diagnostics\): complete integration gate/u);
    assert.match(handoff, /Task 24 remains unchecked, unstarted/u);
    assert.match(handoff, /requires separate execution authorization/u);
    assert.match(normalizedHandoff, /After Packet 08 is reviewed and committed, Packet 09 is the exact next packet/u);
    assert.equal(handoff.includes('Task 23 is implemented and verified'), false);
    assert.equal(handoff.includes('Task 23 is unstaged'), false);
    assert.equal(handoff.includes('Task 23 is uncommitted'), false);
  });
});
