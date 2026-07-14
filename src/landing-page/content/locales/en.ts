import type { LandingContent } from '../schema';

export const englishContent = {
  metadata: {
    title: 'GPT-Voice — Voice-to-text for faster AI prompts',
    description:
      'Create AI prompts faster with desktop voice-to-text. Use ChatGPT Web or OpenAI API, retry audio, translate selections, and refine text.',
    socialCardAlt: 'GPT-Voice Command Dock beside the words Write better AI prompts faster.',
  },
  navigation: {
    brand: 'GPT-Voice',
    providers: 'Providers',
    howItWorks: 'How it works',
    faq: 'FAQ',
    language: 'Language',
    currentLanguage: 'English',
    repositoryCta: 'GitHub',
    releaseCta: 'Download',
    mobileMenu: 'Open navigation',
    skipLink: 'Skip to main content',
  },
  hero: {
    badge: 'Desktop utility · Windows + Linux',
    title: 'Write better AI prompts faster.',
    lead: 'Writing clear, well-structured prompts takes time. GPT-Voice turns speech into prompt-ready text, then helps you translate it and remove grammar errors, repetition, and filler—with less effort.',
    primaryCta: 'Download latest release',
    secondaryCta: 'View source on GitHub',
    shortcuts: [
      { keys: ['F9'], action: 'Record' },
      { keys: ['Ctrl+F8'], action: 'Retry' },
      { keys: ['F11'], action: 'Translate' },
      { keys: ['F12'], action: 'Prettify' },
    ],
    screenshotAlt:
      'GPT-Voice Command Dock connected to ChatGPT Web, with the gemma3:4b-it-qat prettification model loaded at 1.4 GB VRAM, a Translation copied status, and English selected.',
  },
  demo: {
    eyebrow: 'ONE-MINUTE DEMO',
    title: 'See the complete workflow.',
    lead: 'Transcription, retry, translation, prettification, and provider choice—shown in the real app.',
    videoLabel: 'Play the one-minute GPT-Voice product demonstration',
    summary: 'Speak · Retry · Translate · Refine',
    supportingNote: '60 seconds · 60 fps · English visual walkthrough',
    captionTrackLabel: 'English visual descriptions',
    transcriptControl: 'Read the visual walkthrough notes',
    transcriptRequirement:
      'Include every narration line, meaningful sound cue, and meaningful visual-only action in chronological order.',
    transcriptCues: [
      {
        id: 'prompt-problem',
        narration:
          'Writing prompts for AI agents and assistants is work. Goals can be vague. Context, constraints, examples, success criteria, and output format may be missing. Instructions can conflict. Ambiguity, grammar mistakes, filler, repetition, slow typing, translation detours, and failed recognition all break your flow.',
        soundCues: ['Restrained music pulse', 'Quiet issue ticks', 'Muted error cue'],
        visualDescription:
          'A neutral prompt draft accumulates visible intent, clarity, language, and workflow problems before GPT-Voice appears.',
      },
      {
        id: 'product-bridge',
        narration: 'GPT-Voice removes that input friction—without inventing your intent.',
        soundCues: ['Blue and cyan reveal', 'Short rising sweep'],
        visualDescription:
          'The real Command Dock and the Transcribe, Retry, Translate, and Prettify action nodes appear beside the prompt problems.',
      },
      {
        id: 'transcription-sample',
        narration: 'Review this pull request and summarize the three most important risks.',
        soundCues: ['Record key tap', 'Live speech waveform', 'Stop key tap'],
        visualDescription:
          'The real app records the spoken prompt with F9, then stops with F10 and begins transcription.',
      },
      {
        id: 'transcription-result',
        narration: 'Your prompt is ready to paste.',
        soundCues: ['Processing sweep', 'Clipboard success chime', 'Paste click'],
        visualDescription: 'The transcribed text is copied to the clipboard and pasted into the prompt draft.',
      },
      {
        id: 'retry',
        narration:
          'If the request fails or isn’t processed, resend the same audio without recording again. ChatGPT Web itself doesn’t offer that same-audio retry.',
        soundCues: ['Muted error cue', 'Retry key tap', 'Processing sweep', 'Clipboard success chime'],
        visualDescription:
          'A failed recognition keeps the stored waveform. Ctrl+F8 resends that same audio and compares GPT-Voice resend with ChatGPT Web record again.',
      },
      {
        id: 'translation',
        narration:
          'Press F11 to translate into the language chosen for your model or task—without opening another translation tool.',
        soundCues: ['Selection sound', 'F11 tap', 'Clipboard tick', 'Paste click'],
        visualDescription:
          'The selected prompt is translated and copied back to the clipboard with source and target language labels.',
      },
      {
        id: 'prettify',
        narration:
          'Prettify removes grammar errors, repetition, and filler while preserving the instructions and meaning you need.',
        soundCues: ['F12 tap', 'Refinement sweep', 'Quiet completion tick'],
        visualDescription:
          'A rough prompt becomes a clearer instruction while the Grammar, Repetition, and Filler cleanup lanes remain visible.',
      },
      {
        id: 'providers',
        narration:
          'With a ChatGPT subscription, recognition is high quality and virtually unlimited—within provider limits.',
        soundCues: ['Soft confirmation tone'],
        visualDescription:
          'The provider selector shows ChatGPT Web, saved session, no API key, and the adjacent provider-limit qualification.',
      },
      {
        id: 'final-cta',
        narration: 'Write better prompts—faster, with less effort.',
        soundCues: ['Four soft rhythmic ticks', 'Logo-resolve chord', 'Music fades to silence'],
        visualDescription:
          'The four actions resolve into the final GPT-Voice poster frame: Speak, Retry, Translate, Refine.',
      },
    ],
  },
  workflow: {
    eyebrow: 'HOW IT WORKS',
    title: 'Three steps to better prompts, faster.',
    lead: 'Transcribe, translate, and refine. Retry only after a voice provider error.',
    transcribe: {
      id: 'transcribe',
      order: '01',
      title: 'Transcribe',
      description:
        'Press F9 to start speaking. Press F9 again to pause or resume, F10 to stop, or Escape to cancel. Successful text is copied to the clipboard and saved in local history.',
      compactResult: 'Copied to clipboard · saved in local history',
      shortcuts: ['F9', 'F10', 'Escape'],
      footnote: 'Remote recognition. No local Whisper model or GPU required.',
    },
    retry: {
      id: 'retry',
      statusLabel: 'OPTIONAL · PROVIDER ERROR',
      title: 'Retry',
      condition: 'Only if the voice provider returns an error.',
      description: 'Press Ctrl+F8 to resend the last in-memory audio without repeating yourself.',
      compactResult: 'Resend retained audio — no re-recording',
      shortcuts: ['Ctrl+F8'],
      comparisonLabel: 'GPT-Voice: resend same audio',
      comparisonNote: 'ChatGPT Web: record again',
      footnote: 'Available until a new recording replaces the audio or the app restarts.',
    },
    translate: {
      id: 'translate',
      order: '02',
      title: 'Translate for clearer model input',
      description:
        'Convert your prompt into the language the model handles best, then paste it back—without opening another translation tool.',
      compactResult: 'Selected text → translated → clipboard',
      compactNote: 'No separate translation tool',
      shortcuts: ['F11'],
      languages: 'English · Russian · Ukrainian · Belarusian',
      footnote: 'Translation can be enabled or disabled in Settings.',
      serviceDetail:
        'GPT-Voice uses Google Translate for this action. The user chooses and reviews the supported target language; the wording does not guarantee that one language is best for every model or task.',
    },
    prettify: {
      id: 'prettify',
      order: '03',
      title: 'Prettify for clearer model input',
      description:
        'Remove grammar errors, repetition, and filler so the model can understand your prompt more clearly—while preserving its instructions and meaning.',
      compactResult: 'Fix grammar, repetition & filler · preserve meaning',
      shortcuts: ['F12', 'Escape'],
      footnote: 'Choose the model, prompt, temperature, and advanced generation settings.',
    },
  },
  providers: {
    eyebrow: 'TRANSCRIPTION PROVIDERS',
    title: 'Two ways to turn speech into prompts.',
    lead: 'Choose a subscription-backed web session or a usage-based API.',
    inputNode: 'YOUR VOICE',
    inputDetail: 'Audio input',
    availableNow: 'Available now',
    futureRouteLegend: 'Future · not available',
    groupDescription:
      'Both supported transcription routes are visible at once and connect to the same voice-input node.',
    chatGptWeb: {
      provider: 'ChatGPT Web',
      status: 'Available now',
      facts: ['Subscription', 'Saved session', 'No API key'],
      claim: 'High-quality, virtually unlimited recognition*',
      qualification:
        'Subject to ChatGPT plan, availability, fair-use, and provider limits. GPT-Voice does not bypass quotas.',
    },
    openAiApi: {
      provider: 'OpenAI API',
      status: 'Available now',
      facts: ['whisper-1', 'Usage based', 'API key + billing/quota'],
    },
    future: {
      blockLabel: 'FUTURE HORIZON · NOT AVAILABLE',
      providers: [
        { provider: 'Claude Web', status: 'Planned' },
        { provider: 'Gemini Web', status: 'Planned' },
      ],
      longerTermCopy: 'More providers may follow where technically and legally viable.',
      qualification: 'No compatibility or timing is promised.',
      independenceNote:
        'GPT-Voice is independent and is not affiliated with or endorsed by OpenAI, Anthropic, or Google.',
    },
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'How GPT-Voice works.',
    items: [
      {
        id: 'record-and-transcribe',
        question: 'How do I record and transcribe speech?',
        answer:
          'Press F9 to start recording. Press F9 again to pause or resume, F10 to stop and send the audio to the selected provider, or Escape to cancel. A successful result is copied to the clipboard and added to local transcription history.',
      },
      {
        id: 'transcription-providers',
        question: 'Which transcription providers can I use?',
        answer:
          'ChatGPT Web and the OpenAI API are available now. ChatGPT Web uses a saved browser session and does not require an API key; the OpenAI API requires your own key with available billing or quota. Planned and possible later integrations are identified separately in the Future horizon · Not available block and are not current providers.',
      },
      {
        id: 'retry',
        question: 'Can I retry without recording again?',
        answer:
          'Yes, but Retry is optional and only needed after a voice provider error—for example, when the last request failed to send or was not processed. Press Ctrl+F8 to resend the same in-memory audio. The cache is replaced when a new recording begins and is not retained after the app restarts.',
      },
      {
        id: 'translation',
        question: 'How does selected-text translation work?',
        answer:
          'Select a prompt in the app you are using and press F11. GPT-Voice sends the selection through Google Translate, then copies the translated result to the clipboard. Choose the supported target language that best suits the model or task—English, Russian, Ukrainian, or Belarusian—without stopping to open a separate translation application or website. Translation can be enabled or disabled; the user should still review the result, and the page does not promise that one language improves every model.',
      },
      {
        id: 'prettify',
        question: 'What does Prettify do?',
        answer:
          'Select rough prompt text and press F12. GPT-Voice sends it to the configured Ollama or vLLM endpoint with your editing prompt and generation settings, then copies the refined text back to the clipboard. The editing goal is to remove grammar errors, repetition, and filler so the model can understand the prompt more clearly while preserving necessary instructions and intended meaning and not inventing facts. This reduces manual correction effort, but clearer model input is a workflow goal rather than a guaranteed improvement in model output; the user should review the generated result. Escape cancels active prettification.',
      },
      {
        id: 'prettify-models',
        question: 'Which Ollama and vLLM models can Prettify use?',
        answer:
          'GPT-Voice uses models exposed by the configured Ollama or vLLM base URL. You can refresh the model list and choose a model, prompt, temperature, and advanced generation settings. Ollama entries may show an approximate memory footprint; model availability and quality depend on your own endpoint.',
      },
      {
        id: 'recognized-text',
        question: 'Where does recognized text go?',
        answer:
          'A successful transcription is copied to the system clipboard so you can paste it into the current editor, AI assistant, agent interface, form, or document. It is also added to local transcription history, where it can be copied again or cleared; GPT-Voice does not automatically type into the destination.',
      },
      {
        id: 'keyboard-shortcuts',
        question: 'Can I customize keyboard shortcuts?',
        answer:
          'Yes. The Settings window lets you change record, stop, cancel, translate, prettify, and resend-transcription shortcuts. Conflict safeguards prevent ambiguous registrations, and the configured global shortcuts work while GPT-Voice runs in the background.',
      },
      {
        id: 'transcription-history',
        question: 'Does GPT-Voice keep transcription history?',
        answer:
          'Yes. Successful recognitions are stored locally in the per-user application directory. You can page through older entries, copy text again, or clear the history; failed attempts are not presented as successful history items.',
      },
      {
        id: 'pause-resume-cancel',
        question: 'Can I pause, resume, or cancel an action?',
        answer:
          'While recording, F9 pauses and resumes, F10 stops and processes, and Escape cancels. Escape can also cancel active prettification. Available actions depend on the current state, and the tray, Command Dock, and notifications report what GPT-Voice is doing.',
      },
      {
        id: 'ollama-vram',
        question: 'How does Ollama VRAM loading and unloading work?',
        answer:
          'You can ask GPT-Voice to pre-load the selected Ollama model into VRAM to reduce first-request latency. The app may show an approximate memory requirement, tracks a model it loaded, and unloads that model when GPT-Voice fully quits. This lifecycle applies to Ollama models loaded by GPT-Voice, not arbitrary models or a remote vLLM server.',
      },
      {
        id: 'platform-support',
        question: 'Which app languages, operating systems, and package formats are supported?',
        answer:
          'The desktop app exposes English, Russian, Ukrainian, and Belarusian interface or target-language choices where supported. Current downloads include a Windows installer and Linux AppImage, deb, and rpm packages. The landing page itself is available in eleven languages; that website localization does not expand the desktop app’s language list. macOS downloads are not promoted until signed and notarized builds are available.',
      },
    ],
  },
  finalCta: {
    title: 'Write better prompts faster, with less effort.',
    lead: 'Speak naturally, translate for the model or task, and clean rough language without opening more tools.',
    primaryCta: 'Download latest release',
    secondaryCta: 'View source on GitHub',
    licenseNote: 'Source available under the PolyForm Noncommercial 1.0.0 license.',
  },
  footer: {
    brand: 'GPT-Voice',
    description: 'Desktop voice-to-text for better AI prompts, faster.',
    links: [
      { label: 'Releases', href: 'latestRelease' },
      { label: 'Repository', href: 'repository' },
      { label: 'Issues', href: 'issues' },
      { label: 'License', href: 'license' },
    ],
    disclaimer: 'Independent project. Not affiliated with OpenAI, Anthropic, or Google.',
    copyright: '© 2026 Dmitry Vasiliev',
  },
  links: {
    latestRelease: 'https://github.com/swimmwatch/gpt-voice/releases/latest',
    repository: 'https://github.com/swimmwatch/gpt-voice',
    issues: 'https://github.com/swimmwatch/gpt-voice/issues',
    license: 'https://github.com/swimmwatch/gpt-voice/blob/main/LICENSE',
  },
} satisfies LandingContent;
