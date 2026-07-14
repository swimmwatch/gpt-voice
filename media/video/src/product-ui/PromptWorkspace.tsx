import type { CSSProperties, JSX } from 'react';
import { interpolate } from 'remotion';

interface PromptWorkspaceProps {
  frame: number;
}

const draftFields = [
  'Goal',
  'Context',
  'Constraints',
  'Examples',
  'Success criteria',
  'Output format',
] as const;

const workspaceStyle: CSSProperties = {
  background: 'linear-gradient(145deg, #152033 0%, #0C1423 56%, #0A101C 100%)',
  border: '1px solid #334155',
  borderRadius: 28,
  boxShadow: '0 32px 80px #02061780',
  color: '#E2E8F0',
  overflow: 'hidden',
};

/** A deliberately generic prompt editor used before the product is introduced. */
export function PromptWorkspace({ frame }: PromptWorkspaceProps): JSX.Element {
  const detailOpacity = interpolate(frame, [0, 72], [0.55, 1], { extrapolateRight: 'clamp' });

  return (
    <section aria-label="Prompt draft workspace" data-slot="prompt-workspace" style={workspaceStyle}>
      <header
        style={{
          alignItems: 'center',
          borderBottom: '1px solid #263447',
          display: 'flex',
          justifyContent: 'space-between',
          padding: '22px 26px',
        }}
      >
        <div>
          <p style={{ color: '#94A3B8', fontSize: 17, letterSpacing: '0.08em', margin: 0, textTransform: 'uppercase' }}>
            Prompt draft
          </p>
          <h2 style={{ fontSize: 28, letterSpacing: '-0.03em', lineHeight: 1.15, margin: '8px 0 0' }}>
            Writing prompts for AI agents and assistants is work
          </h2>
        </div>
        <div
          aria-hidden="true"
          style={{
            backgroundColor: '#17243A',
            border: '1px solid #3B82F6',
            borderRadius: 999,
            boxShadow: '0 0 26px #2563EB45',
            height: 16,
            width: 16,
          }}
        />
      </header>

      <div style={{ opacity: detailOpacity, padding: 26 }}>
        <p style={{ color: '#B6C5D9', fontSize: 20, lineHeight: 1.55, margin: 0 }}>
          A useful request needs deliberate choices before an agent can act on it.
        </p>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            marginTop: 24,
          }}
        >
          {draftFields.map((field, index) => (
            <div
              key={field}
              style={{
                alignItems: 'center',
                backgroundColor: '#101A2A',
                border: '1px solid #2B3A50',
                borderRadius: 12,
                display: 'flex',
                fontSize: 18,
                justifyContent: 'space-between',
                minHeight: 48,
                padding: '0 14px',
              }}
            >
              <span>{field}</span>
              <span aria-hidden="true" style={{ color: index < 2 ? '#F59E0B' : '#64748B', fontWeight: 700 }}>
                ?
              </span>
            </div>
          ))}
        </div>
      </div>

      <footer
        style={{
          backgroundColor: '#0A111D',
          borderTop: '1px solid #263447',
          color: '#94A3B8',
          fontSize: 17,
          padding: '18px 26px',
        }}
      >
        Every missing choice adds friction.
      </footer>
    </section>
  );
}
