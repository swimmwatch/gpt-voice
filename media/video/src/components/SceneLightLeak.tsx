import { LightLeak } from '@remotion/light-leaks';
import type { JSX } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';

interface SceneLightLeakProps {
  from: number;
  hueShift: number;
  seed: number;
}

/** Renders one fixed-seed, bounded transition accent behind the scene's critical content. */
export function SceneLightLeak({ from, hueShift, seed }: SceneLightLeakProps): JSX.Element {
  return (
    <Sequence durationInFrames={24} from={from}>
      <AbsoluteFill
        aria-hidden
        style={{
          filter: 'blur(12px)',
          opacity: 0.12,
          overflow: 'hidden',
          pointerEvents: 'none',
          transform: 'scale(1.08)',
        }}
      >
        <LightLeak height={1080} hueShift={hueShift} seed={seed} width={1920} />
      </AbsoluteFill>
    </Sequence>
  );
}
