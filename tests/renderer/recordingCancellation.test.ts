import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('recording cancellation', () => {
  it('invalidates batch transcription before every late side effect and clears retry ownership', () => {
    const hook = readProjectFile('src/renderer/hooks/useRecording.ts');

    assert.match(hook, /async \(audio: TranscriptionAudioPayload, retry: boolean, generation: number\)/u);
    assert.match(
      hook,
      /const result = await desktopApi\.transcribeAudio\(audio\.buffer, audio\.mimeType\);\s*if \(!ownsRecordingGeneration\(generation\)\) return;/u,
    );
    assert.match(
      hook,
      /const audio = await prepareTranscriptionAudio\(blob\);\s*if \(!ownsRecordingGeneration\(generation\)\) return;/u,
    );
    assert.match(hook, /await submitTranscriptionAudio\(audio, false, generation\)/u);
    assert.match(hook, /recordingGenerationRef\.current \+= 1;\s*clearLastTranscriptionAudio\(\);/u);
    assert.match(
      hook,
      /if \(ownsRecordingGeneration\(generation\)\) \{\s*retryStateRef\.current = finishRetryTranscription/u,
    );
  });

  it('preserves the streaming generation guard so a cancelled live operation cannot publish a late result', () => {
    const streaming = readProjectFile('src/renderer/hooks/useStreamingRecordingController.ts');

    assert.match(streaming, /recordingGenerationRef\.current \+= 1;/u);
    assert.match(
      streaming,
      /const ownsRecording = \(\): boolean =>[\s\S]*recordingGenerationRef\.current === generation;/u,
    );
    assert.match(streaming, /const result = await queue\.finish\([\s\S]*?if \(!ownsRecording\(\)\) return;/u);
    assert.match(streaming, /clearRetryAudio\(\);/u);
  });
});
