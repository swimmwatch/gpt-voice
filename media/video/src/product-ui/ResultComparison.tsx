import type { JSX } from 'react';

interface ResultComparisonProps {
  details?: readonly string[];
  result: string;
  resultLabel?: string;
  showResult: boolean;
  source: string;
  sourceLabel?: string;
}

function TextCard({ children, label, tone }: { children: string; label: string; tone: 'green' | 'rose' }): JSX.Element {
  const colors =
    tone === 'green'
      ? { border: '#34D39977', label: '#6EE7B7', surface: '#102A26' }
      : { border: '#FB718577', label: '#FDA4AF', surface: '#361522' };

  return (
    <article
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: '15px 18px',
      }}
    >
      <p
        style={{
          color: colors.label,
          fontSize: 15,
          letterSpacing: '0.08em',
          margin: '0 0 8px',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </p>
      <p style={{ color: '#F8FAFC', fontSize: 19, lineHeight: 1.45, margin: 0 }}>{children}</p>
    </article>
  );
}

/** Presents a selected prompt and its meaning-preserving refined result. */
export function ResultComparison({
  details = ['Meaning preserved', 'Grammar · Repetition · Filler'],
  result,
  resultLabel = 'Clearer for the model',
  showResult,
  source,
  sourceLabel = 'Selected prompt',
}: ResultComparisonProps): JSX.Element {
  return (
    <section data-slot="result-comparison">
      <TextCard label={sourceLabel} tone="rose">
        {source}
      </TextCard>
      {showResult ? (
        <div style={{ marginTop: 13 }}>
          <TextCard label={resultLabel} tone="green">
            {result}
          </TextCard>
          <div style={{ color: '#A7F3D0', display: 'flex', fontSize: 17, gap: 18, marginTop: 12 }}>
            {details.map((detail) => (
              <span key={detail}>{detail}</span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
