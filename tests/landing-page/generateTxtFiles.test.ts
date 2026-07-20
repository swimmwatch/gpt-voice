import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { generateTextFiles, getTextDigest, renderPageText } from '../../src/landing-page/build/generate-txt-files';
import {
  englishContent,
  localeRegistry,
  publishedLocaleContent,
  type LandingContent,
  type LandingLocale,
} from '../../src/landing-page/content';

const englishLocale = localeRegistry.find((locale) => locale.tag === 'en');

assert.ok(englishLocale, 'The TXT generation contract requires an English locale.');

test('refuses to write partial TXT output when required locale inputs are absent', async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-txt-'));

  try {
    await assert.rejects(
      generateTextFiles({
        contentByLocale: new Map<LandingLocale, LandingContent>([['en', englishContent]]),
        outputDirectory,
        transcriptsByLocale: new Map<LandingLocale, string>([['en', 'Approved English transcript source.']]),
      }),
      /missing reviewed locale dictionaries: ru, be, uk, es, pt-BR, zh-CN, ja, de, fr, hi.*missing approved transcript sources:/,
    );
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});

test('generates all normalized TXT resources from the complete localized source', async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-txt-'));

  try {
    const files = await generateTextFiles({ outputDirectory });
    const englishPage = await readFile(path.join(outputDirectory, 'index.txt'), 'utf8');
    const russianTranscript = await readFile(path.join(outputDirectory, 'media/transcripts/ru.txt'), 'utf8');
    const spanishPage = await readFile(path.join(outputDirectory, 'es/index.txt'), 'utf8');
    const llmsIndex = await readFile(path.join(outputDirectory, 'llms.txt'), 'utf8');
    const llmsFull = await readFile(path.join(outputDirectory, 'llms-full.txt'), 'utf8');

    assert.equal(files.length, 24);
    assert.match(englishPage, /^# Write better AI prompts faster\./);
    assert.match(englishPage, /High-quality, virtually unlimited recognition\*/);
    assert.match(englishPage, /Subject to ChatGPT plan, availability, fair-use, and provider limits/);
    assert.match(russianTranscript, /Посмотрите полный рабочий процесс/);
    assert.ok(spanishPage.includes(publishedLocaleContent.es.hero.title));
    assert.doesNotMatch(spanishPage, /^### prompt-problem$/mu);
    assert.match(llmsIndex, /https:\/\/swimmwatch\.github\.io\/gpt-voice\/ru\//);
    assert.match(
      llmsIndex,
      /\[Documentation\]\(https:\/\/swimmwatch\.github\.io\/gpt-voice\/docs\/\): The user guide covers installation, first use, workflows, settings, privacy, troubleshooting, and FAQ\./,
    );
    assert.match(
      llmsIndex,
      /\[Русский transcript\]\(https:\/\/swimmwatch\.github\.io\/gpt-voice\/media\/transcripts\/ru\.txt\)/,
    );
    assert.doesNotMatch(llmsIndex, /https:\/\/swimmwatch\.github\.io\/gpt-voice\/ru\/media\/transcripts\//);
    assert.equal(llmsIndex.includes('\r'), false);
    assert.equal(llmsIndex, llmsIndex.normalize('NFC'));
    assert.equal(llmsIndex.endsWith('\n'), true);
    assert.ok(llmsFull.startsWith(renderPageText(englishContent, englishLocale).trimEnd()));
    assert.doesNotMatch(llmsFull, /https:\/\/swimmwatch\.github\.io\/gpt-voice\/docs\//);
    assert.doesNotMatch(llmsFull, /First use: connect a provider and transcribe speech/);
    assert.equal(englishPage.includes('\r'), false);
    assert.equal(englishPage, englishPage.normalize('NFC'));
    assert.equal(englishPage.endsWith('\n'), true);
    assert.match(getTextDigest(englishPage), /^[a-f0-9]{64}$/);
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});
