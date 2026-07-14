import type { CSSProperties, JSX } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { KineticBackdrop } from '../components/KineticBackdrop';
import { claims, productLabels } from '../data/content';
import { getVideoUiState } from '../data/uiFixtures';
import { ProductUiFrame } from '../product-ui/ProductUiFrame';

const productActions = [
  { action: 'Transcribe', mapsTo: 'Speak a first draft', tone: '#60A5FA' },
  { action: 'Retry', mapsTo: 'Resend stored audio', tone: '#FB7185' },
  { action: 'Translate', mapsTo: 'Choose the task language', tone: '#C084FC' },
  { action: 'Prettify', mapsTo: 'Remove distracting language', tone: '#34D399' },
] as const;

function actionStyle(tone: string, opacity: number, translateY: number): CSSProperties {
  return {
    alignItems: 'center',
    background: '#101A2A',
    border: `1px solid ${tone}66`,
    borderRadius: 16,
    boxShadow: `0 12px 30px ${tone}12`,
    display: 'flex',
    justifyContent: 'space-between',
    opacity,
    padding: '15px 18px',
    transform: `translateY(${translateY}px)`,
  };
}

/** Introduces the canonical Command Dock and its bounded, user-controlled workflow. */
export function ProductBridgeScene(): JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const productReveal = spring({ config: { damping: 20, mass: 0.8, stiffness: 130 }, fps, frame });
  const copyOpacity = interpolate(frame, [6, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      data-slot="product-bridge-scene"
      style={{ background: 'radial-gradient(circle at 75% 42%, #0E315A 0%, #091321 41%, #050914 100%)' }}
    >
      <KineticBackdrop accent="#38BDF8" phase={42} />
      <div
        aria-hidden="true"
        style={{
          background: 'radial-gradient(circle, #38BDF840 0%, #2563EB16 36%, transparent 72%)',
          borderRadius: '50%',
          height: 940,
          position: 'absolute',
          right: -140,
          top: 46,
          width: 940,
        }}
      />
      <section style={{ left: 192, opacity: copyOpacity, position: 'absolute', top: 234, width: 650 }}>
        <p
          style={{
            color: '#7DD3FC',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '0.08em',
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          GPT-Voice
        </p>
        <h1 style={{ fontSize: 58, letterSpacing: '-0.05em', lineHeight: 1.02, margin: '16px 0 18px' }}>
          {productLabels.promptFirst}
        </h1>
        <p style={{ color: '#CBD5E1', fontSize: 25, lineHeight: 1.42, margin: 0 }}>{claims.control}</p>
        <div style={{ display: 'grid', gap: 12, marginTop: 40 }}>
          {productActions.map(({ action, mapsTo, tone }, index) => {
            const progress = spring({ config: { damping: 18, stiffness: 160 }, delay: 32 + index * 18, fps, frame });
            return (
              <div key={action} style={actionStyle(tone, progress, (1 - progress) * 20)}>
                <span style={{ color: tone, fontSize: 21, fontWeight: 700 }}>{action}</span>
                <span style={{ color: '#B6C5D9', fontSize: 18 }}>
                  {mapsTo} <span aria-hidden="true">→</span>
                </span>
              </div>
            );
          })}
        </div>
        <p style={{ color: '#94A3B8', fontSize: 19, margin: '28px 0 0' }}>{productLabels.actions}</p>
      </section>

      <div
        style={{
          opacity: 1,
          position: 'absolute',
          right: 206,
          top: 228 + (1 - productReveal) * 26,
          transform: `scale(${0.92 + productReveal * 0.08})`,
          transformOrigin: 'top right',
        }}
      >
        <ProductUiFrame scale={1.45} spinnerRotation={(frame * 7) % 360} state={getVideoUiState('bridgeReady')} />
      </div>
    </AbsoluteFill>
  );
}
