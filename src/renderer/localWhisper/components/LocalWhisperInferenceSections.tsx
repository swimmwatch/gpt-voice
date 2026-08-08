import { PiSlidersHorizontal } from 'react-icons/pi';
import { Input } from '@renderer/components/ui/input';
import { Textarea } from '@renderer/components/ui/textarea';
import { useI18n } from '@renderer/hooks/useI18n';
import {
  LOCAL_WHISPER_AUTO_CPU_THREADS,
  LOCAL_WHISPER_LANGUAGE_CATALOG,
  LOCAL_WHISPER_MAX_PROMPT_CODE_POINTS,
  type LocalWhisperDecodingStrategy,
  type LocalWhisperRendererSnapshot,
} from '@shared/localWhisper';
import {
  countLocalWhisperPromptCodePoints,
  type LocalWhisperDraftField,
  type LocalWhisperSettingsDraft,
  type LocalWhisperValidationMessage,
} from '../LocalWhisperSettingsState';
import { LocalWhisperDisclosure, LocalWhisperField, LocalWhisperOptionSelect } from './LocalWhisperSection';

interface LocalWhisperInferenceSectionsProps {
  readonly snapshot: LocalWhisperRendererSnapshot;
  readonly draft: LocalWhisperSettingsDraft;
  readonly errors: Readonly<Partial<Record<LocalWhisperDraftField, LocalWhisperValidationMessage>>>;
  readonly disabled: boolean;
  readonly updateDraft: (updater: (draft: LocalWhisperSettingsDraft) => LocalWhisperSettingsDraft) => void;
}

function strategies(
  translate: ReturnType<typeof useI18n>['t'],
): readonly { readonly id: LocalWhisperDecodingStrategy; readonly label: string }[] {
  return Object.freeze([
    { id: 'greedy', label: translate('localWhisper.settings.strategyGreedy') },
    { id: 'beamSearch', label: translate('localWhisper.settings.strategyBeamSearch') },
    { id: 'bestOfSampling', label: translate('localWhisper.settings.strategyBestOf') },
  ]);
}

function normalizedTemperatureForStrategy(strategy: LocalWhisperDecodingStrategy): string {
  return strategy === 'bestOfSampling' ? '0.20' : '0.00';
}

function languageLabel(
  id: string,
  fallbackLabel: string,
  locale: ReturnType<typeof useI18n>['locale'],
  translate: ReturnType<typeof useI18n>['t'],
): string {
  if (id === 'auto') return translate('localWhisper.settings.auto');
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(id) ?? fallbackLabel;
  } catch {
    return fallbackLabel;
  }
}

function inferenceSummary(
  snapshot: LocalWhisperRendererSnapshot,
  draft: LocalWhisperSettingsDraft,
  locale: ReturnType<typeof useI18n>['locale'],
  translate: ReturnType<typeof useI18n>['t'],
): string {
  const languageEntry = LOCAL_WHISPER_LANGUAGE_CATALOG.find((entry) => entry.id === draft.language);
  const language = languageEntry
    ? languageLabel(languageEntry.id, languageEntry.fallbackLabel, locale, translate)
    : draft.language;
  const prompt =
    draft.promptMutation === 'replace'
      ? translate('localWhisper.settings.summaryNewPrompt')
      : snapshot.hasInitialPrompt
        ? translate('localWhisper.settings.summarySavedPrompt')
        : translate('localWhisper.settings.summaryNoPrompt');
  const strategy =
    strategies(translate).find((entry) => entry.id === draft.decodingStrategy)?.label ?? draft.decodingStrategy;
  const extras = [
    draft.decodingStrategy === 'beamSearch'
      ? translate('localWhisper.settings.summaryBeam', { value: draft.beamSize })
      : null,
    draft.decodingStrategy === 'bestOfSampling'
      ? translate('localWhisper.settings.summaryBestOf', { value: draft.bestOf })
      : null,
    draft.executionTarget === 'cpu'
      ? translate('localWhisper.settings.summaryCpuThreads', {
          value: draft.cpuThreads || translate('localWhisper.settings.auto'),
        })
      : null,
  ].filter((value): value is string => value !== null);
  return [language, prompt, `Temp: ${draft.temperature}`, strategy, ...extras].join(' · ');
}

/** Keeps transcription controls compact until the user expands the disclosure. */
export default function LocalWhisperInferenceSections({
  snapshot,
  draft,
  errors,
  disabled,
  updateDraft,
}: LocalWhisperInferenceSectionsProps): React.JSX.Element {
  const { locale, t } = useI18n();
  const promptLength = countLocalWhisperPromptCodePoints(draft.initialPrompt);

  return (
    <LocalWhisperDisclosure
      className="lw-advanced-disclosure"
      icon={PiSlidersHorizontal}
      summary={inferenceSummary(snapshot, draft, locale, t)}
      title={t('localWhisper.settings.advanced')}
    >
      <div className="lw-advanced-grid">
        <LocalWhisperField
          error={errors.language ? t(errors.language.key, errors.language.params) : undefined}
          htmlFor="local-whisper-language"
          label={t('localWhisper.settings.transcriptionLanguage')}
        >
          <LocalWhisperOptionSelect
            disabled={disabled}
            id="local-whisper-language"
            onChange={(language) => updateDraft((current) => ({ ...current, language: language as never }))}
            options={LOCAL_WHISPER_LANGUAGE_CATALOG.map((entry) => ({
              id: entry.id,
              label: languageLabel(entry.id, entry.fallbackLabel, locale, t),
            }))}
            placeholder={t('localWhisper.settings.selectLanguage')}
            value={draft.language}
          />
        </LocalWhisperField>

        <LocalWhisperField
          error={errors.decodingStrategy ? t(errors.decodingStrategy.key, errors.decodingStrategy.params) : undefined}
          htmlFor="local-whisper-decoding-strategy"
          label={t('localWhisper.settings.decodingStrategy')}
        >
          <LocalWhisperOptionSelect
            disabled={disabled}
            id="local-whisper-decoding-strategy"
            onChange={(decodingStrategy) =>
              updateDraft((current) => ({
                ...current,
                decodingStrategy: decodingStrategy as LocalWhisperDecodingStrategy,
                temperature: normalizedTemperatureForStrategy(decodingStrategy as LocalWhisperDecodingStrategy),
              }))
            }
            options={strategies(t)}
            placeholder={t('localWhisper.settings.selectStrategy')}
            value={draft.decodingStrategy}
          />
        </LocalWhisperField>

        <LocalWhisperField
          error={errors.temperature ? t(errors.temperature.key, errors.temperature.params) : undefined}
          hint={t('localWhisper.settings.temperatureHint')}
          htmlFor="local-whisper-temperature"
          label={t('localWhisper.settings.temperature')}
        >
          <Input
            aria-describedby="local-whisper-temperature-error"
            disabled={disabled}
            id="local-whisper-temperature"
            inputMode="decimal"
            onChange={(event) => updateDraft((current) => ({ ...current, temperature: event.target.value }))}
            value={draft.temperature}
          />
        </LocalWhisperField>

        {draft.decodingStrategy === 'beamSearch' ? (
          <LocalWhisperField
            error={errors.beamSize ? t(errors.beamSize.key, errors.beamSize.params) : undefined}
            htmlFor="local-whisper-beam-size"
            label={t('localWhisper.settings.beamSize')}
          >
            <Input
              disabled={disabled}
              id="local-whisper-beam-size"
              inputMode="numeric"
              max={10}
              min={1}
              onChange={(event) => updateDraft((current) => ({ ...current, beamSize: event.target.value }))}
              type="number"
              value={draft.beamSize}
            />
          </LocalWhisperField>
        ) : null}

        {draft.decodingStrategy === 'bestOfSampling' ? (
          <LocalWhisperField
            error={errors.bestOf ? t(errors.bestOf.key, errors.bestOf.params) : undefined}
            htmlFor="local-whisper-best-of"
            label={t('localWhisper.settings.bestOf')}
          >
            <Input
              disabled={disabled}
              id="local-whisper-best-of"
              inputMode="numeric"
              max={10}
              min={1}
              onChange={(event) => updateDraft((current) => ({ ...current, bestOf: event.target.value }))}
              type="number"
              value={draft.bestOf}
            />
          </LocalWhisperField>
        ) : null}

        {draft.executionTarget === 'cpu' ? (
          <LocalWhisperField
            error={errors.cpuThreads ? t(errors.cpuThreads.key, errors.cpuThreads.params) : undefined}
            hint={t('localWhisper.settings.cpuThreadsHint', { count: String(snapshot.host.logicalProcessorCount) })}
            htmlFor="local-whisper-cpu-threads"
            label={t('localWhisper.settings.cpuThreads')}
          >
            <Input
              disabled={disabled}
              id="local-whisper-cpu-threads"
              inputMode="numeric"
              onChange={(event) => updateDraft((current) => ({ ...current, cpuThreads: event.target.value }))}
              placeholder={LOCAL_WHISPER_AUTO_CPU_THREADS}
              value={draft.cpuThreads}
            />
          </LocalWhisperField>
        ) : null}
      </div>

      <fieldset className="lw-prompt-settings" disabled={disabled}>
        <legend>{t('localWhisper.settings.savedInitialPrompt')}</legend>
        <p>
          {snapshot.hasInitialPrompt
            ? t('localWhisper.settings.savedPromptExists')
            : t('localWhisper.settings.noSavedPrompt')}
        </p>
        <div className="lw-prompt-mode">
          <label className="focus-within:ring-2 focus-within:ring-ring">
            <input
              checked={draft.promptMutation === 'unchanged'}
              name="local-whisper-prompt-mode"
              onChange={() =>
                updateDraft((current) => ({ ...current, promptMutation: 'unchanged', initialPrompt: '' }))
              }
              type="radio"
            />
            {t('localWhisper.settings.keepSaved')}
          </label>
          <label className="focus-within:ring-2 focus-within:ring-ring">
            <input
              checked={draft.promptMutation === 'replace'}
              name="local-whisper-prompt-mode"
              onChange={() => updateDraft((current) => ({ ...current, promptMutation: 'replace' }))}
              type="radio"
            />
            {t('localWhisper.settings.replace')}
          </label>
          <label className="focus-within:ring-2 focus-within:ring-ring">
            <input
              checked={draft.promptMutation === 'clear'}
              name="local-whisper-prompt-mode"
              onChange={() => updateDraft((current) => ({ ...current, promptMutation: 'clear', initialPrompt: '' }))}
              type="radio"
            />
            {t('localWhisper.settings.clearOnSave')}
          </label>
        </div>
      </fieldset>

      {draft.promptMutation === 'replace' ? (
        <LocalWhisperField
          error={errors.initialPrompt ? t(errors.initialPrompt.key, errors.initialPrompt.params) : undefined}
          hint={t('localWhisper.settings.promptHint')}
          htmlFor="local-whisper-prompt"
          label={t('localWhisper.settings.replacementPrompt')}
        >
          <Textarea
            aria-describedby="local-whisper-prompt-counter local-whisper-prompt-error"
            disabled={disabled}
            id="local-whisper-prompt"
            onChange={(event) => updateDraft((current) => ({ ...current, initialPrompt: event.target.value }))}
            rows={4}
            value={draft.initialPrompt}
          />
          <p
            className={
              promptLength > LOCAL_WHISPER_MAX_PROMPT_CODE_POINTS
                ? 'text-xs text-destructive'
                : 'text-xs text-muted-foreground'
            }
            id="local-whisper-prompt-counter"
          >
            {t('localWhisper.settings.promptCodePoints', {
              current: String(promptLength),
              maximum: String(LOCAL_WHISPER_MAX_PROMPT_CODE_POINTS),
            })}
          </p>
        </LocalWhisperField>
      ) : null}
    </LocalWhisperDisclosure>
  );
}
