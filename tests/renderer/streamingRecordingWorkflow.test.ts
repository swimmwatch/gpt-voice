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
    const streaming = readProjectFile('src/renderer/hooks/useStreamingRecordingController.ts');
    const queueConstruction = streaming.indexOf('const queue = new StreamingTranscriptionQueue({');
    const liveCapture = streaming.indexOf('const capturePromise = startLivePcmCapture(stream, {', queueConstruction);

    assert.match(hook, /transcriptionMode: VoiceTranscriptionMode/u);
    assert.match(hook, /recordingModeRef\.current = transcriptionMode;/u);
    assert.match(
      hook,
      /if \(transcriptionMode === 'streaming'\) \{\s*await streamingRecording\.start\(stream, generation\);/u,
    );
    assert.match(streaming, /recordingGenerationRef\.current !== generation/u);
    assert.ok(queueConstruction >= 0 && liveCapture > queueConstruction);
    assert.doesNotMatch(streaming.slice(queueConstruction, liveCapture), /await/u);
    assert.match(streaming, /client: window\.electronAPI/u);
    assert.match(streaming, /onFrame: \(frame\) => queue\.enqueueFrame\(frame\)/u);
  });

  it('routes pause, resume, Stop, cancellation, and explicit Retry through their owned paths', () => {
    const hook = readProjectFile('src/renderer/hooks/useRecording.ts');
    const streaming = readProjectFile('src/renderer/hooks/useStreamingRecordingController.ts');

    assert.match(streaming, /captureRef\.current\?\.pause\(\)/u);
    assert.match(streaming, /captureRef\.current\?\.resume\(\)/u);
    assert.match(streaming, /const finished = await capture\.finish\(\)/u);
    assert.match(streaming, /await queue\.finish\(finished\.finalChunk, finished\.recordingWav\)/u);
    assert.match(streaming, /if \(!ownsRecording\(\)\) return;/u);
    assert.match(streaming, /void queue\.cancel\(\)/u);
    assert.match(hook, /await submitTranscriptionAudio\(retry\.audio, true\)/u);
    assert.match(hook, /window\.electronAPI\.transcribeAudio\(audio\.buffer, audio\.mimeType\)/u);
    assert.doesNotMatch(streaming, /transcribeAudio/u);
  });

  it('retains canonical WAV only for successful or retry-eligible live outcomes', () => {
    const streaming = readProjectFile('src/renderer/hooks/useStreamingRecordingController.ts');

    assert.match(streaming, /mimeType: WAV_TRANSCRIPTION_MIME_TYPE,[\s\S]*transcoded: false,/u);
    assert.match(streaming, /if \(failure\.retryEligible\) \{[\s\S]*capture\?\.finish\(\)/u);
    assert.match(streaming, /if \(retryAudio\) rememberRetryAudio\(retryAudio\)/u);
    assert.match(streaming, /if \(!result\.retryEligible\) clearRetryAudio\(\)/u);
    assert.match(streaming, /if \(result\.success && result\.text\) \{\s*showSuccessfulTranscription/u);
  });

  it('presents typed live failures through a localized safe-message adapter', () => {
    const streaming = readProjectFile('src/renderer/hooks/useStreamingRecordingController.ts');

    assert.match(streaming, /const translationKey = getStreamingTranscriptionFailureTranslationKey\(failure\);/u);
    assert.match(streaming, /showRecognitionError\(undefined, t\(translationKey\), \{ sound: 'error' \}\)/u);
    assert.doesNotMatch(streaming, /showRecognitionError\(failure/u);
  });

  it('cancels only a live recording before provider mutation and during teardown', () => {
    const streaming = readProjectFile('src/renderer/hooks/useStreamingRecordingController.ts');
    const app = readProjectFile('src/renderer/App.tsx');
    const switchStarted = app.indexOf("case 'switch-started'");
    const rendererCancel = app.indexOf('cancelStreamingForProviderChange();', switchStarted);
    const providerMutation = app.indexOf('setActiveProviderId(event.providerId);', switchStarted);

    assert.match(streaming, /if \(recordingModeRef\.current === 'streaming'\) cancel\(false\);/u);
    assert.ok(rendererCancel > switchStarted && rendererCancel < providerMutation);
    assert.match(app, /transcriptionMode: activeProviderTranscriptionMode/u);
    assert.match(streaming, /return \(\) => \{[\s\S]*void queue\.cancel\(\)/u);
    assert.match(streaming, /capturePromiseRef\.current\?\.then\(\(capture\) => capture\.cancel\(\)\)/u);
  });

  it('keeps the established MediaRecorder batch workflow available', () => {
    const hook = readProjectFile('src/renderer/hooks/useRecording.ts');

    assert.match(hook, /new MediaRecorder\(stream, \{ mimeType: selectedMimeType \}\)/u);
    assert.match(hook, /mediaRecorder\.ondataavailable/u);
    assert.match(hook, /const audio = await prepareTranscriptionAudio\(blob\)/u);
    assert.match(hook, /await submitTranscriptionAudio\(audio, false\)/u);
  });
});
