import type { JSX } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { KineticBackdrop } from '../components/KineticBackdrop';
import { prompts } from '../data/content';
import { getTranscriptionViewState, type TranscriptionViewState } from '../data/transcriptionState';
import { getVideoUiState } from '../data/uiFixtures';
import { HotkeyChip } from '../product-ui/HotkeyChip';
import { ProductUiFrame } from '../product-ui/ProductUiFrame';
import { PromptWorkspace } from '../product-ui/PromptWorkspace';
import { VideoCursor } from '../product-ui/VideoCursor';

const stageCardContent = {
  copied: { detail: 'Ready for your next prompt.', title: 'Copied to clipboard', tone: '#34D399' },
  stopping: { detail: 'The recording is closing.', title: 'Stopping…', tone: '#F59E0B' },
  transcribing: { detail: 'The request is being processed.', title: 'Transcribing…', tone: '#60A5FA' },
  waiting: { detail: 'Use the global shortcut when you are ready.', title: 'Start from speech', tone: '#94A3B8' },
} as const;

function AudioInputCard({ frame }: { frame: number }): JSX.Element {
  const bars = Array.from({ length: 18 }, (_, index) => {
    const intensity = 0.32 + Math.abs(Math.sin(frame * 0.19 + index * 0.83)) * 0.68;
    return { height: 18 + intensity * 68, index };
  });

  return (
    <div
      data-slot="live-audio-input"
      style={{
        background: '#101A2A',
        border: '1px solid #EF444477',
        borderRadius: 22,
        color: '#FEE2E2',
        padding: 24,
      }}
    >
      <div style={{ alignItems: 'center', display: 'flex', gap: 10 }}>
        <span aria-hidden="true" style={{ background: '#EF4444', borderRadius: '50%', height: 10, width: 10 }} />
        <span style={{ fontSize: 20, fontWeight: 700 }}>Audio input</span>
      </div>
      <div
        aria-label="Live audio signal"
        style={{ alignItems: 'center', display: 'flex', gap: 7, height: 116, marginTop: 16 }}
      >
        {bars.map((bar) => (
          <span
            key={bar.index}
            style={{
              background: 'linear-gradient(#FDA4AF, #EF4444)',
              borderRadius: 999,
              height: bar.height,
              opacity: 0.72,
              width: 10,
            }}
          />
        ))}
      </div>
      <p style={{ color: '#FCA5A5', fontSize: 17, margin: '4px 0 0' }}>Live sample</p>
    </div>
  );
}

function StageCard({ stage }: Pick<TranscriptionViewState, 'stage'>): JSX.Element {
  const current = stageCardContent[stage === 'recording' ? 'waiting' : stage];

  return (
    <div
      data-slot="transcription-stage-card"
      style={{
        background: '#101A2A',
        border: `1px solid ${current.tone}66`,
        borderRadius: 22,
        boxShadow: `0 18px 42px ${current.tone}14`,
        color: '#F8FAFC',
        padding: 26,
      }}
    >
      <p style={{ color: current.tone, fontSize: 17, letterSpacing: '0.08em', margin: 0, textTransform: 'uppercase' }}>
        Transcription
      </p>
      <h2 style={{ fontSize: 31, letterSpacing: '-0.035em', margin: '11px 0 8px' }}>{current.title}</h2>
      <p style={{ color: '#B6C5D9', fontSize: 20, lineHeight: 1.4, margin: 0 }}>{current.detail}</p>
    </div>
  );
}

/** Demonstrates the actual Command Dock lifecycle from shortcut through deterministic paste. */
export function TranscriptionScene(): JSX.Element {
  const frame = useCurrentFrame();
  const view = getTranscriptionViewState(frame);
  const productOffset = interpolate(frame, [0, 18], [48, 0], { extrapolateRight: 'clamp' });
  const panelOffset = interpolate(frame, [6, 26], [64, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pasteOpacity = interpolate(frame, [540, 552], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const spinnerRotation = (frame * 7.3 + 9) % 360;

  return (
    <AbsoluteFill
      data-slot="transcription-scene"
      style={{ background: 'radial-gradient(circle at 23% 43%, #10365A 0%, #091321 42%, #050914 100%)' }}
    >
      <KineticBackdrop accent="#60A5FA" phase={144} />
      <div style={{ left: 192, position: 'absolute', top: 248, transform: `translateY(${productOffset}px)` }}>
        <ProductUiFrame scale={1.45} spinnerRotation={spinnerRotation} state={getVideoUiState(view.fixtureId)} />
      </div>
      <section
        style={{ left: 1000, position: 'absolute', top: 258, transform: `translateX(${panelOffset}px)`, width: 590 }}
      >
        {view.hotkey === 'F9' ? <HotkeyChip keys={['F9']} label="Start recording" tone="red" /> : null}
        {view.hotkey === 'F10' ? <HotkeyChip keys={['F10']} label="Stop recording" tone="red" /> : null}
        <div style={{ marginTop: view.hotkey ? 18 : 0 }}>
          {view.stage === 'recording' ? <AudioInputCard frame={frame} /> : <StageCard stage={view.stage} />}
        </div>
        {view.showPastedPrompt ? (
          <div style={{ marginTop: 22, opacity: pasteOpacity }}>
            <PromptWorkspace frame={frame} prompt={prompts.spoken} title="Prompt draft" />
            <VideoCursor active opacity={pasteOpacity} x={500} y={304} />
          </div>
        ) : null}
      </section>
    </AbsoluteFill>
  );
}
