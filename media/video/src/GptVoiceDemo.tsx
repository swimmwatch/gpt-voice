import { useEffect, useState, type JSX } from 'react';
import { AbsoluteFill, continueRender, delayRender, Sequence } from 'remotion';
import { z } from 'zod';
import { DebugOverlay } from './components/DebugOverlay';
import { scenes } from './data/timeline';
import { ProductBridgeScene } from './scenes/ProductBridgeScene';
import { PromptProblemsScene } from './scenes/PromptProblemsScene';
import { RetryScene } from './scenes/RetryScene';
import { TranscriptionScene } from './scenes/TranscriptionScene';

export interface GptVoiceDemoProps extends Record<string, unknown> {
  effectsMode: 'webgl' | 'fallback';
  debugOverlays: boolean;
}

export const gptVoiceDemoSchema = z.object({
  debugOverlays: z.boolean(),
  effectsMode: z.enum(['webgl', 'fallback']),
});

function useCanonicalRendererStylesReady(): void {
  const [renderHandle] = useState(() => delayRender('Waiting for canonical renderer styles'));

  useEffect(() => {
    const timeout = setTimeout(() => continueRender(renderHandle), 250);

    return () => clearTimeout(timeout);
  }, [renderHandle]);
}

export function GptVoiceDemo({ debugOverlays, effectsMode }: GptVoiceDemoProps): JSX.Element {
  useCanonicalRendererStylesReady();

  return (
    <AbsoluteFill style={{ backgroundColor: '#080B12', color: '#F8FAFC' }}>
      <AbsoluteFill style={{ backgroundColor: effectsMode === 'webgl' ? '#080B12' : '#111827' }} />
      <Sequence durationInFrames={scenes.promptProblems.durationInFrames} from={scenes.promptProblems.from}>
        <PromptProblemsScene durationInFrames={scenes.promptProblems.durationInFrames} />
      </Sequence>
      <Sequence durationInFrames={scenes.productBridge.durationInFrames} from={scenes.productBridge.from}>
        <ProductBridgeScene />
      </Sequence>
      <Sequence durationInFrames={scenes.transcription.durationInFrames} from={scenes.transcription.from}>
        <TranscriptionScene />
      </Sequence>
      <Sequence durationInFrames={scenes.retry.durationInFrames} from={scenes.retry.from}>
        <RetryScene />
      </Sequence>
      {debugOverlays ? (
        <DebugOverlay effectsMode={effectsMode} />
      ) : null}
    </AbsoluteFill>
  );
}
