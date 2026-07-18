import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('provider settings IPC contract', () => {
  it('binds login and mutations to the requested provider and emits only safe snapshots', () => {
    const ipcSource = readFileSync(path.join(PROJECT_ROOT, 'src/main/ipc.ts'), 'utf8');
    const preloadSource = readFileSync(path.join(PROJECT_ROOT, 'src/main/preload.ts'), 'utf8');
    const rendererTypes = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/types.d.ts'), 'utf8');

    assert.match(ipcSource, /handle\('provider-login', async \(event, providerId: unknown\)/u);
    assert.match(ipcSource, /provider = createProvider\(providerId\)/u);
    assert.match(ipcSource, /refreshActiveProvider\(provider\.info\.id\)/u);
    assert.match(ipcSource, /sendProviderSettingsChanged\(settings, event\.sender\)/u);
    assert.match(preloadSource, /providerLogin: \(providerId: string\)/u);
    assert.match(preloadSource, /ipcRenderer\.invoke\('provider-login', providerId\)/u);
    assert.match(preloadSource, /getProviders: \(\): Promise<ProviderInfo\[\]>/u);
    assert.match(rendererTypes, /onProviderSettingsChanged: \(callback: \(settings: ProviderSettings\) => void\)/u);
    assert.match(rendererTypes, /export type ProviderInfo = RendererSafeVoiceProviderInfo/u);
    assert.doesNotMatch(preloadSource, /startStreamingTranscription|sendStreamingTranscriptionChunk/u);
    assert.doesNotMatch(rendererTypes, /cookie|organization|storageState|accessToken/u);
  });
});
