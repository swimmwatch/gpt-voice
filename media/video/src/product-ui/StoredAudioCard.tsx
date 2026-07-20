import type { JSX } from 'react';

interface StoredAudioCardProps {
  state: 'ready' | 'resending';
}

const waveformHeights = [28, 46, 68, 52, 82, 64, 38, 56, 74, 49, 32, 62, 80, 58, 40, 66, 50, 30] as const;

/** A fixed visual identity for the one stored recording that can be resent. */
export function StoredAudioCard({ state }: StoredAudioCardProps): JSX.Element {
  const isResending = state === 'resending';
  const tone = isResending ? '#60A5FA' : '#FB7185';

  return (
    <article
      aria-label={isResending ? 'Stored audio is being resent' : 'Stored audio is ready to resend'}
      data-slot="stored-audio-card"
      style={{
        background: '#101A2A',
        border: `1px solid ${tone}77`,
        borderRadius: 22,
        boxShadow: `0 18px 44px ${tone}14`,
        color: '#F8FAFC',
        padding: 24,
      }}
    >
      <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <p style={{ color: tone, fontSize: 17, letterSpacing: '0.08em', margin: 0, textTransform: 'uppercase' }}>
            Stored audio
          </p>
          <h2 style={{ fontSize: 29, letterSpacing: '-0.035em', margin: '8px 0 0' }}>
            {isResending ? 'Resending the same recording' : 'Ready to resend'}
          </h2>
        </div>
        <span
          aria-hidden="true"
          style={{
            background: `${tone}22`,
            border: `1px solid ${tone}88`,
            borderRadius: '50%',
            height: 13,
            width: 13,
          }}
        />
      </div>
      <div aria-label="Stored audio waveform" style={{ alignItems: 'center', display: 'flex', gap: 7, height: 110, marginTop: 12 }}>
        {waveformHeights.map((height, index) => (
          <span
            key={index}
            style={{
              background: `linear-gradient(${tone}, ${tone}88)`,
              borderRadius: 999,
              height,
              width: 10,
            }}
          />
        ))}
      </div>
      <p style={{ color: '#B6C5D9', fontSize: 18, margin: '8px 0 0' }}>Captured once · no second recording</p>
    </article>
  );
}
