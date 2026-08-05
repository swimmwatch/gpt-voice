import { PiSlidersHorizontal } from 'react-icons/pi';
import { Input } from '@renderer/components/ui/input';
import { Textarea } from '@renderer/components/ui/textarea';
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
} from '../LocalWhisperSettingsState';
import { LocalWhisperDisclosure, LocalWhisperField, LocalWhisperOptionSelect } from './LocalWhisperSection';

interface LocalWhisperInferenceSectionsProps {
  readonly snapshot: LocalWhisperRendererSnapshot;
  readonly draft: LocalWhisperSettingsDraft;
  readonly errors: Readonly<Partial<Record<LocalWhisperDraftField, string>>>;
  readonly disabled: boolean;
  readonly updateDraft: (updater: (draft: LocalWhisperSettingsDraft) => LocalWhisperSettingsDraft) => void;
}

const STRATEGIES: readonly { readonly id: LocalWhisperDecodingStrategy; readonly label: string }[] = Object.freeze([
  { id: 'greedy', label: 'Greedy' },
  { id: 'beamSearch', label: 'Beam search' },
  { id: 'bestOfSampling', label: 'Best-of sampling' },
]);

function normalizedTemperatureForStrategy(strategy: LocalWhisperDecodingStrategy): string {
  return strategy === 'bestOfSampling' ? '0.20' : '0.00';
}

function inferenceSummary(snapshot: LocalWhisperRendererSnapshot, draft: LocalWhisperSettingsDraft): string {
  const language =
    LOCAL_WHISPER_LANGUAGE_CATALOG.find((entry) => entry.id === draft.language)?.fallbackLabel ?? draft.language;
  const prompt =
    draft.promptMutation === 'replace' ? 'New prompt' : snapshot.hasInitialPrompt ? 'Saved prompt' : 'Prompt: (none)';
  const strategy = STRATEGIES.find((entry) => entry.id === draft.decodingStrategy)?.label ?? draft.decodingStrategy;
  const extras = [
    draft.decodingStrategy === 'beamSearch' ? `Beam: ${draft.beamSize}` : null,
    draft.decodingStrategy === 'bestOfSampling' ? `Best of: ${draft.bestOf}` : null,
    draft.executionTarget === 'cpu' ? `CPU threads: ${draft.cpuThreads || 'Auto'}` : null,
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
  const promptLength = countLocalWhisperPromptCodePoints(draft.initialPrompt);

  return (
    <LocalWhisperDisclosure
      className="lw-advanced-disclosure"
      icon={PiSlidersHorizontal}
      summary={inferenceSummary(snapshot, draft)}
      title="Transcription & advanced"
    >
      <div className="lw-advanced-grid">
        <LocalWhisperField error={errors.language} htmlFor="local-whisper-language" label="Transcription language">
          <LocalWhisperOptionSelect
            disabled={disabled}
            id="local-whisper-language"
            onChange={(language) => updateDraft((current) => ({ ...current, language: language as never }))}
            options={LOCAL_WHISPER_LANGUAGE_CATALOG.map((entry) => ({
              id: entry.id,
              label: entry.fallbackLabel,
            }))}
            placeholder="Select language"
            value={draft.language}
          />
        </LocalWhisperField>

        <LocalWhisperField
          error={errors.decodingStrategy}
          htmlFor="local-whisper-decoding-strategy"
          label="Decoding strategy"
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
            options={STRATEGIES}
            placeholder="Select strategy"
            value={draft.decodingStrategy}
          />
        </LocalWhisperField>

        <LocalWhisperField
          error={errors.temperature}
          hint="Range 0.00–1.00, step 0.05."
          htmlFor="local-whisper-temperature"
          label="Temperature"
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
          <LocalWhisperField error={errors.beamSize} htmlFor="local-whisper-beam-size" label="Beam size">
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
          <LocalWhisperField error={errors.bestOf} htmlFor="local-whisper-best-of" label="Best of">
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
            error={errors.cpuThreads}
            hint={`Use auto or an integer from 1 to ${snapshot.host.logicalProcessorCount}.`}
            htmlFor="local-whisper-cpu-threads"
            label="CPU threads"
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
        <legend>Saved initial prompt</legend>
        <p>
          {snapshot.hasInitialPrompt
            ? 'A saved prompt exists, but its text is never returned to the renderer.'
            : 'No initial prompt is currently saved.'}
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
            Keep saved value
          </label>
          <label className="focus-within:ring-2 focus-within:ring-ring">
            <input
              checked={draft.promptMutation === 'replace'}
              name="local-whisper-prompt-mode"
              onChange={() => updateDraft((current) => ({ ...current, promptMutation: 'replace' }))}
              type="radio"
            />
            Replace
          </label>
          <label className="focus-within:ring-2 focus-within:ring-ring">
            <input
              checked={draft.promptMutation === 'clear'}
              name="local-whisper-prompt-mode"
              onChange={() => updateDraft((current) => ({ ...current, promptMutation: 'clear', initialPrompt: '' }))}
              type="radio"
            />
            Clear on Save
          </label>
        </div>
      </fieldset>

      {draft.promptMutation === 'replace' ? (
        <LocalWhisperField
          error={errors.initialPrompt}
          hint="NUL and invalid Unicode scalars are rejected."
          htmlFor="local-whisper-prompt"
          label="Replacement prompt"
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
            {promptLength} / {LOCAL_WHISPER_MAX_PROMPT_CODE_POINTS} Unicode code points
          </p>
        </LocalWhisperField>
      ) : null}
    </LocalWhisperDisclosure>
  );
}
