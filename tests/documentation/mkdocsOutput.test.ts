import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

type MkDocsConfiguration = {
  docs_dir?: unknown;
  nav?: unknown;
  site_dir?: unknown;
  site_url?: unknown;
};

const projectRoot = process.cwd();
const configurationPath = path.join(projectRoot, 'mkdocs.yml');
const outputDirectory = path.join(projectRoot, 'build', 'github-pages', 'docs');
const canonicalUrl = 'https://swimmwatch.github.io/gpt-voice/docs/';
const prohibitedPathFragments = [
  '.agents/',
  'docs/agent-guides/',
  'docs/researches/',
  'docs/specs/',
  'tasks/handoff.md',
  'access-token.json',
  'chatgpt-session.json',
  'openai-api-settings.json',
];

function assertPublicGuideConfiguration(configuration: MkDocsConfiguration): void {
  assert.equal(configuration.docs_dir, 'docs/user-guide', 'MkDocs must read only the public guide source.');
  assert.equal(configuration.site_dir, 'build/github-pages/docs', 'MkDocs must write only the Pages docs subpath.');
  assert.equal(configuration.site_url, canonicalUrl, 'MkDocs must use the canonical documentation URL.');
  assert.ok(Array.isArray(configuration.nav), 'MkDocs must use explicit navigation.');
  assert.deepEqual(configuration.nav[0], { Overview: 'index.md' });
}

async function listFiles(directory: string, relativeDirectory = ''): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        return listFiles(path.join(directory, entry.name), relativePath);
      }
      return [relativePath];
    }),
  );

  return files.flat().sort();
}

async function readPublishedText(files: readonly string[]): Promise<Map<string, string>> {
  const textFiles = files.filter((file) => /\.(?:html|json|txt|xml)$/u.test(file));
  const contents = await Promise.all(
    textFiles.map(async (file) => [file, await readFile(path.join(outputDirectory, file), 'utf8')] as const),
  );

  return new Map(contents);
}

test('restricts MkDocs to the public guide source and Pages docs path', async () => {
  const configuration = parse(await readFile(configurationPath, 'utf8')) as MkDocsConfiguration;

  assertPublicGuideConfiguration(configuration);
  assert.throws(
    () => assertPublicGuideConfiguration({ ...configuration, docs_dir: 'docs' }),
    /MkDocs must read only the public guide source/u,
  );
});

test('publishes canonical overview metadata without internal engineering artifacts', async () => {
  const files = await listFiles(outputDirectory);
  const index = await readFile(path.join(outputDirectory, 'index.html'), 'utf8');

  assert.ok(files.includes('index.html'));
  assert.ok(files.includes('search/search_index.json'));
  assert.ok(index.includes(`<link href=${canonicalUrl} rel=canonical>`));
  assert.ok(index.includes('<title>GPT-Voice documentation</title>'));
  assert.ok(index.includes('Overview'));

  for (const [file, contents] of await readPublishedText(files)) {
    for (const fragment of prohibitedPathFragments) {
      assert.equal(file.includes(fragment), false, `Published file must not expose ${fragment}: ${file}`);
      assert.equal(contents.includes(fragment), false, `Published content must not expose ${fragment}: ${file}`);
    }
  }
});
