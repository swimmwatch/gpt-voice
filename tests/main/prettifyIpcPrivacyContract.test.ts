import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('Prettify IPC privacy contract', () => {
  it('exposes a dedicated trusted CLI connection check without renderer settings', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const preload = readProjectFile('src/main/preload.ts');
    const rendererTypes = readProjectFile('src/renderer/types.d.ts');
    const settings = readProjectFile('src/shared/prettifySettings.ts');
    const handler = ipc.slice(
      ipc.indexOf("'check-prettify-cli-connection'"),
      ipc.indexOf("handle('set-prettify-settings'"),
    );

    assert.match(settings, /PrettifyCliConnectionResult/u);
    assert.match(preload, /checkPrettifyCliConnection: \(providerId: PrettifyCliProviderId\)/u);
    assert.match(rendererTypes, /checkPrettifyCliConnection: \(providerId: PrettifyCliProviderId\)/u);
    assert.match(handler, /isPrettifyCliProviderId\(providerId\)/u);
    assert.match(handler, /getPrettifySettingsSnapshot\(\)/u);
    assert.match(handler, /event\.sender\.once\('destroyed'/u);
    assert.doesNotMatch(handler, /executablePath|stdout|stderr|account|authStatus/u);
  });

  it('accepts every selectable provider for model inspection', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const preload = readProjectFile('src/main/preload.ts');
    const rendererTypes = readProjectFile('src/renderer/types.d.ts');
    const settings = readProjectFile('src/shared/prettifySettings.ts');
    const modelHandlers = ipc.slice(
      ipc.indexOf("handle(\n    'list-prettify-models'"),
      ipc.indexOf("handle('show-notification'"),
    );

    assert.match(modelHandlers, /providerId: KnownPrettifyProviderId/u);
    assert.match(modelHandlers, /isKnownPrettifyProviderId\(providerId\)/u);
    assert.match(modelHandlers, /assertValidKnownPrettifySettingsInput\(draftSettings\)/u);
    assert.match(preload, /listPrettifyModels: \(\s*providerId: KnownPrettifyProviderId/u);
    assert.match(rendererTypes, /listPrettifyModels: \(\s*providerId: KnownPrettifyProviderId/u);
    assert.match(settings, /ENABLED_PRETTIFY_PROVIDER_IDS = \['ollama', 'vllm', 'claude-cli', 'codex-cli'\]/u);
    assert.match(settings, /KNOWN_PRETTIFY_PROVIDER_IDS = \['ollama', 'vllm', 'claude-cli', 'codex-cli'\]/u);
  });

  it('returns availability and source metadata without logging model or process values', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const settings = readProjectFile('src/shared/prettifySettings.ts');
    const summary = ipc.slice(
      ipc.indexOf('function summarizePrettifySettingsInput'),
      ipc.indexOf('function getTextActionSettingsSnapshot'),
    );
    const modelHandlers = ipc.slice(
      ipc.indexOf("handle(\n    'list-prettify-models'"),
      ipc.indexOf("handle('show-notification'"),
    );

    assert.match(settings, /availability: PrettifyProviderAvailability/u);
    assert.match(settings, /source: PrettifyModelSource/u);
    assert.match(summary, /hasExecutablePath/u);
    assert.match(summary, /modelLength/u);
    assert.match(summary, /fallbackModelLength/u);
    assert.doesNotMatch(summary, /\bmodel:\s*settings/u);
    assert.doesNotMatch(summary, /fallbackModel:\s*settings/u);
    assert.doesNotMatch(modelHandlers, /model:\s*result\.model/u);
    assert.doesNotMatch(modelHandlers, /error:\s*getErrorMessage\(error\)/u);
    assert.match(modelHandlers, /errorName: error instanceof Error \? error\.name : 'unknown'/u);
    assert.match(modelHandlers, /modelCount: result\.models\.length/u);
  });
});
