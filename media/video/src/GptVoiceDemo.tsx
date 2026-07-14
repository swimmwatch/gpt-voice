import { useEffect, useState, type JSX } from 'react';
import { AbsoluteFill, continueRender, delayRender } from 'remotion';
import { z } from 'zod';
import { DebugOverlay } from './components/DebugOverlay';
import { ProductUiFrame, productUiFramePreviewState } from './product-ui/ProductUiFrame';

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
      {debugOverlays ? (
        <>
          <div style={{ left: 730, position: 'absolute', top: 330 }}>
            <ProductUiFrame spinnerRotation={0} state={productUiFramePreviewState} />
          </div>
          <DebugOverlay effectsMode={effectsMode} />
        </>
      ) : null}
    </AbsoluteFill>
  );
}
