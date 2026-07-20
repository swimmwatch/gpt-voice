import { TRANSCRIPTION_MODEL_WHISPER_1 } from './transcriptionConstants';

export const OPENAI_API_TRANSCRIPTION_MODELS = [
  TRANSCRIPTION_MODEL_WHISPER_1,
  'gpt-4o-transcribe',
  'gpt-4o-mini-transcribe',
] as const;

export const OPENAI_API_TRANSCRIPTION_LANGUAGES = [
  'auto',
  'af',
  'ar',
  'hy',
  'az',
  'be',
  'bs',
  'bg',
  'ca',
  'zh',
  'hr',
  'cs',
  'da',
  'nl',
  'en',
  'et',
  'fi',
  'fr',
  'gl',
  'de',
  'el',
  'he',
  'hi',
  'hu',
  'is',
  'id',
  'it',
  'ja',
  'kn',
  'kk',
  'ko',
  'lv',
  'lt',
  'mk',
  'ms',
  'mr',
  'mi',
  'ne',
  'no',
  'fa',
  'pl',
  'pt',
  'ro',
  'ru',
  'sr',
  'sk',
  'sl',
  'es',
  'sw',
  'sv',
  'tl',
  'ta',
  'th',
  'tr',
  'uk',
  'ur',
  'vi',
  'cy',
] as const;

export type OpenAIApiTranscriptionModel = (typeof OPENAI_API_TRANSCRIPTION_MODELS)[number];
export type OpenAIApiTranscriptionLanguage = (typeof OPENAI_API_TRANSCRIPTION_LANGUAGES)[number];

export function isOpenAIApiTranscriptionModel(value: string): value is OpenAIApiTranscriptionModel {
  return OPENAI_API_TRANSCRIPTION_MODELS.includes(value as OpenAIApiTranscriptionModel);
}

export function isOpenAIApiTranscriptionLanguage(value: string): value is OpenAIApiTranscriptionLanguage {
  return OPENAI_API_TRANSCRIPTION_LANGUAGES.includes(value as OpenAIApiTranscriptionLanguage);
}
