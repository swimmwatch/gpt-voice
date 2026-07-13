export type LandingLocale = 'be' | 'de' | 'en' | 'es' | 'fr' | 'hi' | 'ja' | 'pt-BR' | 'ru' | 'uk' | 'zh-CN';

export interface LandingLocaleDefinition {
  language: string;
  tag: LandingLocale;
  routeSlug: string;
  route: string;
  canonical: string;
  nativeLabel: string;
  ogLocale: string;
  direction: 'ltr';
  primaryFont: string;
  fontPackage: string;
  pageText: string;
  transcriptText: string;
  captions: string;
}

export type TranscriptCueId =
  | 'prompt-problem'
  | 'product-bridge'
  | 'transcription-sample'
  | 'transcription-result'
  | 'retry'
  | 'translation'
  | 'prettify'
  | 'providers'
  | 'final-cta';

export interface VideoTranscriptCue {
  id: TranscriptCueId;
  narration: string;
  soundCues: readonly string[];
  visualDescription: string;
}

export interface LandingLinks {
  issues: string;
  license: string;
  latestRelease: string;
  repository: string;
}

export interface LandingContent {
  metadata: {
    description: string;
    socialCardAlt: string;
    title: string;
  };
  navigation: {
    brand: string;
    currentLanguage: string;
    faq: string;
    howItWorks: string;
    language: string;
    mobileMenu: string;
    providers: string;
    repositoryCta: string;
    releaseCta: string;
    skipLink: string;
  };
  hero: {
    badge: string;
    lead: string;
    primaryCta: string;
    secondaryCta: string;
    screenshotAlt: string;
    title: string;
    shortcuts: readonly ShortcutLabel[];
  };
  demo: {
    captionTrackLabel: string;
    eyebrow: string;
    lead: string;
    posterAlt: string;
    supportingNote: string;
    summary: string;
    title: string;
    transcriptControl: string;
    transcriptCues: readonly VideoTranscriptCue[];
    transcriptRequirement: string;
    videoLabel: string;
  };
  workflow: {
    eyebrow: string;
    lead: string;
    prettify: WorkflowStep;
    retry: RetryWorkflowStep;
    title: string;
    transcribe: WorkflowStep;
    translate: TranslateWorkflowStep;
  };
  providers: {
    availableNow: string;
    chatGptWeb: ProviderRoute;
    eyebrow: string;
    future: FutureProviders;
    futureRouteLegend: string;
    groupDescription: string;
    inputDetail: string;
    inputNode: string;
    lead: string;
    openAiApi: ProviderRoute;
    title: string;
  };
  faq: {
    eyebrow: string;
    items: readonly FaqItem[];
    title: string;
  };
  finalCta: {
    lead: string;
    primaryCta: string;
    secondaryCta: string;
    title: string;
    licenseNote: string;
  };
  footer: {
    brand: string;
    copyright: string;
    description: string;
    disclaimer: string;
    links: readonly FooterLink[];
  };
  links: LandingLinks;
}

export interface ShortcutLabel {
  action: string;
  keys: readonly string[];
}

export interface WorkflowStep {
  compactResult: string;
  description: string;
  footnote: string;
  id: 'prettify' | 'transcribe';
  order: '01' | '03';
  shortcuts: readonly string[];
  title: string;
}

export interface TranslateWorkflowStep {
  compactNote: string;
  compactResult: string;
  description: string;
  footnote: string;
  id: 'translate';
  languages: string;
  order: '02';
  serviceDetail: string;
  shortcuts: readonly string[];
  title: string;
}

export interface RetryWorkflowStep {
  compactResult: string;
  comparisonLabel: string;
  comparisonNote: string;
  condition: string;
  description: string;
  footnote: string;
  id: 'retry';
  shortcuts: readonly string[];
  statusLabel: string;
  title: string;
}

export interface ProviderRoute {
  claim?: string;
  facts: readonly string[];
  provider: string;
  qualification?: string;
  status: string;
}

export interface FutureProviders {
  blockLabel: string;
  independenceNote: string;
  longerTermCopy: string;
  providers: readonly PlannedProvider[];
  qualification: string;
}

export interface PlannedProvider {
  provider: string;
  status: string;
}

export interface FaqItem {
  answer: string;
  id: string;
  question: string;
}

export interface FooterLink {
  href: keyof LandingLinks;
  label: string;
}
