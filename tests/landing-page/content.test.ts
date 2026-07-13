import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { englishContent } from '../../src/landing-page/content/locales/en';

const rootDirectory = path.resolve(__dirname, '../..');

test('keeps the canonical English content complete and aligned with the approved outline', async () => {
  const outline: string = await readFile(
    path.join(rootDirectory, 'docs/specs/github-pages-landing-page/assets/content-outline.md'),
    'utf8',
  );
  const canonicalOutline = outline.replace(/`/g, '');
  const faqIds = englishContent.faq.items.map(({ id }) => id);

  assert.equal(englishContent.faq.items.length, 12);
  assert.equal(new Set(faqIds).size, 12);
  assert.equal(englishContent.demo.transcriptCues.length, 9);
  assert.deepEqual(
    englishContent.demo.transcriptCues.map(({ id }) => id),
    [
      'prompt-problem',
      'product-bridge',
      'transcription-sample',
      'transcription-result',
      'retry',
      'translation',
      'prettify',
      'providers',
      'final-cta',
    ],
  );

  for (const item of englishContent.faq.items) {
    assert.ok(canonicalOutline.includes(item.question));
    assert.ok(canonicalOutline.includes(item.answer));
  }
  assert.ok(canonicalOutline.includes(englishContent.workflow.translate.description));
  assert.ok(canonicalOutline.includes(englishContent.workflow.prettify.description));
  assert.ok(canonicalOutline.includes(englishContent.providers.chatGptWeb.qualification ?? ''));
  assert.ok(canonicalOutline.includes(englishContent.providers.future.qualification));
});

test('keeps provider limits, prompt-first positioning, and non-versioned copy explicit', () => {
  const serializedContent = JSON.stringify(englishContent);

  assert.match(englishContent.hero.lead, /Writing clear, well-structured prompts takes time/);
  assert.match(englishContent.workflow.translate.title, /clearer model input/);
  assert.match(englishContent.workflow.prettify.description, /preserving its instructions and meaning/);
  assert.match(englishContent.workflow.retry.condition, /voice provider returns an error/);
  assert.match(englishContent.providers.chatGptWeb.qualification ?? '', /does not bypass quotas/);
  assert.match(englishContent.providers.future.qualification, /No compatibility or timing is promised/);
  assert.doesNotMatch(serializedContent, /\b(?:1\.4\.0|2\.0\.0)\b/);
});

test('keeps the English content ready for shared HTML and plain-text output', async () => {
  const source = await readFile(
    path.join(rootDirectory, 'docs/specs/github-pages-landing-page/assets/txt-output-contract.json'),
    'utf8',
  );
  const contract = JSON.parse(source) as {
    basePath: string;
    contentRules: { stableHeadingOrder: boolean; typedSourceSharedWithHtml: boolean };
    localizedPageText: { count: number; source: string };
  };

  assert.equal(contract.basePath, '/gpt-voice/');
  assert.equal(contract.localizedPageText.count, 11);
  assert.equal(contract.localizedPageText.source, 'localization-matrix.json locales[].pageText');
  assert.equal(contract.contentRules.typedSourceSharedWithHtml, true);
  assert.equal(contract.contentRules.stableHeadingOrder, true);
  assert.ok(englishContent.metadata.title.length < 60);
  assert.ok(englishContent.metadata.description.length < 160);
});
