export const LOCAL_WHISPER_LANGUAGE_CATALOG_REVISION = 'local-whisper-languages-v1' as const;

const LOCAL_WHISPER_LANGUAGE_DEFINITIONS = [
  ['en', 'English'],
  ['zh', 'Chinese'],
  ['de', 'German'],
  ['es', 'Spanish'],
  ['ru', 'Russian'],
  ['ko', 'Korean'],
  ['fr', 'French'],
  ['ja', 'Japanese'],
  ['pt', 'Portuguese'],
  ['tr', 'Turkish'],
  ['pl', 'Polish'],
  ['ca', 'Catalan'],
  ['nl', 'Dutch'],
  ['ar', 'Arabic'],
  ['sv', 'Swedish'],
  ['it', 'Italian'],
  ['id', 'Indonesian'],
  ['hi', 'Hindi'],
  ['fi', 'Finnish'],
  ['vi', 'Vietnamese'],
  ['he', 'Hebrew'],
  ['uk', 'Ukrainian'],
  ['el', 'Greek'],
  ['ms', 'Malay'],
  ['cs', 'Czech'],
  ['ro', 'Romanian'],
  ['da', 'Danish'],
  ['hu', 'Hungarian'],
  ['ta', 'Tamil'],
  ['no', 'Norwegian'],
  ['th', 'Thai'],
  ['ur', 'Urdu'],
  ['hr', 'Croatian'],
  ['bg', 'Bulgarian'],
  ['lt', 'Lithuanian'],
  ['la', 'Latin'],
  ['mi', 'Maori'],
  ['ml', 'Malayalam'],
  ['cy', 'Welsh'],
  ['sk', 'Slovak'],
  ['te', 'Telugu'],
  ['fa', 'Persian'],
  ['lv', 'Latvian'],
  ['bn', 'Bengali'],
  ['sr', 'Serbian'],
  ['az', 'Azerbaijani'],
  ['sl', 'Slovenian'],
  ['kn', 'Kannada'],
  ['et', 'Estonian'],
  ['mk', 'Macedonian'],
  ['br', 'Breton'],
  ['eu', 'Basque'],
  ['is', 'Icelandic'],
  ['hy', 'Armenian'],
  ['ne', 'Nepali'],
  ['mn', 'Mongolian'],
  ['bs', 'Bosnian'],
  ['kk', 'Kazakh'],
  ['sq', 'Albanian'],
  ['sw', 'Swahili'],
  ['gl', 'Galician'],
  ['mr', 'Marathi'],
  ['pa', 'Punjabi'],
  ['si', 'Sinhala'],
  ['km', 'Khmer'],
  ['sn', 'Shona'],
  ['yo', 'Yoruba'],
  ['so', 'Somali'],
  ['af', 'Afrikaans'],
  ['oc', 'Occitan'],
  ['ka', 'Georgian'],
  ['be', 'Belarusian'],
  ['tg', 'Tajik'],
  ['sd', 'Sindhi'],
  ['gu', 'Gujarati'],
  ['am', 'Amharic'],
  ['yi', 'Yiddish'],
  ['lo', 'Lao'],
  ['uz', 'Uzbek'],
  ['fo', 'Faroese'],
  ['ht', 'Haitian Creole'],
  ['ps', 'Pashto'],
  ['tk', 'Turkmen'],
  ['nn', 'Nynorsk'],
  ['mt', 'Maltese'],
  ['sa', 'Sanskrit'],
  ['lb', 'Luxembourgish'],
  ['my', 'Myanmar'],
  ['bo', 'Tibetan'],
  ['tl', 'Tagalog'],
  ['mg', 'Malagasy'],
  ['as', 'Assamese'],
  ['tt', 'Tatar'],
  ['haw', 'Hawaiian'],
  ['ln', 'Lingala'],
  ['ha', 'Hausa'],
  ['ba', 'Bashkir'],
  ['jw', 'Javanese'],
  ['su', 'Sundanese'],
  ['yue', 'Cantonese'],
] as const;

type LocalWhisperSpokenLanguageId = (typeof LOCAL_WHISPER_LANGUAGE_DEFINITIONS)[number][0];
export type LocalWhisperLanguageId = 'auto' | LocalWhisperSpokenLanguageId;

export interface LocalWhisperLanguageCatalogEntry {
  readonly id: LocalWhisperLanguageId;
  readonly fallbackLabel: string;
  readonly labelKey: `localWhisper.language.${LocalWhisperLanguageId}`;
  readonly whisperCpp: LocalWhisperSpokenLanguageId | 'auto';
  readonly fasterWhisper: LocalWhisperSpokenLanguageId | null;
}

const AUTO_LANGUAGE_ENTRY: LocalWhisperLanguageCatalogEntry = Object.freeze({
  id: 'auto',
  fallbackLabel: 'Automatic detection',
  labelKey: 'localWhisper.language.auto',
  whisperCpp: 'auto',
  fasterWhisper: null,
});

const SPOKEN_LANGUAGE_ENTRIES: readonly LocalWhisperLanguageCatalogEntry[] = Object.freeze(
  LOCAL_WHISPER_LANGUAGE_DEFINITIONS.map(([id, fallbackLabel]) =>
    Object.freeze({
      id,
      fallbackLabel,
      labelKey: `localWhisper.language.${id}` as const,
      whisperCpp: id,
      fasterWhisper: id,
    }),
  ),
);

export const LOCAL_WHISPER_LANGUAGE_CATALOG: readonly LocalWhisperLanguageCatalogEntry[] = Object.freeze([
  AUTO_LANGUAGE_ENTRY,
  ...SPOKEN_LANGUAGE_ENTRIES,
]);

const LANGUAGE_ENTRY_BY_ID = Object.freeze(
  Object.fromEntries(LOCAL_WHISPER_LANGUAGE_CATALOG.map((entry) => [entry.id, entry])) as Readonly<
    Record<LocalWhisperLanguageId, LocalWhisperLanguageCatalogEntry>
  >,
);

export function isLocalWhisperLanguageId(value: unknown): value is LocalWhisperLanguageId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LANGUAGE_ENTRY_BY_ID, value);
}

export function getLocalWhisperLanguageEntry(value: unknown): LocalWhisperLanguageCatalogEntry | undefined {
  return isLocalWhisperLanguageId(value) ? LANGUAGE_ENTRY_BY_ID[value] : undefined;
}

export function mapLocalWhisperLanguageForWhisperCpp(
  value: unknown,
): LocalWhisperSpokenLanguageId | 'auto' | undefined {
  return getLocalWhisperLanguageEntry(value)?.whisperCpp;
}

export function mapLocalWhisperLanguageForFasterWhisper(
  value: unknown,
): LocalWhisperSpokenLanguageId | null | undefined {
  return getLocalWhisperLanguageEntry(value)?.fasterWhisper;
}
