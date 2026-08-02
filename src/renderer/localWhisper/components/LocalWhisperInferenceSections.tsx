import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@renderer/components/ui/collapsible';
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
import { LocalWhisperField, LocalWhisperOptionSelect, LocalWhisperSection } from './LocalWhisperSection';

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

/** Renders language, prompt, decoding, and CPU-thread controls. */
export default function LocalWhisperInferenceSections({
  snapshot,
  draft,
  errors,
  disabled,
  updateDraft,
}: LocalWhisperInferenceSectionsProps): React.JSX.Element {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const promptLength = countLocalWhisperPromptCodePoints(draft.initialPrompt);

  return (
    <>
      <LocalWhisperSection
        description="Language uses the application’s canonical Whisper language IDs. Prompt text remains renderer-private until Save."
        title="Language & initial prompt"
      >
        <div className="space-y-5">
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

          <fieldset className="min-w-0 space-y-2" disabled={disabled}>
            <legend className="text-sm font-medium text-foreground">Saved initial prompt</legend>
            <p className="text-xs text-muted-foreground">
              {snapshot.hasInitialPrompt
                ? 'A saved prompt exists, but its text is never returned to the renderer.'
                : 'No initial prompt is currently saved.'}
            </p>
            <div className="flex min-w-0 flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-foreground">
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
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  checked={draft.promptMutation === 'replace'}
                  name="local-whisper-prompt-mode"
                  onChange={() => updateDraft((current) => ({ ...current, promptMutation: 'replace' }))}
                  type="radio"
                />
                Replace
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  checked={draft.promptMutation === 'clear'}
                  name="local-whisper-prompt-mode"
                  onChange={() =>
                    updateDraft((current) => ({ ...current, promptMutation: 'clear', initialPrompt: '' }))
                  }
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
                rows={5}
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
        </div>
      </LocalWhisperSection>

      <LocalWhisperSection
        description="Advanced controls start collapsed. Only active strategy/target values are serialized."
        title="Advanced"
      >
        <Collapsible onOpenChange={setAdvancedOpen} open={advancedOpen}>
          <CollapsibleTrigger
            aria-controls="local-whisper-advanced-content"
            className="flex w-full min-w-0 items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Decoding and CPU controls
            <ChevronDown aria-hidden className={advancedOpen ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4" id="local-whisper-advanced-content">
            <div className="space-y-5">
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
                hint="Range 0.00–1.00, step 0.05. Greedy and beam search require 0.00; best-of sampling requires at least 0.05."
                htmlFor="local-whisper-temperature"
                label="Temperature"
              >
                <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                  <input
                    aria-label="Temperature slider"
                    disabled={disabled}
                    max="1"
                    min="0"
                    onChange={(event) =>
                      updateDraft((current) => ({ ...current, temperature: Number(event.target.value).toFixed(2) }))
                    }
                    step="0.05"
                    type="range"
                    value={draft.temperature.replace(',', '.')}
                  />
                  <Input
                    aria-describedby="local-whisper-temperature-error"
                    disabled={disabled}
                    id="local-whisper-temperature"
                    inputMode="decimal"
                    onChange={(event) => updateDraft((current) => ({ ...current, temperature: event.target.value }))}
                    value={draft.temperature}
                  />
                </div>
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
          </CollapsibleContent>
        </Collapsible>
      </LocalWhisperSection>
    </>
  );
}
