import type { JSX } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { KineticBackdrop } from '../components/KineticBackdrop';
import { PromptProblemMap } from '../product-ui/PromptProblemMap';
import { PromptWorkspace } from '../product-ui/PromptWorkspace';

interface PromptProblemsSceneProps {
  durationInFrames: number;
}

/** The product-free opening: prompt-writing friction only. */
export function PromptProblemsScene({ durationInFrames }: PromptProblemsSceneProps): JSX.Element {
  const frame = useCurrentFrame();
  const exitOpacity = interpolate(frame, [durationInFrames - 72, durationInFrames - 1], [1, 0.16], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const interruptionOpacity = interpolate(frame, [690, 714], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      data-slot="prompt-problems-scene"
      style={{
        background: 'radial-gradient(circle at 20% 30%, #162A4B 0%, #080E1A 39%, #050914 100%)',
        opacity: exitOpacity,
      }}
    >
      <KineticBackdrop accent="#60A5FA" phase={0} />
      <div
        aria-hidden="true"
        style={{
          background: 'radial-gradient(circle, #2563EB30 0%, transparent 68%)',
          borderRadius: '50%',
          height: 760,
          left: -250,
          position: 'absolute',
          top: 90,
          width: 760,
        }}
      />
      <div style={{ left: 192, position: 'absolute', top: 214, width: 700 }}>
        <PromptWorkspace frame={frame} />
      </div>
      <div style={{ left: 960, position: 'absolute', top: 228, width: 576 }}>
        <PromptProblemMap frame={frame} />
        <div
          style={{
            alignItems: 'center',
            backgroundColor: '#361522',
            border: '1px solid #FB718560',
            borderRadius: 14,
            color: '#FED7E2',
            display: 'flex',
            fontSize: 19,
            gap: 10,
            marginTop: 18,
            opacity: interruptionOpacity,
            padding: '15px 18px',
          }}
        >
          <span aria-hidden="true" style={{ color: '#FB7185' }}>
            !
          </span>
          One interruption can break the flow.
        </div>
      </div>
    </AbsoluteFill>
  );
}
