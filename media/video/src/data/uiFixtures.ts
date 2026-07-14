import type { ProductUiFrameState } from '../product-ui/ProductUiFrame';

export const VIDEO_UI_FIXTURE_IDS = [
  'bridgeReady',
  'recordingPrompt',
  'stoppingPrompt',
  'transcribingPrompt',
  'transcriptionCopied',
  'recognitionFailed',
  'retryingStoredAudio',
  'translationSelection',
  'translatingSelection',
  'translationCopied',
  'prettifySelection',
  'prettifyingSelection',
  'prettifiedSelection',
  'chatGptSessionSaved',
  'openAiApiReady',
] as const;

export type VideoUiFixtureId = (typeof VIDEO_UI_FIXTURE_IDS)[number];

export interface VideoUiState extends ProductUiFrameState {
  audio: {
    id: string | null;
    requestAudioId: string | null;
  };
  contentId: string;
  promptMode: 'draft' | 'prettified' | 'rough' | 'selected' | 'translated';
  retryableAudio: 'none' | 'resending' | 'stored';
}

export type VideoUiFixtures = Readonly<Record<VideoUiFixtureId, VideoUiState>>;

const loadedModel = {
  isLoaded: true,
  model: 'llama3.2:3b-instruct-q4_K_M',
  vramSizeBytes: 2_147_483_648,
} as const;

const storedAudio = {
  id: 'spoken-prompt-01',
  requestAudioId: 'spoken-prompt-01',
} as const;

const noAudio = {
  id: null,
  requestAudioId: null,
} as const;

const baseState = {
  activeProviderId: 'chatgpt',
  connection: 'connected',
  lifecycle: 'idle',
  modelControl: loadedModel,
  providerModal: 'closed',
  statusDetail: '',
  targetLang: 'en',
} as const satisfies ProductUiFrameState;

export const videoUiFixtures: VideoUiFixtures = {
  bridgeReady: {
    ...baseState,
    audio: noAudio,
    contentId: 'prompt-bridge-draft',
    promptMode: 'draft',
    retryableAudio: 'none',
  },
  recordingPrompt: {
    ...baseState,
    audio: storedAudio,
    contentId: 'spoken-prompt-01',
    lifecycle: 'recording',
    promptMode: 'draft',
    retryableAudio: 'stored',
  },
  stoppingPrompt: {
    ...baseState,
    audio: storedAudio,
    contentId: 'spoken-prompt-01',
    lifecycle: 'stopping',
    promptMode: 'draft',
    retryableAudio: 'stored',
  },
  transcribingPrompt: {
    ...baseState,
    audio: storedAudio,
    contentId: 'spoken-prompt-01',
    lifecycle: 'transcribing',
    promptMode: 'draft',
    retryableAudio: 'stored',
  },
  transcriptionCopied: {
    ...baseState,
    audio: storedAudio,
    contentId: 'transcribed-prompt-01',
    promptMode: 'draft',
    retryableAudio: 'stored',
    statusDetail: 'Copied to clipboard',
  },
  recognitionFailed: {
    ...baseState,
    audio: storedAudio,
    contentId: 'spoken-prompt-01',
    promptMode: 'draft',
    retryableAudio: 'stored',
    statusDetail: 'Recognition failed',
  },
  retryingStoredAudio: {
    ...baseState,
    audio: storedAudio,
    contentId: 'spoken-prompt-01',
    lifecycle: 'retrying',
    promptMode: 'draft',
    retryableAudio: 'resending',
    statusDetail: 'Resending transcription...',
  },
  translationSelection: {
    ...baseState,
    audio: noAudio,
    contentId: 'translation-source-ru-to-en',
    promptMode: 'selected',
    retryableAudio: 'none',
  },
  translatingSelection: {
    ...baseState,
    audio: noAudio,
    contentId: 'translation-source-ru-to-en',
    promptMode: 'selected',
    retryableAudio: 'none',
    statusDetail: 'Translating selection...',
  },
  translationCopied: {
    ...baseState,
    audio: noAudio,
    contentId: 'translated-prompt-en',
    promptMode: 'translated',
    retryableAudio: 'none',
    statusDetail: 'Translation copied',
  },
  prettifySelection: {
    ...baseState,
    audio: noAudio,
    contentId: 'prettify-rough-to-clear',
    promptMode: 'rough',
    retryableAudio: 'none',
  },
  prettifyingSelection: {
    ...baseState,
    audio: noAudio,
    contentId: 'prettify-rough-to-clear',
    promptMode: 'rough',
    retryableAudio: 'none',
    statusDetail: 'Prettifying selection...',
  },
  prettifiedSelection: {
    ...baseState,
    audio: noAudio,
    contentId: 'prettified-prompt-01',
    promptMode: 'prettified',
    retryableAudio: 'none',
    statusDetail: 'Selection prettified',
  },
  chatGptSessionSaved: {
    ...baseState,
    audio: noAudio,
    contentId: 'chatgpt-session-saved',
    promptMode: 'draft',
    providerModal: 'chatgpt-session-saved',
    retryableAudio: 'none',
  },
  openAiApiReady: {
    ...baseState,
    activeProviderId: 'openai-api',
    audio: noAudio,
    contentId: 'openai-api-ready',
    promptMode: 'draft',
    retryableAudio: 'none',
  },
};

export const VIDEO_UI_PATHS = {
  retry: ['recognitionFailed', 'retryingStoredAudio'],
  translation: ['translationSelection', 'translatingSelection', 'translationCopied'],
} as const satisfies Readonly<Record<string, readonly VideoUiFixtureId[]>>;

export function getVideoUiState(id: VideoUiFixtureId): VideoUiState {
  return videoUiFixtures[id];
}
