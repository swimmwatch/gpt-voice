import type { JSX } from 'react';

interface ResultComparisonProps {
  result: string;
  showResult: boolean;
  source: string;
}

function TextCard({ children, label, tone }: { children: string; label: string; tone: 'green' | 'rose' }): JSX.Element {
  const colors = tone === 'green' ? { border: '#34D39977', label: '#6EE7B7', surface: '#102A26' } : { border: '#FB718577', label: '#FDA4AF', surface: '#361522' };

  return (
    <article style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '15px 18px' }}>
      <p style={{ color: colors.label, fontSize: 15, letterSpacing: '0.08em', margin: '0 0 8px', textTransform: 'uppercase' }}>
        {label}
      </p>
      <p style={{ color: '#F8FAFC', fontSize: 19, lineHeight: 1.45, margin: 0 }}>{children}</p>
    </article>
  );
}

/** Presents a selected prompt and its meaning-preserving refined result. */
export function ResultComparison({ result, showResult, source }: ResultComparisonProps): JSX.Element {
  return (
    <section data-slot="result-comparison">
      <TextCard label="Selected prompt" tone="rose">
        {source}
      </TextCard>
      {showResult ? (
        <div style={{ marginTop: 13 }}>
          <TextCard label="Clearer for the model" tone="green">
            {result}
          </TextCard>
          <div style={{ color: '#A7F3D0', display: 'flex', fontSize: 17, gap: 18, marginTop: 12 }}>
            <span>Meaning preserved</span>
            <span>Grammar · Repetition · Filler</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
