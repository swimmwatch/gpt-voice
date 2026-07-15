import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parseMkDocsConfiguration } from '../../scripts/mkdocs-configuration.mjs';

type GuidePage = {
  heading: string;
  source: string;
};

type MkDocsConfiguration = {
  nav?: unknown;
};

const projectRoot = process.cwd();
const guideRoot = path.join(projectRoot, 'docs', 'user-guide');
const readmePath = path.join(projectRoot, 'README.md');
const publicGuideUrl = 'https://swimmwatch.github.io/gpt-voice/docs/';
const guidePages: readonly GuidePage[] = [
  { source: 'index.md', heading: 'GPT-Voice Documentation' },
  { source: 'install.md', heading: 'Install, update, or remove GPT-Voice' },
  { source: 'getting-started.md', heading: 'First use: connect a provider and transcribe speech' },
  { source: 'guides/transcription.md', heading: 'Record and transcribe' },
  { source: 'guides/providers.md', heading: 'Choose and manage a transcription provider' },
  { source: 'guides/text-actions.md', heading: 'Translate and Prettify selected text' },
  { source: 'guides/history-and-tray.md', heading: 'Transcription history and tray' },
  { source: 'settings/index.md', heading: 'Settings overview' },
  { source: 'settings/providers.md', heading: 'Provider settings' },
  { source: 'settings/shortcuts.md', heading: 'Shortcut settings' },
  { source: 'settings/prettify.md', heading: 'Prettify settings' },
  { source: 'settings/browser.md', heading: 'Browser settings' },
  { source: 'settings/network.md', heading: 'Network settings' },
  { source: 'privacy.md', heading: 'Privacy and data' },
  { source: 'troubleshooting.md', heading: 'Troubleshooting' },
  { source: 'faq.md', heading: 'Frequently asked questions' },
];
const prohibitedLinkLabels = new Set(['click here', 'here', 'learn more', 'more']);

async function readGuideSources(): Promise<Map<string, string>> {
  const sources = await Promise.all(
    guidePages.map(async ({ source }) => [source, await readFile(path.join(guideRoot, source), 'utf8')] as const),
  );
  return new Map(sources);
}

function collectNavigationSources(navigation: unknown): string[] {
  if (typeof navigation === 'string') {
    return [navigation];
  }
  if (Array.isArray(navigation)) {
    return navigation.flatMap(collectNavigationSources);
  }
  if (typeof navigation !== 'object' || navigation === null) {
    return [];
  }
  return Object.values(navigation).flatMap(collectNavigationSources);
}

function assertDescriptiveLinks(source: string, filename: string): void {
  for (const match of source.matchAll(/(?<!!)\[([^\]]+)\]\([^)]*\)/gu)) {
    const label = match[1].trim().toLowerCase();
    assert.equal(prohibitedLinkLabels.has(label), false, `${filename} must use descriptive link text: ${label}`);
  }
}

function assertReadmeDocumentationLink(readme: string): void {
  const guideLink = `<a href="${publicGuideUrl}"><strong>Read the full GPT-Voice user and settings guide</strong></a>`;
  const guideLinkCount = readme.split(guideLink).length - 1;

  assert.equal(guideLinkCount, 1, 'README must link to the canonical public guide exactly once.');
}

function assertGuideContent(sources: ReadonlyMap<string, string>, navigationSources: readonly string[]): void {
  assert.deepEqual(
    new Set(navigationSources),
    new Set(guidePages.map(({ source }) => source)),
    'MkDocs navigation must expose every public guide page exactly once.',
  );
  for (const { heading, source } of guidePages) {
    const contents = sources.get(source);
    assert.ok(contents, `Public guide page is missing: ${source}`);
    assert.match(contents, new RegExp(`^# ${heading.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'mu'));
    assertDescriptiveLinks(contents, source);
  }

  const index = sources.get('index.md') ?? '';
  const allContent = [...sources.values()].join('\n');

  assert.match(index, /GPT-Voice is an independent project and is not affiliated with OpenAI, Anthropic, or Google\./u);
  assert.match(index, /PolyForm Noncommercial 1\.0\.0/u);
  assert.match(index, /not an\s+OSI-approved open-source license/u);
  assert.match(index, /Current macOS releases are paused/u);
  assert.match(index, /copied to the clipboard/u);
  assert.match(index, /alt="GPT-Voice Command Dock showing/u);
  assert.match(index, /A ready-to-record Command Dock in GPT-Voice\./u);
  assert.match(index, /\[Settings\]\(settings\/index\.md\)/u);
  assert.match(index, /\[privacy and data\]\(privacy\.md\)/iu);
  assert.match(index, /\[troubleshooting\]\(troubleshooting\.md\)/iu);
  assert.match(index, /\[frequently asked questions\]\(faq\.md\)/iu);
  assert.match(sources.get('settings/prettify.md') ?? '', /meaning-preserving cleanup/u);

  for (const providerName of ['ChatGPT Web', 'OpenAI API', 'Ollama', 'vLLM']) {
    assert.ok(allContent.includes(providerName), `Guide must use the provider name ${providerName}.`);
  }
  assert.equal(allContent.includes('knowledge base'), false, 'Guide must use documentation or user guide.');
  assert.doesNotMatch(
    allContent,
    /GPT-Voice (?:automatically )?(?:types|inserts|pastes) (?:the )?(?:result|text|transcription)/iu,
    'Guide must not promise automatic insertion into another application.',
  );
  assert.equal(allContent.includes('added in subsequent documentation increments'), false);
}

test('covers the public guide structure, terminology, qualifications, and descriptive links', async () => {
  const [sources, configurationSource, readme] = await Promise.all([
    readGuideSources(),
    readFile(path.join(projectRoot, 'mkdocs.yml'), 'utf8'),
    readFile(readmePath, 'utf8'),
  ]);
  const configuration = parseMkDocsConfiguration(configurationSource) as MkDocsConfiguration;

  assertGuideContent(sources, collectNavigationSources(configuration.nav));
  assertReadmeDocumentationLink(readme);
});

test('rejects prohibited terminology and automatic-insertion claims', async () => {
  const [sources, configurationSource] = await Promise.all([
    readGuideSources(),
    readFile(path.join(projectRoot, 'mkdocs.yml'), 'utf8'),
  ]);
  const configuration = parseMkDocsConfiguration(configurationSource) as MkDocsConfiguration;
  const navigationSources = collectNavigationSources(configuration.nav);
  const index = sources.get('index.md') ?? '';

  assert.throws(
    () =>
      assertGuideContent(
        new Map(sources).set('index.md', `${index}\nGPT-Voice is a knowledge base.`),
        navigationSources,
      ),
    /Guide must use documentation or user guide/u,
  );
  assert.throws(
    () =>
      assertGuideContent(
        new Map(sources).set('index.md', `${index}\nGPT-Voice automatically types the transcription into every app.`),
        navigationSources,
      ),
    /must not promise automatic insertion/u,
  );
});

test('rejects an absent or duplicated README guide destination', async () => {
  const readme = await readFile(readmePath, 'utf8');

  assert.throws(() => assertReadmeDocumentationLink(readme.replace(publicGuideUrl, 'https://example.test/docs/')));
  assert.throws(() =>
    assertReadmeDocumentationLink(
      `${readme}\n<a href="${publicGuideUrl}"><strong>Read the full GPT-Voice user and settings guide</strong></a>`,
    ),
  );
});
