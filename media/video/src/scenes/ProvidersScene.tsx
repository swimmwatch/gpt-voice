import type { JSX } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { claims } from '../data/content';
import { getProvidersViewState } from '../data/providersState';
import { getVideoUiState } from '../data/uiFixtures';
import { KineticBackdrop } from '../components/KineticBackdrop';
import { ProductUiFrame } from '../product-ui/ProductUiFrame';

function ProviderQualification(): JSX.Element {
  return (
    <aside
      data-slot="provider-qualification"
      style={{
        background: 'linear-gradient(145deg, #17223B 0%, #101827 100%)',
        border: '1px solid #60A5FA66',
        borderRadius: 22,
        boxShadow: '0 20px 54px #02061766',
        padding: 28,
      }}
    >
      <p style={{ color: '#93C5FD', fontSize: 17, letterSpacing: '0.1em', margin: 0, textTransform: 'uppercase' }}>
        Provider choice
      </p>
      <h2 style={{ fontSize: 34, letterSpacing: '-0.035em', lineHeight: 1.12, margin: '10px 0 18px' }}>
        ChatGPT Web or OpenAI API
      </h2>
      <div style={{ display: 'grid', gap: 7, marginBottom: 18 }}>
        <p style={{ color: '#E2E8F0', fontSize: 18, margin: 0 }}>
          ChatGPT Web <span style={{ color: '#94A3B8' }}>· Implemented web provider</span>
        </p>
        <p style={{ color: '#E2E8F0', fontSize: 18, margin: 0 }}>
          OpenAI API <span style={{ color: '#94A3B8' }}>· API alternative</span>
        </p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <span style={{ background: '#173251', borderRadius: 999, color: '#BFDBFE', fontSize: 18, padding: '8px 12px' }}>
          {claims.providerRecognition}
        </span>
        <span style={{ background: '#102A26', borderRadius: 999, color: '#A7F3D0', fontSize: 18, padding: '8px 12px' }}>
          {claims.providerScale}
        </span>
      </div>
      <p style={{ color: '#CBD5E1', fontSize: 18, lineHeight: 1.45, margin: '20px 0 0' }}>
        {claims.providerQualification}
      </p>
    </aside>
  );
}

/** Shows the canonical provider choices and the saved ChatGPT Web session without exposing session data. */
export function ProvidersScene(): JSX.Element {
  const frame = useCurrentFrame();
  const view = getProvidersViewState(frame);
  const productOffset = interpolate(frame, [0, 18], [48, 0], { extrapolateRight: 'clamp' });
  const panelOffset = interpolate(frame, [4, 24], [72, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      data-slot="providers-scene"
      style={{ background: 'radial-gradient(circle at 74% 38%, #26204D 0%, #121426 42%, #050914 100%)' }}
    >
      <KineticBackdrop accent="#A78BFA" phase={108} />
      <div style={{ left: 192, position: 'absolute', top: 248, transform: `translateY(${productOffset}px)` }}>
        <ProductUiFrame scale={1.45} spinnerRotation={0} state={getVideoUiState(view.fixtureId)} />
      </div>
      <div
        style={{
          left: 1240,
          position: 'absolute',
          top: 284,
          transform: `translateX(${panelOffset}px)`,
          width: 500,
          zIndex: 60,
        }}
      >
        <ProviderQualification />
      </div>
    </AbsoluteFill>
  );
}
