import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('streaming recording workflow', () => {
  it('snapshots provider mode and starts streaming IPC without waiting before live capture', () => {
    const hook = readProjectFile('src/renderer/hooks/useRecording.ts');
    const queueConstruction = hook.indexOf('const queue = new StreamingTranscriptionQueue({');
    const liveCapture = hook.indexOf('const capturePromise = startLivePcmCapture(stream, {', queueConstruction);

    assert.match(hook, /transcriptionMode: VoiceTranscriptionMode/u);
    assert.match(hook, /if \(transcriptionMode === 'streaming'\) \{\s*await startStreamingRecording\(stream\);/u);
    assert.ok(queueConstruction >= 0 && liveCapture > queueConstruction);
    assert.doesNotMatch(hook.slice(queueConstruction, liveCapture), /await/u);
    assert.match(hook, /client: window\.electronAPI/u);
    assert.match(hook, /onFrame: \(frame\) => \{\s*queue\.enqueueFrame\(frame\);/u);
  });

  it('routes pause, resume, Stop, cancellation, and explicit Retry through their owned paths', () => {
    const hook = readProjectFile('src/renderer/hooks/useRecording.ts');
    const streamingStart = hook.indexOf('const startStreamingRecording');
    const batchStart = hook.indexOf('const startRecording');
    const streamingSection = hook.slice(streamingStart, batchStart);

    assert.match(hook, /streamingCaptureRef\.current\?\.pause\(\)/u);
    assert.match(hook, /streamingCaptureRef\.current\?\.resume\(\)/u);
    assert.match(hook, /const finished = await capture\.finish\(\)/u);
    assert.match(hook, /await queue\.finish\(finished\.finalChunk, finished\.recordingWav\)/u);
    assert.match(hook, /void queue\.cancel\(\)/u);
    assert.match(hook, /await submitTranscriptionAudio\(retry\.audio, true\)/u);
    assert.match(hook, /window\.electronAPI\.transcribeAudio\(audio\.buffer, audio\.mimeType\)/u);
    assert.doesNotMatch(streamingSection, /transcribeAudio/u);
  });

  it('retains canonical WAV only for successful or retry-eligible live outcomes', () => {
    const hook = readProjectFile('src/renderer/hooks/useRecording.ts');

    assert.match(hook, /mimeType: WAV_TRANSCRIPTION_MIME_TYPE,[\s\S]*transcoded: false,/u);
    assert.match(hook, /if \(failure\.retryEligible\) \{[\s\S]*capture\?\.finish\(\)/u);
    assert.match(hook, /if \(retryAudio\) rememberLastTranscriptionAudio\(retryAudio\)/u);
    assert.match(hook, /if \(!result\.retryEligible\) clearLastTranscriptionAudio\(\)/u);
    assert.match(hook, /if \(result\.success && result\.text\) \{\s*showSuccessfulTranscription/u);
  });

  it('cancels only a live recording before provider mutation and during teardown', () => {
    const hook = readProjectFile('src/renderer/hooks/useRecording.ts');
    const app = readProjectFile('src/renderer/App.tsx');
    const providerChange = app.indexOf('const handleProviderChange');
    const rendererCancel = app.indexOf('cancelStreamingForProviderChange();', providerChange);
    const providerMutation = app.indexOf('setActiveProviderId(providerId);', providerChange);

    assert.match(hook, /if \(recordingModeRef\.current === 'streaming'\) cancelStreamingRecording\(false\);/u);
    assert.ok(rendererCancel > providerChange && rendererCancel < providerMutation);
    assert.match(app, /transcriptionMode: activeProviderTranscriptionMode/u);
    assert.match(hook, /return \(\) => \{[\s\S]*void queue\.cancel\(\)/u);
    assert.match(hook, /streamingCapturePromiseRef\.current\?\.then\(\(capture\) => capture\.cancel\(\)\)/u);
  });

  it('keeps the established MediaRecorder batch workflow available', () => {
    const hook = readProjectFile('src/renderer/hooks/useRecording.ts');

    assert.match(hook, /new MediaRecorder\(stream, \{ mimeType: selectedMimeType \}\)/u);
    assert.match(hook, /mediaRecorder\.ondataavailable/u);
    assert.match(hook, /const audio = await prepareTranscriptionAudio\(blob\)/u);
    assert.match(hook, /await submitTranscriptionAudio\(audio, false\)/u);
  });
});
