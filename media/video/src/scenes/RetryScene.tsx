import type { JSX } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { claims, prompts } from '../data/content';
import { getRetryViewState } from '../data/retryState';
import { getVideoUiState } from '../data/uiFixtures';
import { HotkeyChip } from '../product-ui/HotkeyChip';
import { ProductUiFrame } from '../product-ui/ProductUiFrame';
import { PromptWorkspace } from '../product-ui/PromptWorkspace';
import { StoredAudioCard } from '../product-ui/StoredAudioCard';

function RecoveredPrompt(): JSX.Element {
  return (
    <div>
      <div
        style={{
          background: '#102A26',
          border: '1px solid #34D39977',
          borderRadius: 16,
          color: '#D1FAE5',
          fontSize: 19,
          marginBottom: 16,
          padding: '14px 18px',
        }}
      >
        Same audio, recovered prompt.
      </div>
      <PromptWorkspace frame={0} prompt={prompts.spoken} title="Prompt draft" />
    </div>
  );
}

/** Demonstrates resending the stored recording without another microphone capture. */
export function RetryScene(): JSX.Element {
  const frame = useCurrentFrame();
  const view = getRetryViewState(frame);
  const successOpacity = interpolate(frame, [300, 324], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const spinnerRotation = (frame * 7.3 + 9) % 360;

  return (
    <AbsoluteFill
      data-slot="retry-scene"
      style={{ background: 'radial-gradient(circle at 25% 45%, #3A1626 0%, #12101C 42%, #050914 100%)' }}
    >
      <div style={{ left: 192, position: 'absolute', top: 248 }}>
        <ProductUiFrame scale={1.45} spinnerRotation={spinnerRotation} state={getVideoUiState(view.fixtureId)} />
      </div>
      <section style={{ left: 1000, position: 'absolute', top: 236, width: 590 }}>
        {view.showHotkey ? <HotkeyChip keys={['Ctrl', 'F8']} label="Resend transcription" tone="blue" /> : null}
        {view.showComparison ? (
          <div
            style={{
              background: '#361522',
              border: '1px solid #FB718577',
              borderRadius: 16,
              color: '#FFE4E6',
              fontSize: 18,
              lineHeight: 1.4,
              marginBottom: 16,
              padding: '14px 18px',
            }}
          >
            {claims.chatGptComparison}
          </div>
        ) : null}
        {!view.showRecoveredPrompt ? <StoredAudioCard state={view.storedAudioState} /> : null}
        {view.showRecoveredPrompt ? (
          <div style={{ marginTop: 18, opacity: successOpacity }}>
            <RecoveredPrompt />
          </div>
        ) : null}
      </section>
    </AbsoluteFill>
  );
}
