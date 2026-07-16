import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  localeRegistry,
  publishedLocaleContent,
  type LandingContent,
  type LandingLocale,
  type LandingLocaleDefinition,
} from '../content/index.js';

const repositoryRoot = path.resolve(__dirname, '../../..');
const defaultOutputDirectory = path.join(repositoryRoot, 'build/github-pages');
const defaultContentByLocale = new Map<LandingLocale, LandingContent>(
  localeRegistry.map((locale) => [locale.tag, publishedLocaleContent[locale.tag]]),
);

export type TextGenerationOptions = {
  contentByLocale?: ReadonlyMap<LandingLocale, LandingContent>;
  localeDefinitions?: readonly LandingLocaleDefinition[];
  outputDirectory?: string;
  transcriptsByLocale?: ReadonlyMap<LandingLocale, string>;
};

type TextFile = {
  content: string;
  publicPath: string;
};

function normalizeText(text: string): string {
  return `${text.normalize('NFC').replaceAll('\r\n', '\n').replaceAll('\r', '\n').trimEnd()}\n`;
}

export function getTextDigest(text: string): string {
  return createHash('sha256').update(normalizeText(text), 'utf8').digest('hex');
}

function renderShortcutList(shortcuts: readonly string[]): string {
  return shortcuts.map((shortcut) => `- ${shortcut}`).join('\n');
}

function renderProvider(provider: LandingContent['providers']['chatGptWeb']): string {
  return [
    `### ${provider.provider}`,
    provider.status,
    provider.facts.join('; '),
    provider.claim,
    provider.qualification,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Renders the visible landing-page content into its normalized plain-text equivalent. */
export function renderPageText(content: LandingContent, locale: LandingLocaleDefinition): string {
  const transcript = content.demo.transcriptCues
    .map((cue, index) =>
      [`### ${index + 1}`, cue.narration, cue.soundCues.join('; '), cue.visualDescription].join('\n'),
    )
    .join('\n\n');

  return normalizeText(
    [
      `# ${content.hero.title}`,
      `${content.navigation.language}: ${locale.tag}`,
      locale.canonical,
      '',
      content.hero.lead,
      '',
      `## ${content.navigation.mobileMenuLabel}`,
      [content.navigation.providers, content.navigation.howItWorks, content.navigation.faq]
        .map((label) => `- ${label}`)
        .join('\n'),
      '',
      `## ${content.hero.shortcutsLabel}`,
      content.hero.shortcuts.map(({ action, keys }) => `- ${action}: ${keys.join(' + ')}`).join('\n'),
      '',
      `## ${content.demo.title}`,
      content.demo.lead,
      content.demo.summary,
      content.demo.supportingNote,
      '',
      `## ${content.workflow.title}`,
      content.workflow.lead,
      '',
      `### ${content.workflow.transcribe.title}`,
      content.workflow.transcribe.description,
      renderShortcutList(content.workflow.transcribe.shortcuts),
      content.workflow.transcribe.compactResult,
      content.workflow.transcribe.footnote,
      '',
      `### ${content.workflow.retry.title}`,
      content.workflow.retry.statusLabel,
      content.workflow.retry.condition,
      content.workflow.retry.description,
      renderShortcutList(content.workflow.retry.shortcuts),
      content.workflow.retry.compactResult,
      content.workflow.retry.footnote,
      '',
      `### ${content.workflow.translate.title}`,
      content.workflow.translate.description,
      content.workflow.translate.languages,
      content.workflow.translate.serviceDetail,
      renderShortcutList(content.workflow.translate.shortcuts),
      content.workflow.translate.compactResult,
      content.workflow.translate.compactNote,
      content.workflow.translate.footnote,
      '',
      `### ${content.workflow.prettify.title}`,
      content.workflow.prettify.description,
      renderShortcutList(content.workflow.prettify.shortcuts),
      content.workflow.prettify.compactResult,
      content.workflow.prettify.footnote,
      '',
      `## ${content.providers.title}`,
      content.providers.lead,
      `${content.providers.inputNode} — ${content.providers.inputDetail}`,
      content.providers.availableNow,
      renderProvider(content.providers.chatGptWeb),
      renderProvider(content.providers.openAiApi),
      `### ${content.providers.future.blockLabel}`,
      content.providers.future.providers.map((provider) => `- ${provider.provider}: ${provider.status}`).join('\n'),
      content.providers.future.longerTermCopy,
      content.providers.future.qualification,
      content.providers.future.independenceNote,
      '',
      `## ${content.faq.title}`,
      ...content.faq.items.flatMap((item) => [`### ${item.question}`, item.answer]),
      '',
      `## ${content.finalCta.title}`,
      content.finalCta.lead,
      content.finalCta.licenseNote,
      '',
      `## ${content.footer.brand}`,
      content.footer.description,
      content.footer.disclaimer,
      '',
      `## ${content.demo.title}`,
      transcript,
    ].join('\n\n'),
  );
}

export function renderTranscriptText(content: LandingContent, locale: LandingLocaleDefinition): string {
  return normalizeText(
    [
      `# ${content.demo.title}`,
      `${content.navigation.language}: ${locale.tag}`,
      locale.canonical,
      '',
      ...content.demo.transcriptCues.flatMap((cue, index) => [
        `## ${index + 1}`,
        cue.narration,
        cue.soundCues.join('; '),
        cue.visualDescription,
      ]),
    ].join('\n\n'),
  );
}

const defaultTranscriptsByLocale = new Map<LandingLocale, string>(
  localeRegistry.map((locale) => [locale.tag, renderTranscriptText(publishedLocaleContent[locale.tag], locale)]),
);

function renderLlmsIndex(
  content: LandingContent,
  englishLocale: LandingLocaleDefinition,
  localeDefinitions: readonly LandingLocaleDefinition[],
): string {
  const documentationUrl = new URL(content.links.documentation, englishLocale.canonical).href;

  return normalizeText(
    [
      '# GPT-Voice',
      `> ${content.hero.lead}`,
      '',
      content.metadata.description,
      '',
      '## Documentation',
      `- [${content.navigation.documentation}](${documentationUrl}): The user guide covers installation, first use, workflows, settings, privacy, troubleshooting, and FAQ.`,
      '',
      '## Localized pages',
      ...localeDefinitions.map((locale) => `- [${locale.nativeLabel}](${locale.canonical})`),
      '',
      '## Plain-text resources',
      ...localeDefinitions.flatMap((locale) => [
        `- [${locale.nativeLabel} page text](${locale.canonical.replace(/\/$/, '')}/index.txt)`,
        `- [${locale.nativeLabel} transcript](${locale.canonical.replace(/\/$/, '')}/media/transcripts/${locale.routeSlug || 'en'}.txt)`,
      ]),
      '',
      'This plain-text index is an accessibility and interoperability resource. It is not a crawler directive and does not guarantee indexing.',
    ].join('\n'),
  );
}

function renderLlmsFull(
  content: LandingContent,
  locale: LandingLocaleDefinition,
  localeDefinitions: readonly LandingLocaleDefinition[],
): string {
  return normalizeText(
    [
      renderPageText(content, locale).trimEnd(),
      '',
      '## Localized resources',
      ...localeDefinitions.map((candidate) => `- ${candidate.nativeLabel}: ${candidate.canonical}`),
    ].join('\n'),
  );
}

function assertReady(
  contentByLocale: ReadonlyMap<LandingLocale, LandingContent>,
  localeDefinitions: readonly LandingLocaleDefinition[],
  transcriptsByLocale: ReadonlyMap<LandingLocale, string>,
): void {
  const missingContent = localeDefinitions
    .filter((locale) => !contentByLocale.has(locale.tag))
    .map((locale) => locale.tag);
  const missingTranscripts = localeDefinitions
    .filter((locale) => !transcriptsByLocale.has(locale.tag))
    .map((locale) => locale.tag);

  if (missingContent.length === 0 && missingTranscripts.length === 0) {
    return;
  }

  const missing = [
    missingContent.length > 0 ? `missing reviewed locale dictionaries: ${missingContent.join(', ')}` : null,
    missingTranscripts.length > 0 ? `missing approved transcript sources: ${missingTranscripts.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('; ');

  throw new Error(`TXT generation is blocked: ${missing}. No partial public text output was written.`);
}

function getOutputPath(outputDirectory: string, publicPath: string): string {
  const relativePath = publicPath.replace(/^\/gpt-voice\//, '');
  if (relativePath === publicPath || relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
    throw new Error(`TXT output path is outside the landing base path: ${publicPath}`);
  }
  return path.join(outputDirectory, relativePath);
}

export async function generateTextFiles(options: TextGenerationOptions = {}): Promise<readonly string[]> {
  const outputDirectory = options.outputDirectory ?? defaultOutputDirectory;
  const contentByLocale = options.contentByLocale ?? defaultContentByLocale;
  const localeDefinitions = options.localeDefinitions ?? localeRegistry;
  const transcriptsByLocale = options.transcriptsByLocale ?? defaultTranscriptsByLocale;
  assertReady(contentByLocale, localeDefinitions, transcriptsByLocale);

  const englishLocale = localeDefinitions.find((locale) => locale.tag === 'en');
  const englishContent = contentByLocale.get('en');
  if (!englishLocale || !englishContent) {
    throw new Error('TXT generation requires the English locale dictionary.');
  }

  const files: TextFile[] = [
    { publicPath: '/gpt-voice/llms.txt', content: renderLlmsIndex(englishContent, englishLocale, localeDefinitions) },
    {
      publicPath: '/gpt-voice/llms-full.txt',
      content: renderLlmsFull(englishContent, englishLocale, localeDefinitions),
    },
  ];

  for (const locale of localeDefinitions) {
    const content = contentByLocale.get(locale.tag);
    const transcript = transcriptsByLocale.get(locale.tag);
    if (!content || transcript === undefined) {
      throw new Error(`TXT generation became incomplete for ${locale.tag}.`);
    }
    files.push({ publicPath: locale.pageText, content: renderPageText(content, locale) });
    files.push({ publicPath: locale.transcriptText, content: normalizeText(transcript) });
  }

  await Promise.all(
    files.map(async (file) => {
      const outputPath = getOutputPath(outputDirectory, file.publicPath);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, normalizeText(file.content), 'utf8');
    }),
  );

  return files.map((file) => file.publicPath);
}

if (process.argv[1]?.endsWith(path.join('src', 'landing-page', 'build', 'generate-txt-files.ts'))) {
  void generateTextFiles().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
