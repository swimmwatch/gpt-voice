import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { generateTextFiles, getTextDigest } from '../../src/landing-page/build/generate-txt-files';
import {
  englishContent,
  localeRegistry,
  type LandingContent,
  type LandingLocale,
} from '../../src/landing-page/content';

const fullContentMap = new Map<LandingLocale, LandingContent>(
  localeRegistry.map((locale) => [locale.tag, englishContent]),
);
const fullTranscriptMap = new Map<LandingLocale, string>(
  localeRegistry.map((locale) => [locale.tag, `Approved ${locale.tag} transcript source.`]),
);

test('refuses to write partial TXT output when required locale inputs are absent', async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-txt-'));

  try {
    await assert.rejects(
      generateTextFiles({ outputDirectory }),
      /missing reviewed locale dictionaries: ru, be, uk, es, pt-BR, zh-CN, ja, de, fr, hi.*missing approved transcript sources:/,
    );
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});

test('generates all normalized TXT resources from complete localized inputs', async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-txt-'));

  try {
    const files = await generateTextFiles({
      contentByLocale: fullContentMap,
      outputDirectory,
      transcriptsByLocale: fullTranscriptMap,
    });
    const englishPage = await readFile(path.join(outputDirectory, 'index.txt'), 'utf8');
    const russianTranscript = await readFile(path.join(outputDirectory, 'media/transcripts/ru.txt'), 'utf8');
    const llmsIndex = await readFile(path.join(outputDirectory, 'llms.txt'), 'utf8');

    assert.equal(files.length, 24);
    assert.match(englishPage, /^# Write better AI prompts faster\./);
    assert.match(englishPage, /High-quality, virtually unlimited recognition\*/);
    assert.match(englishPage, /Subject to ChatGPT plan, availability, fair-use, and provider limits/);
    assert.match(russianTranscript, /^Approved ru transcript source\.\n$/);
    assert.match(llmsIndex, /https:\/\/swimmwatch\.github\.io\/gpt-voice\/ru\//);
    assert.equal(englishPage.includes('\r'), false);
    assert.equal(englishPage, englishPage.normalize('NFC'));
    assert.equal(englishPage.endsWith('\n'), true);
    assert.match(getTextDigest(englishPage), /^[a-f0-9]{64}$/);
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});
