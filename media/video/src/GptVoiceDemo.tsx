import type { JSX } from 'react';
import { AbsoluteFill } from 'remotion';
import { z } from 'zod';
import { DebugOverlay } from './components/DebugOverlay';

export interface GptVoiceDemoProps extends Record<string, unknown> {
  effectsMode: 'webgl' | 'fallback';
  debugOverlays: boolean;
}

export const gptVoiceDemoSchema = z.object({
  debugOverlays: z.boolean(),
  effectsMode: z.enum(['webgl', 'fallback']),
});

export function GptVoiceDemo({ debugOverlays, effectsMode }: GptVoiceDemoProps): JSX.Element {
  return (
    <AbsoluteFill style={{ backgroundColor: '#080B12', color: '#F8FAFC' }}>
      <AbsoluteFill style={{ backgroundColor: effectsMode === 'webgl' ? '#080B12' : '#111827' }} />
      {debugOverlays ? <DebugOverlay effectsMode={effectsMode} /> : null}
    </AbsoluteFill>
  );
}
