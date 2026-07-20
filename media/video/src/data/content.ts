export const promptProblems = [
  {
    id: 'structure',
    label: 'Intent and structure',
    issues: ['Vague goal', 'Missing context', 'Missing constraints', 'Unclear output'],
  },
  {
    id: 'clarity',
    label: 'Clarity and control',
    issues: ['Ambiguous references', 'Conflicting instructions', 'No examples', 'No success criteria'],
  },
  {
    id: 'language',
    label: 'Language',
    issues: ['Grammar errors', 'Filler words', 'Repetition', 'Overlong phrasing'],
  },
  {
    id: 'workflow',
    label: 'Workflow',
    issues: ['Slow typing', 'Lost train of thought', 'Translation detours', 'Failed recognition / re-recording'],
  },
] as const;

export const prompts = {
  spoken: 'Review this pull request and summarize the three most important risks.',
  prettify: {
    result: 'Review this pull request for security issues and list the three highest-priority findings.',
    source:
      'um review this pull request for security issues and, you know, find security problems and list the top three',
  },
  translation: {
    inputLanguage: 'Russian',
    result: 'Review this pull request and summarize the three most important risks.',
    source: 'Russian voice input',
    targetLanguage: 'English',
  },
} as const;

export const claims = {
  chatGptComparison: 'Same-audio retry is not available in ChatGPT Web',
  control: 'You keep control of intent and facts',
  noSeparateTranslationTool: 'No separate translation tool',
  providerQualification:
    'Subject to ChatGPT plan, availability, fair-use, and provider limits. GPT-Voice does not bypass quotas.',
  providerRecognition: 'High-quality recognition',
  providerScale: 'Virtually unlimited*',
} as const;

export const productLabels = {
  actions: 'Transcribe · Retry · Translate · Prettify',
  cta: 'Better prompts · Less effort',
  promptFirst: 'Prompt-first voice workflow',
  translation: 'Language chosen for the model or task',
} as const;
