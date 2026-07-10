import type { PrettifyModelOption, PrettifySettings } from '@shared/prettifySettings';

export interface OllamaModelControl {
  isLoaded: boolean;
  model: string;
  vramSizeBytes?: number;
}

export function getOllamaModelControl(
  settings: PrettifySettings | null,
  models: readonly PrettifyModelOption[],
): OllamaModelControl | null {
  if (!settings || settings.providerId !== 'ollama' || !settings.ollama.model) {
    return null;
  }

  const selectedModel = models.find((model) => model.id === settings.ollama.model);
  return {
    isLoaded: Boolean(selectedModel?.isLoaded),
    model: settings.ollama.model,
    vramSizeBytes: selectedModel?.vramSizeBytes,
  };
}
