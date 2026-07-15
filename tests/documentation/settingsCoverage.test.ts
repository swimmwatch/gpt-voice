import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

type SettingCoverage = {
  evidence: string[];
  id: string;
  source: string;
};

type SettingsCoverageFixture = {
  reviewedRelease: string;
  schemaVersion: number;
  settings: SettingCoverage[];
};

const projectRoot = process.cwd();
const guideRoot = path.join(projectRoot, 'docs', 'user-guide');
const fixturePath = path.join(projectRoot, 'tests', 'documentation', 'fixtures', 'settings-coverage.json');
const settingSources = [
  'settings/index.md',
  'settings/providers.md',
  'settings/shortcuts.md',
  'settings/prettify.md',
  'settings/browser.md',
  'settings/network.md',
] as const;
const requiredSettingIds = new Set(
  `form.dirty form.validation form.save-progress form.discard form.shortcut-capture
   provider.chatgpt.session provider.chatgpt.sign-in provider.chatgpt.clear-session
   provider.openai.api-key provider.openai.stored-key provider.openai.model provider.openai.language
   provider.openai.prompt provider.openai.temperature provider.openai.save provider.openai.clear-key
   shortcut.record shortcut.stop shortcut.cancel shortcut.translate shortcut.prettify shortcut.retry-transcription
   shortcut.conflicts text-action.translate-enabled text-action.prettify-enabled
   prettify.provider prettify.base-url prettify.vllm-api-key prettify.model-refresh prettify.model-selection
   prettify.model-state prettify.model-load prettify.model-free prettify.model-vram prettify.temperature prettify.top-p
   prettify.min-p prettify.repeat-penalty prettify.top-k prettify.max-output-tokens prettify.seed prettify.prompt
   browser.humanize browser.human-preset browser.background browser.fingerprint-seed browser.locale browser.timezone
   browser.proxy-geoip-dependency network.enabled network.server network.bypass network.username network.password
   network.clear-password network.geoip network.socks5-auth-warning`
    .trim()
    .split(/\s+/u),
);

async function readFixture(): Promise<SettingsCoverageFixture> {
  return JSON.parse(await readFile(fixturePath, 'utf8')) as SettingsCoverageFixture;
}

async function readSettingsSources(): Promise<Map<string, string>> {
  const entries = await Promise.all(
    settingSources.map(async (source) => [source, await readFile(path.join(guideRoot, source), 'utf8')] as const),
  );
  return new Map(entries);
}

function assertSettingsCoverage(
  fixture: SettingsCoverageFixture,
  sources: ReadonlyMap<string, string>,
  packageVersion: string,
): void {
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(fixture.reviewedRelease, packageVersion, 'Coverage map must be reviewed against the current release.');

  const mappedIds = fixture.settings.map(({ id }) => id);
  assert.equal(new Set(mappedIds).size, mappedIds.length, 'Each setting may have one authoritative mapping.');
  assert.deepEqual(
    new Set(mappedIds),
    requiredSettingIds,
    'Coverage map must include every released setting exactly once.',
  );
  assert.deepEqual(
    new Set(fixture.settings.map(({ source }) => source)),
    new Set(settingSources),
    'Every settings page needs a current reviewed-release marker in the coverage map.',
  );

  for (const { evidence, id, source } of fixture.settings) {
    const contents = sources.get(source);
    assert.ok(contents, `Setting ${id} must map to an authoritative settings page.`);
    assert.ok(evidence.length > 0, `Setting ${id} must name its visible evidence.`);
    for (const phrase of evidence) {
      assert.ok(contents.includes(phrase), `${source} must document ${id}: ${phrase}`);
    }
  }
}

test('maps every released setting once to an authoritative reviewed guide page', async () => {
  const [fixture, sources, packageSource] = await Promise.all([
    readFixture(),
    readSettingsSources(),
    readFile(path.join(projectRoot, 'package.json'), 'utf8'),
  ]);
  const packageVersion = (JSON.parse(packageSource) as { version: string }).version;

  assertSettingsCoverage(fixture, sources, packageVersion);
});

test('rejects an incomplete or duplicate settings mapping', async () => {
  const [fixture, sources, packageSource] = await Promise.all([
    readFixture(),
    readSettingsSources(),
    readFile(path.join(projectRoot, 'package.json'), 'utf8'),
  ]);
  const packageVersion = (JSON.parse(packageSource) as { version: string }).version;
  const withoutTemperature = {
    ...fixture,
    settings: fixture.settings.filter(({ id }) => id !== 'provider.openai.temperature'),
  };
  const duplicate = {
    ...fixture,
    settings: [...fixture.settings, fixture.settings[0]],
  };

  assert.throws(() => assertSettingsCoverage(withoutTemperature, sources, packageVersion), /every released setting/u);
  assert.throws(() => assertSettingsCoverage(duplicate, sources, packageVersion), /one authoritative mapping/u);
});
