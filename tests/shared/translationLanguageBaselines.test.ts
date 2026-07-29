import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';
import {
  TRANSLATION_PROVIDER_IDS,
  TRANSLATION_PROVIDER_INFO,
  type TranslationLanguage,
  type TranslationProviderId,
} from '@shared/translationProvider';

interface BaselineLanguage {
  readonly code: string;
  readonly label: string;
}

interface TranslationLanguageBaseline {
  readonly schema_version: 1;
  readonly provider_id: TranslationProviderId;
  readonly evidence_date: string;
  readonly target_count: number;
  readonly source_only: readonly BaselineLanguage[];
  readonly languages: readonly BaselineLanguage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function parseLanguage(value: unknown, context: string): BaselineLanguage {
  assert.ok(isRecord(value), `${context} must be an object`);
  const code = value.code;
  const label = value.label;
  if (typeof code !== 'string') assert.fail(`${context}.code must be a string`);
  if (typeof label !== 'string') assert.fail(`${context}.label must be a string`);
  assert.notEqual(code.trim(), '', `${context}.code must be nonblank`);
  assert.notEqual(label.trim(), '', `${context}.label must be nonblank`);
  return { code, label };
}

function parseBaseline(providerId: TranslationProviderId): TranslationLanguageBaseline {
  const baselinePath = path.join(
    process.cwd(),
    'docs',
    'researches',
    'translation-providers',
    'baselines',
    `${providerId}-2026-07-25.yaml`,
  );
  const value: unknown = parse(fs.readFileSync(baselinePath, 'utf8'));
  assert.ok(isRecord(value), `${providerId} baseline must be an object`);
  assert.equal(value.schema_version, 1);
  assert.equal(value.provider_id, providerId);
  assert.equal(value.evidence_date, '2026-07-25');
  const targetCount = value.target_count;
  if (typeof targetCount !== 'number') {
    assert.fail(`${providerId}.target_count must be a number`);
  }
  assert.ok(isUnknownArray(value.source_only));
  assert.ok(isUnknownArray(value.languages));

  const sourceOnly = value.source_only.map((language, index) =>
    parseLanguage(language, `${providerId}.source_only[${index}]`),
  );
  const languages = value.languages.map((language, index) =>
    parseLanguage(language, `${providerId}.languages[${index}]`),
  );

  return {
    schema_version: 1,
    provider_id: providerId,
    evidence_date: '2026-07-25',
    target_count: targetCount,
    source_only: sourceOnly,
    languages,
  };
}

function normalizedBaseline(languages: readonly BaselineLanguage[]): ReadonlyArray<readonly [string, string]> {
  return languages
    .map(({ code, label }) => [code, label] as const)
    .sort(([left], [right]) => left.localeCompare(right));
}

function normalizedRuntime(languages: readonly TranslationLanguage[]): ReadonlyArray<readonly [string, string]> {
  return languages
    .map(({ code, providerLabel }) => [code, providerLabel] as const)
    .sort(([left], [right]) => left.localeCompare(right));
}

describe('translation language baselines', () => {
  for (const providerId of TRANSLATION_PROVIDER_IDS) {
    it(`${providerId} runtime inventory exactly matches its reviewed YAML baseline`, () => {
      const provider = TRANSLATION_PROVIDER_INFO[providerId];
      const baseline = parseBaseline(providerId);
      const runtimeCodes = provider.targetLanguages.map(({ code }) => code);
      const baselineCodes = baseline.languages.map(({ code }) => code);

      assert.equal(provider.contractVersion, baseline.evidence_date);
      assert.equal(baseline.target_count, baseline.languages.length);
      assert.equal(provider.targetLanguages.length, baseline.target_count);
      assert.equal(new Set(baselineCodes).size, baselineCodes.length);
      assert.equal(new Set(runtimeCodes).size, runtimeCodes.length);
      assert.deepEqual(normalizedRuntime(provider.targetLanguages), normalizedBaseline(baseline.languages));

      const sourceOnlyCodes = new Set(baseline.source_only.map(({ code }) => code));
      for (const code of runtimeCodes) assert.equal(sourceOnlyCodes.has(code), false);
    });
  }

  it('retains the exact reviewed baseline counts', () => {
    assert.deepEqual(
      TRANSLATION_PROVIDER_IDS.map((providerId) => TRANSLATION_PROVIDER_INFO[providerId].targetLanguages.length),
      [249, 179, 118],
    );
  });
});
