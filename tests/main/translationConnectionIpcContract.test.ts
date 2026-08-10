import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('Translation connection IPC contract', () => {
  it('registers the query through trusted IPC and settles provider readiness before successful settings mutations resolve', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const getHandler = ipc.slice(
      ipc.indexOf('this.trustedIpc.handle(TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS.get'),
      ipc.indexOf("this.trustedIpc.handle('get-text-action-settings'"),
    );
    const mutationStart = ipc.indexOf('private registerTranslationSettingsSaveIpc(): void {');
    const mutationEnd = ipc.indexOf('\n  private ', mutationStart + 1);
    assert.notEqual(mutationStart, -1);
    assert.notEqual(mutationEnd, -1);
    const translationMutation = ipc.slice(mutationStart, mutationEnd);

    assert.match(getHandler, /dependencies\.translationRuntime\.getConnectionState\(\)/u);
    assert.match(translationMutation, /saveTranslationSettings\(candidate\)[\s\S]*initializeSelectedProvider\(\)/u);
    assert.match(translationMutation, /await translationRuntime\.initializeSelectedProvider\(\)/u);
    assert.match(translationMutation, /enqueueTranslationSettingsMutation/u);
  });

  it('keeps the functional preload and renderer declarations aligned on named channels', () => {
    const preload = readProjectFile('src/main/preloadApi.ts');
    const rendererTypes = readProjectFile('src/renderer/types.d.ts');

    assert.match(preload, /getTranslationProviderConnection/u);
    assert.match(preload, /onTranslationProviderConnectionChanged/u);
    assert.match(preload, /sanitizeTranslationProviderConnectionState/u);
    assert.match(
      rendererTypes,
      /getTranslationProviderConnection: \(\) => Promise<TranslationProviderConnectionState>/u,
    );
    assert.match(rendererTypes, /onTranslationProviderConnectionChanged/u);
  });

  it('exposes no free-form diagnostic fields in the shared state', () => {
    const shared = readProjectFile('src/shared/translationProvider.ts');
    const stateStart = shared.indexOf('export interface TranslationProviderConnectionState');
    const state = shared.slice(stateStart, shared.indexOf('}', stateStart) + 1);

    assert.match(state, /detail: TranslationProviderConnectionDetail/u);
    assert.match(state, /providerId: TranslationProviderId \| null/u);
    assert.match(state, /targetLanguage: string \| null/u);
    assert.doesNotMatch(state, /error|message|stack|url|path|session|account|credential/iu);
  });
});
