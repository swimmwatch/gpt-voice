import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('trusted streaming transcription IPC integration', () => {
  it('keeps all four preload and renderer declarations aligned with the shared result contract', () => {
    const preload = readProjectFile('src/main/preloadApi.ts');
    const rendererTypes = readProjectFile('src/renderer/types.d.ts');
    const contract = readProjectFile('src/shared/streamingTranscription.ts');

    for (const method of [
      'startStreamingTranscription',
      'sendStreamingTranscriptionChunk',
      'finishStreamingTranscription',
      'cancelStreamingTranscription',
    ]) {
      assert.ok(preload.includes(`${method}:`));
      assert.ok(rendererTypes.includes(`${method}:`));
    }
    for (const channel of [
      'start-streaming-transcription',
      'send-streaming-transcription-chunk',
      'finish-streaming-transcription',
      'cancel-streaming-transcription',
    ]) {
      assert.ok(contract.includes(`'${channel}'`));
    }
    assert.match(preload, /operationId: StreamingTranscriptionOperationId/u);
    assert.match(preload, /chunk: Uint8Array/u);
    assert.match(preload, /recordingWav: ArrayBuffer/u);
    assert.match(rendererTypes, /StartStreamingTranscriptionIpcResult/u);
    assert.match(rendererTypes, /FinishStreamingTranscriptionIpcResult/u);
    assert.doesNotMatch(contract, /providerId|organization|session|cacheKey|ownerToken/u);
  });

  it('applies trusted-app validation before the exact main-window controller', () => {
    const ipc = readProjectFile('src/main/ipc.ts');

    assert.match(
      ipc,
      /this\.ipc\.handle\(channel, \(event, \.\.\.args\) => \{\s*this\.assertTrustedSender\(event\);\s*return listener\(event\.sender, \.\.\.args\);/u,
    );
    assert.match(ipc, /return mainWindow && !mainWindow\.isDestroyed\(\) \? mainWindow\.webContents : null;/u);
    assert.match(ipc, /removeHandler: \(channel\) => this\.trustedIpc\.removeStreamingHandler\(channel\)/u);
  });

  it('cancels before browser teardown, provider mutation, and application quit', () => {
    const browser = readProjectFile('src/main/browser.ts');
    const application = readProjectFile('src/main/mainProcessApplication.ts');
    const shutdownStart = browser.indexOf('private async shutdownNow');
    const runHooks = browser.indexOf('await this.runBeforeShutdownHooks();', shutdownStart);
    const providerShutdown = browser.indexOf('await provider.shutdown();', shutdownStart);
    const switchStart = browser.indexOf('public switchProvider');
    const switchShutdown = browser.indexOf('await this.shutdownNow();', switchStart);
    const setProvider = browser.indexOf('this.dependencies.setCurrentProviderId(providerId);', switchStart);
    const quitStart = application.indexOf('private async runQuitCleanup');
    const ipcTeardown = application.indexOf('await runtime?.disposeIpc();', quitStart);
    const browserTeardown = application.indexOf(
      'await this.dependencies.backgroundBrowserService.shutdown();',
      quitStart,
    );

    assert.ok(runHooks > shutdownStart && runHooks < providerShutdown);
    assert.ok(switchShutdown > switchStart && switchShutdown < setProvider);
    assert.ok(ipcTeardown > quitStart && ipcTeardown < browserTeardown);
  });

  it('preserves the existing batch transcription IPC channel', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const preload = readProjectFile('src/main/preloadApi.ts');

    assert.match(ipc, /handle\('transcribe-audio'/u);
    assert.match(preload, /ipcRenderer\.invoke\('transcribe-audio', buffer, mimeType\)/u);
  });
});
