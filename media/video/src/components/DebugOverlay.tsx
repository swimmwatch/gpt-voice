import type { JSX } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { GptVoiceDemoProps } from '../GptVoiceDemo';

interface DebugOverlayProps {
  effectsMode: GptVoiceDemoProps['effectsMode'];
}

export function DebugOverlay({ effectsMode }: DebugOverlayProps): JSX.Element {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 26, pointerEvents: 'none' }}
    >
      <div style={{ border: '2px dashed #22D3EE', inset: '10%', position: 'absolute' }} />
      <div style={{ backgroundColor: '#080B12CC', left: 48, padding: '12px 16px', position: 'absolute', top: 48 }}>
        GptVoiceDemo · {effectsMode} · frame {frame}
      </div>
    </AbsoluteFill>
  );
}
